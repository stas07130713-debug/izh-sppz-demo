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

import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type {
  AuditEvent,
  ChangeLogEntry,
  ChangeLogFilter,
  KeySignature,
  SigningKey,
  AppSettings,
  BackdropCleanup,
  HistoryActionId,
  JournalExportRequest,
  JournalExportResult,
  LocalDocument,
  MaintenanceEvent,
  PasswordDigest,
  PlanBackdrop,
  PlanCalibration,
  PlanObject,
  Regulation,
  RegulationTemplate,
  RegulationVersion,
  Result,
  Room,
  TreeNode,
  UserAccount,
} from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { CHANNELS } from './channels.js';
import { createFileStore, storedFilePath } from './file-store.js';
import { legacyPaths, openStorage, type Storage } from './db/storage.js';
import { createPasswordHasher } from './password-hasher.js';
import { createSigningKeyService } from './signing-keys.js';
import { forgetRememberedSession, rememberSession, restoreRememberedSession } from './remembered-session.js';

import { dataDir, databaseFile, historyFile, importReportFile, usersFile } from './storage-paths.js';
import { CommandHistory } from './command-history.js';
import { createDbHistoryAdapters } from './db/history-adapters.js';
import { createXlsx } from './xlsx-writer.js';
import { resetAccountsForRecovery } from './account-recovery.js';

/**
  * Открытое хранилище программы.
  *
  * Заводится один раз при запуске: база открывается, схема доводится до
  * текущей версии, и при первом запуске в неё переносятся прежние файлы.
  */
export async function openAppStorage(): Promise<Storage> {
  return openStorage({
    databasePath: databaseFile(),
    legacy: legacyPaths(dataDir()),
    reportPath: importReportFile(),
  });
}

