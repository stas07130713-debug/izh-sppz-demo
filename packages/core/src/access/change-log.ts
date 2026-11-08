/**
 * Запись и чтение журнала вносимых изменений.
 *
 * Заказчик: «нужен такой журнал, чтобы по каждому созданному объекту, цеху,
 * этажу можно было посмотреть, что менялось, удалялись или заводились данные,
 * кем, когда, изменения».
 *
 * Записывается по полям, а не снимками: «категория помещения: В2 → В1» человек
 * читает, а два полных объекта рядом — нет. Сравнение полей делает тот, кто
 * знает, что у сущности значимо; ядро только складывает результат в журнал.
 *
 * Чтение ограничено правами: ответственный видит изменения своих узлов и
 * ничего сверх них. Изменения, не относящиеся к дереву — настройки, регламенты,
 * пользователи, — видит только тот, кто вправе их менять, то есть администратор.
 */

import type {
  ChangeAction, ChangeLogEntry, ChangeLogFilter, ChangeLogRepository, ChangeSubject,
  ChangedField, Clock, IdGenerator, Result, TreeNode, TreeNodeId, UserAccount,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { can, reachableNodeIds } from './permissions.js';

export interface ChangeLogDeps {
  readonly log: ChangeLogRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export interface RecordChangeInput {
  readonly author: UserAccount;
  /** Название действия, как его видел человек: «Стереть лишнее с подложки». */
  readonly command: string;
  readonly action: ChangeAction;
  readonly subject: ChangeSubject;
  readonly subjectId: string;
  readonly subjectTitle: string;
  readonly nodeId: TreeNodeId | null;
  readonly fields: readonly ChangedField[];
}

/**
 * Заносит изменение в журнал.
 *
 * Изменение без изменившихся полей не заносится — кроме заведения и удаления:
 * у них меняется не поле, а сама запись. Без этого правила журнал заполнялся бы
 * пустыми строчками «изменено» от каждого открытия карточки.
 */
export async function recordChange(deps: ChangeLogDeps, input: RecordChangeInput): Promise<Result<ChangeLogEntry | null>> {
  const meaningful = input.action !== 'изменено' || input.fields.length > 0;
  if (!meaningful) return ok(null);

  const entry: ChangeLogEntry = {
    id: deps.ids.newId(),
    at: deps.clock.nowUtc(),
    authorId: input.author.id,
    // Снимок автора: должности меняются, а запись должна и через год говорить,
    // кем он был тогда.
    authorName: input.author.fullName,
    authorRole: input.author.role,
    command: input.command,
    action: input.action,
    subject: input.subject,
    subjectId: input.subjectId,
    subjectTitle: input.subjectTitle,
    nodeId: input.nodeId,
    fields: input.fields,
  };

  const saved = await deps.log.append(entry);
  if (!saved.ok) return saved;
  return ok(entry);
}

/**
 * Заносит в журнал всё, что сделала одна команда.
 *
 * Одним обращением к хранилищу, а не по записи на сущность: один жест человека
 * задевает сколько угодно записей — завести сто огнетушителей, перенести этаж
 * на склад, применить состав системы, — и запись по одной переписывала бы файл
 * журнала сто раз подряд, тем дольше, чем длиннее журнал.
 *
 * Пустые изменения отсеиваются по тому же правилу, что и в `recordChange`:
 * «изменено» без изменившихся полей в журнал не идёт.
 */
export async function recordChanges(
  deps: ChangeLogDeps,
  inputs: readonly RecordChangeInput[],
): Promise<Result<readonly ChangeLogEntry[]>> {
  const at = deps.clock.nowUtc();
  const entries = inputs
    .filter((input) => input.action !== 'изменено' || input.fields.length > 0)
    .map((input) => ({
      id: deps.ids.newId(),
      at,
      authorId: input.author.id,
      authorName: input.author.fullName,
      authorRole: input.author.role,
      command: input.command,
      action: input.action,
      subject: input.subject,
      subjectId: input.subjectId,
      subjectTitle: input.subjectTitle,
      nodeId: input.nodeId,
      fields: input.fields,
    }));

  if (entries.length === 0) return ok([]);

  const saved = await deps.log.appendMany(entries);
  if (!saved.ok) return saved;
  return ok(entries);
}

export interface ReadChangeLogInput {
  readonly reader: UserAccount;
  readonly nodes: readonly TreeNode[];
  readonly filter?: ChangeLogFilter;
}

/** Читает журнал в границах прав читающего. */
export async function readChangeLog(
  deps: ChangeLogDeps,
  input: ReadChangeLogInput,
): Promise<Result<readonly ChangeLogEntry[]>> {
  if (!can(input.reader, 'изменения.смотреть')) {
    return err('FORBIDDEN', 'Журнал изменений доступен администратору и ответственному за пожарную безопасность.');
  }

  const all = await deps.log.list(input.filter);
  if (!all.ok) return all;

  /*
   * Администратору журнал показывается целиком, без отбора по дереву.
   *
   * Отбирать и ему было бы ошибкой: узел могли вывести из эксплуатации, и его
   * уже нет в списке — а записи о том, что с ним делали, остаться обязаны.
   * Именно ради таких случаев журнал и ведут.
   */
  if (input.reader.role === 'администратор') return ok(all.value);

  const reachable = reachableNodeIds(input.reader, input.nodes);
  return ok(all.value.filter((entry) => {
    // Изменения вне дерева — общие настройки, регламенты, пользователи — видит
    // только тот, кто вправе их менять. Ответственному они ничего не говорят
    // о его объектах и только засоряли бы журнал.
    if (entry.nodeId === null) return false;
    return reachable.has(entry.nodeId);
  }));
}

/** Сравнивает два значения и возвращает поле, если оно изменилось. */
export function changedField(
  title: string,
  before: unknown,
  after: unknown,
): ChangedField | null {
  const was = asText(before);
  const now = asText(after);
  return was === now ? null : { title, before: was, after: now };
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? null : value.map((item) => asText(item) ?? '—').join(', ');
  return JSON.stringify(value);
}
