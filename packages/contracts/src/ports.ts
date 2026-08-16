/**
 * Порты инфраструктуры.
 *
 * Всё, что выходит за пределы вычислений — файлы, хранение, время,
 * идентификаторы — спрятано за этими интерфейсами. Сейчас у них локальные
 * реализации; когда программа станет серверной, подставятся серверные, а ядро
 * и движки не изменятся ни на строку. Это и есть обещание «переход на сервер
 * без переписывания ядра».
 *
 * Смотри docs/adr/ADR-002-ядро-и-движки.md.
 */

import type { BackdropId, ContentHash, IsoDateTime } from './basic-types.js';
import type { BackdropCleanup } from './image.js';
import type { PlanBackdrop, PlanCalibration } from './plan-source.js';
import type { Result } from './result.js';

/**
 * Хранилище файлов с адресацией по содержимому.
 *
 * Имя файла в хранилище — это SHA-256 его содержимого. Два одинаковых файла
 * занимают место один раз, а данные никогда не содержат путей к диску, поэтому
 * папку с проектом можно перенести на другой компьютер целиком.
 */
export interface FileStore {
  /** Кладёт содержимое в хранилище и возвращает его хеш. */
  put(bytes: Uint8Array, extension: string): Promise<Result<ContentHash>>;
  get(hash: ContentHash): Promise<Result<Uint8Array>>;
  exists(hash: ContentHash): Promise<Result<boolean>>;
}

/** Хранение сведений о подложках и калибровках. */
export interface BackdropRepository {
  save(backdrop: PlanBackdrop): Promise<Result<void>>;
  list(): Promise<Result<readonly PlanBackdrop[]>>;
  getById(id: BackdropId): Promise<Result<PlanBackdrop>>;
  remove(id: BackdropId): Promise<Result<void>>;
  saveCalibration(calibration: PlanCalibration): Promise<Result<void>>;
  getCalibration(id: BackdropId): Promise<Result<PlanCalibration | null>>;
  saveCleanup(cleanup: BackdropCleanup): Promise<Result<void>>;
  getCleanup(id: BackdropId): Promise<Result<BackdropCleanup | null>>;
  removeCleanup(id: BackdropId): Promise<Result<void>>;
}

/** Часы. Отдельным портом, чтобы поведение можно было воспроизвести в тестах. */
export interface Clock {
  nowUtc(): IsoDateTime;
}

/** Генератор идентификаторов. Отдельным портом по той же причине. */
export interface IdGenerator {
  newId(): string;
}
