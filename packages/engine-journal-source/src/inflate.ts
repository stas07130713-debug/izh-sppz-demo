/**
 * Распаковка потока deflate (RFC 1951) без внешних библиотек и без Node.
 *
 * Зачем свой код вместо библиотеки. Движок обязан работать и в окне программы,
 * и в основном процессе, и в тестах — то есть не может опираться на `node:zlib`.
 * Браузерный `DecompressionStream` асинхронный, а контракт движка синхронный,
 * потому что ядро сопоставляет колонки без ожидания. Формат deflate невелик и
 * стабилен с 1996 года: здесь ровно столько кода, сколько нужно для чтения
 * xlsx, и он не меняется вслед за версиями библиотек.
 *
 * Разбор идёт по спецификации: блоки бывают без сжатия, с фиксированными
 * кодами Хаффмана и с динамическими. Реализованы все три.
 */

/** Чтение потока по битам: deflate хранит коды не по границам байтов. */
class BitReader {
  private bytePos = 0;
  private bitPos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  readBit(): number {
    const byte = this.bytes[this.bytePos];
    if (byte === undefined) throw new Error('Поток deflate закончился раньше времени');
    const bit = (byte >> this.bitPos) & 1;
    this.bitPos += 1;
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos += 1;
    }
    return bit;
  }

  /** Число из нескольких бит, младший бит первым. */
  readBits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i += 1) value |= this.readBit() << i;
    return value;
  }

  /** Выравнивание на границу байта — нужно перед несжатым блоком. */
  alignToByte(): void {
    if (this.bitPos !== 0) {
      this.bitPos = 0;
      this.bytePos += 1;
    }
  }

  readBytes(count: number): Uint8Array {
    const slice = this.bytes.subarray(this.bytePos, this.bytePos + count);
    this.bytePos += count;
    return slice;
  }
}

/**
 * Дерево Хаффмана в каноническом виде.
 *
 * Хранится не деревом, а таблицами: для каждой длины кода известны первый код
 * и смещение в списке значений. Так декодирование идёт без переходов по узлам.
 */
interface HuffmanTable {
  readonly counts: readonly number[];
  readonly symbols: readonly number[];
}

function buildHuffman(lengths: readonly number[]): HuffmanTable {
  const maxBits = 15;
  const counts = new Array<number>(maxBits + 1).fill(0);
  for (const length of lengths) if (length > 0) counts[length] = (counts[length] ?? 0) + 1;

  const offsets = new Array<number>(maxBits + 2).fill(0);
  for (let bits = 1; bits <= maxBits; bits += 1) {
    offsets[bits + 1] = (offsets[bits] ?? 0) + (counts[bits] ?? 0);
  }

  const symbols = new Array<number>(lengths.filter((length) => length > 0).length).fill(0);
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const length = lengths[symbol] ?? 0;
    if (length === 0) continue;
    const position = offsets[length] ?? 0;
    symbols[position] = symbol;
    offsets[length] = position + 1;
  }

  return { counts, symbols };
}

function decodeSymbol(reader: BitReader, table: HuffmanTable): number {
  let code = 0;
  let first = 0;
  let index = 0;

  for (let length = 1; length <= 15; length += 1) {
    code |= reader.readBit();
    const count = table.counts[length] ?? 0;
    if (code - first < count) {
      const symbol = table.symbols[index + (code - first)];
      if (symbol === undefined) throw new Error('Некорректный код Хаффмана');
      return symbol;
    }
    index += count;
    first = (first + count) << 1;
    code <<= 1;
  }

  throw new Error('Код Хаффмана длиннее 15 бит');
}

/** Таблицы длин и расстояний из спецификации deflate. */
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

function fixedTables(): { literals: HuffmanTable; distances: HuffmanTable } {
  const literalLengths = new Array<number>(288);
  for (let i = 0; i < 144; i += 1) literalLengths[i] = 8;
  for (let i = 144; i < 256; i += 1) literalLengths[i] = 9;
  for (let i = 256; i < 280; i += 1) literalLengths[i] = 7;
  for (let i = 280; i < 288; i += 1) literalLengths[i] = 8;

  return {
    literals: buildHuffman(literalLengths),
    distances: buildHuffman(new Array<number>(30).fill(5)),
  };
}

