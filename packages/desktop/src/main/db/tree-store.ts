/**
 * Дерево объекта в базе: организации, цеха, здания, этажи и склады.
 *
 * Первое из хранилищ, переведённых с файлов на базу. Порт остался прежним
 * (`ObjectTreeRepository`), поэтому ни ядро, ни окно об этом не знают —
 * поменялась только реализация (AGENTS.md, правило 1).
 *
 * Характеристики здания лежат отдельной строкой в `building_profiles`, а не
 * колонками узла: они бывают только у здания, и у остальных четырёх видов
 * узлов эти двадцать колонок стояли бы пустыми.
 */

import type { BuildingProfile, ObjectTreeRepository, Result, TreeNode } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { Db } from './database';
import { flag, integer, json, number, required, text, toFlag, toJson, toNumber, type Row } from './rows';

/** Узел вместе с его характеристиками: одна выборка вместо двух. */
const SELECT = `
  SELECT n.*, b.data AS building_json
  FROM nodes n
  LEFT JOIN building_profiles b ON b.node_id = n.id
`;

function toNode(row: Row): TreeNode {
  return {
    id: required(row['id'], 'узел.id'),
    siteId: required(row['site_id'], 'узел.siteId'),
    parentId: text(row['parent_id']),
    kind: required(row['kind'], 'узел.kind') as TreeNode['kind'],
    name: required(row['name'], 'узел.name'),
    code: text(row['code']),
    elevationM: number(row['elevation_m']),
    note: text(row['note']),
    building: json<BuildingProfile>(row['building_json']),
    sortOrder: integer(row['sort_order']),
    inCommonJournal: flag(row['in_common_journal'], true),
    objectsPinned: flag(row['objects_pinned']),
    archivedAt: text(row['archived_at']),
    createdAt: required(row['created_at'], 'узел.createdAt'),
    updatedAt: required(row['updated_at'], 'узел.updatedAt'),
    rowVersion: integer(row['row_version'], 1),
  };
}

/**
 * Записывает узел целиком, заменяя прежний.
 *
 * `INSERT … ON CONFLICT DO UPDATE` вместо «прочитать, изменить, записать»:
 * запись идёт одним обращением к базе, и между чтением и записью не остаётся
 * промежутка, в котором узел мог бы поменяться.
 */
export function saveNodeRow(db: Db, node: TreeNode): void {
  db.transaction(() => {
    db.run(
      `INSERT INTO nodes(id, site_id, parent_id, kind, name, code, elevation_m, note,
         sort_order, in_common_journal, objects_pinned, archived_at,
         created_at, updated_at, row_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         site_id = excluded.site_id,
         parent_id = excluded.parent_id,
         kind = excluded.kind,
         name = excluded.name,
         code = excluded.code,
         elevation_m = excluded.elevation_m,
         note = excluded.note,
         sort_order = excluded.sort_order,
         in_common_journal = excluded.in_common_journal,
         objects_pinned = excluded.objects_pinned,
         archived_at = excluded.archived_at,
         updated_at = excluded.updated_at,
         row_version = excluded.row_version`,
      [
        node.id, node.siteId, node.parentId, node.kind, node.name, node.code,
        toNumber(node.elevationM), node.note, integer(node.sortOrder),
        toFlag(node.inCommonJournal), toFlag(node.objectsPinned), node.archivedAt,
        node.createdAt, node.updatedAt, integer(node.rowVersion, 1),
      ],
    );

    /*
     * Характеристики здания: были — записываем, не стало — убираем строку.
     * Держать пустую строку значило бы отвечать «характеристики есть, но все
     * пустые» на вопрос, есть ли они вообще.
     */
    if (node.building === null) {
      db.run('DELETE FROM building_profiles WHERE node_id = ?', [node.id]);
      return;
    }

    db.run(
      `INSERT INTO building_profiles(node_id, data) VALUES (?,?)
       ON CONFLICT(node_id) DO UPDATE SET data = excluded.data`,
      [node.id, toJson(node.building)],
    );
  });
}

export function createTreeStore(db: Db): ObjectTreeRepository {
  return {
    async list(): Promise<Result<readonly TreeNode[]>> {
      /*
       * Порядок задан здесь, а не в окне: узлы показывают в том порядке, в
       * каком их расставил человек, и одинаково во всех местах программы.
       */
      const rows = db.all<Row>(`${SELECT} ORDER BY n.sort_order, n.name`);
      return ok(rows.map(toNode));
    },

    async getById(id): Promise<Result<TreeNode>> {
      const row = db.get<Row>(`${SELECT} WHERE n.id = ?`, [id]);
      if (row === null) return err('NOT_FOUND', 'Узел дерева не найден.');
      return ok(toNode(row));
    },

    async save(node): Promise<Result<void>> {
      saveNodeRow(db, node);
      return ok(undefined);
    },
  };
}
