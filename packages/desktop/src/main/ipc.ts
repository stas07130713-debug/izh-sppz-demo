/**
 * Мост между окном программы и файловой системой.
 *
 * Это тот самый транспортный шов, о котором говорит архитектура: сегодня вызов
 * идёт из окна в этот же процесс, завтра — по сети на сервер организации.
 * Сценарии ядра при этом не меняются, потому что они видят только порты.
 *
 * Имена каналов перечислены в одном месте — в channels.ts, чтобы окно и этот
 * файл не могли разойтись.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import type { BackdropCleanup, PlanBackdrop, PlanCalibration } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { CHANNELS } from './channels.js';
import { createFileStore } from './file-store.js';
import { createBackdropRepository } from './backdrop-repository.js';
import { dataDir } from './storage-paths.js';

export function registerIpcHandlers(): void {
  const fileStore = createFileStore();
  const backdrops = createBackdropRepository();

  ipcMain.handle(CHANNELS.openPlanFile, async () => {
    const window = BrowserWindow.getFocusedWindow();
    const options = {
      title: 'Выберите файл плана',
      properties: ['openFile' as const],
      filters: [
        { name: 'Планы и чертежи', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
        { name: 'Все файлы', extensions: ['*'] },
      ],
    };

    const picked =
      window === null
        ? await dialog.showOpenDialog(options)
        : await dialog.showOpenDialog(window, options);

    if (picked.canceled) return ok(null);

    const path = picked.filePaths[0];
    if (path === undefined) return ok(null);

    try {
      const buffer = await readFile(path);
      return ok({ fileName: basename(path), bytes: new Uint8Array(buffer) });
    } catch (e) {
      return err('FILE_READ_FAILED', 'Не удалось прочитать выбранный файл.', describeUnknown(e));
    }
  });

  ipcMain.handle(CHANNELS.dataDir, async () => ok(dataDir()));

  ipcMain.handle(CHANNELS.storePut, async (_event, bytes: Uint8Array, extension: string) =>
    fileStore.put(bytes, extension),
  );
  ipcMain.handle(CHANNELS.storeGet, async (_event, hash: string) => fileStore.get(hash));
  ipcMain.handle(CHANNELS.storeExists, async (_event, hash: string) => fileStore.exists(hash));

  ipcMain.handle(CHANNELS.backdropSave, async (_event, backdrop: PlanBackdrop) =>
    backdrops.save(backdrop),
  );
  ipcMain.handle(CHANNELS.backdropList, async () => backdrops.list());
  ipcMain.handle(CHANNELS.backdropGetById, async (_event, id: string) => backdrops.getById(id));
  ipcMain.handle(CHANNELS.backdropRemove, async (_event, id: string) => backdrops.remove(id));
  ipcMain.handle(CHANNELS.calibrationSave, async (_event, calibration: PlanCalibration) =>
    backdrops.saveCalibration(calibration),
  );
  ipcMain.handle(CHANNELS.calibrationGet, async (_event, id: string) => backdrops.getCalibration(id));

  ipcMain.handle(CHANNELS.cleanupSave, async (_event, cleanup: BackdropCleanup) =>
    backdrops.saveCleanup(cleanup),
  );
  ipcMain.handle(CHANNELS.cleanupGet, async (_event, id: string) => backdrops.getCleanup(id));
  ipcMain.handle(CHANNELS.cleanupRemove, async (_event, id: string) => backdrops.removeCleanup(id));

  registerHeadlessHandlers();
}

/**
 * Безголовый прогон: `npm run try -- <файл.pdf>`.
 *
 * Программа запускается со скрытым окном, прогоняет распознавание на указанном
 * файле, складывает промежуточные изображения и числа в папку и закрывается.
 *
 * Зачем это нужно. Распознавание работает только там, где есть графический
 * холст, то есть в окне. Без такого прогона проверить результат можно лишь
 * руками, а значит подгонка порогов упирается в человека. Здесь выполняется
 * ровно тот же код, что и при работе с программой, поэтому расхождение
 * «в проверке одно, в программе другое» исключено.
 */
function registerHeadlessHandlers(): void {
  const argv = process.argv;
  const at = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };

  const pdfPath = at('--try');
  const outDir = at('--out') ?? join(dataDir(), 'try');

  ipcMain.handle(CHANNELS.tryParams, async () =>
    pdfPath === null ? null : { pdfPath, outDir },
  );

  ipcMain.handle(CHANNELS.tryReadFile, async (_event, path: string) => {
    try {
      const buffer = await readFile(path);
      return ok(new Uint8Array(buffer));
    } catch (e) {
      return err('FILE_READ_FAILED', 'Не удалось прочитать файл.', describeUnknown(e));
    }
  });

  ipcMain.handle(CHANNELS.tryWrite, async (_event, name: string, data: Uint8Array | string) => {
    try {
      await mkdir(outDir, { recursive: true });
      const target = join(outDir, name);
      if (typeof data === 'string') await writeFile(target, data, 'utf8');
      else await writeFile(target, data);
      // eslint-disable-next-line no-console -- вывод в консоль и есть отчёт прогона
      console.log('записано:', target);
      return ok(target);
    } catch (e) {
      return err('FILE_WRITE_FAILED', 'Не удалось записать файл.', describeUnknown(e));
    }
  });

  ipcMain.handle(CHANNELS.tryDone, async () => {
    app.quit();
    return ok(undefined);
  });
}
