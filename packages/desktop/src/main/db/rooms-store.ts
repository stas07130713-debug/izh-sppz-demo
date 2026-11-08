/**
 * Помещения этажей в базе.
 *
 * Помещение принадлежит этажу и без него не значит ничего, поэтому связь
 * жёсткая: удалили этаж — ушли и помещения. Само помещение из обращения
 * выводят пометкой (`archived_at`), а не удалением: на него ссылаются элементы
 * и записи журнала.
 *
 * Категория и назначение хранятся отдельными колонками, а не в общем
 * составном поле: от них зависят нормы по огнетушителям, и по ним же строят
 * выборки — «все помещения категории В2 без огнетушителя».
 */

import type { PixelPoint, Result, Room, RoomRepository } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { Db } from './database';
import {
  flag, integer, jsonList, number, required, text, toFlag, toJson, toNumber, json, type Row,
} from './rows';

function toRoom(row: Row): Room {
  return {
    id: required(row['id'], 'помещение.id'),
    siteId: required(row['site_id'], 'помещение.siteId'),
    levelId: required(row['level_id'], 'помещение.levelId'),
    name: required(row['name'], 'помещение.name'),
    number: text(row['number']),
    category: text(row['category']),
    categoryBasis: text(row['category_basis']),
    purpose: text(row['purpose']),
    fireClasses: jsonList<string>(row['fire_classes']),
    hasSuppression: flag(row['has_suppression']),
    heightM: number(row['height_m']),
    outline: json<readonly PixelPoint[]>(row['outline']),
    areaM2: number(row['area_m2']),
    archivedAt: text(row['archived_at']),
    createdAt: required(row['created_at'], 'помещение.createdAt'),
    updatedAt: required(row['updated_at'], 'помещение.updatedAt'),
    rowVersion: integer(row['row_version'], 1),
  };
}

export function saveRoomRow(db: Db, room: Room): void {
  db.run(
    `INSERT INTO rooms(id, site_id, level_id, name, number, category, category_basis,
       purpose, fire_classes, height_m, area_m2, has_suppression, outline,
       archived_at, created_at, updated_at, row_version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       site_id = excluded.site_id,
       level_id = excluded.level_id,
       name = excluded.name,
       number = excluded.number,
       category = excluded.category,
       category_basis = excluded.category_basis,
       purpose = excluded.purpose,
       fire_classes = excluded.fire_classes,
       height_m = excluded.height_m,
       area_m2 = excluded.area_m2,
       has_suppression = excluded.has_suppression,
       outline = excluded.outline,
       archived_at = excluded.archived_at,
       updated_at = excluded.updated_at,
       row_version = excluded.row_version`,
    [
      room.id, room.siteId, room.levelId, room.name, room.number, room.category,
      room.categoryBasis, room.purpose, toJson(room.fireClasses), toNumber(room.heightM),
      toNumber(room.areaM2), toFlag(room.hasSuppression), toJson(room.outline),
      room.archivedAt, room.createdAt, room.updatedAt, integer(room.rowVersion, 1),
    ],
  );
}

export function createRoomStore(db: Db): RoomRepository {
  return {
    async list(): Promise<Result<readonly Room[]>> {
      const rows = db.all<Row>('SELECT * FROM rooms ORDER BY number, name');
      return ok(rows.map(toRoom));
    },

    async listByLevel(levelId): Promise<Result<readonly Room[]>> {
      /*
       * Отбор делает база, а не окно: помещений на предприятии тысячи, и
       * перегонять их все через мост ради одного этажа незачем.
       */
      const rows = db.all<Row>(
        'SELECT * FROM rooms WHERE level_id = ? ORDER BY number, name',
        [levelId],
      );
      return ok(rows.map(toRoom));
    },

    async getById(id): Promise<Result<Room>> {
      const row = db.get<Row>('SELECT * FROM rooms WHERE id = ?', [id]);
      if (row === null) return err('NOT_FOUND', 'Помещение не найдено.');
      return ok(toRoom(row));
    },

    async save(room): Promise<Result<void>> {
      saveRoomRow(db, room);
      return ok(undefined);
    },
  };
}
