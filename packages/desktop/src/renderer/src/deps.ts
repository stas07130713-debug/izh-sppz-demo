/**
 * Сборка зависимостей для сценариев ядра.
 *
 * Хранилище файлов и хранилище сведений о подложках здесь — это переходники к
 * основному процессу через мост. Когда программа станет серверной, тут появятся
 * переходники к серверу по сети, а сценарии ядра не изменятся.
 */

import type { BackdropDeps } from '@izh/core';
import type { BackdropRepository, Clock, FileStore, IdGenerator } from '@izh/contracts';
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