export function registerIpcHandlers(storage: Storage): void {
  const fileStore = createFileStore();
  const { backdrops, tree, rooms, users, objects, maintenance, settings, regulations } = storage;
  const hasher = createPasswordHasher();
  /*
   * Отмена и возврат применяются к базе, а не к прежним файлам: иначе человек
   * нажимал бы «отменить», файл менялся, а на экране оставалось прежнее.
   */
  const history = new CommandHistory(createDbHistoryAdapters(storage), historyFile());

  ipcMain.handle(CHANNELS.windowSetTheme, (event, theme: 'dark' | 'light') => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window === null) return ok(undefined);
    window.setTitleBarOverlay({
      color: theme === 'light' ? '#eef1ef' : '#0c161b',
      symbolColor: theme === 'light' ? '#162327' : '#f4f8f8',
      height: 32,
    });
    return ok(undefined);
  });

  ipcMain.handle(CHANNELS.windowFocusContent, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window === null) return ok(undefined);
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    window.webContents.focus();
    return ok(undefined);
  });

  ipcMain.handle(CHANNELS.openPlanFile, async () =>
    pickAndReadFile('Выберите файл плана, чертежа или снимка', [
      {
        name: 'Планы, чертежи и снимки',
        extensions: [
          'pdf', 'svg', 'dxf', 'json',
          'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff',
        ],
      },
      // Тип определяется по содержимому, а не по расширению: чертежи присылают
      // и без расширения, и с чужим. Поэтому «все файлы» остаются доступны.
      { name: 'Все файлы', extensions: ['*'] },
    ]),
  );

  ipcMain.handle(CHANNELS.openJournalFile, async () =>
    pickAndReadFile('Выберите файл существующего журнала', [
      { name: 'Таблицы', extensions: ['xlsx', 'xlsm'] },
      { name: 'Все файлы', extensions: ['*'] },
    ]),
  );

  ipcMain.handle(CHANNELS.openMaintenanceDocument, async () =>
    pickAndReadFile('Выберите паспорт, акт или протокол', [
      { name: 'Документы', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'] },
      { name: 'Все файлы', extensions: ['*'] },
    ]),
  );

  ipcMain.handle(CHANNELS.exportJournal, async (_event, request: JournalExportRequest) =>
    exportJournal(request),
  );
  ipcMain.handle(CHANNELS.openStoredDocument, async (_event, hash: string) =>
    openStoredDocument(hash),
  );
  ipcMain.handle(CHANNELS.saveStoredDocument, async (_event, hash: string, fileName: string) =>
    saveStoredDocument(hash, fileName),
  );

  ipcMain.handle(CHANNELS.dataDir, async () => ok(dataDir()));
  ipcMain.handle(CHANNELS.historyState, async () => history.getState());
  /**
   * Внешняя ссылка открывается браузером системы.
   *
   * Внутри программы внешним страницам не место: окно Electron не браузер —
   * в нём нет ни адресной строки, ни кнопки «назад», и открытая так страница
   * выглядит неработающей. Разрешены только http и https: ссылка приходит из
   * справочника, и запускать по ней файлы нельзя.
   */
  ipcMain.handle(CHANNELS.openExternal, async (_event, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return err('INVALID_ARGUMENT', `Это не ссылка: ${url}`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return err('INVALID_ARGUMENT', `Открывать можно только веб-ссылки, а здесь ${parsed.protocol}`);
    }

    await shell.openExternal(parsed.href);
    return ok(undefined);
  });

  ipcMain.handle(CHANNELS.historyBegin, async (_event, label: string) => history.begin(label));
  ipcMain.handle(CHANNELS.historyCommit, async (_event, id: HistoryActionId) => history.commit(id));
  ipcMain.handle(CHANNELS.historyCancel, async (_event, id: HistoryActionId) => history.cancel(id));
  ipcMain.handle(CHANNELS.historyUndo, async () => history.undoLast());
  ipcMain.handle(CHANNELS.historyRedo, async () => history.redoLast());

  ipcMain.handle(CHANNELS.storePut, async (_event, bytes: Uint8Array, extension: string) =>
    fileStore.put(bytes, extension),
  );
  ipcMain.handle(CHANNELS.storeGet, async (_event, hash: string) => fileStore.get(hash));
  ipcMain.handle(CHANNELS.storeExists, async (_event, hash: string) => fileStore.exists(hash));

  ipcMain.handle(CHANNELS.backdropSave, async (_event, backdrop: PlanBackdrop, actionId?: string | null) => {
    const before = await nullable(backdrops.getById(backdrop.id));
    const saved = await backdrops.save(backdrop);
    if (saved.ok) await history.record(actionId ?? null, 'backdrop', backdrop.id, before, backdrop);
    return saved;
  });
  ipcMain.handle(CHANNELS.backdropList, async () => backdrops.list());
  ipcMain.handle(CHANNELS.backdropGetById, async (_event, id: string) => backdrops.getById(id));
  ipcMain.handle(CHANNELS.backdropRemove, async (_event, id: string, actionId?: string | null) => {
    const before = await nullable(backdrops.getById(id));
    const calibration = await nullable(backdrops.getCalibration(id));
    const cleanup = await nullable(backdrops.getCleanup(id));
    const removed = await backdrops.remove(id);
    if (removed.ok) {
      await history.record(actionId ?? null, 'backdrop', id, before, null);
      await history.record(actionId ?? null, 'calibration', id, calibration, null);
      await history.record(actionId ?? null, 'cleanup', id, cleanup, null);
    }
    return removed;
  });
  ipcMain.handle(CHANNELS.calibrationSave, async (_event, calibration: PlanCalibration, actionId?: string | null) => {
    const before = await nullable(backdrops.getCalibration(calibration.backdropId));
    const saved = await backdrops.saveCalibration(calibration);
    if (saved.ok) await history.record(actionId ?? null, 'calibration', calibration.backdropId, before, calibration);
    return saved;
  });
  ipcMain.handle(CHANNELS.calibrationGet, async (_event, id: string) => backdrops.getCalibration(id));

  ipcMain.handle(CHANNELS.cleanupSave, async (_event, cleanup: BackdropCleanup, actionId?: string | null) => {
    const before = await nullable(backdrops.getCleanup(cleanup.backdropId));
    const saved = await backdrops.saveCleanup(cleanup);
    if (saved.ok) await history.record(actionId ?? null, 'cleanup', cleanup.backdropId, before, cleanup);
    return saved;
  });
  ipcMain.handle(CHANNELS.cleanupGet, async (_event, id: string) => backdrops.getCleanup(id));
  ipcMain.handle(CHANNELS.cleanupRemove, async (_event, id: string, actionId?: string | null) => {
    const before = await nullable(backdrops.getCleanup(id));
    const removed = await backdrops.removeCleanup(id);
    if (removed.ok) await history.record(actionId ?? null, 'cleanup', id, before, null);
    return removed;
  });

  ipcMain.handle(CHANNELS.treeList, async () => tree.list());
  ipcMain.handle(CHANNELS.treeGetById, async (_event, id: string) => tree.getById(id));
  ipcMain.handle(CHANNELS.treeSave, async (_event, node: TreeNode, actionId?: string | null) => {
    const before = await nullable(tree.getById(node.id));
    const saved = await tree.save(node);
    if (saved.ok) await history.record(actionId ?? null, 'tree', node.id, before, node);
    return saved;
  });

  ipcMain.handle(CHANNELS.objectList, async () => objects.list());
  ipcMain.handle(CHANNELS.objectListByNode, async (_event, nodeId: string) => objects.listByNode(nodeId));
  ipcMain.handle(CHANNELS.objectGetById, async (_event, id: string) => objects.getById(id));
  ipcMain.handle(CHANNELS.objectSave, async (_event, object: PlanObject, actionId?: string | null) => {
    const before = await nullable(objects.getById(object.id));
    const saved = await objects.save(object);
    if (saved.ok) await history.record(actionId ?? null, 'object', object.id, before, object);
    return saved;
  });

  ipcMain.handle(CHANNELS.objectSaveMany, async (_event, list: readonly PlanObject[], actionId?: string | null) => {
    const before = new Map<string, unknown>();
    for (const object of list) before.set(object.id, await nullable(objects.getById(object.id)));
    const saved = await objects.saveMany(list);
    if (saved.ok) {
      for (const object of list) {
        await history.record(actionId ?? null, 'object', object.id, before.get(object.id) ?? null, object);
      }
    }
    return saved;
  });

  ipcMain.handle(CHANNELS.maintenanceList, async () => maintenance.list());
  ipcMain.handle(CHANNELS.maintenanceListByObject, async (_event, objectId: string) =>
    maintenance.listByObject(objectId),
  );
  ipcMain.handle(CHANNELS.maintenanceSave, async (_event, event: MaintenanceEvent, actionId?: string | null) => {
    const before = await findMaintenance(maintenance, event.id);
    const saved = await maintenance.save(event);
    if (saved.ok) await history.record(actionId ?? null, 'maintenance', event.id, before, event);
    return saved;
  });

  ipcMain.handle(
    CHANNELS.maintenanceSaveMany,
    async (_event, list: readonly MaintenanceEvent[], actionId?: string | null) => {
      const saved = await maintenance.saveMany(list);
      if (saved.ok) {
        // Записи журнала только появляются, поэтому «до» у них нет. В историю
        // команд они попадают ради связи с действием, а не ради отката: откат
        // мероприятия запрещён (AGENTS.md, правило 10).
        for (const event of list) {
          await history.record(actionId ?? null, 'maintenance', event.id, null, event);
        }
      }
      return saved;
    },
  );

  // Регламенты ТО (Дополнение 5). В историю команд не пишутся: выпуск версии
  // и так не переписывает прежнюю, откатывать нечего.
  ipcMain.handle(CHANNELS.regulationList, async () => regulations.listRegulations());
  ipcMain.handle(CHANNELS.regulationListVersions, async () => regulations.listVersions());
  ipcMain.handle(CHANNELS.regulationListDocuments, async () => regulations.listDocuments());
  ipcMain.handle(CHANNELS.regulationListTemplates, async () => regulations.listTemplates());
  ipcMain.handle(CHANNELS.regulationSave, async (_event, value: Regulation) => regulations.saveRegulation(value));
  ipcMain.handle(CHANNELS.regulationSaveVersions, async (_event, list: readonly RegulationVersion[]) =>
    regulations.saveVersions(list),
  );
  ipcMain.handle(CHANNELS.regulationSaveDocument, async (_event, value: LocalDocument) =>
    regulations.saveDocument(value),
  );
  ipcMain.handle(CHANNELS.regulationSaveTemplate, async (_event, value: RegulationTemplate) =>
    regulations.saveTemplate(value),
  );

  ipcMain.handle(CHANNELS.settingsGet, async () => settings.get());
  ipcMain.handle(CHANNELS.settingsSave, async (_event, value: AppSettings, actionId?: string | null) => {
    const before = await nullable(settings.get());
    const saved = await settings.save(value);
    if (saved.ok) await history.record(actionId ?? null, 'settings', 'settings', before, value);
    return saved;
  });

  /*
   * Учётные записи и отпечатки.
   *
   * В историю Undo/Redo не пишутся намеренно: отменить кнопкой «назад»
   * заведение человека или смену его пароля нельзя — это не правка данных
   * объекта, а изменение того, кто с программой работает.
   */
  ipcMain.handle(CHANNELS.usersList, async () => users.list());
  ipcMain.handle(CHANNELS.usersRemove, async (_event, id: string) => users.remove(id));

  const changeLog = storage.changeLog;
  ipcMain.handle(CHANNELS.changeLogList, async (_event, filter?: ChangeLogFilter) => changeLog.list(filter));
  ipcMain.handle(CHANNELS.changeLogAppend, async (_event, entry: ChangeLogEntry) => changeLog.append(entry));
  ipcMain.handle(
    CHANNELS.changeLogAppendMany,
    async (_event, entries: readonly ChangeLogEntry[]) => changeLog.appendMany(entries),
  );

  const audit = storage.audit;
  ipcMain.handle(CHANNELS.auditList, async () => audit.list());
  ipcMain.handle(CHANNELS.auditAppend, async (_event, entry: AuditEvent) => audit.append(entry));
  ipcMain.handle(CHANNELS.auditPrune, async (_event, olderThan: string) => audit.prune(olderThan));

  /**
   * Начать с учётными записями заново.
   *
   * Нужно на один случай: единственный администратор забыл пароль. Пароль не
   * восстанавливается ни программой, ни кем-либо ещё — это и есть смысл
   * хранения отпечатком, — и без такого выхода программа становилась бы
   * недоступной насовсем.
   *
   * Это не дыра в разграничении: база лежит в профиле Windows, и тот, у кого
   * есть к ней доступ, и так может заменить её резервной копией. Кнопка лишь
   * избавляет от необходимости править хранилище вручную.
   * В серверном варианте её не будет — там данные не у пользователя.
   *
   * Перед очисткой рабочей таблицы полный снимок учётных записей сохраняется
   * рядом с базой: подписи и записи журнала ссылаются на прежних людей, и
   * знать, кто это был, может понадобиться.
   */
  ipcMain.handle(CHANNELS.usersResetAll, async () => {
    const archivedAt = new Date().toISOString();
    const stamp = archivedAt.replace(/[:.]/gu, '-');
    return resetAccountsForRecovery({
      users,
      archiveFile: `${usersFile()}.снято-${stamp}`,
      archivedAt,
      forgetRememberedSession,
    });
  });
  ipcMain.handle(CHANNELS.usersGetById, async (_event, id: string) => users.getById(id));
  ipcMain.handle(CHANNELS.usersFindByLogin, async (_event, login: string) => users.findByLogin(login));
  ipcMain.handle(CHANNELS.usersSave, async (_event, user: UserAccount) => users.save(user));
  ipcMain.handle(CHANNELS.sessionRemember, async (_event, userId: string) => rememberSession(users, userId));
  ipcMain.handle(CHANNELS.sessionRestore, async () => restoreRememberedSession(users));
  ipcMain.handle(CHANNELS.sessionForget, async () => forgetRememberedSession());

  ipcMain.handle(CHANNELS.passwordHash, async (_event, password: string) => hasher.hash(password));
  ipcMain.handle(CHANNELS.passwordVerify, async (_event, password: string, digest: PasswordDigest) =>
    hasher.verify(password, digest));

  /*
   * Ключи подписи считаются только здесь, в главном процессе.
   *
   * Закрытый ключ не покидает его расшифрованным: окно программы получает
   * готовую подпись, а не ключ. Пароль приходит сюда на время одного вызова
   * и нигде не сохраняется.
   */
  const signingKeys = createSigningKeyService();
  ipcMain.handle(CHANNELS.signingKeyCreate, async (_event, password: string, generation: number) =>
    signingKeys.create(password, generation));
  ipcMain.handle(CHANNELS.signingKeyRekey, async (_event, key: SigningKey, oldPassword: string, newPassword: string, generation: number) =>
    signingKeys.rekey(key, oldPassword, newPassword, generation));
  ipcMain.handle(CHANNELS.signingKeySign, async (_event, key: SigningKey, password: string, contentHash: string) =>
    signingKeys.sign(key, password, contentHash));
  ipcMain.handle(CHANNELS.signingKeyVerify, async (_event, signature: KeySignature, contentHash: string) =>
    signingKeys.verify(signature, contentHash));
  ipcMain.handle(CHANNELS.contentSha256, async (_event, text: string) => hasher.sha256Hex(text));

  ipcMain.handle(CHANNELS.roomList, async () => rooms.list());
  ipcMain.handle(CHANNELS.roomListByLevel, async (_event, levelId: string) => rooms.listByLevel(levelId));
  ipcMain.handle(CHANNELS.roomGetById, async (_event, id: string) => rooms.getById(id));
  ipcMain.handle(CHANNELS.roomSave, async (_event, room: Room, actionId?: string | null) => {
    const before = await nullable(rooms.getById(room.id));
    const saved = await rooms.save(room);
    if (saved.ok) await history.record(actionId ?? null, 'room', room.id, before, room);
    return saved;
  });

}

