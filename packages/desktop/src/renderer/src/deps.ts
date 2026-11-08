/**
 * Сборка зависимостей для сценариев ядра.
 *
 * Хранилище файлов и хранилище сведений о подложках здесь — это переходники к
 * основному процессу через мост. Когда программа станет серверной, тут появятся
 * переходники к серверу по сети, а сценарии ядра не изменятся.
 */

import type {
  AuditDeps, ChangeLogDeps,
  AccessDeps, BackdropDeps, HierarchyArchiveDeps, MaintenanceDeps, ObjectDeps, RoomDeps, RegulationDeps, SettingsDeps, TreeDeps } from '@izh/core';
import type {
  AppSettingsRepository,
  AuditRepository,
  ChangeLogRepository,
  BackdropRepository,
  Clock,
  FileStore,
  IdGenerator,
  MaintenanceEventRepository,
  ObjectTreeRepository,
  PasswordHasher,
  SigningKeyService,
  PlanObjectRepository,
  RegulationRepository,
  RoomRepository,
  UserRepository,
} from '@izh/contracts';
import { planSourceEngine, setPdfWorkerPort } from '@izh/engine-plan-source';
// Рабочий поток pdf.js создаёт сборщик — движок не должен знать, каким именно
// инструментом собирается программа. См. pdfjs-setup.ts в движке.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

const fileStore: FileStore = {
  put: (bytes, extension) => window.izh.store.put(bytes, extension),
  get: (hash) => window.izh.store.get(hash),
  exists: (hash) => window.izh.store.exists(hash),
};

const backdrops: BackdropRepository = {
  save: (backdrop) => window.izh.backdrops.save(backdrop),
  list: () => window.izh.backdrops.list(),
  getById: (id) => window.izh.backdrops.getById(id),
  remove: (id) => window.izh.backdrops.remove(id),
  saveCalibration: (calibration) => window.izh.backdrops.saveCalibration(calibration),
  getCalibration: (id) => window.izh.backdrops.getCalibration(id),
  saveCleanup: (cleanup) => window.izh.backdrops.saveCleanup(cleanup),
  getCleanup: (id) => window.izh.backdrops.getCleanup(id),
  removeCleanup: (id) => window.izh.backdrops.removeCleanup(id),
};

const users: UserRepository = {
  list: () => window.izh.users.list(),
  getById: (id) => window.izh.users.getById(id),
  findByLogin: (login) => window.izh.users.findByLogin(login),
  save: (user) => window.izh.users.save(user),
  remove: (id) => window.izh.users.remove(id),
};

const hasher: PasswordHasher = {
  hash: (password) => window.izh.password.hash(password),
  verify: (password, digest) => window.izh.password.verify(password, digest),
  sha256Hex: (text) => window.izh.password.sha256Hex(text),
};

/**
 * Ключи простой электронной подписи.
 *
 * Всё считается в главном процессе: закрытый ключ не приходит сюда
 * расшифрованным, окно получает готовую подпись. Пароль уходит туда на время
 * одного вызова и нигде не остаётся.
 */
const signingKeys: SigningKeyService = {
  create: (password, generation) => window.izh.signingKeys.create(password, generation),
  rekey: (key, oldPassword, newPassword, generation) =>
    window.izh.signingKeys.rekey(key, oldPassword, newPassword, generation),
  sign: (key, password, contentHash) => window.izh.signingKeys.sign(key, password, contentHash),
  verify: (signature, contentHash) => window.izh.signingKeys.verify(signature, contentHash),
};

const tree: ObjectTreeRepository = {
  list: () => window.izh.tree.list(),
  getById: (id) => window.izh.tree.getById(id),
  save: (node) => window.izh.tree.save(node),
};

const rooms: RoomRepository = {
  listByLevel: (levelId) => window.izh.rooms.listByLevel(levelId),
  list: () => window.izh.rooms.list(),
  getById: (id) => window.izh.rooms.getById(id),
  save: (room) => window.izh.rooms.save(room),
};

const planObjects: PlanObjectRepository = {
  list: () => window.izh.objects.list(),
  listByNode: (nodeId) => window.izh.objects.listByNode(nodeId),
  getById: (id) => window.izh.objects.getById(id),
  save: (object) => window.izh.objects.save(object),
  saveMany: (objects) => window.izh.objects.saveMany(objects),
};

