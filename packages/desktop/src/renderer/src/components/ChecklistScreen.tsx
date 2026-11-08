/**
 * Окно чек-листа проверки и запись её результата в журнал.
 *
 * Вынесено из главного экрана отдельно: это законченная работа со своими
 * правилами, а не связывание частей. Правила здесь такие:
 *
 *  — правки карточки, сделанные прямо в чек-листе, сохраняются до записи:
 *    проверяющий поправил номер или марку — это исправление сведений, и оно
 *    не должно пропасть вместе с закрытием окна;
 *  — групповая проверка пишется одним вызовом: сначала проверяются все записи,
 *    потом сохраняются разом. Отказ на середине оставил бы половину проверки в
 *    журнале, а убрать её оттуда уже нельзя (AGENTS.md, правило 10);
 *  — каждому элементу — только его работы: система проверяется целиком, но
 *    регламенты внутри неё разные, и запись чужой работы отклонялась бы целиком.
 */

import type {
  AppSettings, ChecklistAnswer, ExternalMaintenanceEvidence, InspectionAct, MaintenanceEvent,
  MaintenanceExecutor, MaintenanceMeasurement, MaintenanceResult, PlanObject, SimpleSignature,
  TreeNode, UserAccount,
} from '@izh/contracts';
import {
  activityCellsForObject, can, checkGroupFor, recordAudit, recordMaintenanceBatch, signSimple,
  signedJournalContent, updateObject,
} from '@izh/core';
import { UnifiedChecklistModal } from './UnifiedChecklistModal';
import { useScheduleSource } from '../schedule-source-context';
import { accessDeps, auditDeps, maintenanceDeps, objectDeps } from '../deps';
import { todayIso } from '../today';

/** Что открыто: карточка элемента и работа, с которой открылся чек-лист. */
export interface ChecklistRequest {
  readonly object: PlanObject;
  readonly activityCode: string;
}

export interface ChecklistScreenProps {
  readonly request: ChecklistRequest | null;
  readonly onClose: () => void;

  /** Кто вошёл: подставляется исполнителем. Поле остаётся исправимым вручную. */
  readonly performer: UserAccount | null;
  readonly organization: string | null;

  readonly nodes: readonly TreeNode[];
  readonly allObjects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  readonly settings: AppSettings;
  readonly busy: boolean;

  /** Общий страж действий главного экрана: он же ведёт отмену. */
  readonly runCommand: <T>(label: string, action: () => Promise<T>) => Promise<T | null>;
  readonly setMessage: (message: string) => void;
  readonly reloadEvents: () => void;
}

/** Сведения карточки, которые чек-лист позволяет поправить на месте. */
function differsForChecklist(saved: PlanObject, draft: PlanObject): boolean {
  return saved.typeCode !== draft.typeCode
    || saved.regNumber !== draft.regNumber
    || saved.model !== draft.model
    || saved.manufacturer !== draft.manufacturer
    || saved.serialNumber !== draft.serialNumber
    || saved.commissionedOn !== draft.commissionedOn
    || (saved.serviceLifeYears ?? null) !== draft.serviceLifeYears
    || saved.responsible !== draft.responsible
    || saved.roomId !== draft.roomId
    || saved.note !== draft.note
    || JSON.stringify(saved.extinguisherProfile) !== JSON.stringify(draft.extinguisherProfile);
}

