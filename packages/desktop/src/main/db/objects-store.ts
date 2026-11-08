/**
 * Элементы СППЗ в базе — главная таблица программы.
 *
 * Заказчик (пункт 11): «Элементы СППЗ хранят основные идентификационные данные
 * конкретных элементов: ID, тип системы, учётный номер, местоположение, статус,
 * ссылка на конкретную карточку системы. Данные отдельных видов СППЗ:
 * специфические характеристики должны храниться в соответствующих
 * сущностях/таблицах либо связанных структурах».
 *
 * Так и сделано. В `objects` — то, что есть у любого элемента и по чему идут
 * выборки: где числится, какого вида, под каким номером, в каком состоянии,
 * размещён ли на плане. Видовые характеристики — связанной строкой в
 * `object_profiles`, по одной на вид характеристик.
 *
 * **Почему характеристики видов не разложены по колонкам.** У двенадцати видов
 * оборудования в сумме больше трёхсот характеристик, и состав их задаёт
 * нормативная база, а не программа: уточнили ГОСТ — поменялся набор полей.
 * Схема базы, которую нужно править вслед за каждым уточнением, — это схема,
 * которую перестанут править. Поэтому карточка вида лежит одной связанной
 * строкой, а выборки по ней программа не делает: расчёты по нормам ведёт ядро,
 * и оно получает элемент целиком.
 */

