/**
 * Сценарии учётных записей: завести, войти, сменить пароль, выдать и забрать
 * доступ.
 *
 * Два правила проходят через все сценарии.
 *
 * **Пароль знает только его владелец.** Администратор задаёт временный пароль,
 * но программа сразу требует заменить его при первом входе: пока не заменён,
 * подписывать нельзя — иначе подпись подтверждала бы не того, кто расписался, а
 * того, кто пароль выдал.
 *
 * **Последний администратор не исчезает.** Ни снятием роли, ни отключением
 * учётной записи: программа, в которую некому войти с правами администратора,
 * восстанавливается только правкой файлов данных руками.
 */

import type {
  PasswordDigest, Result, TreeNodeId, UserAccount, UserId, UserRole,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { AccessDeps } from './access-deps.js';
import { SIGN_IN_REFUSED, checkPasswordStrength } from './password-policy.js';
import { can } from './permissions.js';
import { saveChangedUser } from './save-user.js';

export interface CreateUserInput {
  readonly login: string;
  readonly fullName: string;
  readonly position?: string | null;
  /** Организация, в которой работает человек. Подставляется в акты проверок. */
  readonly organization?: string | null;
  readonly email?: string | null;
  readonly role: UserRole;
  readonly scope?: readonly TreeNodeId[];
  /** Временный пароль. Пользователь заменит его при первом входе. */
  readonly temporaryPassword: string;
}

const LOGIN_PATTERN = /^[A-Za-zА-Яа-яЁё0-9._-]{3,32}$/u;

/**
 * Кто выполняет действие над учётными записями.
 *
 * Право проверяется здесь, в ядре, а не только кнопкой на экране. Кнопку
 * можно не нарисовать и всё равно позвать сценарий — из другого места, из
 * сочетания клавиш, из будущего серверного вызова. Разграничение, которое
 * держится на том, что кнопка спрятана, разграничением не является.
 */
function guardManageUsers(actor: UserAccount | null): Result<never> | null {
  if (can(actor, 'пользователи.править')) return null;
  return err('FORBIDDEN', 'Заводить и менять учётные записи вправе администратор.');
}

/**
 * Заводит учётную запись.
 *
 * actor — тот, кто заводит. null допустим ровно в одном случае: программа
 * пустая и заводится самый первый администратор. Иначе завести первого было
 * бы некому — войти не под кем.
 */
export async function createUser(
  deps: AccessDeps,
  input: CreateUserInput,
  actor: UserAccount | null,
): Promise<Result<UserAccount>> {
  if (actor === null) {
    const empty = await hasAnyUser(deps);
    if (!empty.ok) return empty;
    if (empty.value) {
      return err('FORBIDDEN', 'Заводить учётные записи вправе администратор.');
    }
    if (input.role !== 'администратор') {
      return err('INVALID_ARGUMENT', 'Первой заводится учётная запись администратора: иначе настраивать программу будет некому.');
    }
  } else {
    const guard = guardManageUsers(actor);
    if (guard !== null) return guard;
  }

  const login = input.login.trim();
  if (!LOGIN_PATTERN.test(login)) {
    return err('INVALID_ARGUMENT', 'Имя для входа: от 3 до 32 знаков, буквы, цифры, точка, дефис или подчёркивание.');
  }
  if (input.fullName.trim() === '') {
    return err('INVALID_ARGUMENT', 'Без ФИО учётная запись бесполезна: оно подставляется исполнителем работ и в подпись.');
  }

  const strength = checkPasswordStrength(input.temporaryPassword);
  if (!strength.ok) return strength;

  const existing = await deps.users.findByLogin(login);
  if (!existing.ok) return existing;
  if (existing.value !== null) return err('CONFLICT', `Имя «${login}» уже занято.`);

  const digest = await deps.hasher.hash(input.temporaryPassword);
  if (!digest.ok) return digest;

  const now = deps.clock.nowUtc();
  const user: UserAccount = {
    id: deps.ids.newId(),
    login,
    fullName: input.fullName.trim(),
    position: input.position?.trim() === '' ? null : input.position ?? null,
    organization: input.organization?.trim() === '' ? null : input.organization ?? null,
    email: input.email?.trim() === '' ? null : input.email ?? null,
    role: input.role,
    scope: input.role === 'администратор' ? [] : [...(input.scope ?? [])],
    password: digest.value,
    keyGeneration: 1,
    mustChangePassword: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1,
  };

  const saved = await deps.users.save(user);
  if (!saved.ok) return saved;
  return ok(user);
}

export interface SignInInput {
  readonly login: string;
  readonly password: string;
}

/**
 * Вход.
 *
 * Отказ всегда одной фразой: разница между «нет такого имени» и «неверный
 * пароль» помогает подбирающему и ничем не помогает тому, кто ошибся.
 *
 * Отпечаток проверяется даже у отключённой учётной записи и у записи без
 * пароля — на глазок, по времени ответа, отличить их иначе было бы можно.
 */
export async function signIn(deps: AccessDeps, input: SignInInput): Promise<Result<UserAccount>> {
  const found = await deps.users.findByLogin(input.login.trim());
  if (!found.ok) return found;

  const user = found.value;
  if (user === null || user.password === null) {
    /*
     * Отпечаток считается и тогда, когда считать нечего.
     *
     * Иначе отказ «нет такого имени» возвращался бы мгновенно, а «неверный
     * пароль» — после медленного счёта отпечатка, и по одному времени ответа
     * было бы видно, какое имя существует. Общая фраза отказа теряет смысл,
     * если разницу выдают часы.
     */
    await deps.hasher.hash(input.password);
    return err('NOT_FOUND', SIGN_IN_REFUSED);
  }

  const matched = await deps.hasher.verify(input.password, user.password);
  if (!matched.ok) return matched;
  if (!matched.value) return err('NOT_FOUND', SIGN_IN_REFUSED);
  if (user.archivedAt !== null) {
    return err('FORBIDDEN', 'Учётная запись отключена. Обратитесь к администратору.');
  }

  return ok(user);
}



export interface UpdateUserInput {
  readonly id: UserId;
  readonly fullName?: string;
  readonly position?: string | null;
  readonly organization?: string | null;
  readonly email?: string | null;
  readonly role?: UserRole;
  readonly scope?: readonly TreeNodeId[];
}

export async function updateUser(
  deps: AccessDeps,
  input: UpdateUserInput,
  actor: UserAccount | null,
): Promise<Result<UserAccount>> {
  const guard = guardManageUsers(actor);
  if (guard !== null) return guard;

  const current = await deps.users.getById(input.id);
  if (!current.ok) return current;

  const role = input.role ?? current.value.role;
  if (current.value.role === 'администратор' && role !== 'администратор') {
    const last = await lastAdministratorGuard(deps, current.value.id);
    if (last !== null) return last;
  }

  return saveChangedUser(deps, current.value, {
    fullName: input.fullName === undefined || input.fullName.trim() === ''
      ? current.value.fullName
      : input.fullName.trim(),
    position: input.position === undefined ? current.value.position : input.position,
    organization: input.organization === undefined ? current.value.organization : input.organization,
    email: input.email === undefined ? current.value.email : input.email,
    role,
    // У администратора области нет: ему доступно всё, и хранить список узлов
    // значило бы делать вид, что он на что-то влияет.
    scope: role === 'администратор' ? [] : [...(input.scope ?? current.value.scope)],
  });
}

/**
 * Отключение и возврат учётной записи.
 *
 * Не удаление: записи журнала и подписи ссылаются на автора, и запись без
 * автора — это запись, которую некому предъявить.
 */
export async function setUserArchived(
  deps: AccessDeps,
  id: UserId,
  archived: boolean,
  actor: UserAccount | null,
): Promise<Result<UserAccount>> {
  const guard = guardManageUsers(actor);
  if (guard !== null) return guard;

  const current = await deps.users.getById(id);
  if (!current.ok) return current;

  if (archived && current.value.role === 'администратор') {
    const last = await lastAdministratorGuard(deps, id);
    if (last !== null) return last;
  }

  return saveChangedUser(deps, current.value, { archivedAt: archived ? deps.clock.nowUtc() : null });
}

/** Есть ли в программе хоть одна работающая учётная запись. */
export async function hasAnyUser(deps: AccessDeps): Promise<Result<boolean>> {
  const list = await deps.users.list();
  if (!list.ok) return list;
  return ok(list.value.length > 0);
}

/** Не последний ли это администратор. null — можно менять. */
async function lastAdministratorGuard(deps: AccessDeps, id: UserId): Promise<Result<never> | null> {
  const list = await deps.users.list();
  if (!list.ok) return list;

  const others = list.value.filter((user) =>
    user.id !== id && user.role === 'администратор' && user.archivedAt === null);
  if (others.length > 0) return null;

  return err(
    'FORBIDDEN',
    'Это последний администратор. Сначала назначьте другого — иначе в программу'
      + ' станет некому войти с правами на настройки и пользователей.',
  );
}


export type { PasswordDigest };

export interface UpdateOwnProfileInput {
  readonly id: UserId;
  readonly fullName: string;
  readonly position: string | null;
  /** Организация, в которой человек работает. */
  readonly organization: string | null;
  readonly email: string | null;
}

/**
 * Правка своих сведений: ФИО, должность, организация, почта.
 *
 * Отдельно от updateUser и без права «пользователи.править» — намеренно. Это
 * своя запись, и просить администратора поправить опечатку в собственной
 * фамилии человек не должен. Роль и область здесь не трогаются вовсе: их в
 * входных данных нет, и подсунуть их нельзя.
 *
 * Править разрешено только себя: идентификатор сверяется с тем, кто правит.
 */
export async function updateOwnProfile(
  deps: AccessDeps,
  input: UpdateOwnProfileInput,
  actor: UserAccount | null,
): Promise<Result<UserAccount>> {
  if (actor === null || actor.id !== input.id) {
    return err('FORBIDDEN', 'Свои сведения правит только их владелец.');
  }
  if (input.fullName.trim() === '') {
    return err('INVALID_ARGUMENT', 'Без ФИО не обойтись: оно подставляется исполнителем работ и в подпись.');
  }

  const current = await deps.users.getById(input.id);
  if (!current.ok) return current;

  return saveChangedUser(deps, current.value, {
    fullName: input.fullName.trim(),
    position: input.position === null || input.position.trim() === '' ? null : input.position.trim(),
    organization: input.organization === null || input.organization.trim() === ''
      ? null
      : input.organization.trim(),
    email: input.email === null || input.email.trim() === '' ? null : input.email.trim(),
  });
}

/**
 * Можно ли удалить учётную запись совсем.
 *
 * Заказчик просил уметь «блокировать и удалять» пользователей. Блокировка есть —
 * это вывод из обращения, при котором записи и подписи остаются на месте.
 * Удаление же возможно не всегда, и причина серьёзнее удобства.
 *
 * Под записями журнала эксплуатации стоят простые электронные подписи, и в
 * каждой — снимок подписавшего: ФИО, должность, роль, открытый ключ. Сама
 * подпись удаление учётной записи переживёт. Но человек, который подписывал,
 * обязан оставаться в списке: по 63-ФЗ подпись определяет **подписавшего**, а
 * запись «подписал тот, кого в программе нет» этому не отвечает.
 *
 * Поэтому: подписывал — только отключение; не подписывал — удаляется начисто.
 */
export interface UserDeletionCheck {
  readonly canDelete: boolean;
  /** Сколько записей журнала он подписал. */
  readonly signedCount: number;
}

export function userDeletionCheck(
  userId: UserId,
  events: readonly { readonly signature?: { readonly signerId: string } | null }[],
): UserDeletionCheck {
  const signedCount = events.filter((event) => (event.signature ?? null)?.signerId === userId).length;
  return { canDelete: signedCount === 0, signedCount };
}

/**
 * Удаляет учётную запись совсем.
 *
 * Проверку «подписывал ли он» делает вызывающий: она требует журнала
 * эксплуатации, а сценариям доступа он не нужен ни для чего другого, и тянуть
 * его сюда значило бы читать весь журнал ради одного удаления.
 */
export async function deleteUser(
  deps: AccessDeps,
  id: UserId,
  actor: UserAccount | null,
): Promise<Result<void>> {
  if (!can(actor, 'пользователи.править')) {
    return err('FORBIDDEN', 'Удалять учётные записи вправе администратор.');
  }
  if (actor !== null && actor.id === id) {
    return err('INVALID_ARGUMENT', 'Себя удалить нельзя: программа осталась бы без администратора.');
  }

  const current = await deps.users.getById(id);
  if (!current.ok) return current;

  return deps.users.remove(id);
}
