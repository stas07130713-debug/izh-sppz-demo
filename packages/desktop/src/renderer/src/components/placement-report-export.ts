/**
 * Справка о соответствии размещения огнетушителей — выгрузка в Word, PDF и на
 * печать.
 *
 * Строится по образцу заказчика: «Информационная справка о соответствии
 * размещения первичных средств пожаротушения (огнетушителей) на объекте
 * защиты» — характеристика объекта, требования ППР, таблицы норм, обоснование
 * выбора, вывод и приложение со схемой расположения.
 *
 * Отличие от бумажной справки одно, и оно в пользу дела: вывод не написан от
 * руки, а посчитан, и рядом с ним стоит основание — по какой строке таблицы и
 * при каких сведениях о помещении он получен.
 *
 * Лист книжный: справка — текстовый документ, а не широкая таблица журнала.
 */

import type { BuildingProfile, JournalExportFormat, JournalExportRequest } from '@izh/contracts';
import type { PlacementReport } from '@izh/core';
import { escapeHtml } from './document-export';
import { PPR_REQUIREMENTS, table1Html, table2Html } from './placement-report-text';
import { formatDateTime } from '../format';

/** Сколько огнетушителей каждой марки размещено — строка приложения 1. */
export interface MarkTally {
  readonly mark: string;
  readonly count: number;
}

export interface PlacementDocumentInput {
  readonly report: PlacementReport;
  /** Наименование объекта защиты: организация, здание, этаж. */
  readonly objectName: string;
  readonly levelName: string;
  /** Отметка этажа, как её пишут в справках: «отм. +5.400». */
  readonly elevation: string | null;
  readonly building: BuildingProfile | null;
  readonly marks: readonly MarkTally[];
  /** Схема расположения ссылкой `data:image/png`. null — плана нет. */
  readonly schemeDataUrl: string | null;
}

const CSS = 'body{font-family:"IBM Plex Sans",Arial,sans-serif;color:#162327;font-size:11pt;line-height:1.35}'
  + 'h1{font-size:14pt;text-align:center;margin:0 0 4pt;padding-top:10pt;border-top:2px solid #176a75}'
  + 'h2{font-size:12pt;margin:14pt 0 4pt;font-weight:600}'
  + 'h3{font-size:11pt;margin:12pt 0 4pt;font-weight:600}'
  + 'p{margin:4pt 0;text-align:justify}'
  + 'table{border-collapse:collapse;width:100%;font-size:9pt;margin:6pt 0}'
  + 'th,td{border:1px solid #536266;padding:3pt 4pt;vertical-align:top;text-align:left}'
  + 'th{background:#f3f2ee;font-weight:600}'
  + 'ul{margin:4pt 0 4pt 18pt;padding:0}'
  + '.center{text-align:center}'
  + '.scheme{width:100%;margin-top:6pt}'
  // Подпись над схемой — та же, что над чертежом в программе: по центру и
  // полужирная. Приложение отделяют от справки, и без неё непонятно, чей это
  // план.
  + '.scheme-title{text-align:center;font-weight:700;font-size:11pt;margin:10pt 0 2pt}'
  // Подпись и схема не разъезжаются по разным листам: лист их не разрывает.
  /*
   * Приложение начинается с нового листа, и подпись со схемой на нём уже не
   * разлучить.
   *
   * Просьбы «не разрывай» (`break-inside: avoid`) не хватило: правило действует,
   * только пока блок помещается на лист целиком, а схема занимает почти весь
   * лист — браузер объявлял такой блок неделимым и всё равно разрывал его,
   * оставляя подпись на предыдущем листе.
   *
   * С нового листа сомнений нет: сверху заголовок приложения, под ним подпись
   * объекта, под ней сама схема, и всё это на одном листе.
   */
  + '.appendix-start{page-break-before:always;break-before:page}'
  + '.appendix-start{page-break-after:avoid;break-after:avoid}'
  + '.scheme-block{page-break-inside:avoid;break-inside:avoid}'
  + '.scheme-title{page-break-after:avoid;break-after:avoid}'
  // Схема вписывается в остаток листа: высота ограничена, чтобы подпись и
  // картинка гарантированно уместились вместе.
  + '.scheme{max-height:200mm;object-fit:contain}'
  // Графы под запись от руки: высота строки — чтобы было куда расписаться.
  + '.sign-heading{margin-top:16pt}'
  + '.sign-table td.sign-cell{height:34pt}'
  + '.sign{margin-top:18pt}';

