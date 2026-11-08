/**
 * Смена и сброс пароля.
 *
 * Вынесено из сценариев учётных записей: там про то, кто есть в программе и
 * что кому поручено, а здесь про ключ, которым человек подтверждает, что это
 * он. Разные вопросы, и правила у них разные — свой пароль меняют по прежнему
 * паролю, чужой сбрасывает администратор.
 */

import type { Result, SigningKey, UserAccount, UserId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { AccessDeps } from './access-deps.js';
import { checkPasswordStrength } from './password-policy.js';
import { can } from './permissions.js';
import { saveChangedUser } from './save-user.js';

/**
 * Ключ подписи после смены пароля.
 *
 * `null` — ключей программа не умеет вовсе (порт не подан): тогда и поля не
 * появляется, а подпись остаётся отметкой без криптографии.
 */
async function nextSigningKey(
  deps: AccessDeps,
  user: UserAccount,
  currentPassword: string,
  newPassword: string,
  generation: number,
): Promise<Result<SigningKey | null>> {
  if (deps.keys === undefined) return ok(null);

  const existing = user.signingKey ?? null;
  if (existing === null) return deps.keys.create(newPassword, generation);
  return deps.keys.rekey(existing, currentPassword, newPassword, generation);
}

export interface ChangePasswordInput {
  readonly id: UserId;
  /** Прежний пароль. Спрашивается всегда, даже у себя: подтверждение, что это он. */
  readonly currentPassword: string;
  readonly newPassword: string;
}

/**
 * Смена своего пароля.
 *
 * Исполнитель здесь не спрашивается, и это не упущение: прежний пароль знает
 * только владелец, и знание пароля и есть подтверждение, что это он.
 */
export async function changePassword(
  deps: AccessDeps,
  input: ChangePasswordInput,
): Promise<Result<UserAccount>> {
  const current = await deps.users.getById(input.id);
  if (!current.ok) return current;
  if (current.value.password === null) return err('INVALID_ARGUMENT', 'У учётной записи ещё нет пароля.');

  const matched = await deps.hasher.verify(input.currentPassword, current.value.password);
  if (!matched.ok) return matched;
  if (!matched.value) return err('FORBIDDEN', 'Прежний пароль указан неверно.');

  const strength = checkPasswordStrength(input.newPassword);
  if (!strength.ok) return strength;

  const digest = await deps.hasher.hash(input.newPassword);
  if (!digest.ok) return digest;

  const generation = current.value.keyGeneration + 1;

  /*
   * Ключ подписи следует за паролем.
   *
   * Есть ключ — он перешифровывается на новый пароль: пара остаётся
   * прежней, и прежние подписи по-прежнему проверяются тем же открытым
   * ключом. Нет ключа — заводится: человек задал свой пароль, и с этого
   * мгновения он может подписывать.
   */
  const key = await nextSigningKey(deps, current.value, input.currentPassword, input.newPassword, generation);
  if (!key.ok) return key;

  return saveChangedUser(deps, current.value, {
    password: digest.value,
    // Поколение ключа растёт: по нему видно, тем же паролем подписано или уже
    // другим. Прежние подписи это не отменяет — они привязаны к учётной записи.
    keyGeneration: generation,
    signingKey: key.value,
    mustChangePassword: false,
  });
}

export interface ResetPasswordInput {
  readonly id: UserId;
  readonly temporaryPassword: string;
}

/**
 * Сброс пароля администратором.
 *
 * Прежний пароль не спрашивается — его никто и не знает. Новый помечается
 * временным: до замены человек не сможет подписывать, потому что подпись
 * подтверждала бы не его.
 */
export async function resetPassword(
  deps: AccessDeps,
  input: ResetPasswordInput,
  actor: UserAccount | null,
): Promise<Result<UserAccount>> {
  if (!can(actor, 'пользователи.править')) {
    return err('FORBIDDEN', 'Сбрасывать пароли вправе администратор.');
  }

  const current = await deps.users.getById(input.id);
  if (!current.ok) return current;

  const strength = checkPasswordStrength(input.temporaryPassword);
  if (!strength.ok) return strength;

  const digest = await deps.hasher.hash(input.temporaryPassword);
  if (!digest.ok) return digest;

  /*
   * Ключ подписи при сбросе **удаляется**.
   *
   * Закрытый ключ заперт прежним паролем, которого никто не знает, — отпереть
   * его нечем. Оставить запись о ключе значило бы обещать подпись, которую
   * поставить невозможно. Новый ключ появится, когда человек задаст свой
   * пароль: временным паролем подписывать нельзя, его знают двое.
   */
  return saveChangedUser(deps, current.value, {
    password: digest.value,
    keyGeneration: current.value.keyGeneration + 1,
    signingKey: null,
    mustChangePassword: true,
  });
}