async function nullable<T>(promise: Promise<Result<T>>): Promise<T | null> {
  const result = await promise;
  return result.ok ? result.value : null;
}

async function findMaintenance(
  repository: { readonly list: () => Promise<Result<readonly MaintenanceEvent[]>> },
  id: string,
): Promise<MaintenanceEvent | null> {
  const list = await repository.list();
  if (!list.ok) return null;
  return list.value.find((event) => event.id === id) ?? null;
}

async function exportJournal(
  request: JournalExportRequest,
): Promise<ReturnType<typeof ok<JournalExportResult>> | ReturnType<typeof err>> {
  try {
    if (request.format === 'print') {
      const printWindow = await createPrintWindow(request.html);
      await new Promise<void>((resolve) => {
        printWindow.webContents.print({ silent: false, printBackground: true }, () => {
          printWindow.close();
          // Отмена пользователем штатна: файл не создаётся и ошибка не показывается.
          resolve();
        });
      });
      return ok({ savedPath: null });
    }

    const extension = request.format === 'excel' ? 'xlsx' : request.format === 'word' ? 'doc' : 'pdf';
    const label = request.format === 'excel' ? 'Excel' : request.format === 'word' ? 'Word' : 'PDF';
    const parent = BrowserWindow.getFocusedWindow();
    const options = {
      title: `Сохранить документ в ${label}`,
      defaultPath: `${basename(request.suggestedName, '.json')}.${extension}`,
      filters: [{ name: label, extensions: [extension] }],
    };
    const picked = parent === null ? await dialog.showSaveDialog(options) : await dialog.showSaveDialog(parent, options);
    if (picked.canceled || picked.filePath === undefined) return ok({ savedPath: null });

    if (request.format === 'excel') {
      await writeFile(picked.filePath, createXlsx(request.sheets));
    } else if (request.format === 'word') {
      // Word получает свою разметку: печатную он открывает книжной и режет
      // половину граф — он понимает не @page, а собственное описание раздела.
      await writeFile(picked.filePath, request.wordHtml ?? request.html, 'utf8');
    } else {
      const printWindow = await createPrintWindow(request.html);
      /*
       * Номер листа внизу по центру.
       *
       * Заказчик: «страницы соответственно должны быть пронумерованы». Ставит
       * их печать, а не разметка: правило `@page { @bottom-center }` из CSS
       * Chromium не понимает, а число листов заранее не вычислить — оно
       * зависит от того, как лёг текст.
       *
       * Верхний колонтитул пустой: адрес и заголовок окна, которые Chromium
       * ставит туда по умолчанию, в журнале ни к чему.
       */
      const bytes = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: request.landscape ?? true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;'
          + 'font-family:Arial,sans-serif;color:#444"><span class="pageNumber"></span></div>',
        margins: { top: 0.4, bottom: 0.6, left: 0.4, right: 0.4 },
      });
      printWindow.close();
      await writeFile(picked.filePath, bytes);
    }
    return ok({ savedPath: picked.filePath });
  } catch (e) {
    return err('FILE_WRITE_FAILED', 'Не удалось выгрузить документ.', describeUnknown(e));
  }
}

