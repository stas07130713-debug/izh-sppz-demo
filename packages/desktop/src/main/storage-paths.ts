/**
 * Где программа хранит данные пользователя.
 *
 * Всё лежит в одной папке: файлы подложек и исходных чертежей — в files,
 * сведения о них — в backdrops.json. Папку можно скопировать на другой
 * компьютер целиком, потому что в данных нет ни одного абсолютного пути.
 *
 * На следующем шаге backdrops.json заменится на базу SQLite. Заменится только
 * реализация хранилища; сценарии ядра и движок не изменятся — ради этого они и
 * работают через порты.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';

export function dataDir(): string {
  return join(app.getPath('userData'), 'data');
}

export function filesDir(): string {
  return join(dataDir(), 'files');
}

export function backdropsFile(): string {
  return join(dataDir(), 'backdrops.json');
}

/** Дерево объекта: организации, цеха, здания, этажи и склады. */
export function treeFile(): string {
  return join(dataDir(), 'tree.json');
}

/** Объекты СППЗ: они же значки на плане и записи журнала. */
export function objectsFile(): string {
  return join(dataDir(), 'objects.json');
}

/** Помещения этажей: категории, обводки на плане, вычисленные площади. */
export function roomsFile(): string {
  return join(dataDir(), 'rooms.json');
}

/** Мероприятия: осмотры, ТО, испытания — лента истории по каждому объекту. */
export function maintenanceFile(): string {
  return join(dataDir(), 'maintenance.json');
}

/** Настройки программы: порог «скоро» и то, что к нему добавится позже. */
export function settingsFile(): string {
  return join(dataDir(), 'settings.json');
}

/** Регламенты ТО: сами регламенты, их версии, локальные документы и шаблоны. */
export function regulationsFile(): string {
  return join(dataDir(), 'regulations.json');
}

/**
 * Учётные записи: имена, роли, области прав и отпечатки паролей.
 *
 * Отдельным файлом от прочих данных: копируя папку на другой компьютер, люди
 * переносят объекты, а пароли переносить чаще всего не хотят.
 */
export function usersFile(): string {
  return join(dataDir(), 'users.json');
}

/**
 * Журнал действий пользователей: кто вошёл, кого завели, что подписали.
 *
 * Отдельным файлом и рядом с учётными записями: это сведения о людях, а не об
 * оборудовании. Живёт тридцать дней и стареет сам (правило в ядре).
 */
export function auditFile(): string {
  return join(dataDir(), 'audit.json');
}

/**
 * Журнал вносимых изменений: кто, когда и какое поле изменил.
 *
 * Отдельным файлом от данных, которые он описывает: журнал переживает и
 * удаление узла, и вывод элемента из обращения — ради этого его и ведут.
 */
export function changeLogFile(): string {
  return join(dataDir(), 'change-log.json');
}

/**
 * База данных программы: всё, что предприятие ведёт в журнале.
 *
 * Один файл: его копируют целиком, кладут в резерв и прикладывают к акту
 * проверки. До перехода на базу данные лежали десятком файлов JSON без связей
 * между ними.
 */
export function databaseFile(): string {
  return join(dataDir(), 'sppz.db');
}

/** Отчёт о переносе данных из прежних файлов. Пишется один раз. */
export function importReportFile(): string {
  return join(dataDir(), 'перенос-в-базу.json');
}

/** История пользовательских команд для Undo/Redo. */
export function historyFile(): string {
  return join(dataDir(), 'history.json');
}

/** Зашифрованная средствами Windows ссылка на запомненную учётную запись. */
export function rememberedSessionFile(): string {
  return join(dataDir(), 'remembered-session.bin');
}

export async function ensureDataDirs(): Promise<void> {
  await mkdir(filesDir(), { recursive: true });
}
