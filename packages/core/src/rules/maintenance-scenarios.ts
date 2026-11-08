/**
 * Сценарий: провести мероприятие (осмотр, ТО, испытание) и записать результат.
 *
 * Событие добавляется в ленту, карточка оборудования не переписывается —
 * ровно то, что требует часть Д5 Дополнения 1. Само мероприятие не проверяет
 * дальнейший расчёт сроков: это делает чистая функция computeSchedule по
 * готовой ленте, отдельно от записи.
 */

import type {
  ChecklistAnswer,
  ExternalMaintenanceEvidence,
  InspectionAct,
  MaintenanceEvent,
  MaintenanceExecutor,
  MaintenanceMeasurement,
  MaintenanceResult,
  PlanObjectId,
  SimpleSignature,
  Result,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { Signer } from '../access/signer.js';
import type { MaintenanceDeps } from './maintenance-deps.js';
import { signSimple } from '../access/simple-signature.js';
import { signedJournalContent } from '../access/signed-content.js';
import { rulePackageSource } from './activity-source.js';
import { blocking } from '../validation/problem.js';
import { maintenanceProblems } from '../validation/maintenance-constraints.js';

export interface RecordMaintenanceInput {
  readonly objectId: PlanObjectId;
  readonly activityCode: string;
  readonly performedOn: string;
  readonly result: MaintenanceResult;
  readonly checklist: readonly ChecklistAnswer[];
  readonly defect?: string | null;
  /** Версия регламента и периодичность, по которым проводилась проверка (Дополнение 5, Р9). */
  readonly regulationVersionId?: string | null;
  readonly periodicityId?: string | null;
  readonly executor?: string | null;
  readonly executorDetails?: MaintenanceExecutor | null;
  readonly externalEvidence?: ExternalMaintenanceEvidence | null;
  /**
   * Акт проверки: номер, дата и приложенный файл.
   *
   * Заполняется в чек-листе и предъявляется при проверке. Раньше поля здесь не
   * было: окно чек-листа акт собирало, передавало сюда — и он молча пропадал,
   * потому что в запись не переносился. Ни в истории элемента, ни в перечне
   * документов его после этого не находили.
   */
  readonly inspectionAct?: InspectionAct | null;
  /**
   * Простая электронная подпись под записью.
   *
   * Ставит её тот, кто вносит сведения, — отдельным осознанным действием, с
   * вводом пароля (63-ФЗ, статья 5 часть 2). Сюда она приходит готовой:
   * сценарий записи не спрашивает паролей и не умеет подписывать, его дело —
   * проверить и сохранить.
   */
  readonly signature?: SimpleSignature | null;
  readonly measurements?: readonly MaintenanceMeasurement[];
  readonly groupId?: string | null;
  readonly note?: string | null;
}

function clean(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = raw.trim().replace(/\s+/g, ' ');
  return value.length === 0 ? null : value;
}

/**
 * Проверяет исходные данные и собирает готовое событие, ничего не сохраняя.
 *
 * Отделено от записи намеренно: одна проверка закрывает несколько видов работ
 * сразу и сразу по нескольким огнетушителям, и все проверки обязаны пройти
 * раньше, чем на диск ляжет хоть одна запись. Иначе отказ на середине оставил
 * бы журнал наполовину заполненным, а исправить его удалением нельзя —
 * записи журнала эксплуатации не удаляются (AGENTS.md, правило 10).
 */
async function prepareEvent(
  deps: MaintenanceDeps,
  input: RecordMaintenanceInput,
): Promise<Result<MaintenanceEvent>> {
  const object = await deps.objects.getById(input.objectId);
  if (!object.ok) return object;
  if (object.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', 'Объект выведен из эксплуатации, мероприятия по нему не заводятся.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.performedOn)) {
    return err('INVALID_ARGUMENT', 'Дата выполнения должна быть в формате ГГГГ-ММ-ДД.');
  }

  /*
   * Проверка не может быть выполнена завтра.
   *
   * Журнал записывает сделанное, а не запланированное: от даты выполнения
   * отсчитывается следующий срок, и запись будущим числом отодвигает его на
   * год вперёд — оборудование выглядит обслуженным, хотя к нему не подходили.
   * Найдено при проверке на журнале предприятия: десять записей из семидесяти
   * восьми стояли будущим числом, вплоть до ноября следующего года.
   */
  const today = deps.clock.nowUtc().slice(0, 10);
  if (input.performedOn > today) {
    return err(
      'INVALID_ARGUMENT',
      `Дата выполнения ${input.performedOn} ещё не наступила. В журнал записывается выполненная работа, а не запланированная.`,
    );
  }

  // Перечень применимых работ спрашивается у источника — им может быть и
  // нормативная библиотека, и регламент организации (Дополнение 5, Р19).
  // Спрашивается на дату проверки, а не на сегодня: проверку заносят задним
  // числом, и применим тот регламент, что действовал тогда (часть Р9).
  const source = deps.activities ?? rulePackageSource;
  const rule = source.rulesFor(object.value, input.performedOn)
    .find((item) => item.activityCode === input.activityCode) ?? null;
  if (rule === null) {
    return err(
      'INVALID_ARGUMENT',
      'Это мероприятие не применимо к данному типу оборудования по действующему регламенту.',
    );
  }

  const validItemResults = new Set<string>([
    'выполнено', 'выполнено с замечанием', 'не выполнено', 'не проверено', 'не применяется',
  ]);
  const completed = 'выполнено';
  for (const answer of input.checklist) {
    if (!validItemResults.has(answer.result)) {
      return err('INVALID_ARGUMENT', 'У пункта чек-листа указан неизвестный результат.');
    }
    if (answer.result === 'не проверено') {
      return err('INVALID_ARGUMENT', 'Нельзя завершить проверку: один или несколько пунктов не проверены.');
    }
    if (answer.result !== completed && answer.result !== 'не применяется' && clean(answer.defect) === null) {
      return err('INVALID_ARGUMENT', 'Для невыполненного пункта или пункта с замечанием нужен комментарий.');
    }
  }

  const applicable = input.checklist.filter((answer) => answer.result !== 'не применяется');
  const calculatedResult: MaintenanceResult = applicable.some((answer) => answer.result === 'не выполнено')
    ? 'не выполнено'
    : applicable.some((answer) => answer.result === 'выполнено с замечанием')
      ? 'выполнено с замечаниями'
      : 'выполнено';
  if (input.checklist.length > 0 && input.result !== calculatedResult) {
    return err('INVALID_ARGUMENT', 'Итог мероприятия не соответствует результатам пунктов чек-листа.');
  }

  if (input.checklist.length > 0 && !validExecutor(input.executorDetails) && !validExternal(input.externalEvidence)) {
    return err(
      'INVALID_ARGUMENT',
      'Укажите Ф.И.О., должность и организацию исполнителя либо приложите акт сторонней организации.',
    );
  }

  // Запреты логики данных (Дополнение 7, часть Б). Запись журнала неизменяема,
  // поэтому проверять надо до неё: исправить потом будет нечем.
  const known = await deps.events.listByObject(input.objectId);
  if (!known.ok) return known;
  const forbidden = blocking(maintenanceProblems(
    {
      objectId: input.objectId,
      activityCode: input.activityCode,
      performedOn: input.performedOn,
      actDate: input.externalEvidence?.actDate ?? null,
    },
    { object: object.value, events: known.value, today: deps.clock.nowUtc().slice(0, 10) },
  ));
  if (forbidden.length > 0) {
    return err('INVALID_ARGUMENT', forbidden.map((item) => item.message).join(' '));
  }

  const defect = clean(input.defect);
  if (input.result !== 'выполнено' && defect === null) {
    return err('INVALID_ARGUMENT', 'При результате, отличном от «выполнено», нужно описать замечание или дефект.');
  }

  const event: MaintenanceEvent = {
    id: deps.ids.newId(),
    siteId: object.value.siteId,
    objectId: object.value.id,
    activityCode: rule.activityCode,
    performedOn: input.performedOn,
    result: input.result,
    checklist: input.checklist,
    defect,
    executor: clean(input.executor),
    executorDetails: input.executorDetails ?? null,
    externalEvidence: input.externalEvidence ?? null,
    inspectionAct: input.inspectionAct ?? null,
    signature: input.signature ?? null,
    measurements: input.measurements ?? [],
    groupId: clean(input.groupId),
    // Версия берётся у самого правила, а не из ввода: сценарий уже нашёл
    // действовавший регламент, и доверять здесь второму, присланному источнику
    // значило бы позволить записи сослаться не на тот состав работ.
    regulationVersionId: clean(rule.regulationVersionId ?? input.regulationVersionId),
    periodicityId: clean(rule.periodicityId ?? input.periodicityId),
    note: clean(input.note),
    createdAt: deps.clock.nowUtc(),
  };

  return ok(event);
}

