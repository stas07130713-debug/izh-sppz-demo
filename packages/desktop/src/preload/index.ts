/**
 * Мост, доступный окну программы.
 *
 * Окно не имеет доступа ни к файловой системе, ни к Node. Ему выдаётся только
 * этот перечень действий — так посторонний файл плана не сможет добраться до
 * компьютера пользователя.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../main/channels.js';

let currentHistoryActionId: string | null = null;

/** Итог «ничего не делали»: текущее состояние стека и пустой перечень. */
async function emptyCommit(): Promise<unknown> {
  const state = await ipcRenderer.invoke(CHANNELS.historyState);
  if (!state.ok) return state;
  return { ok: true, value: { state: state.value, label: '', changes: [] } };
}

const bridge = {
  openPlanFile: () => ipcRenderer.invoke(CHANNELS.openPlanFile),
  openJournalFile: () => ipcRenderer.invoke(CHANNELS.openJournalFile),
  openExternal: (url: string) => ipcRenderer.invoke(CHANNELS.openExternal, url),
  openMaintenanceDocument: () => ipcRenderer.invoke(CHANNELS.openMaintenanceDocument),
  exportJournal: (request: unknown) => ipcRenderer.invoke(CHANNELS.exportJournal, request),
  openStoredDocument: (hash: string) => ipcRenderer.invoke(CHANNELS.openStoredDocument, hash),
  saveStoredDocument: (hash: string, fileName: string) => ipcRenderer.invoke(CHANNELS.saveStoredDocument, hash, fileName),
  dataDir: () => ipcRenderer.invoke(CHANNELS.dataDir),
  history: {
    state: () => ipcRenderer.invoke(CHANNELS.historyState),
    begin: async (label: string) => {
      const result = await ipcRenderer.invoke(CHANNELS.historyBegin, label);
      if (result.ok) currentHistoryActionId = result.value.id;
      return result;
    },
    /*
     * Завершение команды отдаёт и состояние стека, и перечень изменений — по
     * ним заполняется журнал изменений. Когда команды не было (кнопку нажали
     * дважды), отдаётся пустой итог с текущим состоянием: вызывающему не
     * приходится различать два разных ответа.
     */
    commit: async () => {
      if (currentHistoryActionId === null) return emptyCommit();
      const id = currentHistoryActionId;
      currentHistoryActionId = null;
      return ipcRenderer.invoke(CHANNELS.historyCommit, id);
    },
    cancel: async () => {
      if (currentHistoryActionId === null) return emptyCommit();
      const id = currentHistoryActionId;
      currentHistoryActionId = null;
      return ipcRenderer.invoke(CHANNELS.historyCancel, id);
    },
    undo: () => ipcRenderer.invoke(CHANNELS.historyUndo),
    redo: () => ipcRenderer.invoke(CHANNELS.historyRedo),
  },

  store: {
    put: (bytes: Uint8Array, extension: string) => ipcRenderer.invoke(CHANNELS.storePut, bytes, extension),
    get: (hash: string) => ipcRenderer.invoke(CHANNELS.storeGet, hash),
    exists: (hash: string) => ipcRenderer.invoke(CHANNELS.storeExists, hash),
  },

  objects: {
    list: () => ipcRenderer.invoke(CHANNELS.objectList),
    listByNode: (nodeId: string) => ipcRenderer.invoke(CHANNELS.objectListByNode, nodeId),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.objectGetById, id),
    save: (object: unknown) => ipcRenderer.invoke(CHANNELS.objectSave, object, currentHistoryActionId),
    saveMany: (objects: unknown) => ipcRenderer.invoke(CHANNELS.objectSaveMany, objects, currentHistoryActionId),
  },

  settings: {
    get: () => ipcRenderer.invoke(CHANNELS.settingsGet),
    save: (settings: unknown) => ipcRenderer.invoke(CHANNELS.settingsSave, settings, currentHistoryActionId),
  },

  maintenance: {
    list: () => ipcRenderer.invoke(CHANNELS.maintenanceList),
    listByObject: (objectId: string) => ipcRenderer.invoke(CHANNELS.maintenanceListByObject, objectId),
    save: (event: unknown) => ipcRenderer.invoke(CHANNELS.maintenanceSave, event, currentHistoryActionId),
    saveMany: (events: unknown) => ipcRenderer.invoke(CHANNELS.maintenanceSaveMany, events, currentHistoryActionId),
  },

  regulations: {
    list: () => ipcRenderer.invoke(CHANNELS.regulationList),
    listVersions: () => ipcRenderer.invoke(CHANNELS.regulationListVersions),
    listDocuments: () => ipcRenderer.invoke(CHANNELS.regulationListDocuments),
    listTemplates: () => ipcRenderer.invoke(CHANNELS.regulationListTemplates),
    save: (value: unknown) => ipcRenderer.invoke(CHANNELS.regulationSave, value),
    saveVersions: (values: unknown) => ipcRenderer.invoke(CHANNELS.regulationSaveVersions, values),
    saveDocument: (value: unknown) => ipcRenderer.invoke(CHANNELS.regulationSaveDocument, value),
    saveTemplate: (value: unknown) => ipcRenderer.invoke(CHANNELS.regulationSaveTemplate, value),
  },

  /** Журнал действий пользователей: только чтение, запись и старение. */
  changeLog: {
    list: (filter?: unknown) => ipcRenderer.invoke(CHANNELS.changeLogList, filter),
    append: (entry: unknown) => ipcRenderer.invoke(CHANNELS.changeLogAppend, entry),
    appendMany: (entries: unknown) => ipcRenderer.invoke(CHANNELS.changeLogAppendMany, entries),
  },

  audit: {
    list: () => ipcRenderer.invoke(CHANNELS.auditList),
    append: (entry: unknown) => ipcRenderer.invoke(CHANNELS.auditAppend, entry),
    prune: (olderThan: string) => ipcRenderer.invoke(CHANNELS.auditPrune, olderThan),
  },

  users: {
    list: () => ipcRenderer.invoke(CHANNELS.usersList),
    resetAll: () => ipcRenderer.invoke(CHANNELS.usersResetAll),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.usersGetById, id),
    findByLogin: (login: string) => ipcRenderer.invoke(CHANNELS.usersFindByLogin, login),
    save: (user: unknown) => ipcRenderer.invoke(CHANNELS.usersSave, user),
    remove: (id: string) => ipcRenderer.invoke(CHANNELS.usersRemove, id),
  },

  session: {
    remember: (userId: string) => ipcRenderer.invoke(CHANNELS.sessionRemember, userId),
    restore: () => ipcRenderer.invoke(CHANNELS.sessionRestore),
    forget: () => ipcRenderer.invoke(CHANNELS.sessionForget),
  },

  window: {
    setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke(CHANNELS.windowSetTheme, theme),
    focusContent: () => ipcRenderer.invoke(CHANNELS.windowFocusContent),
  },

  /** Ключи простой электронной подписи: считаются в главном процессе. */
  signingKeys: {
    create: (password: string, generation: number) =>
      ipcRenderer.invoke(CHANNELS.signingKeyCreate, password, generation),
    rekey: (key: unknown, oldPassword: string, newPassword: string, generation: number) =>
      ipcRenderer.invoke(CHANNELS.signingKeyRekey, key, oldPassword, newPassword, generation),
    sign: (key: unknown, password: string, contentHash: string) =>
      ipcRenderer.invoke(CHANNELS.signingKeySign, key, password, contentHash),
    verify: (signature: unknown, contentHash: string) =>
      ipcRenderer.invoke(CHANNELS.signingKeyVerify, signature, contentHash),
  },
  password: {
    hash: (password: string) => ipcRenderer.invoke(CHANNELS.passwordHash, password),
    verify: (password: string, digest: unknown) => ipcRenderer.invoke(CHANNELS.passwordVerify, password, digest),
    sha256Hex: (text: string) => ipcRenderer.invoke(CHANNELS.contentSha256, text),
  },

  rooms: {
    list: () => ipcRenderer.invoke(CHANNELS.roomList),
    listByLevel: (levelId: string) => ipcRenderer.invoke(CHANNELS.roomListByLevel, levelId),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.roomGetById, id),
    save: (room: unknown) => ipcRenderer.invoke(CHANNELS.roomSave, room, currentHistoryActionId),
  },

  tree: {
    list: () => ipcRenderer.invoke(CHANNELS.treeList),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.treeGetById, id),
    save: (node: unknown) => ipcRenderer.invoke(CHANNELS.treeSave, node, currentHistoryActionId),
  },

  backdrops: {
    save: (backdrop: unknown) => ipcRenderer.invoke(CHANNELS.backdropSave, backdrop, currentHistoryActionId),
    list: () => ipcRenderer.invoke(CHANNELS.backdropList),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.backdropGetById, id),
    remove: (id: string) => ipcRenderer.invoke(CHANNELS.backdropRemove, id, currentHistoryActionId),
    saveCalibration: (calibration: unknown) => ipcRenderer.invoke(CHANNELS.calibrationSave, calibration, currentHistoryActionId),
    getCalibration: (id: string) => ipcRenderer.invoke(CHANNELS.calibrationGet, id),
    saveCleanup: (cleanup: unknown) => ipcRenderer.invoke(CHANNELS.cleanupSave, cleanup, currentHistoryActionId),
    getCleanup: (id: string) => ipcRenderer.invoke(CHANNELS.cleanupGet, id),
    removeCleanup: (id: string) => ipcRenderer.invoke(CHANNELS.cleanupRemove, id, currentHistoryActionId),
  },
};

contextBridge.exposeInMainWorld('izh', bridge);

export type IzhBridge = typeof bridge;