const maintenanceEvents: MaintenanceEventRepository = {
  list: () => window.izh.maintenance.list(),
  listByObject: (objectId) => window.izh.maintenance.listByObject(objectId),
  save: (event) => window.izh.maintenance.save(event),
  saveMany: (events) => window.izh.maintenance.saveMany(events),
};

const appSettings: AppSettingsRepository = {
  get: () => window.izh.settings.get(),
  save: (settings) => window.izh.settings.save(settings),
};

const clock: Clock = {
  nowUtc: () => new Date().toISOString(),
};

const ids: IdGenerator = {
  newId: () => crypto.randomUUID(),
};

let workerReady = false;

/** Вызывается один раз при запуске окна. */
export function initEngines(): void {
  if (workerReady) return;
  setPdfWorkerPort(new PdfWorker());
  workerReady = true;
}

export const deps: BackdropDeps = {
  engine: planSourceEngine,
  fileStore,
  backdrops,
  clock,
  ids,
};

/** Зависимости сценариев доступа: учётные записи, отпечатки, часы. */
/** Журнал действий: служебный след за тридцать дней (Дополнение 7, часть Д14). */
const audit: AuditRepository = {
  list: () => window.izh.audit.list(),
  append: (entry) => window.izh.audit.append(entry),
  prune: (olderThan) => window.izh.audit.prune(olderThan),
};

export const auditDeps: AuditDeps = { audit, clock, ids };

/**
 * Журнал вносимых изменений: кто, когда и какое поле изменил.
 *
 * В отличие от журнала действий он не стареет: это доказательство правки, а не
 * служебный след. Заполняется из истории команд — см. use-command-history.ts.
 */
const changeLog: ChangeLogRepository = {
  list: (filter) => window.izh.changeLog.list(filter),
  append: (entry) => window.izh.changeLog.append(entry),
  appendMany: (entries) => window.izh.changeLog.appendMany(entries),
};

export const changeLogDeps: ChangeLogDeps = { log: changeLog, clock, ids };

export const accessDeps: AccessDeps = {
  users,
  hasher,
  keys: signingKeys,
  clock,
  ids,
};

/** Зависимости сценариев дерева объекта. Движок им не нужен: дерево ничего не вычисляет. */
export const treeDeps: TreeDeps = {
  tree,
  clock,
  ids,
};

/** Зависимости сценариев работы с объектами СППЗ. */
export const objectDeps: ObjectDeps = {
  objects: planObjects,
  tree,
  clock,
  ids,
};

/** Зависимости сценариев работы с помещениями этажа. */
export const roomDeps: RoomDeps = {
  rooms,
  tree,
  clock,
  ids,
};

/** Единый сценарий каскадного вывода уровней и помещений из эксплуатации. */
export const hierarchyArchiveDeps: HierarchyArchiveDeps = {
  tree,
  rooms,
  objects: planObjects,
  clock,
};

/** Зависимости сценария проведения мероприятия. */
export const maintenanceDeps: MaintenanceDeps = {
  events: maintenanceEvents,
  objects: planObjects,
  clock,
  ids,
};

/** Зависимости сценария изменения настроек. */
export const settingsDeps: SettingsDeps = {
  settings: appSettings,
};

/** Хранилище регламентов ТО: переходник к мосту (Дополнение 5). */
const regulationStore: RegulationRepository = {
  listRegulations: () => window.izh.regulations.list(),
  listVersions: () => window.izh.regulations.listVersions(),
  listDocuments: () => window.izh.regulations.listDocuments(),
  listTemplates: () => window.izh.regulations.listTemplates(),
  saveRegulation: (value) => window.izh.regulations.save(value),
  saveVersions: (values) => window.izh.regulations.saveVersions(values),
  saveDocument: (value) => window.izh.regulations.saveDocument(value),
  saveTemplate: (value) => window.izh.regulations.saveTemplate(value),
};

/** Зависимости сценариев регламентов ТО. */
export const regulationDeps: RegulationDeps = {
  regulations: regulationStore,
  clock,
  ids,
};
