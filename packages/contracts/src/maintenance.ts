/**
 * Мероприятия по обслуживанию оборудования: осмотры, ТО, испытания.
 *
 * Мероприятие — отдельное событие, а не правка карточки оборудования. У
 * карточки одна история, сколько бы проверок ни прошло; каждая проверка
 * добавляет запись в эту ленту, а не переписывает состояние задним числом.
 * Записи неизменяемы: программа не редактирует и не удаляет прошлые события,
 * только добавляет новые — так же, как история дерева объекта.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, Дополнение 1, разделы Д5–Д8.
 */

import type { IsoDate, IsoDateTime } from './basic-types.js';
import type { SimpleSignature } from './signature.js';
import type { PlanObjectId } from './plan-objects.js';
import type { Result } from './result.js';

export type MaintenanceEventId = string;

/** Итог мероприятия. Выбирается из списка, а не набирается текстом. */
export type MaintenanceResult = 'выполнено' | 'выполнено с замечаниями' | 'не выполнено';

/**
 * Результат одного пункта чек-листа (ТЗ, Дополнение 3, часть К8.3).
 *
 * Не сводится к галочке «сделано/не сделано»: «выполнено с замечанием» —
 * самостоятельное состояние и не считается автоматически полностью
 * исправным результатом.
 */
export type ChecklistItemResult =
  | 'выполнено'
  | 'выполнено с замечанием'
  | 'не выполнено'
  | 'не проверено'
  | 'не применяется';

/** Влияние отрицательного ответа на возможность эксплуатации. */
export type ChecklistItemSeverity = 'критический' | 'значительный' | 'незначительный';

export type ChecklistEvidenceSource = 'осмотр' | 'измерение' | 'акт' | 'протокол';

/** Файл, сохранённый в хранилище приложения без абсолютного пути пользователя. */
export interface StoredDocumentReference {
  readonly hash: string;
  readonly fileName: string;
}

/**
 * Акт проверки, приложенный к записи журнала.
 *
 * Номер и дата — то, по чему акт находят в делах; файл — сам акт. Дата
 * отдельно от даты работ: акт подписывают позже, чем выходят на объект.
 */
export interface InspectionAct {
  readonly number: string;
  readonly date: IsoDate;
  readonly file: StoredDocumentReference;
}

/** Отметка одного пункта чек-листа: что сделано и с каким результатом. */
export interface ChecklistAnswer {
  readonly item: string;
  readonly result: ChecklistItemResult;
  readonly severity?: ChecklistItemSeverity;
  /** Заполняется, если результат пункта не «выполнено» (часть К8.4). */
  readonly defect: string | null;
  readonly correctiveAction?: string | null;
  readonly correctionDueOn?: IsoDate | null;
  readonly evidenceSource?: ChecklistEvidenceSource | null;
  /** Фото или файл, относящийся именно к этому пункту и этому замечанию. */
  readonly attachments?: readonly StoredDocumentReference[];
}

/** Исполнитель проверки хранится раздельно, чтобы сведения переносились в журнал. */
export interface MaintenanceExecutor {
  readonly fullName: string;
  readonly position: string;
  readonly organization: string;
}

/** Реквизиты работ, подтверждённых актом сторонней организации. */
export interface ExternalMaintenanceEvidence {
  readonly organization: string;
  readonly inn: string;
  readonly licenseNumber: string;
  readonly actNumber: string;
  readonly actDate: IsoDate;
  readonly actFile: StoredDocumentReference;
  readonly protocolFile?: StoredDocumentReference | null;
}

/** Типизированное измерение, зафиксированное во время проверки. */
export interface MaintenanceMeasurement {
  readonly code: string;
  readonly label: string;
  readonly value: number | string | boolean;
  readonly unit: string | null;
}

