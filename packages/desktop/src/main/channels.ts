/**
 * Имена каналов связи между окном и основным процессом.
 *
 * Перечислены в одном месте, чтобы обе стороны не могли разойтись из-за
 * опечатки в строке.
 */

export const CHANNELS = {
  openPlanFile: 'file:open-plan',
  openJournalFile: 'file:open-journal',
  /** Открыть ссылку в браузере системы: внутри программы внешним страницам не место. */
  openExternal: 'shell:open-external',
  openMaintenanceDocument: 'file:open-maintenance-document',
  exportJournal: 'file:export-journal',
  openStoredDocument: 'file:open-stored-document',
  saveStoredDocument: 'file:save-stored-document',
  dataDir: 'app:data-dir',
  historyState: 'history:state',
  historyBegin: 'history:begin',
  historyCommit: 'history:commit',
  historyCancel: 'history:cancel',
  historyUndo: 'history:undo',
  historyRedo: 'history:redo',

  storePut: 'store:put',
  storeGet: 'store:get',
  storeExists: 'store:exists',

  backdropSave: 'backdrop:save',
  backdropList: 'backdrop:list',
  backdropGetById: 'backdrop:get-by-id',
  backdropRemove: 'backdrop:remove',
  calibrationSave: 'calibration:save',
  calibrationGet: 'calibration:get',
  cleanupSave: 'cleanup:save',
  cleanupGet: 'cleanup:get',
  cleanupRemove: 'cleanup:remove',

  objectList: 'object:list',
  objectListByNode: 'object:list-by-node',
  objectGetById: 'object:get-by-id',
  objectSave: 'object:save',
  objectSaveMany: 'object:save-many',

  settingsGet: 'settings:get',
  settingsSave: 'settings:save',

  maintenanceList: 'maintenance:list',
  maintenanceListByObject: 'maintenance:list-by-object',
  maintenanceSave: 'maintenance:save',
  maintenanceSaveMany: 'maintenance:save-many',

  regulationList: 'regulation:list',
  regulationListVersions: 'regulation:list-versions',
  regulationListDocuments: 'regulation:list-documents',
  regulationListTemplates: 'regulation:list-templates',
  regulationSave: 'regulation:save',
  regulationSaveVersions: 'regulation:save-versions',
  regulationSaveDocument: 'regulation:save-document',
  regulationSaveTemplate: 'regulation:save-template',
  usersList: 'users:list',
  usersRemove: 'users:remove',

  /* Журнал вносимых изменений: кто и какое поле изменил. Не стареет. */
  changeLogList: 'change-log:list',
  changeLogAppend: 'change-log:append',
  changeLogAppendMany: 'change-log:append-many',

  /* Журнал действий пользователей: служебный след за тридцать дней. */
  auditList: 'audit:list',
  auditAppend: 'audit:append',
  auditPrune: 'audit:prune',
  usersResetAll: 'users:reset-all',
  usersFindByLogin: 'users:find-by-login',
  usersGetById: 'users:get-by-id',
  usersSave: 'users:save',
  sessionRemember: 'session:remember',
  sessionRestore: 'session:restore',
  sessionForget: 'session:forget',
  windowSetTheme: 'window:set-theme',
  windowFocusContent: 'window:focus-content',
  passwordHash: 'password:hash',
  passwordVerify: 'password:verify',

  /* Ключи простой электронной подписи (63-ФЗ, вариант с ключом у подписывающего). */
  signingKeyCreate: 'signing-key:create',
  signingKeyRekey: 'signing-key:rekey',
  signingKeySign: 'signing-key:sign',
  signingKeyVerify: 'signing-key:verify',
  contentSha256: 'content:sha256',
  roomList: 'room:list',
  roomListByLevel: 'room:list-by-level',
  roomGetById: 'room:get-by-id',
  roomSave: 'room:save',

  treeList: 'tree:list',
  treeGetById: 'tree:get-by-id',
  treeSave: 'tree:save',

} as const;
