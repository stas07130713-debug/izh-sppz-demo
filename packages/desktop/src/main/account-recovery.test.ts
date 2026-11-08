import { describe, expect, it } from 'vitest';
import type { Result, UserAccount, UserId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { resetAccountsForRecovery, type ResettableUserRepository } from './account-recovery.js';

const USER: UserAccount = {
  id: 'u1', login: 'Святослав', fullName: 'Янишевский Святослав Анатольевич',
  position: 'Начальник АСС', organization: null, email: null, role: 'администратор',
  scope: [], password: null, keyGeneration: 1, mustChangePassword: false,
  archivedAt: null, createdAt: '2026-09-01T17:51:41.024Z',
  updatedAt: '2026-09-02T17:20:30.642Z', rowVersion: 4,
};

function memoryUsers(): { readonly repository: ResettableUserRepository; readonly values: Map<UserId, UserAccount> } {
  const values = new Map<UserId, UserAccount>([[USER.id, USER]]);
  const repository: ResettableUserRepository = {
    async list(): Promise<Result<readonly UserAccount[]>> { return ok([...values.values()]); },
    async getById(id) { const found = values.get(id); return found === undefined ? err('NOT_FOUND', 'нет') : ok(found); },
    async findByLogin(login) {
      return ok([...values.values()].find((user) => user.login.toLowerCase() === login.toLowerCase()) ?? null);
    },
    async save(user) { values.set(user.id, user); return ok(undefined); },
    async remove(id) { values.delete(id); return ok(undefined); },
    async resetAll() { values.clear(); return ok(undefined); },
  };
  return { repository, values };
}

describe('восстановление доступа единственного администратора', () => {
  it('сначала сохраняет снимок, затем очищает рабочие учётные записи', async () => {
    const users = memoryUsers();
    let archive = '';
    let forgotten = false;
    const result = await resetAccountsForRecovery({
      users: users.repository,
      archiveFile: 'users.json.снято',
      archivedAt: '2026-10-22T15:40:00.000Z',
      saveArchive: async (_path, contents) => { archive = contents; },
      forgetRememberedSession: async () => { forgotten = true; return ok(undefined); },
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(archive)).toMatchObject({ version: 1, users: [{ login: 'Святослав' }] });
    expect(forgotten).toBe(true);
    expect(users.values.size).toBe(0);
  });

  it('не трогает рабочие записи, если резервную копию сохранить не удалось', async () => {
    const users = memoryUsers();
    const result = await resetAccountsForRecovery({
      users: users.repository,
      archiveFile: 'users.json.снято',
      archivedAt: '2026-10-22T15:40:00.000Z',
      saveArchive: async () => { throw new Error('диск недоступен'); },
      forgetRememberedSession: async () => ok(undefined),
    });

    expect(result.ok).toBe(false);
    expect(users.values.size).toBe(1);
  });
});
