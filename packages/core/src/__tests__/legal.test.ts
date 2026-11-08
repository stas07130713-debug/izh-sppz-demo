/**
 * Соглашения и их принятие (ТЗ, Дополнение 7, часть Д12).
 *
 * Проверяется не текст, а правило: с чем именно человек согласился и когда
 * требовать согласия заново. Ошибка здесь не видна — программа откроется, а на
 * вопрос «на что он давал согласие» ответить будет нечем.
 */

import { describe, expect, it } from 'vitest';
import type { Clock, IdGenerator, Result, UserAccount, UserId, UserRepository } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { LEGAL_DOCUMENTS, LEGAL_VERSION, needsLegalAcceptance } from '../legal/legal-documents.js';
import { acceptLegal } from '../access/legal-scenarios.js';

function user(extra: Partial<UserAccount> = {}): UserAccount {
  return {
    id: 'u1', login: 'ivanov', fullName: 'Иванов Иван', position: null, email: null,
    role: 'ответственный', scope: [], password: null, keyGeneration: 1,
    mustChangePassword: false, archivedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z', rowVersion: 1,
    ...extra,
  } as unknown as UserAccount;
}

function deps(initial: UserAccount) {
  const users = new Map<UserId, UserAccount>([[initial.id, initial]]);
  const repository: UserRepository = {
    async list(): Promise<Result<readonly UserAccount[]>> { return ok([...users.values()]); },
    async getById(id): Promise<Result<UserAccount>> {
      const found = users.get(id);
      return found === undefined ? err('NOT_FOUND', 'нет') : ok(found);
    },
    async findByLogin(): Promise<Result<UserAccount | null>> { return ok(null); },
    async save(next): Promise<Result<void>> { users.set(next.id, next); return ok(undefined); },
    async remove(id: string): Promise<Result<void>> { users.delete(id); return ok(undefined); },
  };
  const clock: Clock = { nowUtc: () => '2026-09-02T08:00:00.000Z' };
  const ids: IdGenerator = { newId: () => 'x' };
  return { users: repository, clock, ids, hasher: null } as never;
}

describe('состав документов', () => {
  it('согласие на обработку персональных данных даётся отдельной отметкой', () => {
    // 152-ФЗ, статья 9: согласие должно быть конкретным и осознанным. Общая
    // галочка «согласен со всем» этого не даёт.
    const ids = LEGAL_DOCUMENTS.map((document) => document.id);
    expect(ids).toContain('персональные данные');
    expect(ids).toContain('соглашение');
    expect(new Set(LEGAL_DOCUMENTS.map((document) => document.consent)).size).toBe(LEGAL_DOCUMENTS.length);
  });

  it('у каждого документа есть непустой текст', () => {
    for (const document of LEGAL_DOCUMENTS) {
      expect(document.text.length, document.id).toBeGreaterThan(500);
    }
  });
});

describe('когда требовать принятия', () => {
  it('не принимал — требуется', () => {
    expect(needsLegalAcceptance(null)).toBe(true);
    expect(needsLegalAcceptance(undefined)).toBe(true);
  });

  it('принял прежнюю редакцию — требуется снова', () => {
    // Изменённые условия — это другие условия, и молча считать их принятыми
    // нельзя: иначе через год не ответить, на что человек соглашался.
    expect(needsLegalAcceptance('2020-01-01')).toBe(true);
  });

  it('принял действующую — не требуется', () => {
    expect(needsLegalAcceptance(LEGAL_VERSION)).toBe(false);
  });
});

describe('запись принятия', () => {
  it('сохраняет редакцию и дату', async () => {
    const saved = await acceptLegal(deps(user()), {
      id: 'u1', version: LEGAL_VERSION, acceptedAt: '2026-09-02T08:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.acceptedLegalVersion).toBe(LEGAL_VERSION);
    expect(saved.value.acceptedLegalAt).toBe('2026-09-02T08:00:00.000Z');
    expect(needsLegalAcceptance(saved.value.acceptedLegalVersion)).toBe(false);
  });

  it('чужую редакцию принять нельзя', async () => {
    // Иначе принятие можно было бы записать на версию, которой человек не видел.
    const refused = await acceptLegal(deps(user()), {
      id: 'u1', version: '1999-01-01', acceptedAt: '2026-09-02T08:00:00.000Z',
    });
    expect(refused.ok).toBe(false);
  });
});
