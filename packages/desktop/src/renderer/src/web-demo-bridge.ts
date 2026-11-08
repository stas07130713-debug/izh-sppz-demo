import type {
  BackdropCleanup, ChangeLogFilter, HistoryCommit, HistoryState, PasswordDigest,
  PlanCalibration, Result,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { IzhBridge } from './bridge';
import { downloadBytes, pickBrowserFile, sha256Hex } from './web-demo-files';
import { mutableSnapshot, type MutableWebDemoState, type WebDemoSnapshot } from './web-demo-state';

const STORAGE_KEY = 'izh-sppz-web-demo-state-v1';
const EMPTY_HISTORY: HistoryState = { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 };
const uploadedFiles = new Map<string, Uint8Array>();
let loaded: Promise<MutableWebDemoState> | null = null;

function persist(current: MutableWebDemoState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* Остаётся рабочая копия в памяти. */ }
}

async function state(): Promise<MutableWebDemoState> {
  loaded ??= (async () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return JSON.parse(saved) as MutableWebDemoState;
    const response = await fetch(new URL('demo/snapshot.json', document.baseURI));
    if (!response.ok) throw new Error(`Снимок данных не найден: ${response.status}`);
    return mutableSnapshot(await response.json() as WebDemoSnapshot);
  })();
  return loaded;
}

function findById<T extends { readonly id: string }>(values: readonly T[], id: string, title: string): Result<T> {
  const found = values.find((item) => item.id === id);
  return found === undefined ? err('NOT_FOUND', `${title} не найден.`) : ok(found);
}

function upsert<T extends { readonly id: string }>(values: T[], value: T): void {
  const index = values.findIndex((item) => item.id === value.id);
  if (index < 0) values.push(value); else values[index] = value;
}

async function saveOne<K extends keyof MutableWebDemoState>(
  key: K,
  value: MutableWebDemoState[K] extends Array<infer T> ? T : never,
): Promise<Result<void>> {
  const current = await state();
  const list = current[key] as unknown as Array<{ readonly id: string }>;
  upsert(list, value as { readonly id: string });
  persist(current);
  return ok(undefined);
}

async function storedBytes(hash: string): Promise<Result<Uint8Array>> {
  const uploaded = uploadedFiles.get(hash);
  if (uploaded !== undefined) return ok(uploaded);
  const current = await state();
  const path = current.files[hash];
  if (path === undefined) return err('FILE_NOT_FOUND', 'Файл не найден в демонстрационной копии.');
  try {
    const response = await fetch(new URL(`demo/${path}`, document.baseURI));
    if (!response.ok) return err('FILE_READ_FAILED', 'Не удалось загрузить файл демонстрации.');
    return ok(new Uint8Array(await response.arrayBuffer()));
  } catch (cause) {
    return err('FILE_READ_FAILED', 'Не удалось загрузить файл демонстрации.', String(cause));
  }
}

function emptyCommit(label = ''): Result<HistoryCommit> {
  return ok({ state: EMPTY_HISTORY, label, changes: [] });
}

function demoDigest(hash: string): PasswordDigest {
  return {
    algorithm: 'scrypt', costN: 1, blockSizeR: 1, parallelP: 1, keyLength: 32,
    salt: 'web-demo', digest: `web-demo:${hash}`,
  };
}