/** Записывает одно мероприятие: проверка данных, затем сохранение. */
export async function recordMaintenance(
  deps: MaintenanceDeps,
  input: RecordMaintenanceInput,
): Promise<Result<MaintenanceEvent>> {
  const event = await prepareEvent(deps, input);
  if (!event.ok) return event;

  const saved = await deps.events.save(event.value);
  if (!saved.ok) return saved;
  return ok(event.value);
}

/**
 * Записывает проверку целиком — всё или ничего.
 *
 * Сначала проверяются и собираются все события до единого, и только потом они
 * ложатся на диск одной операцией. Если хоть одно не прошло проверку, не
 * записывается ничего: пользователь исправляет ошибку и повторяет, а в журнале
 * не остаётся половины проверки, которую уже не убрать.
 */
export async function recordMaintenanceBatch(
  deps: MaintenanceDeps,
  inputs: readonly RecordMaintenanceInput[],
): Promise<Result<readonly MaintenanceEvent[]>> {
  const events: MaintenanceEvent[] = [];
  for (const input of inputs) {
    const event = await prepareEvent(deps, input);
    if (!event.ok) return event;
    events.push(event.value);
  }

  if (events.length === 0) return ok([]);

  const saved = await deps.events.saveMany(events);
  if (!saved.ok) return saved;
  return ok(events);
}

