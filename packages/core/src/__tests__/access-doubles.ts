/**
 * Подставные хранилище учётных записей, счётчик отпечатков и журнал изменений.
 *
 * Отпечаток здесь считается нарочито простым способом: тесты проверяют правила
 * доступа, а не стойкость криптографии. Важно только, чтобы разные пароли
 * давали разные отпечатки, а одинаковые — одинаковые.
 *
 * Настоящий счёт живёт в основном процессе, на scrypt и SHA-256 из Node.
 */

import type {
  ChangeLogEntry, ChangeLogFilter, ChangeLogRepository, PasswordDigest, PasswordHasher,
  Result, UserAccount, UserId, UserRepository,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';

/** Обратимо и небезопасно — ровно то, что нужно тесту, и негодно в работе. */
function toyDigest(password: string, salt: string): string {
  let value = 0;
  const material = `${salt}:${password}`;
  for (const char of material) value = (value * 31 + char.codePointAt(0)!) % 1_000_000_007;
  return `${value}`;
}

export function fakePasswordHasher(): PasswordHasher {
  let counter = 0;
  return {
    async hash(password: string): Promise<Result<PasswordDigest>> {
      counter += 1;
      const salt = `соль-${counter}`;
      return ok({
        algorithm: 'scrypt',
        salt,
        digest: toyDigest(password, salt),
        costN: 16384,
        blockSizeR: 8,
        parallelP: 1,
        keyLength: 32,
      });
    },
    async verify(password: string, digest: PasswordDigest): Promise<Result<boolean>> {
      return ok(toyDigest(password, digest.salt) === digest.digest);
    },
    async sha256Hex(text: string): Promise<Result<string>> {
      let value = 0;
      for (const char of text) value = (value * 131 + char.codePointAt(0)!) % 1_000_000_007;
      return ok(value.toString(16).padStart(8, '0'));
    },
  };
}

export function fakeUserRepository(): UserRepository {
  const users = new Map<UserId, UserAccount>();
  return {
    async list(): Promise<Result<readonly UserAccount[]>> {
      return ok([...users.values()]);
    },
    async getById(id: UserId): Promise<Result<UserAccount>> {
      const found = users.get(id);
      return found === undefined ? err('NOT_FOUND', `Учётной записи ${id} нет.`) : ok(found);
    },
    async findByLogin(login: string): Promise<Result<UserAccount | null>> {
      const wanted = login.trim().toLocaleLowerCase('ru');
      const found = [...users.values()].find(
        (user) => user.login.toLocaleLowerCase('ru') === wanted,
      );
      return ok(found ?? null);
    },
    async save(user: UserAccount): Promise<Result<void>> {
      users.set(user.id, user);
      return ok(undefined);
    },
    async remove(id: string): Promise<Result<void>> { users.delete(id); return ok(undefined); },
  };
}

export function fakeChangeLogRepository(): ChangeLogRepository & { readonly entries: ChangeLogEntry[] } {
  const entries: ChangeLogEntry[] = [];
  return {
    entries,
    async list(filter?: ChangeLogFilter): Promise<Result<readonly ChangeLogEntry[]>> {
      let result = [...entries];
      if (filter?.subject !== undefined) result = result.filter((entry) => entry.subject === filter.subject);
      if (filter?.authorId !== undefined) result = result.filter((entry) => entry.authorId === filter.authorId);
      return ok(result);
    },
    async append(entry: ChangeLogEntry): Promise<Result<void>> {
      entries.push(entry);
      return ok(undefined);
    },
    async appendMany(rows: readonly ChangeLogEntry[]): Promise<Result<void>> {
      entries.push(...rows);
      return ok(undefined);
    },
  };
}
