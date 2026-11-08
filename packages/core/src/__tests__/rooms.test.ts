/**
 * Эталонные тесты помещений.
 *
 * Главное, что здесь закреплено: площадь считается по обводке и масштабу плана,
 * а не вводится руками, и без масштаба не выдумывается.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 5.5.
 */

import { describe, expect, it } from 'vitest';
import type { PixelPoint, RoomRepository } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { RoomDeps } from '../rooms/room-deps.js';
import {
  archiveRoom, clearRoomOutline, createRoom, setRoomOutline, updateRoom,
} from '../rooms/room-scenarios.js';
import { polygonAreaM2, polygonAreaPx } from '../rooms/room-area.js';
import { fakeClock, fakeIdGenerator } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

function fakeRoomRepository(): RoomRepository {
  const rooms = new Map<string, import('@izh/contracts').Room>();
  return {
    async listByLevel(levelId) {
      return ok([...rooms.values()].filter((room) => room.levelId === levelId));
    },
    async list() {
      return ok([...rooms.values()]);
    },
    async getById(id) {
      const found = rooms.get(id);
      if (found === undefined) return err('NOT_FOUND', `Нет помещения ${id}.`);
      return ok(found);
    },
    async save(room) {
      rooms.set(room.id, room);
      return ok(undefined);
    },
  };
}

/** Квадрат 100 × 100 точек. */
const SQUARE: readonly PixelPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('площадь по обводке', () => {
  it('считает площадь многоугольника в точках', () => {
    expect(polygonAreaPx(SQUARE)).toBe(10_000);
  });

  it('не зависит от направления обхода', () => {
    expect(polygonAreaPx([...SQUARE].reverse())).toBe(10_000);
  });

  it('переводит в метры по масштабу плана', () => {
    // 0.05 м в точке: 100 точек — это 5 м, значит квадрат 5 × 5 = 25 м².
    expect(polygonAreaM2(SQUARE, 0.05)).toBe(25);
  });

  it('считает площадь любой замкнутой фигуры, а не только прямоугольника', () => {
    // Буква «Г»: 100 × 100 без вырезанного квадрата 50 × 50.
    const shape: readonly PixelPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(polygonAreaPx(shape)).toBe(7_500);
  });

  it('без масштаба площадь не выдумывается', () => {
    expect(polygonAreaM2(SQUARE, null)).toBeNull();
  });

  it('вырожденная обводка площади не даёт', () => {
    expect(polygonAreaM2([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }], 0.05)).toBeNull();
  });
});

async function makeRoomDeps(): Promise<{ deps: RoomDeps; levelId: string; buildingId: string }> {
  const treeDeps = makeTreeDeps();
  const { level, building } = await makeSampleTree(treeDeps);
  return {
    deps: { rooms: fakeRoomRepository(), tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() },
    levelId: level.id,
    buildingId: building.id,
  };
}

describe('помещения этажа', () => {
  it('заводится с категорией и документом-основанием', async () => {
    const { deps, levelId } = await makeRoomDeps();

    const room = value(
      await createRoom(deps, {
        levelId,
        name: 'Электрощитовая',
        number: '105',
        category: 'В4',
        categoryBasis: 'Расчёт категорий 2024 г.',
      }),
    );

    expect(room.category).toBe('В4');
    expect(room.areaM2).toBeNull();
    expect(room.outline).toBeNull();
  });

  it('заводится только на этаже, а не на здании или складе', async () => {
    const { deps, buildingId } = await makeRoomDeps();

    const result = await createRoom(deps, { levelId: buildingId, name: 'Помещение' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('на этаже');
  });

  it('не заводит два одноимённых помещения на одном этаже', async () => {
    const { deps, levelId } = await makeRoomDeps();
    await createRoom(deps, { levelId, name: 'Коридор' });

    const again = await createRoom(deps, { levelId, name: '  Коридор ' });
    expect(again.ok).toBe(false);
  });

  it('обводка задаёт площадь', async () => {
    const { deps, levelId } = await makeRoomDeps();
    const room = value(await createRoom(deps, { levelId, name: 'Склад ГСМ', category: 'В1' }));

    const outlined = value(await setRoomOutline(deps, { id: room.id, points: SQUARE, metersPerPixel: 0.05 }));

    expect(outlined.areaM2).toBe(25);
    expect(outlined.outline).toHaveLength(4);
    expect(outlined.rowVersion).toBe(room.rowVersion + 1);
  });

  it('без масштаба плана обводка сохраняется, а площадь остаётся неизвестной', async () => {
    const { deps, levelId } = await makeRoomDeps();
    const room = value(await createRoom(deps, { levelId, name: 'Кабинет' }));

    const outlined = value(await setRoomOutline(deps, { id: room.id, points: SQUARE, metersPerPixel: null }));

    expect(outlined.outline).toHaveLength(4);
    expect(outlined.areaM2).toBeNull();
  });

  it('двух точек для помещения мало', async () => {
    const { deps, levelId } = await makeRoomDeps();
    const room = value(await createRoom(deps, { levelId, name: 'Кабинет' }));

    const result = await setRoomOutline(deps, {
      id: room.id,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      metersPerPixel: 0.05,
    });
    expect(result.ok).toBe(false);
  });

  it('обводку можно снять, не трогая помещение', async () => {
    /*
     * Разбор жалобы: «выделяется достаточно криво, никак эту отметку не снять».
     * Обвести заново было можно, а убрать — нечем, и кривая фигура оставалась
     * на плане до удаления самого помещения.
     */
    const { deps, levelId } = await makeRoomDeps();
    const room = value(await createRoom(deps, { levelId, name: 'Электрощитовая', category: 'В4' }));
    const outlined = value(await setRoomOutline(deps, { id: room.id, points: SQUARE, metersPerPixel: 0.05 }));

    const cleared = value(await clearRoomOutline(deps, room.id));

    expect(cleared.outline).toBeNull();
    // Площадь считалась из обводки: без фигуры она была бы числом ниоткуда.
    expect(cleared.areaM2).toBeNull();
    expect(cleared.name).toBe('Электрощитовая');
    expect(cleared.category).toBe('В4');
    expect(cleared.rowVersion).toBe(outlined.rowVersion + 1);
  });

  it('снимать нечего — помещение не трогается', async () => {
    const { deps, levelId } = await makeRoomDeps();
    const room = value(await createRoom(deps, { levelId, name: 'Кабинет' }));

    const cleared = value(await clearRoomOutline(deps, room.id));

    // Пустая правка не плодит версию: по журналу изменений видно только то,
    // что действительно менялось.
    expect(cleared.rowVersion).toBe(room.rowVersion);
  });

  it('правка карточки не стирает обводку и площадь', async () => {
    const { deps, levelId } = await makeRoomDeps();
    const room = value(await createRoom(deps, { levelId, name: 'Насосная' }));
    await setRoomOutline(deps, { id: room.id, points: SQUARE, metersPerPixel: 0.05 });

    const updated = value(await updateRoom(deps, { id: room.id, name: 'Насосная станция', category: 'Д' }));

    expect(updated.name).toBe('Насосная станция');
    expect(updated.areaM2).toBe(25);
    expect(updated.outline).toHaveLength(4);
  });

  it('вывод из эксплуатации не удаляет запись', async () => {
    const { deps, levelId } = await makeRoomDeps();
    const room = value(await createRoom(deps, { levelId, name: 'Бывшая кладовая' }));

    const archived = value(await archiveRoom(deps, room.id));
    expect(archived.archivedAt).not.toBeNull();
    expect(value(await deps.rooms.getById(room.id)).archivedAt).not.toBeNull();
  });
});
