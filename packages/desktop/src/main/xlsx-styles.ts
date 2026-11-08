/**
 * Оформление книги Excel: шрифты, заливки, рамки и наборы для трёх видов строк.
 *
 * Отдельным файлом, потому что это самостоятельный кусок формата OOXML со
 * своими правилами: порядок элементов в `styles.xml` закреплён схемой, и
 * перепутанный порядок Excel считает повреждённым файлом, ничего не объясняя.
 *
 * Наборы (`cellXfs`) идут в том же порядке, что и `STYLE_INDEX`, — по этим
 * номерам ячейки ссылаются на оформление.
 */

/** Номер набора оформления для каждого вида строки. */
export const STYLE_INDEX = {
  обычная: 0,
  заголовок: 1,
  шапка: 2,
  данные: 3,
} as const;

export const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  // Шрифты: обычный, жирный, крупный жирный для заголовка над таблицей.
  '<fonts count="3">' +
  '<font><sz val="10"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="10"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="12"/><name val="Calibri"/></font>' +
  '</fonts>' +
  // Заливки: первые две обязательны по схеме, третья — серая шапка таблицы.
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF3"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  // Рамки: без рамки и тонкая по всем сторонам.
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border>' +
  '<left style="thin"><color rgb="FF808080"/></left>' +
  '<right style="thin"><color rgb="FF808080"/></right>' +
  '<top style="thin"><color rgb="FF808080"/></top>' +
  '<bottom style="thin"><color rgb="FF808080"/></bottom>' +
  '<diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  // 0 — обычная: без рамки, без переноса.
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  // 1 — заголовок над таблицей: крупный жирный, без рамки.
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  // 2 — шапка таблицы: жирная, с заливкой, рамкой и переносом по словам.
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"'
  + ' applyBorder="1" applyAlignment="1">'
  + '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  // 3 — данные: рамка и перенос, выравнивание по верху — так строка читается,
  //     когда в одной ячейке несколько сведений карточки.
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">'
  + '<alignment vertical="top" wrapText="1"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';
