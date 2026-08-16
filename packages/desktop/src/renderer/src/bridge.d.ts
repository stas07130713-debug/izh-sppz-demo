/**
 * Описание моста, который основной процесс выдаёт окну программы.
 *
 * Файл только описывает типы. Сама реализация — в src/preload/index.ts.
 */

import type { BackdropCleanup, PlanBackdrop, PlanCalibration, Result } from '@izh/contracts';

export interface OpenedPlanFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface IzhBridge {
  openPlanFile(): Promise<Result<OpenedPlanFile | null>>;
  dataDir(): Promise<Result<string>>;
  store: {
    put(bytes: Uint8Array, extension: string): Promise<Result<string>>;
    get(hash: string): Promise<Result<Uint8Array>>;
    exists(hash: string): Promise<Result<boolean>>;
  };
  backdrops: {
    save(backdrop: PlanBackdrop): Promise<Result<void>>;
    list(): Promise<Result<PlanBackdrop[]>>;
    getById(id: string): Promise<Result<PlanBackdrop>>;
    remove(id: string): Promise<Result<void>>;
    saveCalibration(calibration: PlanCalibration): Promise<Result<void>>;
    getCalibration(id: string): Promise<Result<PlanCalibration | null>>;
    saveCleanup(cleanup: BackdropCleanup): Promise<Result<void>>;
    getCleanup(id: string): Promise<Result<BackdropCleanup | null>>;
    removeCleanup(id: string): Promise<Result<void>>;
  };
}

declare global {
  interface Window {
    readonly izh: IzhBridge;
  }
}
