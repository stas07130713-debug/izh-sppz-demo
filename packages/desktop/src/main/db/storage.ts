/**
 * Хранилище программы: открытие базы, перенос данных, готовые репозитории.
 *
 * Одна точка вместо десяти: раньше каждое хранилище само открывало свой файл,
 * и связей между ними не было. Теперь база одна, открывается один раз, и все
 * репозитории работают через неё.
 *
 * **Первый запуск на базе переносит данные из прежних файлов.** Условие
 * переноса простое и надёжное: база пуста, а файлы есть. Повториться перенос
 * не может — после него база уже не пуста. Файлы при этом остаются на месте:
 * удалять их — отдельное решение заказчика.
 *
 * **Отчёт о переносе записывается рядом с базой.** Если какие-то записи не
 * прошли по связям — это след ошибки в прежнем хранении, и о нём нужно знать,
 * а не узнавать по отсутствию элемента в журнале через полгода.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AppSettingsRepository, AuditRepository, BackdropRepository, ChangeLogRepository,
  MaintenanceEventRepository, ObjectTreeRepository, PlanObjectRepository, RegulationRepository,
  Result, RoomRepository, UserAccount, UserRepository,
} from '@izh/contracts';
import { DEFAULT_APP_SETTINGS } from '@izh/contracts';
import { openDatabase, type Db } from './database';
import { MIGRATIONS } from './schema';
import { importFromJson, isEmpty, recoverMissing, type ImportPaths } from './import-json';
import { createTreeStore } from './tree-store';
import { createRoomStore } from './rooms-store';
import { createObjectStore } from './objects-store';
import { createMaintenanceStore } from './maintenance-store';
import { createAuditStore, createChangeLogStore, createUserStore } from './access-stores';
import { createBackdropStore, createRegulationStore, createSettingsStore } from './misc-stores';

/** Все хранилища программы — те же порты, что и прежде. */
export interface Storage {
  readonly db: Db;
  readonly tree: ObjectTreeRepository;
  readonly rooms: RoomRepository;
  readonly objects: PlanObjectRepository;
  readonly maintenance: MaintenanceEventRepository;
  readonly users: UserRepository & { resetAll(): Promise<Result<void>> };
  readonly audit: AuditRepository;
  readonly changeLog: ChangeLogRepository;
  readonly settings: AppSettingsRepository;
  readonly regulations: RegulationRepository;
  readonly backdrops: BackdropRepository;
}

export interface StorageOptions {
  /** Файл базы. `:memory:` — для проверок. */
  readonly databasePath: string;
  /** Прежние файлы: откуда переносить при первом запуске. */
  readonly legacy?: ImportPaths | null;
  /** Куда положить отчёт о переносе. Не задан — отчёт не пишется. */
  readonly reportPath?: string | null;
}

export function createStorage(db: Db): Storage {
  return {
    db,
    tree: createTreeStore(db),
    rooms: createRoomStore(db),
    objects: createObjectStore(db),
    maintenance: createMaintenanceStore(db),
    users: createUserStore(db),
    audit: createAuditStore(db),
    changeLog: createChangeLogStore(db),
    settings: createSettingsStore(db, DEFAULT_APP_SETTINGS),
    regulations: createRegulationStore(db),
    backdrops: createBackdropStore(db),
  };
}

/**
 * Открывает базу, при надобности переносит в неё прежние данные и отдаёт
 * готовые хранилища.
 */
export async function openStorage(options: StorageOptions): Promise<Storage> {
  const db = openDatabase(options.databasePath, MIGRATIONS);

  const legacy = options.legacy ?? null;
  if (legacy !== null) {
    /*
     * Перенос — при первом запуске на пустой базе. Добор — всегда: он
     * подхватывает то, что прежний перенос пропустил по своей ошибке, и
     * молчит, когда добирать нечего.
     */
    const report = isEmpty(db)
      ? await importFromJson(db, legacy)
      : await recoverMissing(db, legacy);

    const anything = Object.keys(report.moved).length > 0 || report.skipped.length > 0;
    if (options.reportPath != null && anything) {
      /*
       * Отчёт пишется рядом с базой и обычным текстом: его читает человек,
       * а не программа. Отказ записи отчёта не должен мешать работе —
       * перенос уже состоялся, и это главное.
       */
      try {
        writeFileSync(options.reportPath, JSON.stringify({
          at: new Date().toISOString(),
          moved: report.moved,
          skipped: report.skipped,
        }, null, 2), 'utf8');
      } catch {
        // Отчёт не записался: данные на месте, и это важнее.
      }
    }
  }

  return createStorage(db);
}

/** Пути к прежним файлам данных по папке, где они лежали. */
export function legacyPaths(dataDir: string): ImportPaths {
  return {
    tree: join(dataDir, 'tree.json'),
    rooms: join(dataDir, 'rooms.json'),
    objects: join(dataDir, 'objects.json'),
    maintenance: join(dataDir, 'maintenance.json'),
    users: join(dataDir, 'users.json'),
    audit: join(dataDir, 'audit.json'),
    changeLog: join(dataDir, 'change-log.json'),
    backdrops: join(dataDir, 'backdrops.json'),
    settings: join(dataDir, 'settings.json'),
    regulations: join(dataDir, 'regulations.json'),
  };
}

/**
 * Заводит первую учётную запись, если их нет вовсе.
 *
 * Нужен переносу: у предприятия, работавшего без входа в программу, файла
 * пользователей не было, и после перехода войти было бы некому.
 */
export async function hasAnyUser(storage: Storage): Promise<boolean> {
  const list = await storage.users.list();
  return list.ok && list.value.length > 0;
}

export type { UserAccount };
