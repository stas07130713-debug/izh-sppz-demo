/**
 * Эталонные тесты переноса журнала из Excel (Дополнение 1, части Д12–Д13).
 *
 * Данные в тестах — настоящие строки из журнала заказчика
 * (`Образец существующих планов и журналов/Журнал.xlsx`, лист «Огнетушители»):
 * заголовок в третьей строке, даты числами Excel, «АЦ 4.0-60» как место
 * установки (пожарная машина), служебные подсказки справа от данных.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import {
  detectExtinguisherType,
  looksLikePlaceholder,
  parseExcelDate,
  parseTechnicalState,
} from '../import/excel-values.js';
import { detectHeaderRow, hasAmbiguity, matchColumn, matchColumns } from '../import/column-mapping.js';
import { buildImportPreview } from '../import/import-preview.js';
import { datesToActivities } from '../import/date-to-activity.js';

describe('даты из Excel', () => {
  it('число Excel превращается в календарную дату', () => {
    // 46203 — реальное значение из журнала заказчика, это 30.06.2026.
    // Проверено независимо через OLE-представление даты: 12.07.2026 = 46215.
    expect(parseExcelDate(46203).date).toBe('2026-06-30');
    expect(parseExcelDate(46215).date).toBe('2026-07-12');
  });

  it('текстовая дата в русском формате понимается', () => {
    expect(parseExcelDate('12.07.2026').date).toBe('2026-07-12');
  });

  it('«дата не верна» не превращается в пустоту молча', () => {
    const parsed = parseExcelDate('дата не верна');
    expect(parsed.date).toBeNull();
    // Пользователь должен увидеть, что в источнике было испорченное значение.
    expect(parsed.rejected).toBe('дата не верна');
  });

  it('число вне диапазона дат отклоняется, а не даёт 1902 год', () => {
    const parsed = parseExcelDate(28);
    expect(parsed.date).toBeNull();
    expect(parsed.rejected).toBe('28');
  });

  it('пустая ячейка — это просто отсутствие даты, без предупреждения', () => {
    expect(parseExcelDate('')).toEqual({ date: null, rejected: null });
    expect(parseExcelDate(null)).toEqual({ date: null, rejected: null });
  });
});

describe('состояние и заглушки', () => {
  it('состояние берётся из выпадающего списка журнала', () => {
    expect(parseTechnicalState('Исправен')).toBe('исправен');
    expect(parseTechnicalState('Неисправен')).toBe('неисправен');
  });

  it('непонятное состояние не угадывается', () => {
    expect(parseTechnicalState('ок')).toBe('не определено');
    expect(parseTechnicalState(null)).toBe('не определено');
  });

  it('пометки человека распознаются как заглушки', () => {
    expect(looksLikePlaceholder('ВПВ отсутствует')).toBe(true);
    expect(looksLikePlaceholder('Не входит в СПЗ объекта инв № 580115')).toBe(true);
    expect(looksLikePlaceholder('Необходимо заполнить следующие пункты !')).toBe(true);
    expect(looksLikePlaceholder('28-27')).toBe(false);
  });
});

describe('подтип огнетушителя по марке', () => {
  it('ОП — порошковый, ОУ — углекислотный, ОВЭ — водный', () => {
    expect(detectExtinguisherType('ОП-8')).toBe('extinguisher-powder');
    expect(detectExtinguisherType('ОУ-5')).toBe('extinguisher-co2');
    expect(detectExtinguisherType('ОВЭ-5 (Бонтел)')).toBe('extinguisher-bantl');
    expect(detectExtinguisherType('ОВП-5')).toBe('extinguisher-foam');
  });

  it('неизвестная марка оставляет общий тип, а не выдумывает срок', () => {
    expect(detectExtinguisherType('нечто')).toBe('extinguisher');
    expect(detectExtinguisherType(null)).toBe('extinguisher');
  });
});

describe('сопоставление колонок', () => {
  it('узнаёт колонки реального журнала', () => {
    expect(matchColumn('Номер огнетушителя').target).toBe('regNumber');
    expect(matchColumn('Тип и марка огнетушителя').target).toBe('model');
    expect(matchColumn('Место установки огнетушителя').target).toBe('placement');
    expect(matchColumn('Ответственный должность, Ф.И.О').target).toBe('responsible');
    expect(matchColumn('Состояние огнетушителя').target).toBe('technicalState');
  });

  it('словарь синонимов: «инв. №» — тот же учётный номер', () => {
    expect(matchColumn('инв. № ОТ').target).toBe('regNumber');
    expect(matchColumn('№ ОТ').target).toBe('regNumber');
  });

  it('расчётные и служебные колонки не переносятся', () => {
    // «Дата следующей проверки» — расчёт программы, а не факт из журнала.
    expect(matchColumn('Дата следующей проверки').target).toBe('ignore');
    expect(matchColumn('Количество дней до проверки').target).toBe('ignore');
    expect(matchColumn('№ п/п').target).toBe('ignore');
  });

  it('неизвестная колонка помечается низкой уверенностью, а не отбрасывается', () => {
    const match = matchColumn('Какая-то своя колонка предприятия');
    expect(match.confidence).toBe('низкая');
    expect(match.reason).toContain('примечание');
  });

  it('пустые столбцы за таблицей не считаются неизвестными колонками', () => {
    // В реальном листе справа тянутся десятки пустых столбцов — они не должны
    // требовать решения пользователя.
    const match = matchColumn('');
    expect(match.target).toBe('ignore');
    expect(match.confidence).toBe('высокая');
  });

  it('две колонки на одно поле — неоднозначность, требующая выбора', () => {
    // Так в журнале заказчика: «Квартальная проверка» и «Ежегодная проверка».
    const matches = matchColumns(['Номер огнетушителя', 'Квартальная проверка', 'Ежегодная проверка']);
    expect(hasAmbiguity(matches)).toBe(true);

    const checks = matches.filter((m) => m.target === 'lastCheck');
    expect(checks).toHaveLength(2);
    expect(checks[0]?.confidence).toBe('низкая');
    expect(checks[0]?.reason).toContain('выберите нужную колонку');

    // Однозначная колонка остаётся с высокой уверенностью.
    expect(matches[0]?.confidence).toBe('высокая');
  });
});

describe('поиск строки заголовков', () => {
  it('находит заголовок в третьей строке, как в журнале заказчика', () => {
    const rows = [
      ['Учет наличия, периодического осмотра и перезарядки огнетушителей (п.60 Правил)', '', ''],
      ['', '', 'АО «Кольская ГМК»'],
      ['№ п/п', 'Место установки огнетушителя', 'Номер огнетушителя', 'Тип и марка огнетушителя'],
      ['1', 'Учебная башня, 2-й этаж', '28-27', 'ОП-8'],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it('не принимает за заголовок название формы из одной ячейки', () => {
    const rows = [['Учет наличия огнетушителей'], ['1', '2', '3']];
    expect(detectHeaderRow(rows)).toBeNull();
  });
});

const HEADER = [
  '№ п/п',
  'Место установки огнетушителя',
  'Ответственный должность, Ф.И.О',
  'Номер огнетушителя',
  'Тип и марка огнетушителя',
  'Состояние огнетушителя',
  'Квартальная проверка',
  'Дата следующей проверки',
];

function existing(regNumber: string): PlanObject {
  return {
    id: `id-${regNumber}`,
    siteId: 'site',
    nodeId: 'node',
    typeCode: 'extinguisher-powder',
    regNumber,
    model: null,
    manufacturer: null,
    serialNumber: null,
    commissionedOn: null,
    serviceLifeMonths: null,
    responsible: null,
    roomId: null,
    position: null,
    technicalState: 'не определено',
    note: null,
    archivedAt: null,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    rowVersion: 1,
  };
}

describe('предпросмотр импорта', () => {
  const rows = [
    ['Учет наличия огнетушителей (п.60 Правил)', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    HEADER,
    ['1', 'Учебная башня, 2-й этаж', 'ком. отд. Бархударян Э.С.', '28-27', 'ОП-8', 'Исправен', '46203', '46295'],
    ['2', 'АЦ 4.0-60', 'ком. отд. Бархударян Э.С.', '28-20', 'ОУ-5', 'Исправен', '46203', ''],
    ['3', '', '', '', '', '', '', ''],
    ['4', 'ВПВ отсутствует', '', '', '', '', '', ''],
  ];

  const preview = buildImportPreview({
    rows,
    headerRowIndex: 2,
    matches: matchColumns(HEADER),
    existingObjects: [],
    baseTypeCode: 'extinguisher',
  });

  it('считает, сколько записей будет создано, пропущено и конфликтует', () => {
    expect(preview.toCreate).toBe(2);
    expect(preview.skipped).toBe(2); // пустая заготовка и пометка «ВПВ отсутствует»
    expect(preview.duplicates).toBe(0);
  });

  it('уточняет тип по марке, чтобы объект попал в журнал с правилами', () => {
    const [first, second] = preview.rows;
    expect(first?.typeCode).toBe('extinguisher-powder'); // ОП-8
    expect(second?.typeCode).toBe('extinguisher-co2'); // ОУ-5
  });

  it('переносит номер, место, ответственного, состояние и дату проверки', () => {
    const first = preview.rows[0];
    expect(first?.regNumber).toBe('28-27');
    expect(first?.placement).toBe('Учебная башня, 2-й этаж');
    expect(first?.responsible).toBe('ком. отд. Бархударян Э.С.');
    expect(first?.technicalState).toBe('исправен');
    expect(first?.lastCheck).toBe('2026-06-30');
  });

  it('указывает номер строки источника, чтобы пользователь нашёл её глазами', () => {
    expect(preview.rows[0]?.sourceRow).toBe(4);
  });

  it('находит дубликат по уже существующему учётному номеру', () => {
    const withExisting = buildImportPreview({
      rows,
      headerRowIndex: 2,
      matches: matchColumns(HEADER),
      existingObjects: [existing('28-27')],
      baseTypeCode: 'extinguisher',
    });
    expect(withExisting.duplicates).toBe(1);
    expect(withExisting.toCreate).toBe(1);
    expect(withExisting.rows[0]?.verdict).toBe('дубликат');
  });

  it('два одинаковых номера внутри одного файла — тоже конфликт', () => {
    const doubled = [...rows, ['5', 'Гараж', '', '28-27', 'ОП-5', 'Исправен', '', '']];
    const result = buildImportPreview({
      rows: doubled,
      headerRowIndex: 2,
      matches: matchColumns(HEADER),
      existingObjects: [],
      baseTypeCode: 'extinguisher',
    });
    expect(result.duplicates).toBe(1);
  });

  it('неизвестные колонки сохраняются в примечание, а не теряются', () => {
    const header = [...HEADER, 'Своя колонка предприятия'];
    const result = buildImportPreview({
      rows: [
        ['', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', ''],
        header,
        ['1', 'Гараж', '', '28-30', 'ОП-5', 'Исправен', '', '', 'важное значение'],
      ],
      headerRowIndex: 2,
      matches: matchColumns(header),
      existingObjects: [],
      baseTypeCode: 'extinguisher',
    });
    expect(result.unmappedHeaders).toEqual(['Своя колонка предприятия']);
    expect(result.rows[0]?.note).toBe('Своя колонка предприятия: важное значение');
  });

  it('строка-заготовка с формулами не создаёт объект', () => {
    // Настоящая строка из журнала заказчика (лист «Огнетушители», строка 28):
    // счётчик по порядку, мусор в колонке места и формулы, считающие даты, но
    // ни номера, ни марки — оборудования за такой строкой нет.
    const result = buildImportPreview({
      rows: [
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        HEADER,
        ['25', '7', '', '', '', '', '45931', '46023'],
      ],
      headerRowIndex: 2,
      matches: matchColumns(HEADER),
      existingObjects: [],
      baseTypeCode: 'extinguisher',
    });
    expect(result.toCreate).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('повторный ряд заголовков в середине листа не создаёт объект', () => {
    // На листе журнала заказчика подряд идут две таблицы, и у второй свой ряд
    // заголовков (строка 124). Без этой проверки появлялся бы объект с маркой
    // «Тип и марка огнетушителя».
    const secondTableHeader = [
      '№ п/п',
      'Место установки огнетушителя',
      'Ответственный должность, Ф.И.О',
      'Номер огнетушителя',
      'Тип и марка огнетушителя',
      'Взвешивание углекислотных огнетушителей',
      '106',
      '',
    ];
    const result = buildImportPreview({
      rows: [
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        HEADER,
        ['1', 'Гараж', '', '28-40', 'ОП-5', 'Исправен', '', ''],
        secondTableHeader,
      ],
      headerRowIndex: 2,
      matches: matchColumns(HEADER),
      existingObjects: [],
      baseTypeCode: 'extinguisher',
    });
    expect(result.toCreate).toBe(1);
    expect(result.rows.find((row) => row.sourceRow === 5)?.verdict).toBe('пропустить');
  });

  it('испорченная дата даёт предупреждение, но не отменяет запись', () => {
    const result = buildImportPreview({
      rows: [
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        HEADER,
        ['1', 'Гараж', '', '28-31', 'ОП-5', 'Исправен', 'дата не верна', ''],
      ],
      headerRowIndex: 2,
      matches: matchColumns(HEADER),
      existingObjects: [],
      baseTypeCode: 'extinguisher',
    });
    expect(result.toCreate).toBe(1);
    expect(result.rows[0]?.lastCheck).toBeNull();
    expect(result.rows[0]?.warnings[0]).toContain('дата не верна');
  });
});

describe('склонённые заголовки', () => {
  /*
   * Найдено на стенде: журнал с заголовком «Дата последней проверки» переносился
   * без единого мероприятия. Сопоставление искало «проверка» и «дата проверки»
   * по вхождению — а в заголовке стоит «проверки», да ещё и с лишним словом
   * посередине. Колонка объявлялась нераспознанной, дата уезжала в примечание, и
   * история проверок не переносилась вовсе, хотя мастер говорил «перенесено».
   */
  it('«Дата последней проверки» — это дата проверки', () => {
    const match = matchColumn('Дата последней проверки');
    expect(match.target).toBe('lastCheck');
    expect(match.confidence).toBe('средняя');
  });

  it('«Дата перезарядки огнетушителя» — это перезарядка', () => {
    expect(matchColumn('Дата перезарядки огнетушителя').target).toBe('lastRecharge');
  });

  it('«Отметка о проведённом осмотре» — это осмотр', () => {
    expect(matchColumn('Отметка о проведённом осмотре').target).toBe('lastCheck');
  });

  it('служебные колонки остаются служебными: «Дата следующей проверки»', () => {
    // Расчётное поле источника: принять его за факт значило бы записать в
    // журнал проверку, которой не было.
    const match = matchColumn('Дата следующей проверки');
    expect(match.target).toBe('ignore');
    expect(match.confidence).toBe('высокая');
  });

  it('чужое слово не притягивается по одной основе', () => {
    expect(matchColumn('Стоимость обслуживания, руб.').target).toBe('ignore');
  });
});

