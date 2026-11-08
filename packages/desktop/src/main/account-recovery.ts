/**
 * Подготовка программы к повторному заведению первого администратора.
 *
 * Пароль хранится отпечатком и восстановлению не подлежит. При этом просто
 * удалить пользователей из рабочей базы нельзя: прежние подписи и журнал
 * должны оставаться объяснимыми. Поэтому перед очисткой полный снимок учётных
 * записей сохраняется рядом с базой. Это тот же принцип, что раньше применялся
 * к отдельному users.json, только после перехода на SQLite источником стала
 * сама база.
 */

import { writeFile } from 'node:fs/promises';
import type { Result, UserAccount, UserRepository } from '@izh/contracts';
import { describeUnknown, err } from '@izh/contracts';

export interface ResettableUserRepository extends UserRepository {
  resetAll(): Promise<Result<void>>;
}

export interface AccountRecoveryDeps {
  readonly users: ResettableUserRepository;
  readonly archiveFile: string;
  readonly archivedAt: string;
  readonly forgetRememberedSession: () => Promise<Result<void>>;
  readonly saveArchive?: (path: string, contents: string) => Promise<void>;
}

export async function resetAccountsForRecovery(deps: AccountRecoveryDeps): Promise<Result<void>> {
  const listed = await deps.users.list();
  if (!listed.ok) return listed;

  const snapshot: { readonly version: 1; readonly archivedAt: string; readonly users: readonly UserAccount[] } = {
    version: 1,
    archivedAt: deps.archivedAt,
    users: listed.value,
  };

  try {
    const save = deps.saveArchive ?? ((path: string, contents: string) =>
      writeFile(path, contents, { encoding: 'utf8', flag: 'wx' }));
    await save(deps.archiveFile, JSON.stringify(snapshot, null, 2));
  } catch (cause) {
    return err(
      'FILE_WRITE_FAILED',
      'Не удалось сохранить резервную копию прежних учётных записей. Сброс отменён.',
      describeUnknown(cause),
    );
  }

  // Сначала убирается автоматический вход: если очистка состоится, ссылка на
  // прежнего пользователя не должна пережить следующий запуск.
  const forgotten = await deps.forgetRememberedSession();
  if (!forgotten.ok) return forgotten;

  return deps.users.resetAll();
}