function line(title: string, value: string | number | null): string {
  if (value === null || value === '') return '';
  return `<p><b>${escapeHtml(title)}:</b> ${escapeHtml(String(value))}</p>`;
}

/** Краткая характеристика объекта — те же строки, что в справке заказчика. */
function summaryHtml(input: PlacementDocumentInput): string {
  const building = input.building;
  const categories = [...new Set(
    input.report.rooms.map((room) => room.category).filter((value): value is string => value !== null),
  )].join(', ');

  return '<h2>Краткая характеристика объекта</h2>'
    + line('Наименование объекта', input.objectName)
    + line('Уровень', input.elevation === null ? input.levelName : `${input.levelName} (${input.elevation})`)
    + line('Площадь застройки, м²', building?.builtAreaM2 ?? null)
    + line('Высота здания, м', building?.heightM ?? null)
    + line('Количество надземных этажей', building?.floorsAbove ?? null)
    + line('Степень огнестойкости', building?.fireResistance ?? null)
    + line('Категория здания по взрывопожарной и пожарной опасности', building?.explosionCategory ?? null)
    + line('Категории помещений по взрывопожарной и пожарной опасности', categories === '' ? null : categories)
    + line('Класс конструктивной пожарной опасности', building?.constructiveClass ?? null)
    + line('Класс функциональной пожарной опасности', building?.functionalClasses ?? null)
    + line('Класс возможного пожара на объекте', building?.fireClasses ?? null)
    + line('Основание категории', building?.categoryBasis ?? null);
}

/** Требования нормативных документов — целиком, как в справке. */
function requirementsHtml(): string {
  return '<h2>Требования нормативных документов</h2>'
    + PPR_REQUIREMENTS.map((text) => `<p>${escapeHtml(text)}</p>`).join('')
    + table1Html()
    + table2Html();
}

/**
 * Обоснование выбора: по одной строке на каждое встретившееся требование.
 *
 * В справке это «для помещений категории В-2, В-3, В-4 … принимаются
 * огнетушители с рангом тушения модельного очага не ниже 3A, 70B, C, E».
 * Одинаковые требования сводятся в одну строку — перечислять их по разу на
 * каждое помещение значит утопить вывод в повторах.
 */
function reasoningHtml(report: PlacementReport): string {
  const byRank = new Map<string, Set<string>>();
  for (const room of sectionsOf(report)) {
    if (!room.requirement.needed || room.requirement.rankText === '') continue;
    const categories = byRank.get(room.requirement.rankText) ?? new Set<string>();
    if (room.category !== null) categories.add(room.category);
    byRank.set(room.requirement.rankText, categories);
  }

  if (byRank.size === 0) return '';

  // Помещения без категории — административные и общественные: их по
  // взрывопожарной опасности не категорируют, и писать «категории без
  // категории» было бы бессмыслицей.
  const items = [...byRank.entries()].map(([rank, categories]) => {
    const where = categories.size === 0
      ? ', не подлежащих категорированию по взрывопожарной и пожарной опасности,'
      : ` категории ${escapeHtml([...categories].join(', '))}`;
    return `<li>для помещений${where} с учётом классов возможных пожаров принимаются `
      + `огнетушители с рангом тушения модельного очага не ниже ${escapeHtml(rank)}</li>`;
  });

  return '<h2>Обоснование выбора огнетушителей с учётом ранга тушения модельного очага</h2>'
    + `<ul>${items.join('')}</ul>`;
}

