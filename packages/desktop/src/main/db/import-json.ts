/**
 * Перенос данных из прежних файлов JSON в базу.
 *
 * Выполняется один раз, при первом запуске на базе. Правила переноса три, и
 * все они о сохранности данных предприятия.
 *
 * 1. **Файлы не удаляются.** После переноса они остаются на месте: если что-то
 *    пошло не так, вернуться есть куда. Удалять их — отдельное решение
 *    заказчика, а не побочное действие обновления.
 *
 * 2. **Перенос идёт одной сделкой.** Либо в базе оказывается всё, либо она
 *    остаётся пустой и перенос повторится при следующем запуске. Наполовину
 *    перенесённые данные хуже, чем неперенесённые: их не отличить от полных.
 *
 * 3. **Порядок продиктован связями.** Сначала узлы дерева, потом помещения и
 *    элементы, потом записи журнала: база не даст записать элемент в
 *    несуществующий узел — и это защита, а не помеха.
 *
 * Того, что не проходит по связям, перенос не выбрасывает молча: он считает
 * такие записи и сообщает о них. Элемент, оставшийся от удалённого узла, —
 * не мусор, а след ошибки в прежнем хранении, и о нём нужно знать.
 */

import { readFile } from 'node:fs/promises';
import type {
  AuditEvent, BackdropCleanup, ChangeLogEntry, MaintenanceEvent, PlanBackdrop, PlanCalibration,
  PlanObject, Room, TreeNode, UserAccount,
} from '@izh/contracts';
import type { Db } from './database';
import { saveNodeRow } from './tree-store';
import { saveRoomRow } from './rooms-store';
import { saveObjectRow } from './objects-store';
import { saveEventRow } from './maintenance-store';
import { insertAuditRow, insertChangeRow, saveUserRow } from './access-stores';
import {
  regulationKindOf, saveBackdropRow, saveCalibrationRow, saveCleanupRow, saveRegulationRow,
} from './misc-stores';

/** Что удалось перенести и что пришлось оставить. */
export interface ImportReport {
  readonly moved: Readonly<Record<string, number>>;
  /** Записи, не прошедшие по связям: их некуда положить. */
  readonly skipped: readonly string[];
}

/** Читает список из файла. Нет файла — нет и записей: это первый запуск. */
async function readList<T>(path: string, key: string): Promise<readonly T[]> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const list = parsed[key];
    return Array.isArray(list) ? (list as T[]) : [];
  } catch {
    /*
     * Нет файла или он не читается — переносить нечего. Отличать «файла нет»
     * от «файл испорчен» здесь не нужно: испорченный файл остаётся на диске
     * нетронутым, и разобраться с ним можно отдельно.
     */
    return [];
  }
}

/** Читает одиночную запись: настройки лежат объектом, а не списком. */
async function readOne<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Пути к прежним файлам. Передаются снаружи: так перенос можно проверить. */
export interface ImportPaths {
  readonly tree: string;
  readonly rooms: string;
  readonly objects: string;
  readonly maintenance: string;
  readonly users: string;
  readonly audit: string;
  readonly changeLog: string;
  readonly backdrops: string;
  readonly settings: string;
  readonly regulations: string;
}

/**
 * Переносит данные в базу.
 *
 * Записи, которые не прошли по связям, пропускаются с пометкой: перенос обязан
 * довести до конца то, что перенести можно, а не останавливаться на первой же
 * испорченной строке из прежнего хранения.
 */
