/**
 * Чтение zip-архива: ровно столько, сколько нужно для xlsx.
 *
 * Файлы читаются по локальным заголовкам подряд. Оглавление архива (central
 * directory) не разбирается: в xlsx нет ни шифрования, ни многотомности, а
 * имена и размеры есть в локальных заголовках.
 *
 * **Распаковывается только затребованное.** Zip-архивом является не только
 * xlsx: тем же контейнером устроены docx, pptx, odt и обычный архив. Пока
 * распаковывалось всё подряд, ответ на вопрос «а это вообще книга Excel?»
 * стоил распаковки всего файла целиком — и на документе с картинками окно
 * замирало на минуты, будто программа зависла. Имя записи известно из
 * заголовка, размер тоже: ненужную запись можно перешагнуть, не разжимая.
 */

import { inflateRaw } from './inflate.js';

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;

/**
 * Пределы разбора: дальше архив считается негодным, а не читается вечно.
 *
 * Испорченный или чужой файл может выглядеть как бесконечная череда записей —
 * и разбор его крутился бы, не отвечая. Пределы взяты с большим запасом:
 * в xlsx предприятия сотни записей и десятки мегабайт после распаковки.
 */
const MAX_ENTRIES = 8192;
const MAX_UNPACKED_BYTES = 512 * 1024 * 1024;

function readUInt32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function readUInt16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

/** Ищет сигнатуру из четырёх байт начиная с указанного места. */
function indexOfSignature(bytes: Uint8Array, signature: number, from: number): number {
  for (let i = from; i + 4 <= bytes.length; i += 1) {
    if (readUInt32(bytes, i) === signature) return i;
  }
  return -1;
}

const decoder = new TextDecoder('utf-8');

/**
 * Проход по записям архива.
 *
 * `visit` решает, нужна ли запись: вернул `false` — она перешагивается, и
 * распаковки не происходит вовсе.
 */
function walkZip(
  bytes: Uint8Array,
  visit: (name: string, raw: Uint8Array, method: number) => boolean,
): void {
  let offset = 0;
  let seen = 0;

  while (offset + 30 <= bytes.length && readUInt32(bytes, offset) === LOCAL_HEADER) {
    seen += 1;
    if (seen > MAX_ENTRIES) {
      throw new Error('В архиве слишком много записей — он не похож на книгу Excel.');
    }

    const method = readUInt16(bytes, offset + 8);
    let compressedSize = readUInt32(bytes, offset + 18);
    const nameLength = readUInt16(bytes, offset + 26);
    const extraLength = readUInt16(bytes, offset + 28);

    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;

    // Размер в локальном заголовке может быть нулевым — тогда он записан после
    // данных (data descriptor). Границу находим по следующему заголовку.
    if (compressedSize === 0) {
      const nextLocal = indexOfSignature(bytes, LOCAL_HEADER, dataStart);
      const central = indexOfSignature(bytes, CENTRAL_HEADER, dataStart);
      const end = nextLocal === -1 ? central : Math.min(nextLocal, central === -1 ? nextLocal : central);
      compressedSize = (end === -1 ? bytes.length : end) - dataStart;
    }

    // Испорченный заголовок с нулевым или отрицательным шагом закольцевал бы
    // проход: следующий виток начался бы с того же места.
    if (compressedSize < 0 || dataStart + compressedSize <= offset) {
      throw new Error('Заголовок записи архива испорчен: прочитать книгу нельзя.');
    }

    visit(name, bytes.subarray(dataStart, dataStart + compressedSize), method);
    offset = dataStart + compressedSize;
  }
}

/** Имена записей архива — без распаковки: по ним узнают, что это за файл. */
export function zipEntryNames(bytes: Uint8Array): readonly string[] {
  const names: string[] = [];
  walkZip(bytes, (name) => { names.push(name); return false; });
  return names;
}

/**
 * Записи архива, отобранные по имени.
 *
 * `wanted` обязателен: читать «всё» здесь незачем и опасно — в чужом
 * контейнере лежат картинки и шрифты, распаковка которых стоит времени, а
 * пользы не приносит никакой.
 */
export function readZipEntries(
  bytes: Uint8Array,
  wanted: (name: string) => boolean,
): readonly ZipEntry[] {
  const entries: ZipEntry[] = [];
  let unpacked = 0;

  walkZip(bytes, (name, raw, method) => {
    if (!wanted(name)) return false;
    const data = method === 0 ? raw : inflateRaw(raw);
    unpacked += data.length;
    if (unpacked > MAX_UNPACKED_BYTES) {
      throw new Error('Книга слишком велика для разбора — сохраните нужные листы отдельным файлом.');
    }
    entries.push({ name, data });
    return true;
  });

  return entries;
}

export function zipEntryText(entries: readonly ZipEntry[], name: string): string | null {
  const found = entries.find((entry) => entry.name === name);
  return found === undefined ? null : decoder.decode(found.data);
}