/**
 * Разделы проверки по порядку: объект целиком, затем каждое помещение.
 *
 * Тот же порядок, что на экране (заказчик: «вначале в целом по зданию... и
 * дальше по каждому такому помещению»). Справку и экран читают вместе, и
 * расходиться им нельзя.
 */
function sectionsOf(report: PlacementReport): readonly PlacementReport['rooms'][number][] {
  return report.whole === null ? report.rooms : [report.whole, ...report.rooms];
}

/** Результат проверки по разделам — то, чего в бумажной справке нет. */
function roomsHtml(report: PlacementReport): string {
  const sections = sectionsOf(report);
  if (sections.length === 0) return '';

  const rows = sections.map((room) => {
    const coverage = room.coverage === null || room.coverage.sampled === 0
      ? '—'
      : `${Math.round(room.coverage.ratio * 100)} %`;
    const cells = [
      room.roomName,
      room.category ?? '—',
      room.areaM2 === null ? '—' : room.areaM2.toFixed(2),
      room.requirement.needed ? (room.requirement.rankText === '' ? '—' : `не ниже ${room.requirement.rankText}`) : '—',
      room.requirement.reachM === null ? '—' : `${room.requirement.reachM} м`,
      coverage,
      room.verdict,
    ];
    return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
  });

  const findings = sections
    .flatMap((room) => room.findings.map((finding) => ({ room: room.roomName, finding })))
    .filter((item) => item.finding.severity !== 'сведения');

  const findingsHtml = findings.length === 0 ? '' : '<h3>Замечания и нарушения</h3><ul>'
    + findings.map((item) =>
      `<li><b>${escapeHtml(item.room)}</b> — ${escapeHtml(item.finding.severity)}: `
      + `${escapeHtml(item.finding.text)} (${escapeHtml(item.finding.clause)})</li>`).join('')
    + '</ul>';

  const level = report.findings.length === 0 ? '' : '<h3>По уровню в целом</h3><ul>'
    + report.findings.map((finding) =>
      `<li>${escapeHtml(finding.severity)}: ${escapeHtml(finding.text)} `
      + `(${escapeHtml(finding.clause)})</li>`).join('')
    + '</ul>';

  return '<h2>Результат проверки размещения</h2>'
    + '<table><thead><tr><th>Помещение</th><th>Категория</th><th>Площадь, м²</th>'
    + '<th>Требуемый ранг</th><th>Расстояние</th><th>Покрытие</th><th>Вывод</th></tr></thead>'
    + `<tbody>${rows.join('')}</tbody></table>`
    + level
    + findingsHtml;
}

/** Вывод о достаточности — та же формулировка, что подписывают в справке. */
function verdictHtml(report: PlacementReport): string {
  const text = report.verdict === 'соответствует'
    ? 'Количество размещённых на объекте защиты огнетушителей соответствует требованиям пожарной безопасности.'
    : report.verdict === 'нарушение'
      ? 'Размещение огнетушителей требованиям пожарной безопасности не соответствует. Выявленные '
        + 'нарушения приведены выше и подлежат устранению.'
      : 'Вывод о достаточности не сделан: по части помещений не заполнены сведения, без которых норма '
        + 'не определяется. Недостающее перечислено выше.';

  return '<h2>Вывод о достаточности и правильности выбора первичных средств пожаротушения</h2>'
    + `<p>${escapeHtml(text)}</p>`;
}

