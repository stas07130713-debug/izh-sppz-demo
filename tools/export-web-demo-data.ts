import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { PasswordDigest, Result, UserAccount } from '@izh/contracts';
import { openStorage } from '../packages/desktop/src/main/db/storage';

function valueOf<T>(result: Result<T>, name: string): T {
  if (!result.ok) throw new Error(`${name}: ${result.error.message}`);
  return result.value;
}

const dataDir = resolve(process.argv[2] ?? join(process.env['APPDATA'] ?? '', 'ИЖ СППЗ', 'data'));
const outputDir = resolve(process.argv[3] ?? join('packages', 'desktop', 'src', 'renderer', 'public', 'demo'));
const storage = await openStorage({ databasePath: join(dataDir, 'sppz.db'), legacy: null });

const [tree, rooms, objects, maintenance, rawUsers, audit, changeLog, settings,
  regulations, regulationVersions, regulationDocuments, regulationTemplates, backdrops] = await Promise.all([
  storage.tree.list(), storage.rooms.list(), storage.objects.list(), storage.maintenance.list(),
  storage.users.list(), storage.audit.list(), storage.changeLog.list(), storage.settings.get(),
  storage.regulations.listRegulations(), storage.regulations.listVersions(),
  storage.regulations.listDocuments(), storage.regulations.listTemplates(), storage.backdrops.list(),
]);

const demoPassword: PasswordDigest = {
  algorithm: 'scrypt', costN: 1, blockSizeR: 1, parallelP: 1, keyLength: 32,
  salt: 'web-demo', digest: 'web-demo:disabled',
};
const users = valueOf(rawUsers, 'пользователи').map((user): UserAccount => ({
  ...user,
  // Закрытые ключи и настоящие отпечатки паролей в опубликованный снимок не входят.
  password: demoPassword,
  signingKey: null,
  mustChangePassword: false,
}));

const calibrations: Record<string, unknown> = {};
const cleanups: Record<string, unknown> = {};
for (const backdrop of valueOf(backdrops, 'подложки')) {
  const calibration = valueOf(await storage.backdrops.getCalibration(backdrop.id), 'масштаб');
  const cleanup = valueOf(await storage.backdrops.getCleanup(backdrop.id), 'правка чертежа');
  if (calibration !== null) calibrations[backdrop.id] = calibration;
  if (cleanup !== null) cleanups[backdrop.id] = cleanup;
}

const sourceFiles = join(dataDir, 'files');
const targetFiles = join(outputDir, 'files');
await mkdir(targetFiles, { recursive: true });
const files: Record<string, string> = {};
for (const name of await readdir(sourceFiles)) {
  const hash = name.split('.')[0];
  if (hash === undefined || hash === '') continue;
  await copyFile(join(sourceFiles, name), join(targetFiles, name));
  files[hash] = `files/${name}`;
}

const activeAdmin = users.find((user) => user.archivedAt === null && user.role === 'администратор')
  ?? users.find((user) => user.archivedAt === null) ?? users[0] ?? null;
const snapshot = {
  exportedAt: new Date().toISOString(),
  defaultUserId: activeAdmin?.id ?? null,
  tree: valueOf(tree, 'дерево'), rooms: valueOf(rooms, 'помещения'),
  objects: valueOf(objects, 'объекты'), maintenance: valueOf(maintenance, 'мероприятия'),
  users, audit: valueOf(audit, 'журнал действий'), changeLog: valueOf(changeLog, 'журнал изменений'),
  settings: valueOf(settings, 'настройки'), regulations: valueOf(regulations, 'регламенты'),
  regulationVersions: valueOf(regulationVersions, 'версии регламентов'),
  regulationDocuments: valueOf(regulationDocuments, 'документы'),
  regulationTemplates: valueOf(regulationTemplates, 'шаблоны'),
  backdrops: valueOf(backdrops, 'подложки'), calibrations, cleanups, files,
};

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'snapshot.json'), JSON.stringify(snapshot), 'utf8');
await writeFile(join(outputDir, 'README.txt'), [
  `Снимок ИЖ СППЗ от ${snapshot.exportedAt}.`,
  `База: ${basename(join(dataDir, 'sppz.db'))}.`,
  'Пароли и закрытые ключи пользователей намеренно исключены.',
].join('\n'), 'utf8');
storage.db.close();

process.stdout.write(JSON.stringify({ outputDir, files: Object.keys(files).length, bytes: JSON.stringify(snapshot).length }));