describe('дата из чужого журнала становится мероприятием', () => {
  /*
   * Найдено на стенде: перенос журнала огнетушителей создавал объекты, но ни
   * одной записи в истории. Подбор мероприятия шёл по списку кодов —
   * `osmotr`, `proverka`, `kontrol`, — а у огнетушителей работы называются
   * `lokalny-kvartalny-osmotr`, `ezhegodnaya-proverka`, `proverka-poroshka`.
   * Ни один код не совпадал, и дата проверки просто исчезала: перенесённые
   * огнетушители выходили просроченными в день переноса, хотя в исходном
   * журнале даты стояли.
   */
  it('дата проверки огнетушителя переносится', () => {
    const activities = datesToActivities('extinguisher-powder', '2025-03-15', null);
    expect(activities).toHaveLength(1);
    expect(activities[0]?.performedOn).toBe('2025-03-15');
  });

  it('заголовок колонки выбирает, какая это была проверка', () => {
    const yearly = datesToActivities('extinguisher-powder', '2025-03-15', null, 'Ежегодная проверка');
    expect(yearly[0]?.activityCode).toBe('ezhegodnaya-proverka');
  });

  it('названная периодичность, которой нет в регламенте, не подменяется соседней', () => {
    /*
     * Ежеквартальный осмотр огнетушителя действует только по решению
     * организации. Пока его не включили, дату из колонки «Квартальная проверка»
     * записать нечем — и записывать вместо неё ежегодную нельзя: это объявило бы
     * выполненной работу серьёзнее той, что была. Пропуск виден в отчёте.
     */
    expect(datesToActivities('extinguisher-powder', '2025-03-15', null, 'Квартальная проверка')).toEqual([]);
  });

  it('молчащий заголовок берёт проверку из применимых', () => {
    const guessed = datesToActivities('extinguisher-powder', '2025-03-15', null, 'Дата последней проверки');
    expect(guessed[0]?.activityCode).toBe('ezhegodnaya-proverka');
  });

  it('дата перезарядки переносится перезарядкой', () => {
    const activities = datesToActivities('extinguisher-powder', null, '2024-11-02');
    expect(activities).toEqual([{ activityCode: 'perezaryadka', performedOn: '2024-11-02' }]);
  });

  it('типу без пакета правил дата не приписывается', () => {
    expect(datesToActivities('нет-такого-типа', '2025-03-15', '2024-11-02')).toEqual([]);
  });
});