export function installWebDemoBridge(): void {
  const bridge: IzhBridge = {
    openPlanFile: () => pickBrowserFile('.pdf,.svg,.dxf,.json,.png,.jpg,.jpeg,.webp,.tif,.tiff'),
    openJournalFile: () => pickBrowserFile('.xlsx,.xlsm'),
    openMaintenanceDocument: () => pickBrowserFile('.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png'),
    openExternal: async (url) => { window.open(url, '_blank', 'noopener,noreferrer'); return ok(undefined); },
    exportJournal: async () => err('UNSUPPORTED_FORMAT', 'В браузерной демонстрации выгрузка журнала отключена.'),
    openStoredDocument: async (hash) => {
      const bytes = await storedBytes(hash); if (!bytes.ok) return bytes;
      window.open(URL.createObjectURL(new Blob([bytes.value as BlobPart])), '_blank', 'noopener,noreferrer');
      return ok(undefined);
    },
    saveStoredDocument: async (hash, fileName) => {
      const bytes = await storedBytes(hash); if (!bytes.ok) return bytes;
      downloadBytes(bytes.value, fileName); return ok({ savedPath: fileName });
    },
    dataDir: async () => ok('Браузерная демонстрация'),
    history: {
      state: async () => ok(EMPTY_HISTORY), begin: async () => ok({ id: crypto.randomUUID() }),
      commit: async () => emptyCommit(), cancel: async () => emptyCommit(),
      undo: async () => emptyCommit('Отменить'), redo: async () => emptyCommit('Вернуть'),
    },
    store: {
      put: async (bytes) => { const hash = await sha256Hex(bytes); uploadedFiles.set(hash, bytes); return ok(hash); },
      get: storedBytes,
      exists: async (hash) => { const current = await state(); return ok(uploadedFiles.has(hash) || current.files[hash] !== undefined); },
    },
    objects: {
      list: async () => ok((await state()).objects),
      listByNode: async (nodeId) => ok((await state()).objects.filter((item) => item.nodeId === nodeId)),
      getById: async (id) => findById((await state()).objects, id, 'Объект'),
      save: (value) => saveOne('objects', value),
      saveMany: async (values) => { const current = await state(); values.forEach((value) => upsert(current.objects, value)); persist(current); return ok(undefined); },
    },
    settings: {
      get: async () => ok((await state()).settings),
      save: async (value) => { const current = await state(); current.settings = value; persist(current); return ok(undefined); },
    },
    maintenance: {
      list: async () => ok((await state()).maintenance),
      listByObject: async (id) => ok((await state()).maintenance.filter((item) => item.objectId === id)),
      save: (value) => saveOne('maintenance', value),
      saveMany: async (values) => { const current = await state(); values.forEach((value) => upsert(current.maintenance, value)); persist(current); return ok(undefined); },
    },
    regulations: {
      list: async () => ok((await state()).regulations),
      listVersions: async () => ok((await state()).regulationVersions),
      listDocuments: async () => ok((await state()).regulationDocuments),
      listTemplates: async () => ok((await state()).regulationTemplates),
      save: (value) => saveOne('regulations', value),
      saveVersions: async (values) => { const current = await state(); values.forEach((value) => upsert(current.regulationVersions, value)); persist(current); return ok(undefined); },
      saveDocument: (value) => saveOne('regulationDocuments', value),
      saveTemplate: (value) => saveOne('regulationTemplates', value),
    },
    changeLog: {
      list: async (filter?: ChangeLogFilter) => {
        let values = (await state()).changeLog;
        if (filter?.subject !== undefined) values = values.filter((item) => item.subject === filter.subject);
        if (filter?.authorId !== undefined) values = values.filter((item) => item.authorId === filter.authorId);
        if (filter?.from !== undefined) values = values.filter((item) => item.at >= filter.from!);
        if (filter?.to !== undefined) values = values.filter((item) => item.at <= filter.to!);
        if (filter?.nodeIds !== undefined) values = values.filter((item) => item.nodeId !== null && filter.nodeIds!.includes(item.nodeId));
        return ok(values);
      },
      append: (value) => saveOne('changeLog', value),
      appendMany: async (values) => { const current = await state(); values.forEach((value) => upsert(current.changeLog, value)); persist(current); return ok(undefined); },
    },
    audit: {
      list: async () => ok((await state()).audit), append: (value) => saveOne('audit', value),
      prune: async (olderThan) => { const current = await state(); const before = current.audit.length; current.audit = current.audit.filter((item) => item.at >= olderThan); persist(current); return ok(before - current.audit.length); },
    },
    users: {
      list: async () => ok((await state()).users),
      resetAll: async () => err('FORBIDDEN', 'В демонстрационной копии учётные записи не удаляются.'),
      getById: async (id) => findById((await state()).users, id, 'Пользователь'),
      findByLogin: async (login) => ok((await state()).users.find((item) => item.login.toLocaleLowerCase() === login.toLocaleLowerCase()) ?? null),
      save: (value) => saveOne('users', value),
      remove: async (id) => { const current = await state(); current.users = current.users.filter((item) => item.id !== id); persist(current); return ok(undefined); },
    },
    session: {
      restore: async () => { const current = await state(); return ok(current.users.find((item) => item.id === current.defaultUserId) ?? current.users[0] ?? null); },
      remember: async () => ok(undefined), forget: async () => ok(undefined),
    },
    window: { setTheme: async () => ok(undefined), focusContent: async () => { window.focus(); return ok(undefined); } },
    signingKeys: {
      create: async () => err('FORBIDDEN', 'Подписание отключено в демонстрационной копии.'),
      rekey: async () => err('FORBIDDEN', 'Смена ключа отключена в демонстрационной копии.'),
      sign: async () => err('FORBIDDEN', 'Подписание отключено в демонстрационной копии.'),
      verify: async () => ok(true),
    },
    password: {
      hash: async (password) => ok(demoDigest(await sha256Hex(password))),
      verify: async (password, digest) => ok(digest.digest === `web-demo:${await sha256Hex(password)}`),
      sha256Hex: async (text) => ok(await sha256Hex(text)),
    },
    rooms: {
      list: async () => ok((await state()).rooms),
      listByLevel: async (id) => ok((await state()).rooms.filter((item) => item.levelId === id)),
      getById: async (id) => findById((await state()).rooms, id, 'Помещение'), save: (value) => saveOne('rooms', value),
    },
    tree: {
      list: async () => ok((await state()).tree), getById: async (id) => findById((await state()).tree, id, 'Узел'), save: (value) => saveOne('tree', value),
    },
    backdrops: {
      list: async () => ok((await state()).backdrops), getById: async (id) => findById((await state()).backdrops, id, 'Подложка'),
      save: (value) => saveOne('backdrops', value),
      remove: async (id) => { const current = await state(); current.backdrops = current.backdrops.filter((item) => item.id !== id); persist(current); return ok(undefined); },
      saveCalibration: async (value: PlanCalibration) => { const current = await state(); current.calibrations[value.backdropId] = value; persist(current); return ok(undefined); },
      getCalibration: async (id) => ok((await state()).calibrations[id] ?? null),
      saveCleanup: async (value: BackdropCleanup) => { const current = await state(); current.cleanups[value.backdropId] = value; persist(current); return ok(undefined); },
      getCleanup: async (id) => ok((await state()).cleanups[id] ?? null),
      removeCleanup: async (id) => { const current = await state(); delete current.cleanups[id]; persist(current); return ok(undefined); },
    },
  };

  Object.defineProperty(window, 'izh', { configurable: true, value: bridge });
}