/** Приложение 1 — схема расположения и перечень марок, как в справке заказчика. */
function appendixHtml(input: PlacementDocumentInput): string {
  const where = input.elevation ?? input.levelName;
  const total = input.marks.reduce((sum, item) => sum + item.count, 0);
  const list = input.marks.map((item) => `${item.mark} — ${item.count} шт.`).join(', ');

  const caption = total === 0
    ? `На ${escapeHtml(where)} огнетушители на плане не размещены.`
    : `На ${escapeHtml(where)} — ${total} огнетушителей (${escapeHtml(list)}).`;

  const scheme = input.schemeDataUrl === null
    ? '<p>Схема не приложена: подложка плана не загружена.</p>'
    : `<img class="scheme" src="${input.schemeDataUrl}" alt="Схема расположения огнетушителей">`;

  /*
   * Над схемой — та же подпись, что над чертежом в программе.
   *
   * Заказчик: «в скачанной проверке нужно, чтобы сам план тоже был сверху
   * подписан, как в программе». Схема шла без заголовка, и на распечатке было
   * не понять, к какому зданию и этажу она относится: приложение отделяют от
   * справки и подшивают отдельно.
   */
  const planTitle = `<p class="scheme-title">${escapeHtml(input.objectName)}${
    input.elevation === null ? '' : ` · ${escapeHtml(input.elevation)}`}</p>`;

  /*
   * Подпись и схема — одним куском, который лист не разрывает.
   *
   * Заказчик: «подпись объекта при скачивании проверки огнетушителей должна
   * быть на том же листе, что и сам план». Подпись — обычный абзац, схема —
   * картинка во всю ширину: если до конца листа оставалось немного, подпись
   * уходила на предыдущий лист, а план начинался на следующем, и на распечатке
   * они оказывались порознь.
   */
  return '<h2 class="appendix-start">Приложение 1. Схема расположения огнетушителей</h2>'
    + `<p>${caption}</p>`
    + '<p>Радиус кругов на схеме соответствует норме расстояния для категории помещения. Красными '
    + 'точками отмечены места, до которых расстояние до огнетушителя превышает норму.</p>'
    + `<div class="scheme-block">${planTitle}${scheme}</div>`;
}

/**
 * Место для подписи от руки.
 *
 * Заказчик: «добавь графу под подпись, чтобы туда вручную потом вписать можно
 * было ответственное лицо, подпись и дату». Справку распечатывают и подшивают,
 * и подписывает её человек — программа его не знает и подставлять не вправе:
 * подписал тот, кто расписался, а не тот, кто был указан в настройках.
 *
 * Поэтому графы пустые, с линейками под запись. Таблицей, а не строкой с
 * подчёркиваниями: подчёркивания расползаются при любой правке ширины листа.
 */
function signatureHtml(): string {
  return '<h2 class="sign-heading">Проверку провёл</h2>'
    + '<table class="sign-table"><thead><tr>'
    + '<th>Должность</th><th>Фамилия, инициалы</th><th>Подпись</th><th>Дата</th>'
    + '</tr></thead><tbody><tr>'
    + '<td class="sign-cell"></td><td class="sign-cell"></td>'
    + '<td class="sign-cell"></td><td class="sign-cell"></td>'
    + '</tr></tbody></table>';
}

export function buildPlacementDocument(
  format: JournalExportFormat,
  input: PlacementDocumentInput,
): JournalExportRequest {
  const title = 'Информационная справка о соответствии размещения первичных средств пожаротушения '
    + '(огнетушителей) на объекте защиты';

  const body = `<h1>${escapeHtml(title)}</h1>`
    + `<p class="center">Сформирована: ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>`
    + summaryHtml(input)
    + requirementsHtml()
    + reasoningHtml(input.report)
    + roomsHtml(input.report)
    + verdictHtml(input.report)
    + signatureHtml()
    + appendixHtml(input);

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>@page{size:A4;margin:15mm}${CSS}</style></head>
<body>${body}</body></html>`;

  // Word разворачивает лист по описанию раздела, а не по `@page` с размером.
  // Здесь лист книжный: справка — текст, а не широкая таблица журнала.
  const wordHtml = `<!doctype html>
<html lang="ru" xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page WordSection1{size:595.3pt 841.9pt;mso-page-orientation:portrait;margin:1.5cm}
div.WordSection1{page:WordSection1}
${CSS}
</style></head>
<body><div class="WordSection1">${body}</div></body></html>`;

  return {
    format,
    suggestedName: `Проверка размещения огнетушителей ${input.levelName}`.replace(/[\\/:*?"<>|]/g, '_'),
    html,
    wordHtml,
    csv: '',
    sheets: [],
  };
}
