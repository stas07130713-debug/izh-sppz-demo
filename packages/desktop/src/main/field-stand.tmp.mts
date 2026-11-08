/* eslint-disable */
/** Стенд переноса: копия рабочей базы + учётка с известным паролем. */
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { UserAccount } from '@izh/contracts';
import { createPasswordHasher } from './password-hasher.js';
import { openStorage } from './db/storage.js';
import { startFieldServer } from './field-server.js';

const LIVE = 'C:/Users/Svyt0/AppData/Roaming/ИЖ СППЗ/data/sppz.db';
const NOW = new Date().toISOString();

async function main(){
const dir = mkdtempSync(join(tmpdir(), 'изж-стенд-'));
const copy = join(dir, 'sppz.db');
copyFileSync(LIVE, copy);

const hasher = createPasswordHasher();
const storage = await openStorage({ databasePath: copy });

const digest = await hasher.hash('обход-2026');
if (!digest.ok) throw new Error('пароль не завёлся');

const обходчик = {
  id: 'обходчик-1', login: 'obhod', fullName: 'Петров П. П.', position: 'Слесарь',
  organization: null, email: null, role: 'ответственный', scope: [],
  password: digest.value, keyGeneration: 1, mustChangePassword: false,
  archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
} as unknown as UserAccount;

const tree = await storage.tree.list();
if (tree.ok) {
  // Выдаём обходчику одно здание: так видно, что уезжает не весь журнал.
  const building = tree.value.find((node) => node.kind === 'building');
  if (building !== undefined) Object.assign(обходчик, { scope: [building.id] });
  console.log('выдано:', building?.name ?? '(нет здания)');
}
await storage.users.save(обходчик);

const server = await startFieldServer({ storage, hasher, port: 8123, appDir: 'D:/Projects/izh-sppz/packages/mobile/dist' });
console.log('АДРЕС:', server.address);
console.log('КОД:', server.code);
console.log('ВХОД: obhod / обход-2026');
}
await main();
