/**
 * Сохранение изменённой учётной записи.
 *
 * Общий помощник: им пользуются и сценарии учётных записей, и сценарии
 * паролей. Версия записи растёт на каждое сохранение — по ней серверный вариант
 * потом отличит одновременную правку двумя людьми.
 */

import type { Clock, Result, UserAccount } from '@izh/contracts';
import { ok } from '@izh/contracts';

export async function saveChangedUser(
  deps: { readonly users: { save(user: UserAccount): Promise<Result<void>> }; readonly clock: Clock },
  current: UserAccount,
  patch: Partial<UserAccount>,
): Promise<Result<UserAccount>> {
  const next: UserAccount = {
    ...current,
    ...patch,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.rowVersion + 1,
  };
  const saved = await deps.users.save(next);
  if (!saved.ok) return saved;
  return ok(next);
}
