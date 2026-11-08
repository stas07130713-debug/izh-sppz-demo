/**
 * История эксплуатации в базе: проверки, обслуживание, испытания.
 *
 * Это главный документ программы — его предъявляют при проверке. Отсюда два
 * правила, заложенных прямо в схему.
 *
 * **Записи не удаляются.** Внешний ключ на элемент объявлен `ON DELETE
 * RESTRICT`: удалить элемент, по которому есть записи, база не даст. Из
 * обращения его выводят пометкой, и история остаётся.
 *
 * **Пачка пишется целиком.** Одна проверка закрывает несколько видов работ
 * сразу и сразу по нескольким огнетушителям. Сбой на середине оставил бы часть
 * записанной, а исправить журнал эксплуатации потом нельзя — ни удалением, ни
 * правкой.
 *
 * Составные части записи — чек-лист, измерения, акт, сведения об исполнителе,
 * подпись — лежат составными значениями, а не колонками: их состав задаёт
 * регламент, который меняется вместе с нормативной базой, а не схема хранилища.
 */

import type {
  ChecklistAnswer, MaintenanceEvent, MaintenanceEventRepository, Result,
} from '@izh/contracts';
import { ok } from '@izh/contracts';
import { SIGNED_RECORD_LOCKED, canReplaceEvent } from '@izh/core';
import type { Db } from './database';
import { json, jsonList, required, text, toJson, type Row } from './rows';

function toEvent(row: Row): MaintenanceEvent {
  const optional = {
    executorDetails: json(row['executor_details_json']),
    externalEvidence: json(row['external_evidence_json']),
    inspectionAct: json(row['inspection_act_json']),
    measurements: json(row['measurements_json']),
    signature: json(row['signature_json']),
    groupId: text(row['group_id']),
    regulationVersionId: text(row['regulation_version_id']),
    periodicityId: text(row['periodicity_id']),
  };

  return {
    id: required(row['id'], 'запись.id'),
    siteId: required(row['site_id'], 'запись.siteId'),
    objectId: required(row['object_id'], 'запись.objectId'),
    activityCode: required(row['activity_code'], 'запись.activityCode'),
    performedOn: required(row['performed_on'], 'запись.performedOn'),
    result: required(row['result'], 'запись.result'),
    checklist: jsonList<ChecklistAnswer>(row['checklist_json']),
    defect: text(row['defect']),
    executor: text(row['executor']),
    note: text(row['note']),
    createdAt: required(row['created_at'], 'запись.createdAt'),
    ...optional,
  } as unknown as MaintenanceEvent;
}

/**
 * Проверяет, можно ли заменить запись, и отказывает, если она подписана.
 *
 * Правило живёт в ядре (`canReplaceEvent`), а исполняется здесь — на последнем
 * рубеже. Так его не обойти ни новым окном, ни забытым сценарием: любая запись
 * в журнал эксплуатации проходит через это место.
 */
function assertReplaceable(db: Db, event: MaintenanceEvent): void {
  const row = db.get<Row>('SELECT * FROM maintenance_events WHERE id = ?', [event.id]);
  if (row === null) return;

  if (!canReplaceEvent(toEvent(row), event)) {
    throw new Error(SIGNED_RECORD_LOCKED);
  }
}

function saveEventRow(db: Db, event: MaintenanceEvent): void {
  assertReplaceable(db, event);
  db.run(
    `INSERT INTO maintenance_events(id, site_id, object_id, activity_code, performed_on,
       result, defect, executor, note, group_id, regulation_version_id, periodicity_id,
       checklist_json, measurements_json, inspection_act_json, executor_details_json,
       external_evidence_json, signature_json, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       result = excluded.result,
       defect = excluded.defect,
       executor = excluded.executor,
       note = excluded.note,
       group_id = excluded.group_id,
       regulation_version_id = excluded.regulation_version_id,
       periodicity_id = excluded.periodicity_id,
       checklist_json = excluded.checklist_json,
       measurements_json = excluded.measurements_json,
       inspection_act_json = excluded.inspection_act_json,
       executor_details_json = excluded.executor_details_json,
       external_evidence_json = excluded.external_evidence_json,
       signature_json = excluded.signature_json`,
    [
      event.id, event.siteId, event.objectId, event.activityCode, event.performedOn,
      event.result, event.defect, event.executor, event.note,
      event.groupId ?? null, event.regulationVersionId ?? null, event.periodicityId ?? null,
      toJson(event.checklist), toJson(event.measurements ?? null),
      toJson(event.inspectionAct ?? null), toJson(event.executorDetails ?? null),
      toJson(event.externalEvidence ?? null), toJson(event.signature ?? null),
      event.createdAt,
    ],
  );
}

export { saveEventRow };

export function createMaintenanceStore(db: Db): MaintenanceEventRepository {
  return {
    async list(): Promise<Result<readonly MaintenanceEvent[]>> {
      /*
       * Свежее позже: журнал читают по порядку проведения работ, а при
       * совпадении дня — в порядке записи.
       */
      const rows = db.all<Row>(
        'SELECT * FROM maintenance_events ORDER BY performed_on, created_at',
      );
      return ok(rows.map(toEvent));
    },

    async listByObject(objectId): Promise<Result<readonly MaintenanceEvent[]>> {
      const rows = db.all<Row>(
        'SELECT * FROM maintenance_events WHERE object_id = ? ORDER BY performed_on, created_at',
        [objectId],
      );
      return ok(rows.map(toEvent));
    },

    async save(event): Promise<Result<void>> {
      saveEventRow(db, event);
      return ok(undefined);
    },

    async saveMany(events): Promise<Result<void>> {
      db.transaction(() => {
        for (const event of events) saveEventRow(db, event);
      });
      return ok(undefined);
    },
  };
}
