/**
 * Простая электронная подпись и журнал изменений (ТЗ, Дополнение 7).
 *
 * Проверяется то, ради чего подпись и заводят: она привязана к содержимому и к
 * человеку, а не к факту, что программа открыта. Подменили содержимое — сверка
 * это показывает; временный пароль — подписи нет; роль без ответственности —
 * подписи нет.
 */

import { describe, expect, it } from 'vitest';
import type { PasswordHasher, TreeNode, UserAccount, UserRole } from '@izh/contracts';
import { checkSignature, formatSignature, signSimple } from '../access/simple-signature.js';
import { signedJournalContent } from '../access/signed-content.js';
import { AUDIT_KEEP_DAYS, auditCutoff } from '../access/audit-log.js';
import { userDeletionCheck } from '../access/user-scenarios.js';
import { changedField, readChangeLog, recordChange } from '../access/change-log.js';
import { fakeClock, fakeIdGenerator } from './test-doubles.js';
import { fakeChangeLogRepository, fakePasswordHasher } from './access-doubles.js';

const AT = '2026-08-31T09:15:00.000Z';

function value<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

async function account(
  hasher: PasswordHasher,
  role: UserRole,
  password: string,
  patch: Partial<UserAccount> = {},
): Promise<UserAccount> {
  const digest = value(await hasher.hash(password));
  return {
    id: 'u1', login: 'ivanov', fullName: 'Иванов И. И.', position: 'Инженер по ПБ',
    organization: null, email: null, role, scope: ['зд1'], password: digest, keyGeneration: 3,
    mustChangePassword: false, archivedAt: null,
    createdAt: AT, updatedAt: AT, rowVersion: 1,
    ...patch,
  };
}

describe('простая электронная подпись', () => {
  it('ставится по паролю и запоминает, кем и когда', async () => {
    const hasher = fakePasswordHasher();
    const user = await account(hasher, 'ответственный', 'мой-пароль-2026');

    const signature = value(await signSimple(hasher, {
      user, password: 'мой-пароль-2026', kind: 'запись журнала',
      content: 'Проверка ОП-4 № 28-11 от 31.08.2026: исправен', at: AT,
    }));

    expect(signature.signerId).toBe('u1');
    expect(signature.signerName).toBe('Иванов И. И.');
    expect(signature.signerPosition).toBe('Инженер по ПБ');
    expect(signature.keyGeneration).toBe(3);
    expect(signature.signedAt).toBe(AT);
  });

  it('без верного пароля не ставится', async () => {
    // Пароль спрашивается заново: подписание — осознанное действие, а не
    // следствие того, что программа открыта с утра.
    const hasher = fakePasswordHasher();
    const user = await account(hasher, 'ответственный', 'мой-пароль-2026');

    const result = await signSimple(hasher, {
      user, password: 'не тот', kind: 'запись журнала', content: 'что-то', at: AT,
    });
    expect(result.ok).toBe(false);
  });

  it('временным паролем не подписывают', async () => {
    // Такой пароль знают двое, и подпись подтверждала бы не подписавшего.
    const hasher = fakePasswordHasher();
    const user = await account(hasher, 'ответственный', 'выданный-пароль-1', { mustChangePassword: true });

    const result = await signSimple(hasher, {
      user, password: 'выданный-пароль-1', kind: 'запись журнала', content: 'что-то', at: AT,
    });
    expect(result.ok).toBe(false);
  });

  it('гость не подписывает', async () => {
    const hasher = fakePasswordHasher();
    const user = await account(hasher, 'гость', 'мой-пароль-2026');

    const result = await signSimple(hasher, {
      user, password: 'мой-пароль-2026', kind: 'запись журнала', content: 'что-то', at: AT,
    });
    expect(result.ok).toBe(false);
  });

  it('сверка подтверждает неизменное содержимое', async () => {
    const hasher = fakePasswordHasher();
    const user = await account(hasher, 'ответственный', 'мой-пароль-2026');
    const content = 'Журнал эксплуатации СППЗ за август 2026';

    const signature = value(await signSimple(hasher, {
      user, password: 'мой-пароль-2026', kind: 'журнал на печать', content, at: AT,
    }));

    expect(value(await checkSignature(hasher, signature, content))).toEqual({ verdict: 'подпись верна' });
  });

  it('сверка ловит подмену содержимого', async () => {
    // Ради этого отпечаток и хранится: подпись под журналом относится к тому,
    // что напечатано, а не к «журналу вообще».
    const hasher = fakePasswordHasher();
    const user = await account(hasher, 'ответственный', 'мой-пароль-2026');

    const signature = value(await signSimple(hasher, {
      user, password: 'мой-пароль-2026', kind: 'журнал на печать',
      content: 'Журнал за август 2026', at: AT,
    }));

    const checked = value(await checkSignature(hasher, signature, 'Журнал за август 2026, правленый'));
    expect(checked.verdict).toBe('содержимое изменено');
  });

  it('отсутствие подписи так и называется', async () => {
    const hasher = fakePasswordHasher();
    expect(value(await checkSignature(hasher, null, 'что угодно'))).toEqual({ verdict: 'не подписано' });
  });

  it('в документе подпись читается человеком', async () => {
    const hasher = fakePasswordHasher();
    const user = await account(hasher, 'ответственный', 'мой-пароль-2026');

    const signature = value(await signSimple(hasher, {
      user, password: 'мой-пароль-2026', kind: 'журнал на печать', content: 'журнал', at: AT,
      basis: 'Положение о ПЭП, приказ № 14 от 12.01.2026',
    }));

    expect(formatSignature(signature)).toBe(
      'Подписано простой электронной подписью: Инженер по ПБ Иванов И. И., 2026-08-31 09:15,'
      + ' основание: Положение о ПЭП, приказ № 14 от 12.01.2026',
    );
  });
});