export async function importFromJson(db: Db, paths: ImportPaths): Promise<ImportReport> {
  const nodes = await readList<TreeNode>(paths.tree, 'nodes');
  const rooms = await readList<Room>(paths.rooms, 'rooms');
  const objects = await readList<PlanObject>(paths.objects, 'objects');
  const events = await readList<MaintenanceEvent>(paths.maintenance, 'events');
  const users = await readList<UserAccount>(paths.users, 'users');
  const audit = await readList<AuditEvent>(paths.audit, 'audit');
  const changes = await readList<ChangeLogEntry>(paths.changeLog, 'changes');
  const backdrops = await readList<PlanBackdrop>(paths.backdrops, 'backdrops');
  /*
   * Масштаб и правка чертежа лежат в том же файле, что и подложки, — тремя
   * списками рядом. Их перенос сначала забыли, и это стоило дорого: без
   * масштаба не считается ни площадь помещения, ни расстояние до огнетушителя,
   * а без правки чертежа показывается исходный, необрезанный лист другого
   * размера — и все значки на нём оказываются не на своих местах.
   */
  const calibrations = await readList<PlanCalibration>(paths.backdrops, 'calibrations');
  const cleanups = await readList<BackdropCleanup>(paths.backdrops, 'cleanups');
  const settings = await readOne<Record<string, unknown>>(paths.settings);
  const regulations = await readOne<Record<string, unknown[]>>(paths.regulations);

  const moved: Record<string, number> = {};
  const skipped: string[] = [];

  const put = (name: string, work: () => void): void => {
    try {
      work();
      moved[name] = (moved[name] ?? 0) + 1;
    } catch (error) {
      skipped.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  db.transaction(() => {
    /*
     * Узлы записываются в два прохода: сначала без родителей, потом со
     * связями. Порядок в файле произвольный, а ссылка на родителя обязана
     * указывать на уже записанный узел.
     */
    for (const node of nodes) put('узлы', () => saveNodeRow(db, { ...node, parentId: null }));
    for (const node of nodes) {
      if (node.parentId === null) continue;
      put('связи узлов', () => saveNodeRow(db, node));
    }

    for (const room of rooms) put('помещения', () => saveRoomRow(db, room));

    /*
     * Элементы тоже в два прохода: прибор системы и место размещения — ссылки
     * на другие элементы, и второй из них может встретиться в файле раньше.
     */
    for (const object of objects) {
      put('элементы', () => saveObjectRow(db, { ...object, systemId: null, placementId: null }));
    }
    for (const object of objects) {
      if ((object.systemId ?? null) === null && (object.placementId ?? null) === null) continue;
      put('связи элементов', () => saveObjectRow(db, object));
    }

    for (const event of events) put('записи журнала', () => saveEventRow(db, event));
    for (const user of users) put('пользователи', () => saveUserRow(db, user));
    for (const event of audit) put('действия', () => insertAuditRow(db, event));
    for (const entry of changes) put('изменения', () => insertChangeRow(db, entry));
    for (const backdrop of backdrops) put('подложки', () => saveBackdropRow(db, backdrop));
    // Строго после подложек: масштаб и правка ссылаются на подложку.
    for (const item of calibrations) put('масштабы', () => saveCalibrationRow(db, item));
    for (const item of cleanups) put('правка чертежей', () => saveCleanupRow(db, item));

    if (settings !== null) {
      put('настройки', () => db.run(
        'INSERT INTO settings(id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
        [JSON.stringify(settings)],
      ));
    }

    for (const [key, list] of Object.entries(regulations ?? {})) {
      if (!Array.isArray(list)) continue;
      const kind = regulationKindOf(key.replace(/s$/, ''));
      for (const item of list as { id?: string }[]) {
        if (typeof item?.id !== 'string') continue;
        put('регламенты', () => saveRegulationRow(db, kind, item.id as string, item));
      }
    }
  });

  return { moved, skipped };
}

/**
 * Добор того, что перенос пропустил.
 *
 * Обычно переносу хватает одного раза: база пуста, файлы есть — данные
 * переезжают, и повториться перенос не может. Но если в самом переносе была
 * ошибка — а она была: масштаб подложек и правка чертежей не переносились
 * вовсе, — то к моменту, когда её нашли, база уже не пуста, и обычный перенос
 * к ней больше не подступится. Данные при этом целы: прежние файлы никто не
 * удалял, они лежат рядом.
 *
 * Добор берёт из файлов только то, чего в базе нет, и ничего не перезаписывает:
 * запись, сделанную человеком после перехода, он не тронет. Выполняется он при
 * каждом запуске и обходится в два счётчика, когда добирать нечего.
 */
export async function recoverMissing(db: Db, paths: ImportPaths): Promise<ImportReport> {
  const moved: Record<string, number> = {};
  const skipped: string[] = [];

  const calibrations = await readList<PlanCalibration>(paths.backdrops, 'calibrations');
  const cleanups = await readList<BackdropCleanup>(paths.backdrops, 'cleanups');
  if (calibrations.length === 0 && cleanups.length === 0) return { moved, skipped };

  /*
   * Добирается только то, чего в базе нет вовсе. Проверка по каждой подложке
   * отдельно, а не «пусто ли всё»: после ошибочного переноса человек успел
   * задать масштаб заново хотя бы одному этажу, и его работа старее файла —
   * перезаписать её значило бы вернуть чертёж к прежнему состоянию.
   */
  const known = (table: string): ReadonlySet<string> => new Set(
    db.all<{ backdrop_id: string }>(`SELECT backdrop_id FROM ${table}`)
      .map((row) => row.backdrop_id),
  );
  const haveCalibration = known('calibrations');
  const haveCleanup = known('cleanups');

  const put = (name: string, work: () => void): void => {
    try {
      work();
      moved[name] = (moved[name] ?? 0) + 1;
    } catch (error) {
      skipped.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  db.transaction(() => {
    for (const item of calibrations) {
      if (haveCalibration.has(item.backdropId)) continue;
      put('масштабы', () => saveCalibrationRow(db, item));
    }
    for (const item of cleanups) {
      if (haveCleanup.has(item.backdropId)) continue;
      put('правка чертежей', () => saveCleanupRow(db, item));
    }
  });

  return { moved, skipped };
}

/** Есть ли в базе хоть что-нибудь: по этому и решают, нужен ли перенос. */
export function isEmpty(db: Db): boolean {
  const counted = db.get<{ n: number }>(`
    SELECT (
      (SELECT count(*) FROM nodes) + (SELECT count(*) FROM objects)
      + (SELECT count(*) FROM users) + (SELECT count(*) FROM maintenance_events)
    ) AS n
  `);
  return (counted?.n ?? 0) === 0;
}
