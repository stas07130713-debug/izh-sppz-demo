/**
 * Лента действий пользователя — ссылками, а не копиями.
 *
 * Заказчик (пункт 10 перечня доработок): «В программе уже существует история
 * действий / история обслуживания непосредственно по системам и элементам
 * СППЗ. В личном кабинете не требуется создавать отдельную копию всей этой
 * информации. Необходимо использовать ссылочную модель. Например: в личном
 * кабинете отображается "05.09.2026 — Иванов И.И. — Выполнил проверку ПК №24".
 * При нажатии на эту запись программа должна открыть соответствующую запись в
 * основной истории элемента/системы… Это необходимо для исключения:
 * дублирования информации; расхождения данных; лишнего объёма хранения;
 * необходимости синхронизировать две одинаковые записи».
 *
 * Поэтому здесь **ничего не хранится**. Лента собирается на лету из трёх
 * журналов, которые программа ведёт и без неё:
 *
 *  — журнал действий (audit) — вход, выход, работа с учётными записями;
 *  — журнал изменений (change-log) — какое поле какой карточки правили;
 *  — журнал эксплуатации (maintenance) — проверки, обслуживание, испытания.
 *
 * У каждой строки есть ссылка на первоисточник: элемент, узел дерева или
 * запись эксплуатации. По ней окно и открывает основную запись — вторая копия
 * записи не заводится, расходиться нечему.
 *
 * Третий журнал попадает сюда только подписанными записями: подпись — это
 * единственное место, где записана личность выполнившего. Неподписанная
 * проверка остаётся в журнале эксплуатации, но в ленту конкретного человека не
 * попадает — приписывать её кому-либо было бы выдумкой.
 */

import type {
  AuditEvent, ChangeLogEntry, IsoDateTime, MaintenanceEvent, PlanObject, TreeNode, UserId, UserRole,
} from '@izh/contracts';
import { elementByCode } from '../objects/element-lookup.js';
import { planCaption } from '../object-tree/tree-shape.js';

/** Откуда взялась строка ленты. Показывается человеку и решает, куда вести. */
export type ActivitySource = 'действия' | 'изменения' | 'эксплуатация';

/** На что ведёт строка. Ссылка, а не копия записи. */
export interface ActivityLink {
  /** Элемент СППЗ, к которому относится действие. */
  readonly objectId?: string | null;
  /** Узел дерева: здание, этаж, склад. */
  readonly nodeId?: string | null;
  /** Запись основной истории эксплуатации — та самая, которую надо открыть. */
  readonly historyId?: string | null;
}

export interface ActivityLine {
  readonly id: string;
  readonly at: IsoDateTime;
  /**
   * Где это происходило — полный путь по дереву.
   *
   * Заказчик: «в столбце "над чем" показан этаж, но не показано, в каком
   * здании и цеху — нужно полный путь указать». Одного «Этаж 1» мало: этажей
   * с таким названием на предприятии столько же, сколько зданий.
   */
  readonly place: string | null;
  readonly actorId: UserId | null;
  readonly actorName: string;
  readonly actorRole: UserRole | null;
  /** Что сделано: «Выполнил проверку», «Изменил карточку оборудования». */
  readonly action: string;
  /** Над чем: «ОП-5 № ОП-12». Пусто — действие само по себе, как вход. */
  readonly subject: string | null;
  /** Кратко, что именно поменялось: «учётный номер: ОП-12 → ОП-13». */
  readonly details: string | null;
  readonly source: ActivitySource;
  readonly link: ActivityLink | null;
}

export interface UserActivityInput {
  readonly audit: readonly AuditEvent[];
  readonly changes: readonly ChangeLogEntry[];
  readonly maintenance: readonly MaintenanceEvent[];
  /** Элементы: по ним подписанная проверка получает читаемое название. */
  readonly objects: readonly PlanObject[];
  /** Дерево: по нему у строки появляется полный путь, а не одно название узла. */
  readonly nodes?: readonly TreeNode[];
  /** Показать только этого пользователя. Не задан — всех. */
  readonly userId?: UserId | null;
}

/** Название элемента для строки ленты: то же, что человек видит в журнале. */
function objectTitle(object: PlanObject | undefined): string {
  if (object === undefined) return 'элемент';
  const kind = elementByCode(object.typeCode)?.title ?? object.typeCode;
  const name = object.model === null || object.model === '' ? kind : object.model;
  return object.regNumber === null || object.regNumber === '' ? name : `${name} № ${object.regNumber}`;
}

/**
 * Название предмета правки — по-русски, даже если в записи лежит код.
 *
 * Заказчик: «колонка „над чем“ выводит непонятную информацию, видимо какое-то
 * название в системе файлов». Это код вида оборудования — `fire-door`,
 * `extinguisher-powder`: марку в карточке заполняют не всегда, и вместо неё в
 * запись попадал код.
 *
 * Исправить это при записи мало: записи журнала изменений хранятся годами и
 * задним числом не переписываются (AGENTS.md, правило 10). Значит, переводить
 * надо и при чтении — иначе прежние записи так и останутся нечитаемыми.
 *
 * Разбирается вид «код № номер»: номер отделяется, код заменяется названием.
 * Что не похоже на код, остаётся как есть — там и так человеческое название.
 */
function readableSubject(title: string | null): string | null {
  if (title === null || title === '') return title;

  const at = title.indexOf(' № ');
  const head = at < 0 ? title : title.slice(0, at);
  const tail = at < 0 ? '' : title.slice(at);

  const known = elementByCode(head);
  return known === null ? title : `${known.title}${tail}`;
}

/**
 * Как назвать правку.
 *
 * Не «изменено оборудование», а «Изменил карточку оборудования»: лента читается
 * как рассказ о человеке, и глагол в ней уместнее причастия.
 */
