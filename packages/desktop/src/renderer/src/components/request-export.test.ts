/**
 * Заявка на внешний подряд (ТЗ, Дополнение 6, часть С54).
 *
 * Проверяется то, что отличает заявку от журнала: состав граф задаёт
 * пользователь, значения подставляются из журнала, а своя графа остаётся
 * пустой — её заполняют от руки в готовом документе.
 */

import { describe, expect, it } from 'vitest';
import type { AppSettings, MaintenanceEvent, PlanObject, RequestTemplate, TreeNode } from '@izh/contracts';
import { DEFAULT_APP_SETTINGS } from '@izh/contracts';
import type { ActivityScheduleSource } from '@izh/core';
import { buildRequestExportRequest, requestCellValue, requestRows } from './request-export';

const TODAY = '2026-08-26';

const NODES: readonly TreeNode[] = [
  { id: 'этаж-2', parentId: 'корпус', kind: 'level', name: '2 этаж', elevationM: null, archivedAt: null },
] as unknown as readonly TreeNode[];

const OBJECT: PlanObject = {
  id: 'ОП-1', nodeId: 'этаж-2', typeCode: 'extinguisher-powder', regNumber: 'ОП-14',
  model: 'ОП-5(з)', manufacturer: 'Ярпожинвест', serialNumber: '12345',
  commissionedOn: '2026-01-15', responsible: null, note: 'Сорвана пломба', elevationM: null,
  position: { x: 1, y: 1 }, technicalState: 'требует ремонта', archivedAt: null,
} as unknown as PlanObject;

const EVENTS: readonly MaintenanceEvent[] = [
  {
    id: 'e1', objectId: 'ОП-1', activityCode: 'осмотр', performedOn: '2026-08-01',
    createdAt: '2026-08-01T10:00:00.000Z', result: 'выполнено с замечаниями', defect: null,
    checklist: [{ item: 'Пломба', result: 'не выполнено', defect: 'сорвана' }],
  },
] as unknown as readonly MaintenanceEvent[];

const SOURCE: ActivityScheduleSource = {
  rulesFor: () => [{
    activityCode: 'осмотр', title: 'Ежемесячный осмотр', periodicityMonths: 1,
    checklist: [], ndReference: 'ППР РФ №1479', needsVerification: false,
  }],
  nextDueOn: () => '2026-07-01',
};

const SETTINGS: AppSettings = DEFAULT_APP_SETTINGS;
const CONTEXT = { nodes: NODES, events: EVENTS, today: TODAY, settings: SETTINGS, source: SOURCE };

const TEMPLATE: RequestTemplate = {
  id: 't1',
  title: 'Шаблон подрядчика',
  documentTitle: 'Заявка на техническое обслуживание',
  typeCode: 'extinguisher-powder',
  columns: [
    { title: '№ п/п', source: 'номер' },
    { title: 'Наименование', source: 'наименование' },
    { title: 'Учётный номер', source: 'учётный-номер' },
    { title: 'Место установки', source: 'место' },
    { title: 'Характер неисправности', source: 'неисправность' },
    { title: 'Стоимость работ', source: 'свой' },
  ],
  footer: ['Заявку составил: ______ / ______ /'],
  createdAt: '2026-08-26T00:00:00.000Z',
};

const SNAPSHOT = {
  template: TEMPLATE, objects: [OBJECT], scopeTitle: 'Огнетушитель порошковый', context: CONTEXT,
};

