import { describe, expect, it } from 'vitest';
import { buildJournalExportRequest, type ExportJournalRow, type JournalExportSection } from './journal-export';

function row(overrides: Partial<ExportJournalRow> = {}): ExportJournalRow {
  return {
    number: 1,
    name: 'ОП-5',
    registrationNumber: 'ОП-01',
    place: 'Помещение <101>',
    state: 'исправен',
    activities: [{ title: 'Осмотр', lastDate: '01.08.2026', nextDate: '01.09.2026', status: 'скоро' }],
    card: ['заряжен 05.2026'],
    responsible: 'Иванов И.И.',
    note: 'Проверить пломбу',
    ...overrides,
  };
}

function section(
  equipmentTitle: string,
  cardTitles: readonly string[],
  rows: readonly ExportJournalRow[],
  typeCode: string | null = 'extinguisher-powder',
): JournalExportSection {
  return { equipmentTitle, cardTitles, rows, typeCode };
}

const SNAPSHOT_HEAD = {
  title: 'Журнал СППЗ — Корпус № 1',
  scopeTitle: 'Огнетушители',
  objectTitle: 'АО «Пример» · Цех № 1 · Корпус № 1',
};

describe('выгрузка журнала', () => {
  it('собирает CSV и печатную страницу из показанных строк', () => {
    const request = buildJournalExportRequest('excel', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });

    expect(request.suggestedName).toContain('Корпус № 1');
    expect(request.csv).toContain('"ОП-01"');
    expect(request.csv).toContain('"01.09.2026 (скоро)"');
    expect(request.html).toContain('Помещение &lt;101&gt;');
    expect(request.html).not.toContain('Помещение <101>');
  });

  it('сведения карточки идут своей графой, а не в примечании', () => {
    // Обновление эталона 26.08.2026: в печатном журнале данные карточки
    // оказывались в «Примечании» — чужой текст не в своей графе. Теперь графы
    // те же, что на экране, и берутся из одного описания (journal-columns.ts).
    const request = buildJournalExportRequest('pdf', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки огнетушителя'], [row()])],
    });

    expect(request.html).toContain('<th>Данные карточки огнетушителя</th>');
    expect(request.html).toContain('<td>заряжен 05.2026</td>');
    expect(request.html).toContain('<td>Проверить пломбу</td>');
    // Наименование, учётный номер и ответственный — тоже отдельными графами.
    expect(request.html).toContain('<th>Наименование</th>');
    expect(request.html).toContain('<th>Учётный номер</th>');
    expect(request.html).toContain('<td>Иванов И.И.</td>');
  });

  it('у каждого вида своя шапка, а не шапка первого', () => {
    const request = buildJournalExportRequest('excel', {
      title: 'Журнал СППЗ — Корпус № 1',
      scopeTitle: 'Внутри здания',
      objectTitle: 'АО «Пример» · Цех · Здание',
      sections: [
        section('Огнетушители', ['Данные карточки'], [row()]),
        section('Пожарные краны', ['Диаметры'], [row({
          name: 'ПК',
          registrationNumber: 'ПК-01',
          activities: [{ title: 'Проверка водоотдачи', lastDate: '—', nextDate: '01.10.2026', status: 'норма' }],
          card: ['DN 50'],
        })]),
      ],
    });

    expect(request.csv).toContain('Осмотр: последняя');
    expect(request.csv).toContain('Проверка водоотдачи: последняя');
    expect(request.html.match(/<table>/g)).toHaveLength(2);
    expect(request.html).toContain('Пожарные краны</h2>');
  });

  it('каждый вид — своей вкладкой книги, с закреплённой шапкой', () => {
    const request = buildJournalExportRequest('excel', {
      title: 'Журнал СППЗ — Корпус № 1',
      scopeTitle: 'Внутри здания',
      objectTitle: 'АО «Пример» · Цех · Здание',
      sections: [
        section('Огнетушители', ['Данные карточки'], [row()]),
        section('Пожарные краны', ['Диаметры'], [row({ registrationNumber: 'ПК-01' })]),
      ],
    });

    // Первая вкладка книги — титул и содержание, дальше разделы своими.
    expect(request.sheets.map((sheet) => sheet.name)).toEqual(['Содержание', 'Огнетушители', 'Пожарные краны']);
    const first = request.sheets[1];
    expect(first?.frozenRows).toBe(3);
    // Заголовок книги, название вида, шапка таблицы — и только потом данные.
    expect(first?.rowKinds).toEqual(['заголовок', 'заголовок', 'шапка']);
    expect(first?.rows[2]?.[0]).toBe('№');
    expect(first?.columnWidths.length).toBe(first?.rows[2]?.length);
  });

  it('ширина колонки считается по самому длинному значению', () => {
    // «Подогнана, чтобы текст влезал»: колонка по заголовку в три знака
    // прятала бы фразу карточки, а колонка по фразе растянулась бы на
    // пол-экрана — отсюда потолок.
    const request = buildJournalExportRequest('excel', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row({
        card: ['перезаряжен 05.2026, корпус без вмятин, пломба цела, манометр в зелёной зоне, ещё сведения'],
      })])],
    });

    const widths = request.sheets.find((sheet) => sheet.name !== 'Содержание')?.columnWidths ?? [];
    const cardColumn = widths[widths.length - 3];
    expect(cardColumn).toBe(46);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(9);
  });

  it('Word получает свою разметку с альбомным разделом', () => {
    // Word не понимает `@page` с размером листа и печатает книжно, обрезая
    // половину граф. Альбомным его делает только описание раздела.
    const request = buildJournalExportRequest('word', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });

    expect(request.wordHtml).toContain('mso-page-orientation:landscape');
    expect(request.wordHtml).toContain('div.WordSection1');
    expect(request.wordHtml).toContain('<div class="WordSection1">');
  });

  it('проверка встаёт в свою колонку, даже если у элемента её нет', () => {
    // Иначе у крана без осмотра водоотдача сдвинулась бы на его место, и в
    // журнале оказалась бы дата не от той работы.
    const both = section('Пожарные краны', [], [
      row({
        registrationNumber: 'ПК-01',
        card: [],
        activities: [
          { title: 'Осмотр', lastDate: '01.08.2026', nextDate: '01.09.2026', status: 'скоро' },
          { title: 'Водоотдача', lastDate: '01.02.2026', nextDate: '01.08.2026', status: 'норма' },
        ],
      }),
      row({
        number: 2,
        registrationNumber: 'ПК-02',
        card: [],
        activities: [{ title: 'Водоотдача', lastDate: '05.05.2026', nextDate: '05.11.2026', status: 'норма' }],
      }),
    ]);

    const request = buildJournalExportRequest('excel', {
      title: 'Журнал СППЗ — Корпус № 1',
      scopeTitle: 'Пожарные краны',
      objectTitle: 'АО «Пример» · Цех · Здание',
      sections: [both],
    });

    const second = request.sheets
      .find((sheet) => sheet.name !== 'Содержание')?.rows.find((item) => item[2] === 'ПК-02');
    expect(second).toBeDefined();
    // Графы: № | наименование | учётный номер | место | состояние | Осмотр×2 | Водоотдача×2 | …
    expect(second?.[5]).toBe('');
    expect(second?.[6]).toBe('');
    expect(second?.[7]).toBe('05.05.2026');
    expect(second?.[8]).toBe('05.11.2026 (норма)');
  });
});

