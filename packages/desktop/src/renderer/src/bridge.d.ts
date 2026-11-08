/**
 * Описание моста, который основной процесс выдаёт окну программы.
 *
 * Файл только описывает типы. Сама реализация — в src/preload/index.ts.
 */

import type {
  AppSettings,
  AuditEvent,
  ChangeLogEntry,
  ChangeLogFilter,
  BackdropCleanup,
  HistoryActionHandle,
  HistoryCommit, HistoryState,
  MaintenanceEvent,
  PasswordDigest,
  UserAccount,
  JournalExportRequest,
  JournalExportResult,
  LocalDocument,
  PlanBackdrop,
  PlanCalibration,
  PlanObject,
  KeySignature,
  Regulation,
  RegulationTemplate,
  RegulationVersion,
  Result,
  Room,
  SigningKey,
  TreeNode,
} from '@izh/contracts';

export interface OpenedPlanFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface IzhBridge {
  openPlanFile(): Promise<Result<OpenedPlanFile | null>>;
  /** Файл существующего учётного журнала предприятия: xlsx. */
  openJournalFile(): Promise<Result<OpenedPlanFile | null>>;
  /** Открыть ссылку в браузере системы. */
  openExternal(url: string): Promise<Result<void>>;
  /** Паспорт, акт или протокол проверки огнетушителя. */
  openMaintenanceDocument(): Promise<Result<OpenedPlanFile | null>>;
  exportJournal(request: JournalExportRequest): Promise<Result<JournalExportResult>>;
  openStoredDocument(hash: string): Promise<Result<void>>;
  saveStoredDocument(hash: string, fileName: string): Promise<Result<JournalExportResult>>;
  dataDir(): Promise<Result<string>>;
  history: {
    state(): Promise<Result<HistoryState>>;
    begin(label: string): Promise<Result<HistoryActionHandle>>;
    commit(): Promise<Result<HistoryCommit>>;
    cancel(): Promise<Result<HistoryCommit>>;
    undo(): Promise<Result<HistoryCommit>>;
    redo(): Promise<Result<HistoryCommit>>;
  };
  store: {
    put(bytes: Uint8Array, extension: string): Promise<Result<string>>;
    get(hash: string): Promise<Result<Uint8Array>>;
    exists(hash: string): Promise<Result<boolean>>;
  };
  objects: {
    list(): Promise<Result<PlanObject[]>>;
    listByNode(nodeId: string): Promise<Result<PlanObject[]>>;
    getById(id: string): Promise<Result<PlanObject>>;
    save(object: PlanObject): Promise<Result<void>>;
    saveMany(objects: readonly PlanObject[]): Promise<Result<void>>;
  };
  settings: {
    get(): Promise<Result<AppSettings>>;
    save(settings: AppSettings): Promise<Result<void>>;
  };
  maintenance: {
    list(): Promise<Result<MaintenanceEvent[]>>;
    listByObject(objectId: string): Promise<Result<MaintenanceEvent[]>>;
    save(event: MaintenanceEvent): Promise<Result<void>>;
    saveMany(events: readonly MaintenanceEvent[]): Promise<Result<void>>;
  };
  regulations: {
    list(): Promise<Result<Regulation[]>>;
    listVersions(): Promise<Result<RegulationVersion[]>>;
    listDocuments(): Promise<Result<LocalDocument[]>>;
    listTemplates(): Promise<Result<RegulationTemplate[]>>;
    save(value: Regulation): Promise<Result<void>>;
    saveVersions(values: readonly RegulationVersion[]): Promise<Result<void>>;
    saveDocument(value: LocalDocument): Promise<Result<void>>;
    saveTemplate(value: RegulationTemplate): Promise<Result<void>>;
  };
  changeLog: {
    list(filter?: ChangeLogFilter): Promise<Result<readonly ChangeLogEntry[]>>;
    append(entry: ChangeLogEntry): Promise<Result<void>>;
    appendMany(entries: readonly ChangeLogEntry[]): Promise<Result<void>>;
  };
  audit: {
    list(): Promise<Result<AuditEvent[]>>;
    append(entry: AuditEvent): Promise<Result<void>>;
    prune(olderThan: string): Promise<Result<number>>;
  };
  users: {
    list(): Promise<Result<UserAccount[]>>;
    resetAll(): Promise<Result<void>>;
    getById(id: string): Promise<Result<UserAccount>>;
    findByLogin(login: string): Promise<Result<UserAccount | null>>;
    save(user: UserAccount): Promise<Result<void>>;
    remove(id: string): Promise<Result<void>>;
  };
  session: {
    remember(userId: string): Promise<Result<void>>;
    restore(): Promise<Result<UserAccount | null>>;
    forget(): Promise<Result<void>>;
  };
  window: {
    setTheme(theme: 'dark' | 'light'): Promise<Result<void>>;
    focusContent(): Promise<Result<void>>;
  };
  signingKeys: {
    create(password: string, generation: number): Promise<Result<SigningKey>>;
    rekey(key: SigningKey, oldPassword: string, newPassword: string, generation: number): Promise<Result<SigningKey>>;
    sign(key: SigningKey, password: string, contentHash: string): Promise<Result<KeySignature>>;
    verify(signature: KeySignature, contentHash: string): Promise<Result<boolean>>;
  };
  password: {
    hash(password: string): Promise<Result<PasswordDigest>>;
    verify(password: string, digest: PasswordDigest): Promise<Result<boolean>>;
    sha256Hex(text: string): Promise<Result<string>>;
  };
  rooms: {
    list(): Promise<Result<Room[]>>;
    listByLevel(levelId: string): Promise<Result<Room[]>>;
    getById(id: string): Promise<Result<Room>>;
    save(room: Room): Promise<Result<void>>;
  };
  tree: {
    list(): Promise<Result<TreeNode[]>>;
    getById(id: string): Promise<Result<TreeNode>>;
    save(node: TreeNode): Promise<Result<void>>;
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