/**
 * Прежнее имя того же описания: оно осталось в вызовах переноса журнала.
 */
export type BatchSigner = Signer;

/**
 * Записать мероприятия и сразу заверить каждое простой электронной подписью.
 *
 * Подпись ставится **в ядре**, а не в окне переноса: забыть её здесь нельзя, а
 * в окне — можно, и однажды забудут. Не подписалась хоть одна строка — не
 * записывается ни одна: наполовину заверенный перенос хуже незаверенного, по
 * нему не скажешь, где кончается ответственность подписавшего.
 *
 * Кто подписывать не вправе — гость, человек с временным паролем — получит
 * отказ от `signSimple` с объяснением. Это и есть ответ на вопрос «а если
 * подписать некому»: значит, и переносить некому.
 */
export async function recordMaintenanceBatchSigned(
  deps: MaintenanceDeps,
  inputs: readonly RecordMaintenanceInput[],
  signer: BatchSigner,
): Promise<Result<readonly MaintenanceEvent[]>> {
  const prepared: MaintenanceEvent[] = [];
  for (const input of inputs) {
    const event = await prepareEvent(deps, input);
    if (!event.ok) return event;
    prepared.push(event.value);
  }
  if (prepared.length === 0) return ok([]);

  const signed: MaintenanceEvent[] = [];
  for (const event of prepared) {
    // Содержимое собирается той же функцией, что и при сверке: два способа
    // собрать текст разошлись бы, и подпись объявила бы подделку.
    const signature = await signSimple(signer.hasher, {
      user: signer.user,
      password: signer.password,
      kind: 'запись журнала',
      content: signedJournalContent(event),
      at: deps.clock.nowUtc(),
      keys: signer.keys,
      basis: signer.basis ?? null,
    });
    if (!signature.ok) return signature;
    signed.push({ ...event, signature: signature.value });
  }

  const saved = await deps.events.saveMany(signed);
  if (!saved.ok) return saved;
  return ok(signed);
}

function validExecutor(executor: MaintenanceExecutor | null | undefined): boolean {
  return executor !== null && executor !== undefined
    && clean(executor.fullName) !== null
    && clean(executor.position) !== null
    && clean(executor.organization) !== null;
}

function validExternal(evidence: ExternalMaintenanceEvidence | null | undefined): boolean {
  return evidence !== null && evidence !== undefined
    && clean(evidence.organization) !== null
    && clean(evidence.inn) !== null
    && clean(evidence.actNumber) !== null
    && /^\d{4}-\d{2}-\d{2}$/.test(evidence.actDate)
    && clean(evidence.actFile.hash) !== null
    && clean(evidence.actFile.fileName) !== null;
}