describe('титульный лист и оглавление', () => {
  /*
   * Заказчик (пункт 8 перечня доработок): «журналы нужно сделать с нормальным
   * титульным листом и сформированным оглавлением в виде таблицы, куда
   * подтягиваются разделы согласно составу выгружаемого журнала… там, где даты
   * начала и конца, должна быть дата формирования журнала… разделы — по нашему
   * принципу: снаружи здания, внутри здания, автоматика, и в их составе уже
   * отдельные элементы и номера страниц».
   */
  it('титул устроен как у бумажного журнала', () => {
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });

    expect(request.html).toContain('class="cover"');
    // Наименование организации сверху, под чертой.
    expect(request.html).toContain('наименование организации');
    expect(request.html).toContain('АО «Пример»');
    // Название журнала: «ЖУРНАЛ» и подзаголовок под ним.
    expect(request.html).toContain('>ЖУРНАЛ<');
    expect(request.html).toContain('эксплуатации систем противопожарной защиты');
    // Объект — полный путь по дереву.
    expect(request.html).toContain('АО «Пример» · Цех № 1 · Корпус № 1');
  });

  it('вместо «Начат» и «Окончен» — дата формирования', () => {
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });

    expect(request.html).toContain('Выгружен из электронного журнала:');
    expect(request.html).not.toContain('Начат');
    expect(request.html).not.toContain('Окончен');
  });

  it('оглавление — таблица с разделами и страницами', () => {
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [
        section('Огнетушители', ['Данные карточки'], [row()]),
        section('Пожарные краны', ['Данные карточки'], [row()], 'fire-hydrant-indoor'),
      ],
    });

    expect(request.html).toContain('Содержание журнала');
    expect(request.html).toContain('<th>Номер раздела журнала</th>');
    expect(request.html).toContain('<th>Наименование раздела журнала</th>');
    expect(request.html).toContain('<th>Страница начала раздела</th>');
    // Оба вида — внутри здания, значит один раздел и два вида в нём.
    expect(request.html).toContain('Первичные средства и оборудование внутри здания');
    expect(request.html).toContain('Огнетушители');
    expect(request.html).toContain('Пожарные краны');
    // Первый раздел начинается с третьего листа: титул и оглавление — первые два.
    expect(request.html).toContain('стр. 3');
  });

  it('разделы идут по нашему делению', () => {
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [
        section('Огнетушители', ['Данные карточки'], [row()]),
        section('Пожарные извещатели', ['Данные карточки'], [row()], 'smoke-detector'),
        section('Гидранты', ['Данные карточки'], [row()], 'hydrant'),
      ],
    });

    expect(request.html).toContain('Системы пожарной автоматики');
    expect(request.html).toContain('Первичные средства и оборудование внутри здания');
    expect(request.html).toContain('Оборудование снаружи здания');
  });

  it('оглавление не обещает раздела, которого дальше нет', () => {
    // Пустые разделы в журнал не попадают — не должны они попадать и в
    // оглавление, иначе по нему ищут то, чего в документе не окажется.
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [
        section('Огнетушители', ['Данные карточки'], [row()]),
        section('Пожарные краны', ['Данные карточки'], [], 'fire-hydrant-indoor'),
      ],
    });

    expect(request.html).not.toContain('Пожарные краны');
  });

  it('титул и оглавление занимают по листу, раздел начинается с нового', () => {
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });
    expect(request.html).toContain('page-break-after:always');
    expect(request.html).toContain('page-break-before:always');
  });

  it('в Word титул и оглавление тоже есть', () => {
    // Word — основной формат сдачи: без титула там журнал не журнал.
    const request = buildJournalExportRequest('word', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });
    expect(request.wordHtml ?? '').toContain('эксплуатации систем противопожарной защиты');
    expect(request.wordHtml ?? '').toContain('Содержание журнала');
  });

  it('в CSV обложки нет: это данные, а не документ', () => {
    const request = buildJournalExportRequest('excel', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });
    expect(request.csv).not.toContain('Содержание журнала');
  });
});