describe('значения граф заявки', () => {
  it('подставляются из карточки и журнала', () => {
    expect(requestCellValue('номер', OBJECT, 0, CONTEXT)).toBe('1');
    expect(requestCellValue('наименование', OBJECT, 0, CONTEXT)).toBe('ОП-5(з)');
    expect(requestCellValue('учётный-номер', OBJECT, 0, CONTEXT)).toBe('ОП-14');
    expect(requestCellValue('место', OBJECT, 0, CONTEXT)).toContain('2 этаж');
    expect(requestCellValue('заводской-номер', OBJECT, 0, CONTEXT)).toBe('12345');
    // Даты в программе пишутся двузначным годом — так они влезают в графу.
    expect(requestCellValue('дата-ввода', OBJECT, 0, CONTEXT)).toBe('15.01.2026');
  });

  it('характер неисправности берётся из замечаний последней проверки', () => {
    // Ради этого заявку и подают: подрядчику нужно знать, что именно сломано.
    expect(requestCellValue('неисправность', OBJECT, 0, CONTEXT)).toBe('Пломба: сорвана');
  });

  it('просроченные работы называются вместе с датой', () => {
    expect(requestCellValue('просрочено', OBJECT, 0, CONTEXT)).toContain('Ежемесячный осмотр');
    expect(requestCellValue('просрочено', OBJECT, 0, CONTEXT)).toContain('01.07.2026');
  });

  it('своя графа остаётся пустой', () => {
    // Подставить туда что-нибудь «похожее» значило бы испортить её: графа
    // заведена как раз для того, чего программа не знает.
    expect(requestCellValue('свой', OBJECT, 0, CONTEXT)).toBe('');
  });

  it('незнакомая графа не роняет заявку', () => {
    expect(requestCellValue('графа-из-будущего', OBJECT, 0, CONTEXT)).toBe('');
  });
});

describe('документ заявки', () => {
  it('строки идут в том порядке, в каком заданы графы', () => {
    const rows = requestRows(SNAPSHOT);
    expect(rows[0]).toEqual(['1', 'ОП-5(з)', 'ОП-14', '2 этаж', 'Пломба: сорвана', '']);
  });

  it('оформлен так же, как журнал: альбомный Word и вкладка Excel', () => {
    const request = buildRequestExportRequest('word', SNAPSHOT);

    expect(request.wordHtml).toContain('mso-page-orientation:landscape');
    expect(request.html).toContain('Заявка на техническое обслуживание');
    expect(request.html).toContain('<th>Стоимость работ</th>');
    expect(request.sheets).toHaveLength(1);
    expect(request.sheets[0]?.name).toBe('Огнетушитель порошковый');
  });

  it('подписи печатаются под таблицей', () => {
    const request = buildRequestExportRequest('pdf', SNAPSHOT);
    expect(request.html).toContain('Заявку составил');
    expect(request.csv).toContain('Заявку составил');
  });

  it('заявка идёт одним листом: ни разрывов, ни нарезки таблицы', () => {
    /*
     * Заказчик: «формат скаченных заявок не нужно разделять на разные страницы
     * с титульным листом — где написано „заявка“, там же и продолжается лист с
     * таблицей, и таблица тоже не разделяется без необходимости».
     *
     * Оглавления у заявки нет, номера листов ни с чем не сверяются — резать её
     * незачем: печать перенесёт то, что не влезло, а шапка таблицы повторится
     * сама.
     */
    const много = Array.from({ length: 120 }, (_, i) => ({ ...OBJECT, id: 'о' + i }));
    const request = buildRequestExportRequest('pdf', { ...SNAPSHOT, objects: много });

    // Разрыв листа — это не правило в описании стилей, а сам разделитель в теле.
    const тело = request.html.slice(request.html.indexOf('<body>'));
    expect(тело).not.toContain('class="page-break"');
    expect(тело).not.toContain('section-start');
    expect(тело).not.toContain('(продолжение)');
    // Таблица одна на всю заявку, а не по таблице на лист.
    expect(request.html.split('<table').length - 1).toBe(1);
  });

  it('без отмеченных элементов таблицы в документе нет', () => {
    const request = buildRequestExportRequest('excel', { ...SNAPSHOT, objects: [] });
    expect(request.sheets).toHaveLength(0);
    expect(request.html).not.toContain('<table>');
  });
});
