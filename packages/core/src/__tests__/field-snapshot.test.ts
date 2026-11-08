/**
 * Снимок для телефона собирается под учётную запись.
 *
 * Заказчик: «должна быть привязка к учётной записи». Значит, перенос обязан
 * соблюдать ту же область прав, что и экран: выдали цех — уезжает цех, а не
 * весь объект. Иначе телефон стал бы обходом разграничения, которое остальная
 * программа держит.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject, Room, TreeNode, UserAccount } from '@izh/contracts';
import { fieldSnapshot } from '../field/field-snapshot.js';

const NOW = '2026-09-10T06:00:00.000Z';

function node(id: string, parentId: string | null, archivedAt: string | null = null): TreeNode {
  return { id, parentId, name: id, kind: 'level', archivedAt, siteId: 'площадка' } as unknown as TreeNode;
}
function object(id: string, nodeId: string, archivedAt: string | null = null): PlanObject {
  return { id, nodeId, typeCode: 'extinguisher-powder', archivedAt } as unknown as PlanObject;
}
function room(id: string, levelId: string, archivedAt: string | null = null): Room {
  return { id, levelId, name: id, archivedAt } as unknown as Room;
}
function event(id: string, objectId: string): MaintenanceEvent {
  return { id, objectId, activityCode: 'osmotr', performedOn: '2026-08-01' } as unknown as MaintenanceEvent;
}

function user(role: UserAccount['role'], scope: readonly string[]): UserAccount {
  return { id: 'п1', role, scope, archivedAt: null } as unknown as UserAccount;
}

const nodes = [node('цех-а', null), node('этаж-а1', 'цех-а'), node('цех-б', null), node('этаж-б1', 'цех-б')];
const objects = [object('о1', 'этаж-а1'), object('о2', 'этаж-б1')];
const rooms = [room('п1', 'этаж-а1'), room('п2', 'этаж-б1')];
const events = [event('з1', 'о1'), event('з2', 'о2')];

describe('снимок для обхода', () => {
  it('администратору уезжает всё', () => {
    const snapshot = fieldSnapshot({ user: user('администратор', []), at: NOW, nodes, objects, rooms, events });

    expect(snapshot.nodes).toHaveLength(4);
    expect(snapshot.objects.map((item) => item.id)).toEqual(['о1', 'о2']);
    expect(snapshot.forUserId).toBe('п1');
  });

  it('ответственному уезжает только его область', () => {
    const snapshot = fieldSnapshot({ user: user('ответственный', ['цех-а']), at: NOW, nodes, objects, rooms, events });

    // Цех и то, что внутри: права идут вниз по дереву.
    expect(snapshot.nodes.map((item) => item.id)).toEqual(['цех-а', 'этаж-а1']);
    expect(snapshot.objects.map((item) => item.id)).toEqual(['о1']);
    expect(snapshot.rooms.map((item) => item.id)).toEqual(['п1']);
  });

  it('записи журнала уезжают только по уехавшему оборудованию', () => {
    const snapshot = fieldSnapshot({ user: user('ответственный', ['цех-а']), at: NOW, nodes, objects, rooms, events });

    // Чужие записи на обходе не нужны, и терять их вместе с телефоном незачем.
    expect(snapshot.events.map((item) => item.id)).toEqual(['з1']);
  });

  it('выведенное из эксплуатации не уезжает вовсе', () => {
    const withArchived = {
      user: user('администратор', []),
      at: NOW,
      nodes: [...nodes, node('этаж-снят', 'цех-а', NOW)],
      objects: [...objects, object('о-снят', 'этаж-а1', NOW)],
      rooms: [...rooms, room('п-снято', 'этаж-а1', NOW)],
      events: [...events, event('з-снят', 'о-снят')],
    };
    const snapshot = fieldSnapshot(withArchived);

    expect(snapshot.nodes.map((item) => item.id)).not.toContain('этаж-снят');
    expect(snapshot.objects.map((item) => item.id)).not.toContain('о-снят');
    expect(snapshot.rooms.map((item) => item.id)).not.toContain('п-снято');
    expect(snapshot.events.map((item) => item.id)).not.toContain('з-снят');
  });

  it('гостю без выданных узлов не уезжает ничего', () => {
    const snapshot = fieldSnapshot({ user: user('гость', []), at: NOW, nodes, objects, rooms, events });

    expect(snapshot.nodes).toHaveLength(0);
    expect(snapshot.objects).toHaveLength(0);
    expect(snapshot.events).toHaveLength(0);
  });
});
