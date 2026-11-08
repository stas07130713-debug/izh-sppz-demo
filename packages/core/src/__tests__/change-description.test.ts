/**
 * Перевод изменений сущностей в записи журнала.
 *
 * Заказчик (пункт 9 перечня доработок): история должна отражать все значимые
 * изменения — создание, изменение и удаление записей и элементов, перемещение,
 * состояние, данные здания и этажа, настройки, — и хранить по каждому событию
 * тип объекта, его ID, что именно изменилось, старое и новое значение.
 *
 * Здесь проверяется именно перевод: из пары «было — стало» должны получаться
 * читаемые запись и перечень полей.
 */

import { describe, expect, it } from 'vitest';
import type { HistoryEntityChange } from '@izh/contracts';
import { describeChange } from '../access/change-description.js';

function object(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'o1',
    siteId: 's1',
    nodeId: 'n1',
    typeCode: 'ognetushitel',
    regNumber: 'ОП-12',
    model: 'ОП-5',
    manufacturer: null,
    serialNumber: null,
    commissionedOn: null,
    responsible: null,
    position: null,
    technicalState: 'исправен',
    note: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rowVersion: 1,
    ...overrides,
  };
}

function change(kind: HistoryEntityChange['kind'], before: unknown, after: unknown): HistoryEntityChange {
  return { kind, id: 'o1', before, after };
}

describe('описание изменения для журнала', () => {
  it('заведение элемента: вид, ID и читаемое название', () => {
    const described = describeChange(change('object', null, object()));
    expect(described).not.toBeNull();
    if (described === null) return;

    expect(described.action).toBe('заведено');
    expect(described.subject).toBe('оборудование');
    expect(described.subjectId).toBe('o1');
    expect(described.subjectTitle).toBe('ОП-5 № ОП-12');
    expect(described.nodeId).toBe('n1');
  });

  it('изменение карточки: только изменившиеся поля, со старым и новым значением', () => {
    const described = describeChange(change(
      'object',
      object(),
      object({ regNumber: 'ОП-13', responsible: 'Иванов И. И.', rowVersion: 2, updatedAt: '2026-02-01T00:00:00.000Z' }),
    ));
    expect(described).not.toBeNull();
    if (described === null) return;

    expect(described.action).toBe('изменено');
    expect(described.fields).toEqual([
      { title: 'учётный номер', before: 'ОП-12', after: 'ОП-13' },
      { title: 'ответственный', before: null, after: 'Иванов И. И.' },
    ]);
  });

  it('служебные поля в журнал не идут', () => {
    // Версия записи и время правки меняются при каждом сохранении и ничего не
    // говорят человеку: строка о них мешала бы найти настоящее изменение.
    const described = describeChange(change(
      'object',
      object(),
      object({ rowVersion: 9, updatedAt: '2026-03-01T00:00:00.000Z' }),
    ));
    expect(described).toBeNull();
  });

  it('вывод из обращения — это удаление, а не правка', () => {
    const described = describeChange(change(
      'object',
      object(),
      object({ archivedAt: '2026-02-01T00:00:00.000Z' }),
    ));
    expect(described?.action).toBe('удалено');
  });

  it('возврат в обращение — восстановление', () => {
    const described = describeChange(change(
      'object',
      object({ archivedAt: '2026-02-01T00:00:00.000Z' }),
      object(),
    ));
    expect(described?.action).toBe('восстановлено');
  });

  it('перемещение элемента видно как смена места', () => {
    const described = describeChange(change('object', object(), object({ nodeId: 'sklad' })));
    expect(described?.fields).toEqual([
      { title: 'место в дереве', before: 'n1', after: 'sklad' },
    ]);
    // Узел записи — новый: искать перемещение будут там, куда элемент попал.
    expect(described?.nodeId).toBe('sklad');
  });

  it('данные этажа: отметка и название', () => {
    const level = {
      id: 'n2', siteId: 's1', parentId: 'n1', kind: 'level',
      name: 'Этаж 1', code: null, elevationM: null, note: null, building: null,
      sortOrder: 1, inCommonJournal: true, objectsPinned: false, archivedAt: null,
    };
    const described = describeChange(change('tree', level, { ...level, elevationM: 4.2 }));
    expect(described?.subject).toBe('узел дерева');
    expect(described?.subjectTitle).toBe('Этаж 1');
    // Узел записи — он сам: журнал по этажу должен показать правку этажа.
    expect(described?.nodeId).toBe('n2');
    expect(described?.fields).toEqual([
      { title: 'отметка уровня, м', before: null, after: '4.2' },
    ]);
  });

  it('характеристики здания сравниваются по полям, а не целиком', () => {
    const building = {
      id: 'n1', siteId: 's1', parentId: null, kind: 'building',
      name: 'Корпус 1', code: null, elevationM: null, note: null,
      building: { fireResistance: 'II' }, sortOrder: 1,
      inCommonJournal: true, objectsPinned: false, archivedAt: null,
    };
    const described = describeChange(change(
      'tree', building, { ...building, building: { fireResistance: 'III' } },
    ));
    // Не «{…} → {…}» с полусотней ключей в скобках, а именно то поле,
    // которое поменялось: заказчик просит старое и новое значение.
    expect(described?.fields).toEqual([
      { title: 'характеристики пожарной безопасности · предел огнестойкости', before: 'II', after: 'III' },
    ]);
  });

  it('помещение относится к своему этажу', () => {
    const room = {
      id: 'r1', siteId: 's1', levelId: 'n2', name: 'Электрощитовая',
      number: null, category: 'В2', categoryBasis: null, purpose: null,
      fireClasses: [], areaM2: null, outline: null, archivedAt: null,
    };
    const described = describeChange(change('room', room, { ...room, category: 'В1' }));
    expect(described?.subject).toBe('помещение');
    expect(described?.nodeId).toBe('n2');
    expect(described?.fields).toEqual([
      { title: 'категория помещения', before: 'В2', after: 'В1' },
    ]);
  });

  it('настройки программы записываются без узла дерева', () => {
    const described = describeChange(change('settings', { soonDays: 30 }, { soonDays: 14 }));
    // Поля настроек в словаре названий нет, значит показывать нечего — но и
    // выдумывать «soonDays: 30 → 14» журнал не должен.
    expect(described).toBeNull();
  });

  it('пустое изменение не записывается', () => {
    expect(describeChange(change('object', null, null))).toBeNull();
  });
});
