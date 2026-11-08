/**
 * Настройки, регламенты и подложки планов в базе.
 *
 * Три хранилища с общей чертой: у них нет своей предметной структуры, которую
 * стоило бы раскладывать по колонкам.
 *
 *  — **Настройки** читают и пишут целиком, одной записью. Разбирать их на
 *    тридцать колонок значило бы менять схему при каждой новой галочке;
 *  — **Регламенты** — четыре разных вида записей (сам регламент, его версии,
 *    документы, образцы). Общая таблица с колонкой вида: связей между ними нет,
 *    а перечисляются они всегда по виду;
 *  — **Подложки** — сведения о чертеже. Сам файл лежит в хранилище файлов, а
 *    здесь ссылка на него и то, как чертёж повёрнут и обрезан.
 *
 * Масштаб и правка чертежа привязаны к подложке жёстко: без неё они бессмысленны
 * и уходят вместе с ней.
 */

import type {
  AppSettings, AppSettingsRepository, BackdropCleanup, BackdropRepository, LocalDocument,
  PlanBackdrop, PlanCalibration, Regulation, RegulationRepository, RegulationTemplate,
  RegulationVersion, Result,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { Db } from './database';
import { integer, json, required, text, toJson, type Row } from './rows';

// ── Настройки ──────────────────────────────────────────────────────────────

export function createSettingsStore(db: Db, defaults: AppSettings): AppSettingsRepository {
  return {
    async get(): Promise<Result<AppSettings>> {
      const row = db.get<Row>('SELECT data FROM settings WHERE id = 1');
      const saved = row === null ? null : json<Partial<AppSettings>>(row['data']);
      /*
       * Недостающие поля дополняются значениями по умолчанию, а не считаются
       * пустотой: настройка, появившаяся в новой редакции программы, у прежних
       * пользователей должна получить разумное значение, а не ноль.
       */
      return ok({ ...defaults, ...(saved ?? {}) });
    },

    async save(settings): Promise<Result<void>> {
      db.run(
        `INSERT INTO settings(id, data) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        [toJson(settings)],
      );
      return ok(undefined);
    },
  };
}

// ── Регламенты ─────────────────────────────────────────────────────────────

type RegulationKind = 'regulation' | 'version' | 'document' | 'template';

function listOf<T>(db: Db, kind: RegulationKind): readonly T[] {
  return db
    .all<Row>('SELECT data FROM regulations WHERE kind = ? ORDER BY id', [kind])
    .map((row) => json<T>(row['data']))
    .filter((item): item is T => item !== null);
}

function saveOne(db: Db, kind: RegulationKind, id: string, value: unknown): void {
  db.run(
    `INSERT INTO regulations(id, kind, data) VALUES (?,?,?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, data = excluded.data`,
    [id, kind, toJson(value)],
  );
}

export { saveOne as saveRegulationRow };

export function createRegulationStore(db: Db): RegulationRepository {
  return {
    async listRegulations(): Promise<Result<readonly Regulation[]>> {
      return ok(listOf<Regulation>(db, 'regulation'));
    },
    async listVersions(): Promise<Result<readonly RegulationVersion[]>> {
      return ok(listOf<RegulationVersion>(db, 'version'));
    },
    async listDocuments(): Promise<Result<readonly LocalDocument[]>> {
      return ok(listOf<LocalDocument>(db, 'document'));
    },
    async listTemplates(): Promise<Result<readonly RegulationTemplate[]>> {
      return ok(listOf<RegulationTemplate>(db, 'template'));
    },

    async saveRegulation(regulation): Promise<Result<void>> {
      saveOne(db, 'regulation', regulation.id, regulation);
      return ok(undefined);
    },

    async saveVersions(versions): Promise<Result<void>> {
      // Версии выпускают пачкой: либо выпущена вся, либо не выпущена ни одна.
      db.transaction(() => {
        for (const version of versions) saveOne(db, 'version', version.id, version);
      });
      return ok(undefined);
    },

    async saveDocument(document): Promise<Result<void>> {
      saveOne(db, 'document', document.id, document);
      return ok(undefined);
    },

    async saveTemplate(template): Promise<Result<void>> {
      saveOne(db, 'template', template.id, template);
      return ok(undefined);
    },
  };
}

// ── Подложки планов ────────────────────────────────────────────────────────

function toBackdrop(row: Row): PlanBackdrop {
  return {
    id: required(row['id'], 'подложка.id'),
    nodeId: text(row['node_id']),
    sourceHash: required(row['source_hash'], 'подложка.sourceHash'),
    sourceFileName: required(row['source_file_name'], 'подложка.sourceFileName'),
    sourceKind: required(row['source_kind'], 'подложка.sourceKind') as PlanBackdrop['sourceKind'],
    pageNumber: integer(row['page_number'], 1),
    dpi: row['dpi'] === null ? null : integer(row['dpi']),
    rotationDeg: integer(row['rotation_deg']) as PlanBackdrop['rotationDeg'],
    crop: json(row['crop_json']),
    widthPx: integer(row['width_px']),
    heightPx: integer(row['height_px']),
    createdAt: required(row['created_at'], 'подложка.createdAt'),
    ...(json<Record<string, unknown>>(row['data']) ?? {}),
  } as unknown as PlanBackdrop;
}

export function saveBackdropRow(db: Db, backdrop: PlanBackdrop): void {
  db.run(
    `INSERT INTO backdrops(id, node_id, source_hash, source_file_name, source_kind,
       page_number, dpi, rotation_deg, crop_json, width_px, height_px, data, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       node_id = excluded.node_id,
       source_hash = excluded.source_hash,
       source_file_name = excluded.source_file_name,
       source_kind = excluded.source_kind,
       page_number = excluded.page_number,
       dpi = excluded.dpi,
       rotation_deg = excluded.rotation_deg,
       crop_json = excluded.crop_json,
       width_px = excluded.width_px,
       height_px = excluded.height_px,
       data = excluded.data`,
    [
      backdrop.id, backdrop.nodeId, backdrop.sourceHash, backdrop.sourceFileName,
      backdrop.sourceKind, backdrop.pageNumber, backdrop.dpi, backdrop.rotationDeg,
      toJson(backdrop.crop), backdrop.widthPx, backdrop.heightPx,
      // Поля, которых нет отдельными колонками, — целиком: у подложки бывают
      // сведения, зависящие от вида исходного файла.
      toJson(backdrop),
      backdrop.createdAt,
    ],
  );
}

/**
 * Масштаб подложки. Отдельной функцией, а не только методом хранилища: тем же
 * кодом пользуется перенос данных из прежних файлов.
 */
export function saveCalibrationRow(db: Db, calibration: PlanCalibration): void {
  db.run(
    `INSERT INTO calibrations(backdrop_id, data) VALUES (?,?)
     ON CONFLICT(backdrop_id) DO UPDATE SET data = excluded.data`,
    [calibration.backdropId, toJson(calibration)],
  );
}

/** Правка чертежа: стёртые штампы, обрезка. Тем же порядком, что и масштаб. */
export function saveCleanupRow(db: Db, cleanup: BackdropCleanup): void {
  db.run(
    `INSERT INTO cleanups(backdrop_id, data) VALUES (?,?)
     ON CONFLICT(backdrop_id) DO UPDATE SET data = excluded.data`,
    [cleanup.backdropId, toJson(cleanup)],
  );
}

export function createBackdropStore(db: Db): BackdropRepository {
  return {
    async list(): Promise<Result<readonly PlanBackdrop[]>> {
      return ok(db.all<Row>('SELECT * FROM backdrops ORDER BY created_at').map(toBackdrop));
    },

    async getById(id): Promise<Result<PlanBackdrop>> {
      const row = db.get<Row>('SELECT * FROM backdrops WHERE id = ?', [id]);
      if (row === null) return err('NOT_FOUND', 'Подложка не найдена.');
      return ok(toBackdrop(row));
    },

    async save(backdrop): Promise<Result<void>> {
      saveBackdropRow(db, backdrop);
      return ok(undefined);
    },

    async remove(id): Promise<Result<void>> {
      // Масштаб и правка чертежа уходят следом сами: связи объявлены каскадными.
      db.run('DELETE FROM backdrops WHERE id = ?', [id]);
      return ok(undefined);
    },

    async saveCalibration(calibration): Promise<Result<void>> {
      saveCalibrationRow(db, calibration);
      return ok(undefined);
    },

    async getCalibration(id): Promise<Result<PlanCalibration | null>> {
      const row = db.get<Row>('SELECT data FROM calibrations WHERE backdrop_id = ?', [id]);
      return ok(row === null ? null : json<PlanCalibration>(row['data']));
    },

    async saveCleanup(cleanup): Promise<Result<void>> {
      saveCleanupRow(db, cleanup);
      return ok(undefined);
    },

    async getCleanup(id): Promise<Result<BackdropCleanup | null>> {
      const row = db.get<Row>('SELECT data FROM cleanups WHERE backdrop_id = ?', [id]);
      return ok(row === null ? null : json<BackdropCleanup>(row['data']));
    },

    async removeCleanup(id): Promise<Result<void>> {
      db.run('DELETE FROM cleanups WHERE backdrop_id = ?', [id]);
      return ok(undefined);
    },
  };
}

/** Прочие записи регламентов: нужны переносу данных из файлов. */
export function regulationKindOf(kind: string): RegulationKind {
  if (kind === 'version' || kind === 'document' || kind === 'template') return kind;
  return 'regulation';
}

/** Прямая запись строки текста: нужна переносу данных. */
export { text as readText };
