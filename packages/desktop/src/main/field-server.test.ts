/**
 * Перенос по веб-приложению: вход учётной записью и выдача снимка.
 *
 * Проверяется то, что защищает данные: без кода сопряжения не входят, с чужим
 * паролем не входят, без пропуска журнал не отдают, а с пропуском уезжает
 * ровно область прав вошедшего.
 *
 * Сервер поднимается настоящий, на свободном порту, и опрашивается по сети —
 * иначе проверка не сказала бы ничего о том, что происходит на самом деле.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PasswordHasher, UserAccount } from '@izh/contracts';
import { ok } from '@izh/contracts';
import { createPasswordHasher } from './password-hasher';
import { startFieldServer, type RunningFieldServer } from './field-server';
import type { Storage } from './db/storage';

const NOW = '2026-09-10T06:00:00.000Z';

const hasher: PasswordHasher = createPasswordHasher();

function node(id: string, parentId: string | null): unknown {
  return { id, parentId, name: id, kind: 'level', archivedAt: null, siteId: 'п' };
}

let server: RunningFieldServer;
let admin: UserAccount;
let master: UserAccount;

beforeAll(async () => {
  const digest = await hasher.hash('верный-пароль');
  if (!digest.ok) throw new Error('не удалось завести пароль');

  admin = {
    id: 'a1', login: 'admin', fullName: 'Админ', position: null, role: 'администратор',
    scope: [], password: digest.value, keyGeneration: 1, mustChangePassword: false,
    archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  } as unknown as UserAccount;

  master = { ...admin, id: 'м1', login: 'master', role: 'ответственный', scope: ['цех-а'] } as UserAccount;

  const storage = {
    users: {
      findByLogin: async (login: string) => ok(login === 'admin' ? admin : login === 'master' ? master : null),
      getById: async (id: string) => ok(id === 'a1' ? admin : master),
    },
    tree: { list: async () => ok([node('цех-а', null), node('этаж-а', 'цех-а'), node('цех-б', null)]) },
    objects: { list: async () => ok([{ id: 'о1', nodeId: 'этаж-а', archivedAt: null }, { id: 'о2', nodeId: 'цех-б', archivedAt: null }]) },
    rooms: { list: async () => ok([]) },
    maintenance: { list: async () => ok([]) },
  } as unknown as Storage;

  server = await startFieldServer({ storage, hasher, port: 0 });
});

afterAll(async () => { await server.stop(); });

async function login(body: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  const answer = await fetch(`${server.address}/api/вход`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: answer.status, body: await answer.json() as Record<string, unknown> };
}

describe('перенос журнала на телефон', () => {
  it('без кода сопряжения не пускает даже с верным паролем', async () => {
    const answer = await login({ login: 'admin', password: 'верный-пароль', code: '000000' });
    expect(answer.status).toBe(403);
    expect(String(answer.body['ошибка'])).toContain('Код сопряжения');
  });

  it('с чужим паролем не пускает', async () => {
    const answer = await login({ login: 'admin', password: 'не тот', code: server.code });
    expect(answer.status).toBe(403);
  });

  it('журнал без пропуска не отдаётся', async () => {
    const answer = await fetch(`${server.address}/api/журнал`);
    expect(answer.status).toBe(401);
  });

  it('вошедшему уезжает его область прав, а не весь журнал', async () => {
    const entered = await login({ login: 'master', password: 'верный-пароль', code: server.code });
    expect(entered.status).toBe(200);

    const answer = await fetch(`${server.address}/api/журнал`, {
      headers: { Authorization: `Bearer ${String(entered.body['пропуск'])}` },
    });
    const snapshot = await answer.json() as { nodes: { id: string }[]; objects: { id: string }[] };

    expect(snapshot.nodes.map((item) => item.id)).toEqual(['цех-а', 'этаж-а']);
    expect(snapshot.objects.map((item) => item.id)).toEqual(['о1']);
  });

  it('администратору уезжает всё', async () => {
    const entered = await login({ login: 'admin', password: 'верный-пароль', code: server.code });
    const answer = await fetch(`${server.address}/api/журнал`, {
      headers: { Authorization: `Bearer ${String(entered.body['пропуск'])}` },
    });
    const snapshot = await answer.json() as { objects: { id: string }[] };

    expect(snapshot.objects.map((item) => item.id)).toEqual(['о1', 'о2']);
  });

  // Пропуск подделан латиницей намеренно: заголовки HTTP русских букв не
  // несут, и настоящие пропуска — тоже латиница (base64url).
  it('поддельный пропуск не проходит', async () => {
    const answer = await fetch(`${server.address}/api/журнал`, {
      headers: { Authorization: 'Bearer podelnyj-propusk-0000' },
    });
    expect(answer.status).toBe(401);
  });
});
