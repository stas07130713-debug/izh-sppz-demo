/**
 * Разграничение доступа: роли, область прав, пароли (ТЗ, Дополнение 7).
 *
 * Проверки написаны от обратного: не «администратор может всё», а «чего не
 * может каждый». Разграничение ошибается всегда в одну сторону — лишнее
 * разрешение, — и ловить надо именно её.
 */

import { describe, expect, it } from 'vitest';
import type { AccessDeps } from '../access/access-deps.js';
import type { TreeNode, UserAccount, UserRole } from '@izh/contracts';
import { ROLE_PERMISSIONS } from '@izh/contracts';
import {
  can, canOnNode, canReachNode, reachableNodeIds, visibleNodes,
} from '../access/permissions.js';
import { checkPasswordStrength } from '../access/password-policy.js';
import {
  createUser, hasAnyUser, setUserArchived, signIn, updateOwnProfile, updateUser,
} from '../access/user-scenarios.js';
import { changePassword, resetPassword } from '../access/password-scenarios.js';
import { fakeClock, fakeIdGenerator } from './test-doubles.js';
import { fakePasswordHasher, fakeUserRepository } from './access-doubles.js';

function makeDeps(): AccessDeps {
  return {
    users: fakeUserRepository(),
    hasher: fakePasswordHasher(),
    clock: fakeClock(),
    ids: fakeIdGenerator(),
  };
}

function value<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** Первый администратор: с него начинается любая работа с учётными записями. */
async function bootstrap(deps: AccessDeps): Promise<UserAccount> {
  return value(await createUser(deps, {
    login: 'admin1', fullName: 'Петров П. П.', role: 'администратор',
    temporaryPassword: 'начальный-пароль-1',
  }, null));
}

function account(role: UserRole, scope: readonly string[] = []): UserAccount {
  return {
    id: 'u1', login: 'ivanov', fullName: 'Иванов И. И.', position: 'Инженер по ПБ',
    organization: null,
    email: null, role, scope: [...scope], password: null, keyGeneration: 1,
    mustChangePassword: false, archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', rowVersion: 1,
  };
}

/** Организация → цех → здание → этаж, и второе здание в стороне. */
const NODES: readonly TreeNode[] = [
  { id: 'орг', parentId: null, kind: 'organization', name: 'АО' },
  { id: 'цех', parentId: 'орг', kind: 'workshop', name: 'АСС' },
  { id: 'зд1', parentId: 'цех', kind: 'building', name: 'МВАСО' },
  { id: 'эт1', parentId: 'зд1', kind: 'level', name: '1 этаж' },
  { id: 'скл', parentId: 'зд1', kind: 'storage', name: 'Склад' },
  { id: 'зд2', parentId: 'орг', kind: 'building', name: 'Чужое здание' },
].map((node) => ({ ...node, siteId: 'орг', code: null, elevationM: null, note: null, building: null }) as TreeNode);

describe('права по ролям', () => {
  it('ответственный не правит регламенты и настройки', () => {
    // Периодичность проверок — решение организации, одно на всех. Разойдись
    // она по зданиям, журнал перестал бы что-либо значить.
    const user = account('ответственный', ['зд1']);
    expect(can(user, 'регламенты.править')).toBe(false);
    expect(can(user, 'настройки.править')).toBe(false);
    expect(can(user, 'пользователи.править')).toBe(false);
  });

  it('ответственный ведёт оборудование, план и журнал', () => {
    const user = account('ответственный', ['зд1']);
    expect(can(user, 'объекты.править')).toBe(true);
    expect(can(user, 'журнал.вести')).toBe(true);
    expect(can(user, 'план.править')).toBe(true);
    expect(can(user, 'подложка.править')).toBe(true);
  });

  it('гость не меняет ничего и не подписывает', () => {
    const user = account('гость', ['зд1']);
    for (const permission of ROLE_PERMISSIONS.администратор) {
      const allowed = permission === 'выгрузка' || permission === 'отображение';
      expect(can(user, permission), permission).toBe(allowed);
    }
  });

  it('отключённой учётной записи не разрешено ничего', () => {
    const user = { ...account('администратор'), archivedAt: '2026-02-01T00:00:00.000Z' };
    for (const permission of ROLE_PERMISSIONS.администратор) {
      expect(can(user, permission), permission).toBe(false);
    }
  });

  it('без учётной записи не разрешено ничего', () => {
    expect(can(null, 'выгрузка')).toBe(false);
    expect(canReachNode(null, 'эт1', NODES)).toBe(false);
  });
});