export function ChecklistScreen(props: ChecklistScreenProps): React.JSX.Element | null {
  const scheduleSource = useScheduleSource();
  const request = props.request;
  if (request === null) return null;

  /**
   * Подписи для всех записей проверки.
   *
   * `null` — подпись не запрашивали. Иначе — либо все подписи, либо отказ:
   * половина подписанных записей в одном визите означала бы, что часть работ
   * подтвердил кто-то другой.
   */
  const signatureFor = async (
    batch: readonly { readonly objectId: string; readonly activityCode: string; readonly performedOn: string;
      readonly result: MaintenanceResult; readonly checklist: readonly ChecklistAnswer[];
      readonly defect: string | null; readonly executor: string | null;
      readonly executorDetails: MaintenanceExecutor | null;
      readonly externalEvidence: ExternalMaintenanceEvidence | null;
      readonly inspectionAct: InspectionAct | null;
      readonly measurements: readonly MaintenanceMeasurement[];
      readonly note: string | null }[],
    password: string | null,
  ): Promise<{ ok: true; value: readonly (SimpleSignature | null)[] } | { ok: false; error: { message: string } } | null> => {
    if (password === null || props.performer === null) return null;

    const signatures: (SimpleSignature | null)[] = [];
    for (const item of batch) {
      // Содержимое собирается той же функцией, которой пользуется сверка:
      // два способа собрать текст разошлись бы, и подпись объявила бы подделку.
      const content = signedJournalContent({
        ...item,
        id: '', siteId: '', groupId: null, regulationVersionId: null, periodicityId: null,
        createdAt: '',
      } as never);

      const signed = await signSimple(accessDeps.hasher, {
        user: props.performer,
        password,
        kind: 'запись журнала',
        content,
        at: objectDeps.clock.nowUtc(),
        keys: accessDeps.keys,
      });
      if (!signed.ok) return { ok: false, error: { message: signed.error.message } };
      signatures.push(signed.value);
    }
    return { ok: true, value: signatures };
  };

  const saveCardEdits = async (): Promise<boolean> => {
    const current = props.allObjects.find((object) => object.id === request.object.id) ?? null;
    if (current === null || !differsForChecklist(current, request.object)) return true;

    const updated = await updateObject(objectDeps, {
      id: request.object.id,
      typeCode: request.object.typeCode,
      regNumber: request.object.regNumber,
      model: request.object.model,
      manufacturer: request.object.manufacturer,
      serialNumber: request.object.serialNumber,
      commissionedOn: request.object.commissionedOn,
      serviceLifeYears: request.object.serviceLifeYears ?? null,
      responsible: request.object.responsible,
      extinguisherProfile: request.object.extinguisherProfile,
      roomId: request.object.roomId,
      note: request.object.note,
    });
    if (!updated.ok) { props.setMessage(updated.error.message); return false; }
    return true;
  };

  return (
    <UnifiedChecklistModal
      performer={props.performer}
      /*
       * Подписывать вправе администратор и ответственный за пожарную
       * безопасность. Гость — нет: подпись это принятие ответственности.
       * Временный пароль тоже не подписывает — его знают двое, и сценарий
       * подписи откажет; кнопку в таком случае не показываем вовсе, чтобы не
       * обещать того, чего не будет.
       */
      canSign={props.performer !== null && can(props.performer, 'подпись.ставить')
        && !props.performer.mustChangePassword}
      organization={props.organization}
      object={request.object}
      candidates={checkGroupFor(props.nodes, props.allObjects, request.object)}
      /* Состав работ и сроки берутся из действующего регламента, а не из
         библиотеки: включённые в конструкторе периодичности и выбранные внутри
         них шаги должны быть ровно тем, что видит проверяющий (часть Р3), а
         срок рядом с выбором — тем же, что в карточке. */
      cellsFor={(object) => activityCellsForObject(
        object, props.events, todayIso(), props.settings.soonThresholdDays, scheduleSource,
      )}
      initialActivityCode={request.activityCode}
      busy={props.busy}
      settings={props.settings}
      onClose={props.onClose}
      onSubmit={async (fields) => {
        let signatureError: string | null = null;
        await props.runCommand('Записать чек-лист проверки', async () => {
          if (!await saveCardEdits()) return;

          const groupId = fields.objectIds.length > 1 ? maintenanceDeps.ids.newId() : null;

          /*
           * Спрашивается тот же источник, которым нарисован журнал, и на дату
           * проверки: задним числом применим тот регламент, что действовал тогда.
           */
          const applicable = new Map(fields.objectIds.map((objectId) => {
            const object = props.allObjects.find((item) => item.id === objectId) ?? null;
            const codes = object === null
              ? new Set<string>()
              : new Set(scheduleSource.rulesFor(object, fields.performedOn).map((rule) => rule.activityCode));
            return [objectId, codes];
          }));

          const batch = fields.objectIds.flatMap((objectId) =>
            fields.entries.filter((entry) => applicable.get(objectId)?.has(entry.activityCode) === true).map((entry) => ({
              objectId,
              activityCode: entry.activityCode,
              performedOn: fields.performedOn,
              result: entry.result,
              checklist: entry.checklist,
              defect: entry.defect,
              executor: fields.executor,
              executorDetails: fields.executorDetails,
              externalEvidence: fields.externalEvidence,
              inspectionAct: fields.inspectionAct,
              measurements: fields.measurements,
              groupId,
              note: fields.note,
            })),
          );

          if (batch.length === 0) {
            props.setMessage('Выбранные работы не относятся ни к одному из отмеченных элементов. Отметьте работы того вида оборудования, который проверяете.');
            return;
          }

          /*
           * Подпись ставится **до** записи и на то же содержимое.
           *
           * Подписывается не «запись вообще», а её значимые поля: тот же текст
           * собирает и сверка (`signedJournalContent`). Подписать после записи
           * значило бы на миг положить в журнал неподписанную строку, а
           * подписать «что-то похожее» — получить подпись, которая не сходится
           * с тем, что лежит в журнале.
           */
          const signature = await signatureFor(batch, fields.password);
          if (signature !== null && !signature.ok) {
            const reason = signature.error.message.toLocaleLowerCase('ru-RU');
            signatureError = reason.includes('пароль') && reason.includes('невер')
              ? 'Пароль введен неправильно, повторите пароль.'
              : signature.error.message;
            return;
          }

          // Источник тот же, которым нарисован журнал: проверка закрывает ту
          // работу, которую пользователь видел в таблице, и запись сошлётся на
          // действовавшую версию регламента (часть Р9).
          const recorded = await recordMaintenanceBatch(
            { ...maintenanceDeps, activities: scheduleSource },
            signature === null ? batch : batch.map((item, index) => ({
              ...item,
              signature: signature.value[index] ?? null,
            })),
          );
          if (!recorded.ok) { props.setMessage(recorded.error.message); return; }

          /*
           * Подписание — событие журнала действий.
           *
           * Заказчик: «всё это фиксируется в базе данных действий пользователей».
           * Записывается после успешной записи в журнал: подпись под тем, что не
           * записалось, событием не является.
           */
          if (fields.password !== null && props.performer !== null) {
            await recordAudit(auditDeps, {
              actor: props.performer,
              kind: 'подписана запись',
              subject: `${request.object.regNumber ?? 'без номера'}`,
              details: `записей: ${batch.length}`,
            });
          }

          props.reloadEvents();
          props.onClose();
        });
        return signatureError;
      }}
    />
  );
}