export interface MaintenanceEvent {
  readonly id: MaintenanceEventId;
  readonly siteId: string;
  readonly objectId: PlanObjectId;
  /** Код мероприятия из пакета правил: 'osmotr', 'perezaryadka' и так далее. */
  readonly activityCode: string;
  readonly performedOn: IsoDate;
  readonly result: MaintenanceResult;
  /** Ответы по пунктам чек-листа, зафиксированного на момент проверки. */
  readonly checklist: readonly ChecklistAnswer[];
  /** Заполняется, если результат не «выполнено». */
  readonly defect: string | null;
  /** Старое поле оставлено для чтения ранее созданных записей. */
  readonly executor: string | null;
  readonly executorDetails?: MaintenanceExecutor | null;
  readonly externalEvidence?: ExternalMaintenanceEvidence | null;
  /**
   * Акт проверки (ТЗ, Дополнение 6).
   *
   * Не то же самое, что акт сторонней организации выше: тот подтверждает, кто
   * выполнял работы, а этот — что проверка состоялась и с каким результатом.
   * Проверку водоисточника оформляют актом независимо от того, своими силами
   * её провели или подрядчиком, и предъявляют потом именно его.
   */
  readonly inspectionAct?: InspectionAct | null;
  readonly measurements?: readonly MaintenanceMeasurement[];
  readonly groupId?: string | null;
  /**
   * Версия регламента, по которой проводилась проверка (ТЗ, Дополнение 5, Р9).
   *
   * Без этой ссылки старая запись показывала бы сегодняшний состав работ: сам
   * регламент со временем меняется, а предъявляют проверяющему то, что
   * действовало в день проверки. Необязательное — записи, сделанные до
   * появления конструктора регламентов, его не имеют, и переписывать их задним
   * числом нельзя (правило неизменяемости истории).
   */
  readonly regulationVersionId?: string | null;
  /** Периодичность, к которой относится запись: по ней считается следующий срок. */
  readonly periodicityId?: string | null;
  readonly note: string | null;
  /**
   * Простая электронная подпись под записью (63-ФЗ, статья 9 часть 1).
   *
   * Хранится **внутри** записи, а не отдельным списком: по закону подпись
   * содержится в самом документе. Отпечаток в ней относится к значимым полям
   * записи, и по нему видно, не менялось ли подписанное после подписания.
   *
   * `null` — запись внесена без подписи. Так осталось у записей, сделанных до
   * того, как подпись стала обязательной: переписывать их задним числом
   * нельзя. Новых неподписанных записей программа больше не заводит — включая
   * перенос чужого журнала, где подписывающий заверяет не чужую работу, а то,
   * что он перенёс эти сведения в журнал (63-ФЗ, статья 5 часть 2).
   */
  readonly signature?: SimpleSignature | null;
  readonly createdAt: IsoDateTime;
}

/**
 * Хранение мероприятий.
 *
 * Ни правки, ни удаления в порте нет: лента истории добавляется, а не
 * переписывается. Это то же правило неизменяемости, что и в остальной части
 * программы, только здесь оно прямое требование заказчика (журнал эксплуатации
 * предъявляется при проверке).
 */
export interface MaintenanceEventRepository {
  listByObject(objectId: PlanObjectId): Promise<Result<readonly MaintenanceEvent[]>>;
  /** Все мероприятия всех объектов. Нужен общему журналу здания и дашборду. */
  list(): Promise<Result<readonly MaintenanceEvent[]>>;
  save(event: MaintenanceEvent): Promise<Result<void>>;
  /**
   * Записывает несколько мероприятий разом — всё или ничего.
   *
   * Одна проверка может закрывать несколько видов работ сразу и сразу по
   * нескольким огнетушителям (ТЗ, Дополнение 3, часть К8). Складывать их по
   * одному нельзя: сбой на середине оставил бы часть записанной, а журнал
   * эксплуатации не допускает ни удаления, ни правки — откатить половину было
   * бы уже невозможно.
   */
  saveMany(events: readonly MaintenanceEvent[]): Promise<Result<void>>;
}