describe('область прав', () => {
  it('права идут вниз по дереву', () => {
    const user = account('ответственный', ['зд1']);
    expect(canReachNode(user, 'зд1', NODES)).toBe(true);
    expect(canReachNode(user, 'эт1', NODES)).toBe(true);
    expect(canReachNode(user, 'скл', NODES)).toBe(true);
  });

  it('вверх права не идут', () => {
    // Иначе выдача одного этажа означала бы выдачу всего здания и организации.
    const user = account('ответственный', ['эт1']);
    expect(canReachNode(user, 'зд1', NODES)).toBe(false);
    expect(canReachNode(user, 'орг', NODES)).toBe(false);
  });

  it('вбок права не идут', () => {
    const user = account('ответственный', ['зд1']);
    expect(canReachNode(user, 'зд2', NODES)).toBe(false);
  });

  it('администратору доступно всё без всякой области', () => {
    const user = account('администратор');
    for (const node of NODES) expect(canReachNode(user, node.id, NODES), node.id).toBe(true);
  });

  it('пустая область не даёт ничего', () => {
    const user = account('ответственный');
    expect(canReachNode(user, 'эт1', NODES)).toBe(false);
    expect(reachableNodeIds(user, NODES).size).toBe(0);
  });

  it('список доступного собирается целиком', () => {
    const user = account('ответственный', ['зд1']);
    expect([...reachableNodeIds(user, NODES)].sort()).toEqual(['зд1', 'скл', 'эт1']);
  });

  it('дерево отбирается по области прав', () => {
    /*
     * Разбор жалобы заказчика: «присвоил роль ответственный, выбрал ему
     * определённые объекты, но зашёл под ним — вижу все объекты». Правила были
     * написаны и проверены, а окно их не спрашивало и показывало дерево
     * целиком. Правило вынесено сюда, чтобы у него была своя проверка, а не
     * только чужая внимательность.
     */
    const user = account('ответственный', ['зд1']);
    const видно = visibleNodes(user, NODES);

    expect(видно.map((node) => node.id).sort()).toEqual(['зд1', 'скл', 'эт1']);
    expect(видно.length).toBeLessThan(NODES.length);
  });

  it('администратору дерево отдаётся целиком', () => {
    expect(visibleNodes(account('администратор'), NODES)).toEqual(NODES);
  });

  it('без входа и без области дерева нет', () => {
    expect(visibleNodes(null, NODES)).toEqual([]);
    expect(visibleNodes(account('ответственный'), NODES)).toEqual([]);
    expect(visibleNodes(account('гость', ['эт1']), NODES).map((node) => node.id)).toEqual(['эт1']);
  });

  it('петля в дереве не подвешивает проверку', () => {
    // Испорченные данные не должны обращаться в зависание: у проверки есть
    // предел числа шагов.
    const looped = [
      { id: 'а', parentId: 'б' },
      { id: 'б', parentId: 'а' },
    ].map((node) => ({
      ...node, siteId: 'а', kind: 'building' as const, name: node.id,
      code: null, elevationM: null, note: null, building: null,
    }) as TreeNode);
    expect(canReachNode(account('ответственный', ['в']), 'а', looped)).toBe(false);
  });

  it('право и область проверяются вместе', () => {
    const user = account('ответственный', ['зд1']);
    expect(canOnNode(user, 'объекты.править', 'эт1', NODES)).toBe(true);
    expect(canOnNode(user, 'объекты.править', 'зд2', NODES)).toBe(false);
    expect(canOnNode(user, 'настройки.править', 'эт1', NODES)).toBe(false);
  });
});

describe('пароль', () => {
  it('короткий не принимается', () => {
    expect(checkPasswordStrength('корот').ok).toBe(false);
  });

  it('очевидный не принимается', () => {
    expect(checkPasswordStrength('12345678').ok).toBe(false);
    expect(checkPasswordStrength('Password').ok).toBe(false);
  });

  it('из одного знака не принимается', () => {
    expect(checkPasswordStrength('ааааааааа').ok).toBe(false);
  });

  it('обычный принимается', () => {
    expect(checkPasswordStrength('огнетушитель-2026').ok).toBe(true);
  });
});