/** Порядок длин кодов в динамическом блоке — тоже из спецификации. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function dynamicTables(reader: BitReader): { literals: HuffmanTable; distances: HuffmanTable } {
  const literalCount = reader.readBits(5) + 257;
  const distanceCount = reader.readBits(5) + 1;
  const codeLengthCount = reader.readBits(4) + 4;

  const codeLengths = new Array<number>(19).fill(0);
  for (let i = 0; i < codeLengthCount; i += 1) {
    const position = CODE_LENGTH_ORDER[i];
    if (position !== undefined) codeLengths[position] = reader.readBits(3);
  }
  const codeLengthTable = buildHuffman(codeLengths);

  const lengths: number[] = [];
  while (lengths.length < literalCount + distanceCount) {
    const symbol = decodeSymbol(reader, codeLengthTable);

    if (symbol < 16) {
      lengths.push(symbol);
    } else if (symbol === 16) {
      // Повторить предыдущую длину 3–6 раз.
      const previous = lengths[lengths.length - 1];
      if (previous === undefined) throw new Error('Повтор длины без предыдущего значения');
      const repeat = reader.readBits(2) + 3;
      for (let i = 0; i < repeat; i += 1) lengths.push(previous);
    } else if (symbol === 17) {
      const repeat = reader.readBits(3) + 3;
      for (let i = 0; i < repeat; i += 1) lengths.push(0);
    } else {
      const repeat = reader.readBits(7) + 11;
      for (let i = 0; i < repeat; i += 1) lengths.push(0);
    }
  }

  return {
    literals: buildHuffman(lengths.slice(0, literalCount)),
    distances: buildHuffman(lengths.slice(literalCount, literalCount + distanceCount)),
  };
}

/**
 * Распаковывает поток deflate без заголовка zlib (raw deflate) — именно так
 * данные лежат внутри zip, а значит и внутри xlsx.
 */
export function inflateRaw(bytes: Uint8Array): Uint8Array {
  const reader = new BitReader(bytes);
  // Выходной размер заранее неизвестен, поэтому буфер растёт по мере надобности.
  let out = new Uint8Array(Math.max(1024, bytes.length * 4));
  let outPos = 0;

  const ensure = (extra: number): void => {
    if (outPos + extra <= out.length) return;
    let size = out.length * 2;
    while (size < outPos + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(out.subarray(0, outPos));
    out = grown;
  };

  for (;;) {
    const isLast = reader.readBit() === 1;
    const type = reader.readBits(2);

    if (type === 0) {
      // Без сжатия: длина, её дополнение, затем сами байты.
      reader.alignToByte();
      const header = reader.readBytes(4);
      const length = (header[0] ?? 0) | ((header[1] ?? 0) << 8);
      const raw = reader.readBytes(length);
      ensure(length);
      out.set(raw, outPos);
      outPos += length;
    } else if (type === 1 || type === 2) {
      const { literals, distances } = type === 1 ? fixedTables() : dynamicTables(reader);

      for (;;) {
        const symbol = decodeSymbol(reader, literals);
        if (symbol === 256) break;

        if (symbol < 256) {
          ensure(1);
          out[outPos] = symbol;
          outPos += 1;
          continue;
        }

        const lengthIndex = symbol - 257;
        const baseLength = LENGTH_BASE[lengthIndex];
        const extraLengthBits = LENGTH_EXTRA[lengthIndex];
        if (baseLength === undefined || extraLengthBits === undefined) {
          throw new Error(`Некорректный код длины: ${symbol}`);
        }
        const length = baseLength + reader.readBits(extraLengthBits);

        const distanceSymbol = decodeSymbol(reader, distances);
        const baseDistance = DISTANCE_BASE[distanceSymbol];
        const extraDistanceBits = DISTANCE_EXTRA[distanceSymbol];
        if (baseDistance === undefined || extraDistanceBits === undefined) {
          throw new Error(`Некорректный код расстояния: ${distanceSymbol}`);
        }
        const distance = baseDistance + reader.readBits(extraDistanceBits);

        // Копирование из уже распакованного: ссылка назад по потоку.
        ensure(length);
        let from = outPos - distance;
        if (from < 0) throw new Error('Ссылка за пределы распакованных данных');
        for (let i = 0; i < length; i += 1) {
          out[outPos] = out[from] ?? 0;
          outPos += 1;
          from += 1;
        }
      }
    } else {
      throw new Error(`Неизвестный тип блока deflate: ${type}`);
    }

    if (isLast) break;
  }

  return out.subarray(0, outPos);
}
