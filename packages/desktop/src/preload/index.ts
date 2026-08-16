/**
 * Мост, доступный окну программы.
 *
 * Окно не имеет доступа ни к файловой системе, ни к Node. Ему выдаётся только
 * этот перечень действий — так посторонний файл плана не сможет добраться до
 * компьютера пользователя.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../main/channels.js';

const bridge = {
  openPlanFile: () => ipcRenderer.invoke(CHANNELS.openPlanFile),
  dataDir: () => ipcRenderer.invoke(CHANNELS.dataDir),

  store: {
    put: (bytes: Uint8Array, extension: string) => ipcRenderer.invoke(CHANNELS.storePut, bytes, extension),
    get: (hash: string) => ipcRenderer.invoke(CHANNELS.storeGet, hash),
    exists: (hash: string) => ipcRenderer.invoke(CHANNELS.storeExists, hash),
  },

  backdrops: {
    save: (backdrop: unknown) => ipcRenderer.invoke(CHANNELS.backdropSave, backdrop),
    list: () => ipcRenderer.invoke(CHANNELS.backdropList),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.backdropGetById, id),
    remove: (id: string) => ipcRenderer.invoke(CHANNELS.backdropRemove, id),
    saveCalibration: (calibration: unknown) => ipcRenderer.invoke(CHANNELS.calibrationSave, calibration),
    getCalibration: (id: string) => ipcRenderer.invoke(CHANNELS.calibrationGet, id),
    saveCleanup: (cleanup: unknown) => ipcRenderer.invoke(CHANNELS.cleanupSave, cleanup),
    getCleanup: (id: string) => ipcRenderer.invoke(CHANNELS.cleanupGet, id),
    removeCleanup: (id: string) => ipcRenderer.invoke(CHANNELS.cleanupRemove, id),
  },
};

contextBridge.exposeInMainWorld('izh', bridge);

export type IzhBridge = typeof bridge;