import type { PlanObject, PlanObjectRepository, Result, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { Db } from './database';
import { integer, json, number, required, text, toJson, toNumber, type Row } from './rows';

/**
 * Виды карточек, которые бывают у элемента.
 *
 * Список закрытый и перечислен здесь, а не выведен из данных: по нему карточки
 * и раскладываются по строкам, и собираются обратно. Новый вид оборудования —
 * строка в этом списке, а не правка схемы.
 */
const PROFILE_KINDS = [
  'extinguisherProfile', 'hydrantProfile', 'outdoorHydrantProfile', 'waterSourceProfile',
  'ladderProfile', 'controlPanelProfile', 'fireBarrierProfile', 'fireproofingProfile',
  'roofFenceProfile', 'fireBoardProfile', 'pumpStationProfile', 'suppressionProfile',
  'customFields',
] as const;

type ProfileKind = (typeof PROFILE_KINDS)[number];

/** Элемент вместе со своими карточками: одна выборка вместо двух на каждый. */
const SELECT = `
  SELECT o.*, (
    SELECT json_group_object(p.kind, json(p.data))
    FROM object_profiles p WHERE p.object_id = o.id
  ) AS profiles_json
  FROM objects o
`;

function toObject(row: Row): PlanObject {
  const profiles = json<Record<string, unknown>>(row['profiles_json']) ?? {};

  const x = number(row['position_x']);
  const y = number(row['position_y']);

  const base = {
    id: required(row['id'], 'элемент.id'),
    siteId: required(row['site_id'], 'элемент.siteId'),
    nodeId: required(row['node_id'], 'элемент.nodeId'),
    typeCode: required(row['type_code'], 'элемент.typeCode'),
    regNumber: text(row['reg_number']),
    model: text(row['model']),
    manufacturer: text(row['manufacturer']),
    serialNumber: text(row['serial_number']),
    commissionedOn: text(row['commissioned_on']),
    serviceLifeYears: number(row['service_life_years']),
    serviceLifeMonths: number(row['service_life_months']),
    responsible: text(row['responsible']),
    roomId: text(row['room_id']),
    // Место на плане: обе половины или ни одной — точка с одной координатой
    // не место, а испорченная запись.
    position: x === null || y === null ? null : { x, y },
    technicalState: required(row['technical_state'], 'элемент.technicalState'),
    storageSection: text(row['storage_section']),
    systemId: text(row['system_id']),
    placementId: text(row['placement_id']),
    note: text(row['note']),
    archivedAt: text(row['archived_at']),
    // Подпись под заведением строки в журнал: хранится при самом элементе
    // (63-ФЗ, статья 9 часть 1 — подпись содержится в подписанном документе).
    registrationSignature: json(row['registration_signature_json']),
    createdAt: required(row['created_at'], 'элемент.createdAt'),
    updatedAt: required(row['updated_at'], 'элемент.updatedAt'),
    rowVersion: integer(row['row_version'], 1),
  };

  const cards: Record<string, unknown> = {};
  for (const kind of PROFILE_KINDS) {
    const card = profiles[kind];
    if (card !== undefined && card !== null) cards[kind] = card;
  }

  return { ...base, ...cards } as unknown as PlanObject;
}

/** Записывает элемент и его карточки одним действием. */
export function saveObjectRow(db: Db, object: PlanObject): void {
  db.transaction(() => {
    db.run(
      `INSERT INTO objects(id, site_id, node_id, type_code, reg_number, model, manufacturer,
         serial_number, commissioned_on, service_life_years, service_life_months, responsible,
         room_id, position_x, position_y, technical_state, storage_section, system_id,
         placement_id, note, archived_at, registration_signature_json,
         created_at, updated_at, row_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         site_id = excluded.site_id,
         node_id = excluded.node_id,
         type_code = excluded.type_code,
         reg_number = excluded.reg_number,
         model = excluded.model,
         manufacturer = excluded.manufacturer,
         serial_number = excluded.serial_number,
         commissioned_on = excluded.commissioned_on,
         service_life_years = excluded.service_life_years,
         service_life_months = excluded.service_life_months,
         responsible = excluded.responsible,
         room_id = excluded.room_id,
         position_x = excluded.position_x,
         position_y = excluded.position_y,
         technical_state = excluded.technical_state,
         storage_section = excluded.storage_section,
         system_id = excluded.system_id,
         placement_id = excluded.placement_id,
         note = excluded.note,
         archived_at = excluded.archived_at,
         registration_signature_json = excluded.registration_signature_json,
         updated_at = excluded.updated_at,
         row_version = excluded.row_version`,
      [
        object.id, object.siteId, object.nodeId, object.typeCode, object.regNumber,
        object.model, object.manufacturer, object.serialNumber, object.commissionedOn,
        toNumber(object.serviceLifeYears), toNumber(object.serviceLifeMonths),
        object.responsible, object.roomId,
        toNumber(object.position?.x ?? null), toNumber(object.position?.y ?? null),
        object.technicalState, object.storageSection ?? null,
        object.systemId ?? null, object.placementId ?? null,
        object.note, object.archivedAt, toJson(object.registrationSignature ?? null),
        object.createdAt, object.updatedAt,
        integer(object.rowVersion, 1),
      ],
    );

    const source = object as unknown as Record<ProfileKind, unknown>;
    for (const kind of PROFILE_KINDS) {
      const card = source[kind];
      /*
       * Карточки нет — убираем строку, а не оставляем пустую: пустая означала
       * бы «характеристики заполняли и стёрли», а это другое событие.
       */
      if (card === null || card === undefined) {
        db.run('DELETE FROM object_profiles WHERE object_id = ? AND kind = ?', [object.id, kind]);
        continue;
      }
      db.run(
        `INSERT INTO object_profiles(object_id, kind, data) VALUES (?,?,?)
         ON CONFLICT(object_id, kind) DO UPDATE SET data = excluded.data`,
        [object.id, kind, toJson(card)],
      );
    }
  });
}

export function createObjectStore(db: Db): PlanObjectRepository {
  return {
    async list(): Promise<Result<readonly PlanObject[]>> {
      const rows = db.all<Row>(`${SELECT} ORDER BY o.type_code, o.reg_number`);
      return ok(rows.map(toObject));
    },

    async listByNode(nodeId: TreeNodeId): Promise<Result<readonly PlanObject[]>> {
      const rows = db.all<Row>(
        `${SELECT} WHERE o.node_id = ? ORDER BY o.type_code, o.reg_number`,
        [nodeId],
      );
      return ok(rows.map(toObject));
    },

    async getById(id): Promise<Result<PlanObject>> {
      const row = db.get<Row>(`${SELECT} WHERE o.id = ?`, [id]);
      if (row === null) return err('NOT_FOUND', 'Элемент не найден.');
      return ok(toObject(row));
    },

    async save(object): Promise<Result<void>> {
      saveObjectRow(db, object);
      return ok(undefined);
    },

    async saveMany(objects): Promise<Result<void>> {
      /*
       * Вся пачка — одной сделкой: заведение сотни огнетушителей либо
       * записывается целиком, либо не записывается вовсе. Наполовину заведённая
       * партия — это разъехавшаяся нумерация, которую потом разбирают руками.
       */
      db.transaction(() => {
        for (const object of objects) saveObjectRow(db, object);
      });
      return ok(undefined);
    },
  };
}
