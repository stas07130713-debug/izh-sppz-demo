/**
 * Заведение первого администратора и вход под ним — на настоящем счёте
 * отпечатков (ТЗ, Дополнение 7, Д10).
 *
 * Проверки ядра идут на подставном счётчике, и они не поймали бы расхождения
 * между тем, как отпечаток считается при заведении, и тем, как он проверяется
 * при входе. А это ровно та ошибка, из-за которой человек не смог бы войти под
 * только что заведённой учётной записью.
 *
 * Путь повторяется целиком, включая замену пароля тем же паролем: экран входа
 * делает так при первом запуске, чтобы придуманный самим человеком пароль не
 * считался временным.
 */

import { describe, expect, it } from 'vitest';
import type { Result, UserAccount, UserId, UserRepository } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { changePassword, createUser, setUserArchived, signIn } from '@izh/core';
import { createPasswordHasher } from './password-hasher.js';

function memoryUsers(): UserRepository {
  const users = new Map<UserId, UserAccount>();
  return {
    async list(): Promise<Result<readonly UserAccount[]>> { return ok([...users.values()]); },
    async getById(id): Promise<Result<UserAccount>> {
      const found = users.get(id);
      return found === undefined ? err('NOT_FOUND', 'нет') : ok(found);
    },
    async findByLogin(login): Promise<Result<UserAccount | null>> {
      const wanted = login.trim().toLocaleLowerCase('ru');
      return ok([...users.values()].find((user) => user.login.toLocaleLowerCase('ru') === wanted) ?? null);
    },
    async save(user): Promise<Result<void>> { users.set(user.id, user); return ok(undefined); },
    async remove(id: string): Promise<Result<void>> { users.delete(id); return ok(undefined); },
  };
}

function makeDeps() {
  let counter = 0;
  return {
    users: memoryUsers(),
    hasher: createPasswordHasher(),
    clock: { nowUtc: () => '2026-08-30T20:11:48.191Z' },
    ids: { newId: () => { counter += 1; return `u${counter}`; } },
  };
}

function value<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** Тот же ход, что и на экране входа при первом запуске. */
async function register(deps: ReturnType<typeof makeDeps>, login: string, password: string): Promise<UserAccount> {
  const created = value(await createUser(deps, {
    login, fullName: 'Янишевский Святослав Анатольевич', role: 'администратор',
    temporaryPassword: password,
  }, null));
  return value(await changePassword(deps, {
    id: created.id, currentPassword: password, newPassword: password,
  }));
}

describe('первый запуск и вход под заведённой записью', () => {
  it('пароль, придуманный при заведении, пускает в программу', async () => {
    const deps = makeDeps();
    const registered = await register(deps, 'Святослав', 'мой-пароль-2026');

    expect(registered.mustChangePassword).toBe(false);
    expect(value(await signIn(deps, { login: 'Святослав', password: 'мой-пароль-2026' })).id).toBe(registered.id);
  });

  it('имя для входа набирается в любом регистре', async () => {
    const deps = makeDeps();
    await register(deps, 'Святослав', 'мой-пароль-2026');
    expect((await signIn(deps, { login: 'святослав', password: 'мой-пароль-2026' })).ok).toBe(true);
    expect((await signIn(deps, { login: '  Святослав  ', password: 'мой-пароль-2026' })).ok).toBe(true);
  });

  it('лишние пробелы в пароле — это другой пароль', async () => {
    // Пароль не обрезается намеренно: пробел в нём такой же знак, как буква.
    const deps = makeDeps();
    await register(deps, 'Святослав', 'мой-пароль-2026');
    expect((await signIn(deps, { login: 'Святослав', password: ' мой-пароль-2026' })).ok).toBe(false);
  });

  it('русская раскладка в пароле работает', async () => {
    const deps = makeDeps();
    await register(deps, 'Святослав', 'ОгнетушительОП4');
    expect((await signIn(deps, { login: 'Святослав', password: 'ОгнетушительОП4' })).ok).toBe(true);
    // Регистр пароля важен, в отличие от имени для входа.
    expect((await signIn(deps, { login: 'Святослав', password: 'огнетушительоп4' })).ok).toBe(false);
  });
});

/**
 * Вход по временному паролю, выданному администратором.
 *
 * Заказчик: «при пробном разе зарегистрировать пользователя с временным
 * паролем программа не дала сделать вход — нужно проверить». Путь длиннее
 * первого запуска: пароль придумывает не тот, кто им войдёт, и после входа
 * программа обязана потребовать замену — работать под паролем, который знают
 * двое, нельзя (Дополнение 7, Д10).
 */
describe('вход по временному паролю', () => {
  /** Администратор, от имени которого заводят остальных. */
  async function withAdmin() {
    const deps = makeDeps();
    const admin = await register(deps, 'Святослав', 'мой-пароль-2026');
    return { deps, admin };
  }

  it('заведённый администратором входит по выданному паролю', async () => {
    const { deps, admin } = await withAdmin();
    const created = value(await createUser(deps, {
      login: 'petrov', fullName: 'Петров Пётр Петрович', role: 'ответственный',
      temporaryPassword: 'временный-пароль-77',
    }, admin));

    expect(created.mustChangePassword).toBe(true);

    const entered = await signIn(deps, { login: 'petrov', password: 'временный-пароль-77' });
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;
    // Вход состоялся, но программа обязана увести на замену пароля.
    expect(entered.value.mustChangePassword).toBe(true);
  });

  it('после замены пароля пускает по новому и не пускает по временному', async () => {
    const { deps, admin } = await withAdmin();
    const created = value(await createUser(deps, {
      login: 'petrov', fullName: 'Петров Пётр Петрович', role: 'ответственный',
      temporaryPassword: 'временный-пароль-77',
    }, admin));

    const changed = value(await changePassword(deps, {
      id: created.id, currentPassword: 'временный-пароль-77', newPassword: 'свой-пароль-2026',
    }));
    expect(changed.mustChangePassword).toBe(false);

    expect((await signIn(deps, { login: 'petrov', password: 'свой-пароль-2026' })).ok).toBe(true);
    expect((await signIn(deps, { login: 'petrov', password: 'временный-пароль-77' })).ok).toBe(false);
  });

  it('отключённая запись не пускает даже с верным паролем', async () => {
    const { deps, admin } = await withAdmin();
    const created = value(await createUser(deps, {
      login: 'petrov', fullName: 'Петров Пётр Петрович', role: 'ответственный',
      temporaryPassword: 'временный-пароль-77',
    }, admin));

    value(await setUserArchived(deps, created.id, true, admin));

    const refused = await signIn(deps, { login: 'petrov', password: 'временный-пароль-77' });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toContain('отключена');
  });
});