async function createPrintWindow(html: string): Promise<BrowserWindow> {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return window;
}

async function openStoredDocument(hash: string): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof err>> {
  try {
    const path = await storedFilePath(hash);
    if (path === null) return err('FILE_NOT_FOUND', 'Файл не найден в хранилище.');
    const error = await shell.openPath(path);
    return error === '' ? ok(undefined) : err('FILE_READ_FAILED', 'Не удалось открыть документ.', error);
  } catch (e) {
    return err('FILE_READ_FAILED', 'Не удалось открыть документ.', describeUnknown(e));
  }
}

async function saveStoredDocument(
  hash: string,
  fileName: string,
): Promise<ReturnType<typeof ok<JournalExportResult>> | ReturnType<typeof err>> {
  try {
    const path = await storedFilePath(hash);
    if (path === null) return err('FILE_NOT_FOUND', 'Файл не найден в хранилище.');
    const parent = BrowserWindow.getFocusedWindow();
    const picked = parent === null
      ? await dialog.showSaveDialog({ title: 'Сохранить копию документа', defaultPath: fileName })
      : await dialog.showSaveDialog(parent, { title: 'Сохранить копию документа', defaultPath: fileName });
    if (picked.canceled || picked.filePath === undefined) return ok({ savedPath: null });
    await copyFile(path, picked.filePath);
    return ok({ savedPath: picked.filePath });
  } catch (e) {
    return err('FILE_WRITE_FAILED', 'Не удалось сохранить копию документа.', describeUnknown(e));
  }
}