describe('листы журнала (второй круг замечаний)', () => {
  const request = buildJournalExportRequest('print', {
    ...SNAPSHOT_HEAD,
    sections: [
      section('Огнетушители', ['Данные карточки'], [row()]),
      section('Извещатели', ['Данные карточки'], [row()], 'smoke-detector'),
    ],
  });

  it('титул, оглавление и журнал — каждый со своего листа', () => {
    // Заказчик: «титул должен быть отдельно на странице, а оглавление на
    // отдельных страницах, а сам журнал с новой страницы».
    expect(request.html).toContain('.cover{page-break-after:always');
    expect(request.html).toContain('.contents{page-break-after:always');
    expect(request.html).toContain('.section-start{page-break-before:always');
    // Прежнего исключения для первого раздела больше нет: он тоже с нового листа.
    expect(request.html).not.toContain('.contents + .section-start');
  });

  it('название раздела в оглавлении — по середине строки', () => {
    expect(request.html).toContain('.contents-group td:nth-child(2){text-align:center}');
  });

  it('поля листа оставляют место под номер страницы', () => {
    // Сам номер ставит печать: правило @page с колонтитулом Chromium не понимает.
    expect(request.html).toContain('@page{size:A4 landscape;margin:10mm 10mm 14mm}');
    expect(request.html).not.toContain('bottom-center');
  });

  it('в Word номер листа — полем в нижнем колонтитуле', () => {
    const word = request.wordHtml ?? '';
    expect(word).toContain('mso-footer:f1');
    expect(word).toContain('PAGE');
  });

  it('в книге титул и содержание — первой вкладкой и по-человечески', () => {
    const excel = buildJournalExportRequest('excel', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });

    const contents = excel.sheets[0];
    expect(contents?.name).toBe('Содержание');
    // Титул набран карточкой: подпись слева, значение справа.
    expect(contents?.rows[0]?.[0]).toBe('ЖУРНАЛ эксплуатации систем противопожарной защиты');
    expect(contents?.rows.find((line) => line[0] === 'Выгружен из электронного журнала')?.[1]).toBeTruthy();
    // Виды строк расставлены: иначе книга красит всё одинаково.
    expect(contents?.rowKinds.length).toBe(contents?.rows.length);
    expect(contents?.rowKinds[0]).toBe('заголовок');
    expect(contents?.rowKinds).toContain('шапка');
  });
});

