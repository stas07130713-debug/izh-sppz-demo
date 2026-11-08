/**
 * Лента действий пользователя: ссылки вместо копий.
 *
 * Заказчик (пункт 10 перечня доработок): «в личном кабинете не требуется
 * создавать отдельную копию всей этой информации… История пользователя →
 * ссылка на основную запись истории, а не отдельная копия всей записи».
 *
 * Проверяется именно это: строка про проверку состоит из фразы и ссылки, а не
 * из перенесённого содержимого записи; строка про правку ведёт к самой
 * изменённой карточке; и всё это складывается в один список, свежее сверху.
 */

import { describe, expect, it } from 'vitest';
import type { AuditEvent, ChangeLogEntry, MaintenanceEvent, PlanObject } from '@izh/contracts';
import { userActivity } from '../access/user-activity.js';

const IVANOV = { id: 'u1', name: 'Иванов И. И.' };
const PETROV = { id: 'u2', name: 'Петров П. П.' };

function object(): PlanObject {
  return {
    id: 'o1', siteId: 's1', nodeId: 'n1', typeCode: 'fire-hydrant-indoor',
    regNumber: '24', model: null, manufacturer: null, serialNumber: null,
    commissionedOn: null, responsible: null, roomId: null, position: null,
    technicalState: 'исправен', note: null, archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', rowVersion: 1,
  } as PlanObject;
}

function check(): MaintenanceEvent {
  return {
    id: 'm1', siteId: 's1', objectId: 'o1', activityCode: 'osmotr',
    performedOn: '2026-09-05', result: 'выполнено', checklist: [],
    defect: null, executor: null, note: null, createdAt: '2026-09-05T08:00:00.000Z',
    signature: {
      signerId: IVANOV.id, signerName: IVANOV.name, signerPosition: null,
      signerRole: 'ответственный',
      signedAt: '2026-09-05T08:00:00.000Z', kind: 'запись журнала',
      contentHash: 'x', keyGeneration: 1, basis: null,
    },
  } as MaintenanceEvent;
}

function login(): AuditEvent {
  return {
    id: 'a1', at: '2026-09-05T07:00:00.000Z', actorId: IVANOV.id, actorName: IVANOV.name,
    actorRole: 'ответственный', kind: 'вход', subject: null, details: null,
  };
}

function edit(): ChangeLogEntry {
  return {
    id: 'c1', at: '2026-09-05T09:00:00.000Z', authorId: PETROV.id, authorName: PETROV.name,
    authorRole: 'администратор', command: 'Сохранить карточку объекта',
    action: 'изменено', subject: 'оборудование', subjectId: 'o1', subjectTitle: 'ПК № 24',
    nodeId: 'n1',
    fields: [{ title: 'учётный номер', before: '23', after: '24' }],
  };
}

describe('лента действий пользователя', () => {
  const all = userActivity({
    audit: [login()], changes: [edit()], maintenance: [check()], objects: [object()],
  });

  it('три журнала складываются в один список, свежее сверху', () => {
    expect(all.map((line) => line.source)).toEqual(['изменения', 'эксплуатация', 'действия']);
  });

  it('проверка показана фразой и ссылкой, а не копией записи', () => {
    const line = all.find((item) => item.source === 'эксплуатация');
    expect(line?.actorName).toBe(IVANOV.name);
    expect(line?.action).toBe('Выполнил проверку');
    expect(line?.subject).toBe('Пожарный кран № 24');
    // Ссылка на саму запись истории — по ней её и открывают.
    expect(line?.link?.historyId).toBe('m1');
    expect(line?.link?.objectId).toBe('o1');
    // Содержимого записи в ленте нет: ни чек-листа, ни замечаний.
    expect(line?.details).toBeNull();
  });

  it('правка ведёт к изменённой карточке и говорит, что поменялось', () => {
    const line = all.find((item) => item.source === 'изменения');
    expect(line?.action).toBe('Изменил: оборудование');
    expect(line?.details).toBe('учётный номер: 23 → 24');
    expect(line?.link?.objectId).toBe('o1');
  });

  it('служебные коды и «истина» переводятся при чтении', () => {
    /*
     * Записи журнала изменений хранятся годами и задним числом не
     * переписываются (AGENTS.md, правило 10). Значит, чинить их отображение
     * надо при чтении: заказчик смотрит в ленту и видит там `fire-door` и
     * `false` — записанные когда-то, но нечитаемые.
     */
    const старая: ChangeLogEntry = {
      ...edit(),
      subjectTitle: 'fire-door № 7',
      fields: [
        { title: 'вид элемента', before: 'extinguisher', after: 'extinguisher-powder' },
        { title: 'закрепление объектов', before: 'false', after: 'true' },
      ],
    };

    const [line] = userActivity({
      audit: [], changes: [старая], maintenance: [], objects: [],
    });

    expect(line?.subject).toBe('Противопожарная дверь, люк, штора № 7');
    expect(line?.details).toBe(
      'вид элемента: Огнетушитель → Огнетушитель порошковый; закрепление объектов: нет → да',
    );
  });

  it('отбор по человеку берёт события из всех трёх журналов', () => {
    const mine = userActivity({
      audit: [login()], changes: [edit()], maintenance: [check()], objects: [object()],
      userId: IVANOV.id,
    });
    expect(mine.map((line) => line.source)).toEqual(['эксплуатация', 'действия']);
  });

  it('неподписанная проверка никому не приписывается', () => {
    // Подпись — единственное место, где записана личность выполнившего.
    // Запись остаётся в журнале эксплуатации, но в ленту человека не идёт.
    const unsigned = { ...check(), signature: undefined } as MaintenanceEvent;
    const lines = userActivity({ audit: [], changes: [], maintenance: [unsigned], objects: [object()] });
    expect(lines).toEqual([]);
  });
});