describe('учётные записи', () => {
  it('заводится с временным паролем, который нужно заменить', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный',
      scope: ['зд1'], temporaryPassword: 'временный-2026',
    }, admin));

    expect(user.mustChangePassword).toBe(true);
    expect(user.keyGeneration).toBe(1);
    // Самого пароля нет нигде: только отпечаток.
    expect(JSON.stringify(user)).not.toContain('временный-2026');
  });

  it('имя для входа занимать дважды нельзя', async () => {
    const deps = makeDeps();
    value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, await bootstrap(deps)));

    const second = await createUser(deps, {
      login: 'IVANOV', fullName: 'Иванов Пётр', role: 'гость', temporaryPassword: 'другой-пароль-1',
    }, account('администратор'));
    expect(second.ok).toBe(false);
  });

  it('у администратора области нет', async () => {
    const deps = makeDeps();
    const user = value(await createUser(deps, {
      login: 'admin1', fullName: 'Петров П. П.', role: 'администратор',
      scope: ['зд1'], temporaryPassword: 'начальный-пароль-1',
    }, null));
    expect(user.scope).toEqual([]);
  });

  it('вход по верному паролю проходит, по неверному — нет', async () => {
    const deps = makeDeps();
    value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, await bootstrap(deps)));

    expect((await signIn(deps, { login: 'ivanov', password: 'временный-2026' })).ok).toBe(true);
    expect((await signIn(deps, { login: 'ivanov', password: 'не тот' })).ok).toBe(false);
  });

  it('отказ во входе не выдаёт, что именно не подошло', async () => {
    const deps = makeDeps();
    value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, await bootstrap(deps)));

    const noSuchName = await signIn(deps, { login: 'нет-такого', password: 'временный-2026' });
    const wrongPassword = await signIn(deps, { login: 'ivanov', password: 'не тот' });
    expect(noSuchName.ok).toBe(false);
    expect(wrongPassword.ok).toBe(false);
    if (noSuchName.ok || wrongPassword.ok) throw new Error('вход не должен был пройти');
    expect(noSuchName.error.message).toBe(wrongPassword.error.message);
  });

  it('отключённая учётная запись не входит', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, admin));
    value(await setUserArchived(deps, user.id, true, admin));

    expect((await signIn(deps, { login: 'ivanov', password: 'временный-2026' })).ok).toBe(false);
  });

  it('смена пароля растит поколение ключа и снимает временность', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, admin));

    const changed = value(await changePassword(deps, {
      id: user.id, currentPassword: 'временный-2026', newPassword: 'мой-новый-пароль',
    }));

    expect(changed.keyGeneration).toBe(2);
    expect(changed.mustChangePassword).toBe(false);
    expect((await signIn(deps, { login: 'ivanov', password: 'мой-новый-пароль' })).ok).toBe(true);
    expect((await signIn(deps, { login: 'ivanov', password: 'временный-2026' })).ok).toBe(false);
  });

  it('смена пароля без прежнего не проходит', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, admin));

    const result = await changePassword(deps, {
      id: user.id, currentPassword: 'не тот', newPassword: 'мой-новый-пароль',
    });
    expect(result.ok).toBe(false);
  });

  it('сброс администратором снова делает пароль временным', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, admin));
    value(await changePassword(deps, {
      id: user.id, currentPassword: 'временный-2026', newPassword: 'мой-новый-пароль',
    }));

    const reset = value(await resetPassword(deps, { id: user.id, temporaryPassword: 'выданный-заново-1' }, admin));
    expect(reset.mustChangePassword).toBe(true);
    expect(reset.keyGeneration).toBe(3);
  });

  it('последнего администратора нельзя ни разжаловать, ни отключить', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);

    expect((await updateUser(deps, { id: admin.id, role: 'гость' }, admin)).ok).toBe(false);
    expect((await setUserArchived(deps, admin.id, true, admin)).ok).toBe(false);
  });

  it('когда администраторов двое, одного отключить можно', async () => {
    const deps = makeDeps();
    const first = await bootstrap(deps);
    value(await createUser(deps, {
      login: 'admin2', fullName: 'Сидоров С. С.', role: 'администратор', temporaryPassword: 'начальный-пароль-2',
    }, first));

    expect((await setUserArchived(deps, first.id, true, first)).ok).toBe(true);
  });

  it('пустая программа видна как пустая', async () => {
    const deps = makeDeps();
    expect(value(await hasAnyUser(deps))).toBe(false);
    value(await createUser(deps, {
      login: 'admin1', fullName: 'Петров П. П.', role: 'администратор', temporaryPassword: 'начальный-пароль-1',
    }, null));
    expect(value(await hasAnyUser(deps))).toBe(true);
  });
});