const NODES: readonly TreeNode[] = [
  { id: 'орг', parentId: null, kind: 'organization', name: 'АО' },
  { id: 'зд1', parentId: 'орг', kind: 'building', name: 'МВАСО' },
  { id: 'зд2', parentId: 'орг', kind: 'building', name: 'Чужое' },
].map((node) => ({ ...node, siteId: 'орг', code: null, elevationM: null, note: null, building: null }) as TreeNode);

describe('журнал изменений', () => {
  const author = (role: UserRole, scope: readonly string[]): UserAccount => ({
    id: 'u1', login: 'ivanov', fullName: 'Иванов И. И.', position: null, organization: null, email: null,
    role, scope: [...scope], password: null, keyGeneration: 1, mustChangePassword: false,
    archivedAt: null, createdAt: AT, updatedAt: AT, rowVersion: 1,
  });

  function makeDeps() {
    const log = fakeChangeLogRepository();
    return { deps: { log, clock: fakeClock(), ids: fakeIdGenerator() }, log };
  }

  it('записывает автора, действие и изменившиеся поля', async () => {
    const { deps, log } = makeDeps();
    value(await recordChange(deps, {
      author: author('ответственный', ['зд1']),
      command: 'Изменить карточку объекта',
      action: 'изменено', subject: 'оборудование', subjectId: 'o1',
      subjectTitle: 'Огнетушитель ОП-4 № 28-11', nodeId: 'зд1',
      fields: [{ title: 'заряд ОТВ', before: null, after: '4' }],
    }));

    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]?.authorName).toBe('Иванов И. И.');
    expect(log.entries[0]?.fields[0]?.title).toBe('заряд ОТВ');
  });

  it('пустая правка в журнал не попадает', async () => {
    // Иначе журнал заполнялся бы строчками «изменено» от каждого открытия
    // карточки, и найти в нём настоящее изменение стало бы нельзя.
    const { deps, log } = makeDeps();
    const written = value(await recordChange(deps, {
      author: author('ответственный', ['зд1']),
      command: 'Изменить карточку объекта', action: 'изменено', subject: 'оборудование',
      subjectId: 'o1', subjectTitle: 'ОП-4', nodeId: 'зд1', fields: [],
    }));

    expect(written).toBeNull();
    expect(log.entries).toHaveLength(0);
  });

  it('заведение записывается и без изменившихся полей', async () => {
    const { deps, log } = makeDeps();
    value(await recordChange(deps, {
      author: author('ответственный', ['зд1']),
      command: 'Завести объект', action: 'заведено', subject: 'оборудование',
      subjectId: 'o1', subjectTitle: 'ОП-4', nodeId: 'зд1', fields: [],
    }));
    expect(log.entries).toHaveLength(1);
  });

  it('ответственный видит только свои узлы', async () => {
    const { deps } = makeDeps();
    const admin = author('администратор', []);
    for (const nodeId of ['зд1', 'зд2']) {
      value(await recordChange(deps, {
        author: admin, command: 'Завести объект', action: 'заведено', subject: 'оборудование',
        subjectId: `o-${nodeId}`, subjectTitle: 'ОП-4', nodeId, fields: [],
      }));
    }

    const seen = value(await readChangeLog(deps, {
      reader: author('ответственный', ['зд1']), nodes: NODES,
    }));
    expect(seen.map((entry) => entry.nodeId)).toEqual(['зд1']);
  });

  it('изменения вне дерева видит только администратор', async () => {
    // Настройки, регламенты и люди ответственному ничего не говорят о его
    // объектах и только засоряли бы журнал.
    const { deps } = makeDeps();
    value(await recordChange(deps, {
      author: author('администратор', []), command: 'Изменить настройки', action: 'изменено',
      subject: 'настройки', subjectId: 'settings', subjectTitle: 'Настройки программы',
      nodeId: null, fields: [{ title: 'порог «скоро»', before: '30', after: '14' }],
    }));

    expect(value(await readChangeLog(deps, { reader: author('ответственный', ['зд1']), nodes: NODES }))).toHaveLength(0);
    expect(value(await readChangeLog(deps, { reader: author('администратор', []), nodes: NODES }))).toHaveLength(1);
  });

  it('гостю журнал изменений не показывается', async () => {
    const { deps } = makeDeps();
    const result = await readChangeLog(deps, { reader: author('гость', ['зд1']), nodes: NODES });
    expect(result.ok).toBe(false);
  });

  it('сравнение полей отбрасывает то, что не менялось', () => {
    expect(changedField('категория', 'В2', 'В2')).toBeNull();
    expect(changedField('категория', null, '')).toBeNull();
    expect(changedField('категория', 'В2', 'В1')).toEqual({ title: 'категория', before: 'В2', after: 'В1' });
    expect(changedField('классы', ['A'], ['A', 'B'])).toEqual({ title: 'классы', before: 'A', after: 'A, B' });
  });
});