function changeAction(entry: ChangeLogEntry): string {
  const what = entry.subject;
  if (entry.action === 'заведено') return `Завёл: ${what}`;
  if (entry.action === 'удалено') return `Удалил: ${what}`;
  if (entry.action === 'восстановлено') return `Восстановил: ${what}`;
  return `Изменил: ${what}`;
}

/**
 * Что именно поменялось — одной строкой.
 *
 * Показываются первые три поля: строка ленты должна читаться с одного взгляда,
 * а полный список полей человек увидит, перейдя по ссылке.
 */
/**
 * Значение поля так, как его прочтёт человек.
 *
 * Заказчик: «колонка „что изменилось“ — информация непонятна, видимо системные
 * названия какие-то».
 *
 * Их два вида: голые `true` и `false` и код вида оборудования. Переводить их
 * надо именно здесь, при чтении: записи журнала изменений хранятся годами и
 * задним числом не переписываются (AGENTS.md, правило 10) — поправить только
 * запись значило бы оставить всю прежнюю историю нечитаемой.
 */
function readableValue(value: string | null): string {
  if (value === null || value === '') return '—';
  if (value === 'true') return 'да';
  if (value === 'false') return 'нет';
  return elementByCode(value)?.title ?? value;
}

function changeDetails(entry: ChangeLogEntry): string | null {
  if (entry.fields.length === 0) return null;
  const shown = entry.fields
    .slice(0, 3)
    .map((field) => `${field.title}: ${readableValue(field.before)} → ${readableValue(field.after)}`)
    .join('; ');
  return entry.fields.length > 3 ? `${shown} и ещё ${entry.fields.length - 3}` : shown;
}

/** Строки из журнала действий: вход, выход, работа с учётными записями. */
function fromAudit(events: readonly AuditEvent[]): readonly ActivityLine[] {
  return events.map((event) => ({
    id: `audit:${event.id}`,
    at: event.at,
    // Вход и работа с учётными записями к дереву не относятся.
    place: null,
    actorId: event.actorId,
    actorName: event.actorName,
    actorRole: event.actorRole,
    action: event.kind,
    subject: event.subject,
    details: event.details,
    source: 'действия' as const,
    link: null,
  }));
}

/** Строки из журнала изменений: ссылка ведёт на саму изменённую запись. */
function fromChanges(
  entries: readonly ChangeLogEntry[],
  place: (nodeId: string | null) => string | null,
): readonly ActivityLine[] {
  return entries.map((entry) => ({
    id: `change:${entry.id}`,
    at: entry.at,
    place: place(entry.nodeId),
    actorId: entry.authorId,
    actorName: entry.authorName,
    actorRole: entry.authorRole,
    action: changeAction(entry),
    subject: readableSubject(entry.subjectTitle),
    details: changeDetails(entry),
    source: 'изменения' as const,
    link: {
      objectId: entry.subject === 'оборудование' ? entry.subjectId : null,
      nodeId: entry.nodeId,
    },
  }));
}

/**
 * Строки из журнала эксплуатации.
 *
 * Копии записи здесь нет: строка состоит из ссылки и одной фразы. Всё
 * остальное — чек-лист, замечания, измерения, акт — лежит в самой записи, и
 * туда ведёт `historyId`.
 */
function fromMaintenance(
  events: readonly MaintenanceEvent[],
  objects: readonly PlanObject[],
  place: (nodeId: string | null) => string | null,
): readonly ActivityLine[] {
  const byId = new Map(objects.map((object) => [object.id, object]));

  return events.flatMap((event) => {
    const signature = event.signature;
    if (signature === undefined || signature === null) return [];

    const object = byId.get(event.objectId);
    return [{
      id: `maintenance:${event.id}`,
      at: signature.signedAt,
      place: place(object?.nodeId ?? null),
      actorId: signature.signerId,
      actorName: signature.signerName,
      actorRole: signature.signerRole,
      action: 'Выполнил проверку',
      subject: objectTitle(object),
      details: event.result === 'выполнено' ? null : event.result,
      source: 'эксплуатация' as const,
      link: {
        objectId: event.objectId,
        nodeId: object?.nodeId ?? null,
        historyId: event.id,
      },
    }];
  });
}

/**
 * Лента действий: три журнала одним списком, свежее сверху.
 *
 * Ничего не сохраняется и не пересчитывается заново при каждом показе больше
 * необходимого: это чтение поверх того, что уже есть.
 */
export function userActivity(input: UserActivityInput): readonly ActivityLine[] {
  /*
   * Путь считается один раз на узел: строк в ленте бывают тысячи, а узлов —
   * десятки, и обходить дерево на каждую строку незачем.
   */
  const nodes = input.nodes ?? [];
  const paths = new Map<string, string>();
  const place = (nodeId: string | null): string | null => {
    if (nodeId === null || nodes.length === 0) return null;
    const known = paths.get(nodeId);
    if (known !== undefined) return known;
    const caption = planCaption(nodes, nodeId);
    // Узла в дереве может уже не быть: его вывели из эксплуатации, а запись о
    // нём осталась — ради таких случаев журнал и ведут.
    const value = caption === '' ? null : caption;
    if (value !== null) paths.set(nodeId, value);
    return value;
  };

  const lines = [
    ...fromAudit(input.audit),
    ...fromChanges(input.changes, place),
    ...fromMaintenance(input.maintenance, input.objects, place),
  ];

  const wanted = input.userId ?? null;
  const mine = wanted === null ? lines : lines.filter((line) => line.actorId === wanted);

  return [...mine].sort((a, b) => b.at.localeCompare(a.at));
}
