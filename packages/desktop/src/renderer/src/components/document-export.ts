/**
 * Сборка выгружаемого документа: CSV, печатная страница, разметка для Word и
 * вкладки книги Excel.
 *
 * Общая часть журнала и заявки. Оформление у них одно — заказчик просит, чтобы
 * заявка выглядела как журнал, — а различаются они только тем, какие таблицы в
 * них попадают. Держать вторую копию Word-раздела и сборки вкладок значило бы
 * чинить одно и то же дважды.
 */

import type {
  JournalExportFormat, JournalExportRequest, JournalExportSheet, JournalSheetRowKind,
} from '@izh/contracts';
import {
  ROWS_PER_PAGE, buildContents, orderedTables, type ContentsSection,
} from './document-contents';
import { formatDateTime } from '../format';

/** Одна таблица документа: заголовок, шапка и строки. */
export interface DocumentTable {
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /**
   * Вид оборудования, о котором таблица.
   *
   * По нему таблица попадает в свой раздел оглавления — снаружи здания,
   * внутри здания или автоматика. Нет вида — раздел «прочее»: так выходят
   * таблицы заявки, у которой оборудование не одного вида.
   */
  readonly typeCode?: string | null;
}

/**
 * Обложка документа — первый лист, как у бумажного журнала.
 *
 * Журнал предъявляют при проверке, и начинается он не с таблицы, а с
 * титульного листа: что за журнал, по какому объекту, кем и когда заведён.
 * Без обложки распечатка выглядит выпиской из чего-то, а не журналом.
 */
export interface DocumentCover {
  /** Название журнала: «Журнал эксплуатации систем противопожарной защиты». */
  readonly heading: string;
  /** Объект — полный путь по дереву: «АО «Кольская ГМК» · АСС · МВАСО». */
  readonly objectTitle: string;
  /**
   * Наименование организации — верхняя строка титула, как в бумажном журнале.
   *
   * Отдельно от полного пути: на титуле сверху стоит именно организация, а
   * путь до этажа — ниже, в строке объекта.
   */
  readonly organization?: string | null;
  /** Перечень разделов: то же, что дальше в самом журнале. */
  readonly sections: readonly string[];
  /** Строки под перечнем: ответственный, дата начала ведения. */
  readonly notes?: readonly string[];
}