describe('номера листов совпадают с документом (третий круг замечаний)', () => {
  /*
   * Заказчик: «нумерация страниц в содержании и по факту не совпадает».
   *
   * Совпадение держится на одном: документ сам режет таблицу на листы по
   * известному числу строк, а оглавление считает по тому же числу. Здесь это и
   * проверяется — сколько разрывов листа в документе, столько же листов
   * обещано в оглавлении.
   */
  function pageBreaks(html: string): number {
    return (html.match(/class="page-break"/g) ?? []).length;
  }

  it('лист, обещанный оглавлением, — тот же, что в документе', () => {
    // Огнетушителей на два листа, кранов на один: краны должны начаться с
    // третьего листа раздела, то есть с пятого листа документа.
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [
        section('Огнетушители', ['Данные карточки'], Array.from({ length: 20 }, () => row())),
        section('Пожарные краны', ['Данные карточки'], [row()], 'fire-hydrant-indoor'),
      ],
    });

    // Титул → содержание → лист огнетушителей → их продолжение → краны.
    expect(pageBreaks(request.html)).toBe(4);
    expect(request.html).toContain('Огнетушители (продолжение)');
    // Огнетушители с третьего листа, продолжение на четвёртом, краны с пятого.
    expect(request.html).toContain('стр. 3');
    expect(request.html).toContain('стр. 5');
  });

  it('титул кончается разрывом листа', () => {
    const request = buildJournalExportRequest('word', {
      ...SNAPSHOT_HEAD,
      sections: [section('Огнетушители', ['Данные карточки'], [row()])],
    });

    // Word правила разрыва на блоке слушает не всегда — отсюда особый знак.
    expect(request.wordHtml ?? '').toContain('mso-special-character:line-break');
  });
});

describe('порядок разделов', () => {
  it('журнал печатает разделы в том же порядке, что обещает оглавление', () => {
    /*
     * Оглавление складывает виды по разделам — автоматика, внутри здания,
     * снаружи, — а таблицы приходят в порядке журнала. Печатать их в разном
     * порядке значит обещать лист, на котором раздела не окажется: именно так
     * и вышло при первой проверке.
     */
    const request = buildJournalExportRequest('print', {
      ...SNAPSHOT_HEAD,
      sections: [
        section('Огнетушители', ['Данные карточки'], [row()]),
        section('Извещатели', ['Данные карточки'], [row()], 'smoke-detector'),
      ],
    });

    const detectors = request.html.indexOf('<h2 class="section-start">Извещатели');
    const extinguishers = request.html.indexOf('<h2 class="section-start">Огнетушители');
    // Автоматика идёт первой — как в оглавлении.
    expect(detectors).toBeGreaterThan(-1);
    expect(detectors).toBeLessThan(extinguishers);
  });
});
