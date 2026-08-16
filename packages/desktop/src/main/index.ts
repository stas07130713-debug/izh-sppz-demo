/**
 * Запуск программы: создание окна и подключение моста к файловой системе.
 */

import { join } from 'node:path';
import { BrowserWindow, app } from 'electron';
import { registerIpcHandlers } from './ipc.js';
import { ensureDataDirs } from './storage-paths.js';

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'ИЖ СППЗ — интерактивный журнал систем противопожарной защиты',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Окно не имеет доступа к системе напрямую: всё только через мост.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl !== undefined && devServerUrl !== '') {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(async () => {
  await ensureDataDirs();
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