/**
 * Диалог выбора файла и чтение его байтов.
 *
 * Один на все виды файлов: план и журнал открываются одинаково, отличаются
 * только заголовком окна и фильтром расширений. Байты возвращаются окну, потому
 * что разбирают их движки, а они работают там, а не здесь.
 */
/** Предел размера открываемого файла: больше него в память не берём. */
const MAX_PICKED_FILE_BYTES = 100 * 1024 * 1024;

async function pickAndReadFile(
  title: string,
  filters: readonly { name: string; extensions: string[] }[],
): Promise<ReturnType<typeof ok<{ fileName: string; bytes: Uint8Array } | null>> | ReturnType<typeof err>> {
  const window = BrowserWindow.getFocusedWindow();
  const options = { title, properties: ['openFile' as const], filters: [...filters] };

  const picked =
    window === null ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(window, options);

  if (picked.canceled) return ok(null);

  const path = picked.filePaths[0];
  if (path === undefined) return ok(null);

  try {
    /*
     * Размер проверяется до чтения.
     *
     * Файл читается целиком в память и целиком передаётся в окно программы.
     * Указали гигабайтный — и программа замирала, ничего не объясняя: она
     * читала. Отказ до чтения занимает мгновение и говорит человеку, что
     * произошло.
     */
    const info = await stat(path);
    if (info.size > MAX_PICKED_FILE_BYTES) {
      return err(
        'INVALID_ARGUMENT',
        `Файл больше ${Math.round(MAX_PICKED_FILE_BYTES / (1024 * 1024))} МБ — программа его не открывает. `
        + 'Сохраните нужные листы или страницы отдельным файлом и повторите.',
      );
    }

    const buffer = await readFile(path);
    return ok({ fileName: basename(path), bytes: new Uint8Array(buffer) });
  } catch (e) {
    return err('FILE_READ_FAILED', 'Не удалось прочитать выбранный файл.', describeUnknown(e));
  }
}

