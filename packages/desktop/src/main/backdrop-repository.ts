/**
 * Хранение сведений о подложках в файле JSON.
 *
 * Это временная реализация первого шага. На следующем шаге её заменит SQLite.
 * Заменяется только этот файл: сценарии ядра работают через порт
 * BackdropRepository и об устройстве хранилища не знают.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type {
  BackdropCleanup,
  BackdropRepository,
  PlanBackdrop,
  PlanCalibration,
  Result,
} from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { backdropsFile, ensureDataDirs } from './storage-paths.js';

interface StoredState {
  readonly backdrops: PlanBackdrop[];
  readonly calibrations: PlanCalibration[];
  readonly cleanups: BackdropCleanup[];
}

const EMPTY_STATE: StoredState = { backdrops: [], calibrations: [], cleanups: [] };

async function readState(): Promise<StoredState> {
  try {
    const text = await readFile(backdropsFile(), 'utf8');
    const parsed = JSON.parse(text) as Partial<StoredState>;
    return {
      backdrops: parsed.backdrops ?? [],
      calibrations: parsed.calibrations ?? [],
      cleanups: parsed.cleanups ?? [],
    };
  } catch {
    // Файла ещё нет — это обычное состояние при первом запуске.
    return EMPTY_STATE;
  }
}

async function writeState(state: StoredState): Promise<void> {
  await ensureDataDirs();
  await writeFile(backdropsFile(), JSON.stringify(state, null, 2), 'utf8');
}

export function createBackdropRepository(): BackdropRepository {
  return {
    async save(backdrop: PlanBackdrop): Promise<Result<void>> {
      try {
        const state = await readState();
        const others = state.backdrops.filter((b) => b.id !== backdrop.id);
        await writeState({ ...state, backdrops: [...others, backdrop] });
        return ok(undefined);
      } catch (e) {
        return err('FILE_WRITE_FAILED', 'Не удалось сохранить сведения о подложке.', describeUnknown(e));
      }
    },

    async list(): Promise<Result<readonly PlanBackdrop[]>> {
      const state = await readState();
      const sorted = [...state.backdrops].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return ok(sorted);
    },

    async getById(id): Promise<Result<PlanBackdrop>> {
      const state = await readState();
      const found = state.backdrops.find((b) => b.id === id);
      if (found === undefined) return err('NOT_FOUND', 'Подложка не найдена.');
      return ok(found);
    },

    async remove(id): Promise<Result<void>> {
      try {
        const state = await readState();
        await writeState({
          backdrops: state.backdrops.filter((b) => b.id !== id),
          calibrations: state.calibrations.filter((c) => c.backdropId !== id),
          cleanups: state.cleanups.filter((c) => c.backdropId !== id),
        });
        return ok(undefined);
      } catch (e) {
        return err('FILE_WRITE_FAILED', 'Не удалось удалить подложку.', describeUnknown(e));
      }
    },

    async saveCleanup(cleanup: BackdropCleanup): Promise<Result<void>> {
      try {
        const state = await readState();
        const others = state.cleanups.filter((c) => c.backdropId !== cleanup.backdropId);
        await writeState({ ...state, cleanups: [...others, cleanup] });
        return ok(undefined);
      } catch (e) {
        return err('FILE_WRITE_FAILED', 'Не удалось сохранить очистку подложки.', describeUnknown(e));
      }
    },

    async getCleanup(id): Promise<Result<BackdropCleanup | null>> {
      const state = await readState();
      return ok(state.cleanups.find((c) => c.backdropId === id) ?? null);
    },

    async removeCleanup(id): Promise<Result<void>> {
      try {
        const state = await readState();
        await writeState({ ...state, cleanups: state.cleanups.filter((c) => c.backdropId !== id) });
        return ok(undefined);
      } catch (e) {
        return err('FILE_WRITE_FAILED', 'Не удалось отменить очистку.', describeUnknown(e));
      }
    },

    async saveCalibration(calibration: PlanCalibration): Promise<Result<void>> {
      try {
        const state = await readState();
        const others = state.calibrations.filter((c) => c.backdropId !== calibration.backdropId);
        await writeState({ ...state, calibrations: [...others, calibration] });
        return ok(undefined);
      } catch (e) {
        return err('FILE_WRITE_FAILED', 'Не удалось сохранить масштаб.', describeUnknown(e));
      }
    },

    async getCalibration(id): Promise<Result<PlanCalibration | null>> {
      const state = await readState();
      return ok(state.calibrations.find((c) => c.backdropId === id) ?? null);
    },
  };
}
