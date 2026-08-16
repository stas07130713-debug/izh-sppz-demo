/**
 * Имена каналов связи между окном и основным процессом.
 *
 * Перечислены в одном месте, чтобы обе стороны не могли разойтись из-за
 * опечатки в строке.
 */

export const CHANNELS = {
  openPlanFile: 'file:open-plan',
  dataDir: 'app:data-dir',

  storePut: 'store:put',
  storeGet: 'store:get',
  storeExists: 'store:exists',

  backdropSave: 'backdrop:save',
  backdropList: 'backdrop:list',
  backdropGetById: 'backdrop:get-by-id',
  backdropRemove: 'backdrop:remove',
  calibrationSave: 'calibration:save',
  calibrationGet: 'calibration:get',
} as const;