describe('кто вправе распоряжаться учётными записями', () => {
  /*
   * Права проверяются в самих сценариях, а не только кнопкой на экране.
   *
   * Кнопку можно не нарисовать и всё равно позвать сценарий — из другого места,
   * из будущего серверного вызова. Разграничение, которое держится на спрятанной
   * кнопке, разграничением не является, и эти проверки закрепляют именно это.
   */
  it('ответственный не заводит учётные записи', async () => {
    const deps = makeDeps();
    await bootstrap(deps);

    const result = await createUser(deps, {
      login: 'petrov', fullName: 'Петров П. П.', role: 'гость', temporaryPassword: 'какой-то-пароль-1',
    }, account('ответственный', ['зд1']));
    expect(result.ok).toBe(false);
  });

  it('гость не сбрасывает чужие пароли', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, admin));

    const result = await resetPassword(deps, { id: user.id, temporaryPassword: 'подсунутый-пароль' }, account('гость'));
    expect(result.ok).toBe(false);
  });

  it('никто не меняет роли без права', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'гость', temporaryPassword: 'временный-2026',
    }, admin));

    const selfPromotion = await updateUser(deps, { id: user.id, role: 'администратор' }, user);
    expect(selfPromotion.ok).toBe(false);
  });

  it('без исполнителя заводится только первый администратор', async () => {
    const deps = makeDeps();
    // Первый — можно: войти ещё не под кем.
    await bootstrap(deps);
    // Второй без исполнителя — уже нет.
    const second = await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, null);
    expect(second.ok).toBe(false);
  });

  it('первым заводится именно администратор', async () => {
    const deps = makeDeps();
    const result = await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'ответственный', temporaryPassword: 'временный-2026',
    }, null);
    expect(result.ok).toBe(false);
  });

  it('свой пароль меняется без администратора — по прежнему паролю', async () => {
    // Это не дыра: прежний пароль знает только владелец, и он же им и является.
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'гость', temporaryPassword: 'временный-2026',
    }, admin));

    const changed = await changePassword(deps, {
      id: user.id, currentPassword: 'временный-2026', newPassword: 'свой-новый-пароль',
    });
    expect(changed.ok).toBe(true);
  });
});

describe('свой профиль', () => {
  it('правится владельцем без права на пользователей', async () => {
    // Просить администратора поправить опечатку в собственной фамилии человек
    // не должен: это своя запись.
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванв И. И.', role: 'гость', temporaryPassword: 'временный-2026',
    }, admin));

    const fixed = value(await updateOwnProfile(deps, { organization: null,
      id: user.id, fullName: 'Иванов И. И.', position: 'Инженер по ПБ', email: 'i@example.ru',
    }, user));

    expect(fixed.fullName).toBe('Иванов И. И.');
    expect(fixed.position).toBe('Инженер по ПБ');
  });

  it('чужой профиль так не правится', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'гость', temporaryPassword: 'временный-2026',
    }, admin));

    const result = await updateOwnProfile(deps, { organization: null,
      id: user.id, fullName: 'Подменённый', position: null, email: null,
    }, admin);
    expect(result.ok).toBe(false);
  });

  it('роль и область через свой профиль не поднимаются', async () => {
    // Ради этого сценарий и отделён: роли в его входных данных нет вовсе,
    // подсунуть её нельзя.
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'гость',
      scope: ['зд1'], temporaryPassword: 'временный-2026',
    }, admin));

    const saved = value(await updateOwnProfile(deps, { organization: null,
      id: user.id, fullName: 'Иванов И. И.', position: null, email: null,
    }, user));

    expect(saved.role).toBe('гость');
    expect(saved.scope).toEqual(['зд1']);
  });

  it('без ФИО профиль не сохраняется', async () => {
    const deps = makeDeps();
    const admin = await bootstrap(deps);
    const user = value(await createUser(deps, {
      login: 'ivanov', fullName: 'Иванов И. И.', role: 'гость', temporaryPassword: 'временный-2026',
    }, admin));

    const result = await updateOwnProfile(deps, { organization: null, id: user.id, fullName: '   ', position: null, email: null }, user);
    expect(result.ok).toBe(false);
  });
});
