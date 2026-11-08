/**
 * Запуск программы: создание окна и подключение моста к файловой системе.
 */

import { join } from 'node:path';
import { BrowserWindow, Menu, app, dialog, shell } from 'electron';
import { describeUnknown } from '@izh/contracts';
import { openAppStorage, registerIpcHandlers } from './ipc.js';
import { databaseFile, ensureDataDirs } from './storage-paths.js';

app.setName('ИЖ СППЗ');
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window === undefined) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
}

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'ИЖ СППЗ — интерактивный журнал систем противопожарной защиты',
    icon: join(__dirname, '../../app-icon.ico'),
    backgroundColor: '#0f172a',
    // Системные кнопки остаются настоящими (с привычным поведением Windows),
    // но лежат на нашей петроловой верхней панели вместо стандартной белой.
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c161b',
      symbolColor: '#f4f8f8',
      height: 32,
    },
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Окно не имеет доступа к системе напрямую: всё только через мост.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  /*
   * Внешние ссылки уходят в браузер системы, а не открываются окном Electron.
   *
   * Окно программы не браузер: в нём нет ни адресной строки, ни кнопки
   * «назад», и открытая так страница выглядит неработающей. Своё окно
   * программа не открывает никогда — открывать нечего.
   */
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // В безголовом прогоне окно не показывается: оно нужно только ради холста.
  window.once('ready-to-show', () => {
    window.show();
    window.focus();
    window.webContents.focus();
  });

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl !== undefined && devServerUrl !== '') {
    void loadDevServer(window, devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

async function loadDevServer(window: BrowserWindow, url: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await window.loadURL(url);
      return;
    } catch {
      await new Promise((resolve) => { setTimeout(resolve, 250); });
    }
  }
  await window.loadURL(url);
}

if (hasSingleInstanceLock) void app.whenReady().then(async () => {
  // Стандартное меню Electron на Windows англоязычное и относится к
  // инструментам оболочки, а не к функциям СППЗ. Пользовательские команды
  // находятся в самом интерфейсе приложения.
  Menu.setApplicationMenu(null);
  await ensureDataDirs();
  /*
   * База открывается до окна и до обработчиков: схема доводится до текущей
   * версии, и при первом запуске в неё переносятся прежние файлы. Показать
   * окно раньше значило бы дать человеку работать с пустым журналом, пока
   * данные ещё едут.
   */
  /*
   * Отказ при открытии базы называется словами и показывается человеку.
   *
   * Прежде исключение отсюда уходило в никуда: обещание никто не ждал, и
   * программа молча закрывалась через мгновение после запуска. Человек видел
   * лишь то, что «она не открывается», и понять причину было нельзя.
   */
  let storage;
  try {
    storage = await openAppStorage();
  } catch (error) {
    // В консоль тоже: при разборе неполадки её читают там, а окно с
    // сообщением до этого момента может и не успеть появиться.
    console.error("Не удалось открыть базу данных:", error);
    dialog.showErrorBox(
      "Не удалось открыть базу данных",
      [
        "Программа не может продолжить работу: хранилище недоступно.",
        "",
        describeUnknown(error),
        "",
        `Файл базы: ${databaseFile()}`,
      ].join(String.fromCharCode(10)),
    );
    app.quit();
    return;
  }

  registerIpcHandlers(storage);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
