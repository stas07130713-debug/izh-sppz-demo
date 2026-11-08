/**
 * Сценарии работы с помещениями этажа.
 *
 * Помещение заводится в карточке этажа, а обводится на плане отдельным
 * действием: заполнить экспликацию можно сразу, а до плана дело доходит позже.
 * Поэтому создание и обводка — разные сценарии.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 5.5.
 */

import type { PixelPoint, Result, Room, RoomId, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { RoomDeps } from './room-deps.js';
import { polygonAreaM2 } from './room-area.js';

export interface CreateRoomInput {
  readonly levelId: TreeNodeId;
  readonly name: string;
  readonly number?: string | null;
  readonly category?: string | null;
  readonly categoryBasis?: string | null;
  readonly heightM?: number | null;
  /** Назначение: от него зависит норма расстояния до огнетушителя. */
  readonly purpose?: string | null;
  /** Классы возможного пожара: A, B, C, D, E. */
  readonly fireClasses?: readonly string[];
  /** Помещение под автоматической установкой пожаротушения. */
  readonly hasSuppression?: boolean;
}

function clean(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = raw.trim().replace(/\s+/g, ' ');
  return value.length === 0 ? null : value;
}

export async function createRoom(deps: RoomDeps, input: CreateRoomInput): Promise<Result<Room>> {
  const name = clean(input.name);
  if (name === null) return err('INVALID_ARGUMENT', 'У помещения должно быть название.');

  const level = await deps.tree.getById(input.levelId);
  if (!level.ok) return level;

  // Помещения ведутся только на этаже: на генплане здания и на складе их нет.
  if (level.value.kind !== 'level') {
    return err('INVALID_ARGUMENT', 'Помещения заводятся на этаже, а не на другом уровне дерева.');
  }
  if (level.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', `Этаж «${level.value.name}» выведен из эксплуатации.`);
  }

  const existing = await deps.rooms.listByLevel(input.levelId);
  if (!existing.ok) return existing;

  const lowered = name.toLocaleLowerCase('ru');
  const duplicate = existing.value.find(
    (room) => room.archivedAt === null && room.name.toLocaleLowerCase('ru') === lowered,
  );
  if (duplicate !== undefined) {
    return err('INVALID_ARGUMENT', `Помещение «${name}» на этом этаже уже заведено.`);
  }

  const now = deps.clock.nowUtc();
  const room: Room = {
    id: deps.ids.newId(),
    siteId: level.value.siteId,
    levelId: level.value.id,
    name,
    number: clean(input.number),
    category: clean(input.category),
    categoryBasis: clean(input.categoryBasis),
    heightM: input.heightM ?? null,
    purpose: clean(input.purpose),
    fireClasses: input.fireClasses ?? [],
    hasSuppression: input.hasSuppression ?? false,
    outline: null,
    areaM2: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1,
  };

  const saved = await deps.rooms.save(room);
  if (!saved.ok) return saved;
  return ok(room);
}

export interface UpdateRoomInput {
  readonly id: RoomId;
  readonly name: string;
  readonly number?: string | null;
  readonly category?: string | null;
  readonly categoryBasis?: string | null;
  readonly heightM?: number | null;
  /** Назначение: от него зависит норма расстояния до огнетушителя. */
  readonly purpose?: string | null;
  /** Классы возможного пожара: A, B, C, D, E. */
  readonly fireClasses?: readonly string[];
  /** Помещение под автоматической установкой пожаротушения. */
  readonly hasSuppression?: boolean;
}

export async function updateRoom(deps: RoomDeps, input: UpdateRoomInput): Promise<Result<Room>> {
  const name = clean(input.name);
  if (name === null) return err('INVALID_ARGUMENT', 'У помещения должно быть название.');

  const current = await deps.rooms.getById(input.id);
  if (!current.ok) return current;

  const room: Room = {
    ...current.value,
    name,
    number: clean(input.number),
    category: clean(input.category),
    categoryBasis: clean(input.categoryBasis),
    heightM: input.heightM ?? null,
    purpose: clean(input.purpose),
    fireClasses: input.fireClasses ?? [],
    hasSuppression: input.hasSuppression ?? false,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.rooms.save(room);
  if (!saved.ok) return saved;
  return ok(room);
}

export interface SetRoomOutlineInput {
  readonly id: RoomId;
  /** Точки обводки в координатах подложки. */
  readonly points: readonly PixelPoint[];
  /** Масштаб плана: сколько метров в одной точке подложки. null — масштаб не задан. */
  readonly metersPerPixel: number | null;
}

/**
 * Записывает обводку помещения и вычисляет площадь.
 *
 * Прежняя обводка заменяется целиком: перерисовать помещение проще, чем править
 * отдельные точки, а история изменений остаётся в номере версии записи.
 */
export async function setRoomOutline(
  deps: RoomDeps,
  input: SetRoomOutlineInput,
): Promise<Result<Room>> {
  if (input.points.length < 3) {
    return err('INVALID_ARGUMENT', 'Обводка помещения — это замкнутая фигура, нужно хотя бы три точки.');
  }

  const current = await deps.rooms.getById(input.id);
  if (!current.ok) return current;

  const area = polygonAreaM2(input.points, input.metersPerPixel);

  const room: Room = {
    ...current.value,
    outline: input.points,
    // Площадь без масштаба не вычисляется: показать ноль значило бы соврать.
    areaM2: area,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.rooms.save(room);
  if (!saved.ok) return saved;
  return ok(room);
}

/**
 * Снять обводку с помещения, оставив само помещение.
 *
 * Заказчик: «выделяется достаточно криво, никак эту отметку не снять».
 * Обвести заново было можно, а убрать — нечем: помещение оставалось с кривой
 * фигурой на плане, и единственным выходом было удалить его вместе с
 * категорией, назначением и всем, что к нему уже привязано.
 *
 * Вместе с обводкой уходит и площадь: она из обводки и считалась, а площадь без
 * фигуры — число, взявшееся ниоткуда. Помещение возвращается в состояние «не
 * отмечено на плане», как сразу после заведения.
 */
export async function clearRoomOutline(deps: RoomDeps, id: RoomId): Promise<Result<Room>> {
  const current = await deps.rooms.getById(id);
  if (!current.ok) return current;
  if (current.value.outline === null) return ok(current.value);

  const room: Room = {
    ...current.value,
    outline: null,
    areaM2: null,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.rooms.save(room);
  if (!saved.ok) return saved;
  return ok(room);
}

/** Вывод помещения из эксплуатации: перепланировка, объединение, снос. */
export async function archiveRoom(deps: RoomDeps, id: RoomId): Promise<Result<Room>> {
  const current = await deps.rooms.getById(id);
  if (!current.ok) return current;
  if (current.value.archivedAt !== null) return ok(current.value);

  const now = deps.clock.nowUtc();
  const room: Room = {
    ...current.value,
    archivedAt: now,
    updatedAt: now,
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.rooms.save(room);
  if (!saved.ok) return saved;
  return ok(room);
}