describe('содержимое, которое подписывается', () => {
  /*
   * Текст содержимого собирается одним способом при подписании и при сверке.
   * Иначе подпись, верная в день постановки, назавтра объявила бы подделку из-за
   * перестановки полей — и человек не смог бы доказать, что проверку проводил.
   */
  const event = {
    id: 'e1', siteId: 's', objectId: 'o1', activityCode: 'osmotr',
    performedOn: '2026-09-01', result: 'выполнено' as const,
    checklist: [{ item: 'Пломба на месте', result: 'выполнено' as const, defect: null }],
    defect: null, executor: null,
    executorDetails: { fullName: 'Иванов И. И.', position: 'Инженер', organization: 'АО «Пример»' },
    externalEvidence: null, measurements: [], groupId: null,
    regulationVersionId: 'v1', periodicityId: 'p1', note: null,
    createdAt: '2026-09-01T10:00:00.000Z',
  };

  it('служебные поля в содержимое не входят', () => {
    // Идентификатор записи, время её создания и ссылка на версию регламента
    // смысла проверки не меняют: от их появления подпись рвалась бы зря.
    const content = signedJournalContent(event as never);
    expect(content).not.toContain('e1');
    expect(content).not.toContain('v1');
    expect(content).not.toContain('2026-09-01T10:00');
  });

  it('значимые поля входят все', () => {
    const content = signedJournalContent(event as never);
    expect(content).toContain('объект: o1');
    expect(content).toContain('работа: osmotr');
    expect(content).toContain('выполнено: 2026-09-01');
    expect(content).toContain('Пломба на месте = выполнено');
    expect(content).toContain('Иванов И. И.');
  });

  it('правка результата меняет содержимое', () => {
    const before = signedJournalContent(event as never);
    const after = signedJournalContent({ ...event, result: 'выполнено с замечанием' } as never);
    expect(after).not.toBe(before);
  });
});

describe('журнал действий пользователей', () => {
  /*
   * Заказчик: «записывать события за последние 30 дней». Правило хранения живёт
   * в ядре, а не в хранилище: у настольной программы нет ни служб, ни заданий
   * по времени, и «почистить при запуске» не сработает у того, кто не закрывает
   * программу неделями. Поэтому старение идёт при каждой записи.
   */
  it('граница хранения — тридцать дней назад', () => {
    expect(auditCutoff('2026-09-30T12:00:00.000Z')).toBe('2026-08-31T12:00:00.000Z');
    expect(AUDIT_KEEP_DAYS).toBe(30);
  });

  it('удалять можно того, кто ничего не подписывал', () => {
    expect(userDeletionCheck('u1', []).canDelete).toBe(true);
  });

  it('подписавшего удалять нельзя, и число записей названо', () => {
    // Подпись определяет подписавшего (63-ФЗ, статья 9): запись «подписал тот,
    // кого в программе нет» на этот вопрос не отвечает.
    const events = [
      { signature: { signerId: 'u1' } },
      { signature: { signerId: 'u1' } },
      { signature: { signerId: 'u2' } },
      { signature: null },
    ];
    const check = userDeletionCheck('u1', events);
    expect(check.canDelete).toBe(false);
    expect(check.signedCount).toBe(2);
  });
});