export interface DocumentSnapshot {
  readonly title: string;
  /** Что именно выгружено — попадает в имя файла и в шапку страницы. */
  readonly scopeTitle: string;
  readonly tables: readonly DocumentTable[];
  /** Строки под таблицами: подписи, должности, дата. */
  readonly footer?: readonly string[];
  /** Титульный лист. Нет — документ начинается сразу с таблиц. */
  readonly cover?: DocumentCover;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function safeFileName(value: string): string {
  const clean = value.replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').trim();
  return clean === '' ? 'Документ_СППЗ' : clean.slice(0, 120);
}

/**
 * Ширина колонки в знаках.
 *
 * По самому длинному значению, но с потолком: фраза в полстроки растянула бы
 * колонку на пол-экрана. Дальше текст переносится по словам, а высоту строки
 * Excel подберёт сам.
 */
function widthsOf(table: DocumentTable): readonly number[] {
  return table.headers.map((header, index) => {
    const longest = table.rows.reduce((best, row) => Math.max(best, (row[index] ?? '').length), header.length);
    return Math.min(46, Math.max(9, longest + 2));
  });
}

/**
 * Ширины граф в долях от ширины таблицы.
 *
 * Заказчик: «при выгрузке журнала в Word часть граф выходит за пределы
 * страницы… обеспечить размещение всех граф в пределах листа».
 *
 * Причина была в том, что ширину граф выбирал сам Word. Таблице задавали
 * `width:100%`, но при обычной раскладке это лишь пожелание: встретив
 * длинное значение — путь по дереву, наименование в несколько слов, — Word
 * расширял под него графу и выносил хвост таблицы за поле листа. На экране
 * этого не видно, а в напечатанном журнале пропадали последние графы.
 *
 * Поэтому ширины считаются здесь и задаются жёстко (`table-layout:fixed`).
 * Считаются по содержимому — графа «№» не должна занимать столько же, сколько
 * «Примечание», — но с потолком и с полом:
 *
 *  — потолок нужен, чтобы одно длинное примечание не съело всю строку;
 *  — пол — чтобы узкая графа не сжалась в вертикальную строчку по букве.
 *
 * Доли, а не пункты: одна и та же таблица печатается и на A4 в браузере, и в
 * разделе Word, и ширина листа у них разная.
 */
const MIN_COLUMN_CH = 6;
const MAX_COLUMN_CH = 34;
/** Сколько граф таблица выдерживает обычным кеглем. */
const DENSE_COLUMNS = 10;

/**
 * Длина самого длинного слова.
 *
 * Заголовок графы просит не всю свою длину, а только её: «Ежеквартальная
 * проверка: следующая» переносится по пробелам и обходится шириной слова
 * «Ежеквартальная». Считать заголовок целиком значило бы отдать ему столько
 * же, сколько «Месту установки», и отнять ширину у значений.
 */
function longestWord(text: string): number {
  return text.split(/\s+/).reduce((best, word) => Math.max(best, word.length), 0);
}

function columnShares(table: DocumentTable): readonly number[] {
  const weights = table.headers.map((header, index) => {
    const value = table.rows.reduce(
      (best, row) => Math.max(best, (row[index] ?? '').length),
      0,
    );
    const longest = Math.max(longestWord(header), Math.min(MAX_COLUMN_CH, value));
    return Math.min(MAX_COLUMN_CH, Math.max(MIN_COLUMN_CH, longest));
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  // Пустой таблицы здесь не бывает — они отсеяны, — но делить на ноль нельзя.
  if (total === 0) return weights.map(() => 1 / Math.max(1, weights.length));
  return weights.map((weight) => weight / total);
}

/** Описание граф: по нему Word и браузер расставляют ширины одинаково. */
function colgroupHtml(table: DocumentTable): string {
  const cols = columnShares(table)
    /*
     * Ширина написана дважды — свойством и признаком тега. Word читает
     * разметку по-своему: признак `width` он понимает всегда, а стиль —
     * не в каждой версии. Браузеру достаточно любого из двух.
     */
    .map((share) => {
      const percent = (share * 100).toFixed(2);
      return `<col width="${percent}%" style="width:${percent}%">`;
    })
    .join('');
  return `<colgroup>${cols}</colgroup>`;
}

const PRINT_CSS = 'body{font-family:"IBM Plex Sans",Arial,sans-serif;color:#162327;font-size:9pt}'
  + 'h1{font-size:15pt;margin:0 0 3mm;padding-top:3mm;border-top:2px solid #176a75}'
  + 'h2{font-size:11pt;margin:5mm 0 2mm;font-weight:600;color:#162327}'
  + 'table{border-collapse:collapse;width:100%;margin-bottom:4mm;table-layout:fixed;'
  + 'mso-table-layout-alt:fixed}'
  + 'th,td{border:1px solid #536266;padding:3px;vertical-align:top;'
  + 'word-wrap:break-word;overflow-wrap:anywhere}'
  // Шапка повторяется на каждом листе: без неё на второй странице непонятно,
  // что за значение в графе. Браузер слушается display, Word — самой thead.
  + 'thead{display:table-header-group}thead tr{break-inside:avoid}'
  // Широкая таблица набирается мельче и теснее. Шестнадцать граф журнала
  // помещаются на лист и так, но при обычном кегле от каждой остаётся по
  // пять знаков в строке, и заголовки рассыпаются по буквам.
  + 'table.dense{font-size:7.5pt}table.dense th,table.dense td{padding:2px}'
  + 'th{background:#f3f2ee;font-weight:600}tr{break-inside:avoid}.meta{margin-bottom:4mm;color:#536266}'
  + '.sign{margin-top:8mm}.sign div{margin-bottom:5mm}'
  // Обложка занимает лист целиком, дальше — разрыв страницы: журнал
  // начинается с титульного листа, а не с таблицы поверх него.
  + '.cover{page-break-after:always;break-after:page;text-align:center;padding-top:8mm}'
  // Титул по образцу бумажного журнала: черта и наименование организации
  // сверху, название посередине, дата формирования внизу.
  + '.cover-org-line{border-top:1px solid #111;margin:0 12mm 1mm}'
  + '.cover-org{font-size:12pt;min-height:14pt}'
  + '.cover-org-label{font-size:9pt;color:#444;margin-bottom:28mm}'
  + '.cover-heading{font-size:26pt;font-weight:700;letter-spacing:.06em;margin:0 0 4mm}'
  + '.cover-subheading{font-size:18pt;font-weight:700;line-height:1.35;margin:0 0 16mm}'
  + '.cover-object-label{font-size:11pt;color:#444;margin-bottom:2mm}'
  + '.cover-object{font-size:13pt;font-weight:700;margin:0 0 10mm}'
  + '.cover-notes{margin-top:10mm;font-size:10pt;color:#333}'
  + '.cover-notes div{margin-bottom:4mm}'
  + '.cover-formed{margin-top:30mm;font-size:12pt;text-align:right;padding-right:12mm}'
  // Содержание — свой лист, дальше каждый раздел с нового.
  + '.contents{page-break-after:always;break-after:page}'
  + '.contents-heading{text-align:center;font-size:14pt;margin:0 0 6mm}'
  + '.contents-table{font-size:10pt}'
  + '.contents-table th{text-align:center}'
  + '.contents-table td:first-child{width:60pt;text-align:center;font-weight:700}'
  // Название раздела — по середине строки, как в бумажном журнале; вид
  // оборудования под ним остаётся по левому краю, чтобы читался как вложенный.
  + '.contents-group td:nth-child(2){text-align:center}'
  + '.contents-page{width:90pt;text-align:center;white-space:nowrap}'
  + '.contents-group td{font-weight:700;background:#f6f8fa}'
  + '.contents-item{padding-left:14pt}'
  + '.contents-count{color:#555}'
  + '.section-start{page-break-before:always;break-before:page}'
  // Разрыв листа: сам по себе ничего не показывает, только режет лист.
  + '.page-break{display:block;height:0;page-break-before:always;break-before:page}'
  /*
   * Заголовок раздела не отрывается от своей шапки: перенос сразу после
   * названия оставлял бы на листе одну строку.
   */
  + '.section-start{page-break-after:avoid;break-after:avoid}'
;

/**
 * Титульный лист.
 *
 * Разделы перечислены и здесь, и дальше в самом журнале — намеренно: по
 * обложке видно, что в журнале есть, не листая его целиком. Так устроен и
 * бумажный журнал, откуда взят этот вид.
 */
/**
 * Титульный лист по образцу бумажного журнала.
 *
 * Сверху — черта и наименование организации, посередине крупно название
 * журнала, ниже объект, внизу справа — **дата формирования**. В бумажном
 * журнале на этом месте «Начат» и «Окончен»; выгрузка — не тетрадь, которую
 * ведут год, а снимок состояния на день, и обещать по нему срок ведения
 * нельзя.
 *
 * Перечня разделов на титуле нет: он теперь на своём листе, оглавлением с
 * номерами страниц.
 */
function coverHtml(cover: DocumentCover, formedOn: string): string {
  const notes = (cover.notes ?? []).length === 0
    ? ''
    : `<div class="cover-notes">${(cover.notes ?? [])
      .map((line) => `<div>${escapeHtml(line)}</div>`)
      .join('')}</div>`;

  const organization = cover.organization ?? null;

  return '<div class="cover">'
    + '<div class="cover-org-line"></div>'
    + `<div class="cover-org">${escapeHtml(organization ?? '')}</div>`
    + '<div class="cover-org-label">наименование организации</div>'
    + '<div class="cover-heading">ЖУРНАЛ</div>'
    + `<div class="cover-subheading">${escapeHtml(cover.heading)}</div>`
    + '<div class="cover-object-label">Объект</div>'
    + `<div class="cover-object">${escapeHtml(cover.objectTitle)}</div>`
    + notes
    + `<div class="cover-formed">Выгружен из электронного журнала: ${escapeHtml(formedOn)}</div>`
    + '</div>';
}

/**
 * Содержание журнала — таблицей, как в бумажном.
 *
 * Разделы наши: снаружи здания, внутри здания, автоматика; внутри раздела —
 * виды оборудования и лист, с которого каждый начинается. Пустых разделов в
 * оглавлении не бывает: в нём обещано ровно то, что дальше есть.
 */
function contentsHtml(sections: readonly ContentsSection[]): string {
  if (sections.length === 0) return '';

  const rows = sections.flatMap((section) => [
    '<tr class="contents-group">'
    + `<td>${section.numeral}.</td>`
    + `<td>${escapeHtml(section.title)}</td>`
    + `<td class="contents-page">стр. ${section.page}</td>`
    + '</tr>',
    ...section.items.map((item) => '<tr>'
      + '<td></td>'
      + `<td class="contents-item">${escapeHtml(item.title)}`
      + `<span class="contents-count"> — записей: ${item.rows}</span></td>`
      + `<td class="contents-page">стр. ${item.page}</td>`
      + '</tr>'),
  ]);

  return '<div class="contents">'
    + '<h2 class="contents-heading">Содержание журнала</h2>'
    + '<table class="contents-table"><thead><tr>'
    + '<th>Номер раздела журнала</th><th>Наименование раздела журнала</th>'
    + '<th>Страница начала раздела</th>'
    + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>'
    + '</div>';
}

/**
 * Разрыв листа, который понимают и печать, и Word.
 *
 * Правила `page-break-after` на блоке Word слушает не всегда: он читает
 * разметку по-своему и разрывает лист по особому знаку в тексте. Отсюда этот
 * пустой абзац — в браузере он ничего не показывает, а в Word означает «дальше
 * с нового листа».
 *
 * Появился он после того, как в готовом документе титул и содержание оказались
 * на одном листе, хотя правила разрыва были на месте.
 */
function pageBreak(): string {
  return '<br clear="all" class="page-break" '
    + 'style="mso-special-character:line-break;page-break-before:always">';
}

/**
 * Таблицы документа.
 *
 * `paged` — режем ли документ на листы сами.
 *
 * У журнала режем: в оглавлении стоят номера листов, и знать их надо точно —
 * сколько записей ляжет на лист, заранее не известно, в графах «Место
 * установки» и «Примечание» текст переносится.
 *
 * У заявки не режем. Заказчик: «формат скаченных заявок не нужно разделять на
 * разные страницы с титульным листом — где написано „заявка“, там же и
 * продолжается лист с таблицей, и таблица тоже не разделяется без
 * необходимости». Оглавления у заявки нет, номера листов ни с чем не
 * сверяются, и резать её нам незачем: печать сама перенесёт то, что не влезло,
 * а шапка таблицы повторится на новом листе сама (`display:table-header-group`).
 */
function tablesHtml(tables: readonly DocumentTable[], paged: boolean): string {
  return tables
    .map((table) => {
      const head = table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
      const dense = table.headers.length > DENSE_COLUMNS ? ' class="dense"' : '';

      /*
       * Таблица режется на листы здесь, а не отдаётся на усмотрение печати.
       *
       * Иначе номер листа в оглавлении не совпадает с тем, где раздел окажется
       * на самом деле: сколько записей ляжет на лист, заранее не известно — в
       * графах «Место установки» и «Примечание» текст переносится. Разрезав
       * таблицу самим, мы знаем число листов точно.
       *
       * У каждого куска своя шапка: на втором листе раздела она нужна не
       * меньше, чем на первом.
       */
      if (!paged) {
        const body = table.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
          .join('');
        return `<h2>${escapeHtml(table.title)}</h2>`
          + `<table${dense}>${colgroupHtml(table)}<thead><tr>${head}</tr></thead>`
          + `<tbody>${body}</tbody></table>`;
      }

      const pages: string[] = [];
      for (let at = 0; at < Math.max(1, table.rows.length); at += ROWS_PER_PAGE) {
        const part = table.rows.slice(at, at + ROWS_PER_PAGE);
        const body = part
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
          .join('');
        const title = at === 0
          ? escapeHtml(table.title)
          : `${escapeHtml(table.title)} (продолжение)`;

        pages.push(`${pageBreak()}<h2 class="section-start">${title}</h2>`
          + `<table${dense}>${colgroupHtml(table)}<thead><tr>${head}</tr></thead>`
          + `<tbody>${body}</tbody></table>`);
      }

      return pages.join('');
    })
    .join('');
}

function footerHtml(footer: readonly string[]): string {
  if (footer.length === 0) return '';
  return `<div class="sign">${footer.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</div>`;
}

/** Каждая таблица — своей вкладкой книги: так её и ищут, по ярлычку внизу. */
/**
 * Первая вкладка книги: титул и содержание.
 *
 * Заказчик: «должно быть применено к любому формату — Ексель тоже, но разделы
 * по отдельным вкладкам, как сейчас». Разделы вкладками и остались; титул с
 * содержанием — отдельной вкладкой перед ними, как титульный лист бумажного
 * журнала перед его разделами.
 *
 * Вместо номеров страниц здесь названия вкладок: в книге страниц нет, а искать
 * раздел человек будет по ярлычку внизу.
 */
function contentsSheet(
  snapshot: DocumentSnapshot,
  sections: readonly ContentsSection[],
  formedOn: string,
): JournalExportSheet {
  const cover = snapshot.cover;

  /*
   * Книга — не лист бумаги: «ЖУРНАЛ» посреди пустой строки в ней выглядит
   * потерянным, а не торжественным. Поэтому титул набран как карточка —
   * подпись слева, значение справа: так его и читают в таблице.
   */
  const rows: string[][] = [
    ['ЖУРНАЛ эксплуатации систем противопожарной защиты'],
    [],
    ['Организация', cover?.organization ?? ''],
    ['Объект', cover?.objectTitle ?? ''],
    ['Состав', snapshot.scopeTitle],
    ['Выгружен из электронного журнала', formedOn],
    [],
    ['Содержание журнала'],
    ['Номер раздела', 'Наименование раздела журнала', 'Записей', 'Вкладка книги'],
  ];

  /** Вид каждой строки: по нему книга её и оформляет. */
  const kinds: JournalSheetRowKind[] = [
    'заголовок', 'данные', 'данные', 'данные', 'данные', 'данные', 'данные',
    'заголовок', 'шапка',
  ];

  for (const section of sections) {
    rows.push([`${section.numeral}.`, section.title, '', '']);
    kinds.push('шапка');
    for (const item of section.items) {
      rows.push(['', item.title, String(item.rows), item.title]);
      kinds.push('данные');
    }
  }

  return {
    name: 'Содержание',
    rows,
    rowKinds: kinds,
    /*
     * Ширины под содержимое: подписи титула короткие, названия разделов
     * длинные, число записей узкое. Без этого первая колонка растягивалась по
     * слову «Сформирован», а название раздела не помещалось вовсе.
     */
    columnWidths: [22, 58, 12, 30],
    // Шапка содержания остаётся на виду: разделов бывает больше, чем строк на
    // экране.
    frozenRows: 9,
  };
}

function sheetsOf(snapshot: DocumentSnapshot): readonly JournalExportSheet[] {
  return snapshot.tables.map((table) => ({
    name: table.title,
    rows: [
      [snapshot.title],
      [table.title],
      [...table.headers],
      ...table.rows.map((row) => [...row]),
      ...(snapshot.footer ?? []).map((line) => [line]),
    ],
    rowKinds: ['заголовок' as const, 'заголовок' as const, 'шапка' as const],
    columnWidths: widthsOf(table),
    // Шапка остаётся на виду при прокрутке: без неё в списке на сотню строк
    // невозможно понять, что за значение в ячейке.
    frozenRows: 3,
  }));
}

export function buildDocumentExportRequest(
  format: JournalExportFormat,
  snapshot: DocumentSnapshot,
): JournalExportRequest {
  const filledTables = snapshot.tables.filter((table) => table.rows.length > 0);
  /*
   * Разделы идут в порядке разделов — том же, что в оглавлении.
   *
   * Иначе оглавление обещает лист, а раздел лежит на другом: оглавление
   * складывает виды по разделам (автоматика, внутри здания, снаружи), а
   * таблицы приходили в порядке журнала.
   *
   * У документа без обложки разделов нет, и порядок остаётся тем, в каком его
   * собрали: у заявки таблицы идут не по видам оборудования.
   */
  const tables = snapshot.cover === undefined ? filledTables : orderedTables(filledTables);
  const filled: DocumentSnapshot = { ...snapshot, tables };

  // Таблицы идут подряд, разделённые названием и пустой строкой: одной шапки на
  // всех быть не может, а склеивать разные таблицы вплотную значило бы отдать
  // документ, который нельзя прочитать.
  const csv = [
    ...tables.map((table) => [[table.title], table.headers, ...table.rows]
      .map((row) => row.map(csvCell).join(';'))
      .join('\r\n')),
    ...(snapshot.footer === undefined || snapshot.footer.length === 0
      ? []
      : [snapshot.footer.map((line) => csvCell(line)).join('\r\n')]),
  ].join('\r\n\r\n');

  const meta = `${escapeHtml(snapshot.scopeTitle)}. Сформировано: `
    + escapeHtml(formatDateTime(new Date().toISOString()));
  /*
   * Дата формирования — вместо «Начат» и «Окончен» бумажного журнала.
   *
   * Заказчик: «там, где даты начала и конца, должна быть дата формирования
   * журнала». Без времени: на титуле бумажного журнала стоит день, а не час.
   */
  const formedOn = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  /*
   * Обложка заменяет заголовок, а не добавляется к нему: два названия подряд
   * на первом листе — это не титул, а недоразумение.
   */
  /*
   * Оглавление строится по составу самой выгрузки, а не по заранее заданному
   * списку разделов: выгружают то вид, то раздел, то весь журнал, и обещать в
   * оглавлении разделы, которых дальше нет, значит сделать его бесполезным.
   */
  const contents = snapshot.cover === undefined ? [] : buildContents(
    tables.map((table) => ({ title: table.title, rows: table.rows.length, typeCode: table.typeCode ?? null })),
  );

  /*
   * Титул, оглавление и сам журнал идут каждый со своего листа.
   *
   * Заказчик: «титул должен быть отдельно на странице, а оглавление на
   * отдельных страницах, а сам журнал с новой страницы». Титул кончается
   * разрывом, оглавление — тоже, и первый раздел начинается с чистого листа,
   * как все остальные.
   */
  /*
   * Титул, содержание и журнал — каждый со своего листа.
   *
   * Между ними стоит явный разрыв: правила `page-break-after` на блоке Word
   * слушает не всегда, и в готовом документе титул с содержанием оказывались
   * на одном листе. Разрывы перед разделами ставит `tablesHtml`.
   */
  const body = (snapshot.cover === undefined
    ? `<h1>${escapeHtml(snapshot.title)}</h1><div class="meta">${meta}</div>`
    : coverHtml(snapshot.cover, formedOn) + pageBreak() + contentsHtml(contents))
    + tablesHtml(tables, snapshot.cover !== undefined)
    + footerHtml(snapshot.footer ?? []);

  /*
   * Поля листа оставляют место под номер страницы.
   *
   * Сам номер ставит печать (`printToPDF` с нижним колонтитулом): правило
   * `@page { @bottom-center }` из CSS Chromium не понимает, и написать его
   * здесь значило бы завести неработающую строку, на которую потом сошлются.
   */
  const pageCss = '@page{size:A4 landscape;margin:10mm 10mm 14mm}';

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.title)}</title>
<style>${pageCss}${PRINT_CSS}</style></head>
<body>${body}</body></html>`;

  /*
   * Word разворачивает лист альбомно только по своему описанию раздела: `@page`
   * с размером он не понимает и печатает книжно, обрезая половину граф. Отсюда
   * `WordSection1` и размер листа в пунктах — иначе документ приходит негодным.
   */
  /*
   * В Word номер листа ставится полем в нижнем колонтитуле: разметка Word
   * читает колонтитул из отдельного блока, связанного с разделом, а само
   * число подставляет при печати — считать листы заранее нельзя.
   */
  const wordFooter = '<div style="mso-element:footer" id="f1">'
    + '<p class="MsoFooter" style="text-align:center">'
    + '<span style=\'mso-field-code:" PAGE "\'>1</span></p></div>';

  const wordHtml = `<!doctype html>
<html lang="ru" xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(snapshot.title)}</title>
<style>
@page WordSection1{size:841.9pt 595.3pt;mso-page-orientation:landscape;
  margin:1cm 1cm 1.4cm 1cm;mso-footer:f1}
div.WordSection1{page:WordSection1}
p.MsoFooter{margin:0;font-family:Arial,sans-serif;font-size:9pt}
${PRINT_CSS}
</style></head>
<body><div class="WordSection1">${body}${wordFooter}</div></body></html>`;

  /*
   * В книге титул и содержание идут первой вкладкой, разделы — своими, как и
   * прежде. Без обложки (заявка, карточка) вкладка не заводится: там книга —
   * данные, а не документ.
   */
  const sheets = snapshot.cover === undefined
    ? sheetsOf(filled)
    : [contentsSheet(filled, contents, formedOn), ...sheetsOf(filled)];

  return {
    format,
    suggestedName: safeFileName(`${snapshot.title}_${snapshot.scopeTitle}`),
    html,
    wordHtml,
    csv,
    sheets,
  };
}
