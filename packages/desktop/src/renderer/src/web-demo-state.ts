import type {
  AppSettings, AuditEvent, BackdropCleanup, ChangeLogEntry, LocalDocument,
  MaintenanceEvent, PlanBackdrop, PlanCalibration, PlanObject, Regulation,
  RegulationTemplate, RegulationVersion, Room, TreeNode, UserAccount,
} from '@izh/contracts';

export interface WebDemoSnapshot {
  readonly exportedAt: string;
  readonly defaultUserId: string | null;
  readonly tree: readonly TreeNode[];
  readonly rooms: readonly Room[];
  readonly objects: readonly PlanObject[];
  readonly maintenance: readonly MaintenanceEvent[];
  readonly users: readonly UserAccount[];
  readonly audit: readonly AuditEvent[];
  readonly changeLog: readonly ChangeLogEntry[];
  readonly settings: AppSettings;
  readonly regulations: readonly Regulation[];
  readonly regulationVersions: readonly RegulationVersion[];
  readonly regulationDocuments: readonly LocalDocument[];
  readonly regulationTemplates: readonly RegulationTemplate[];
  readonly backdrops: readonly PlanBackdrop[];
  readonly calibrations: Readonly<Record<string, PlanCalibration>>;
  readonly cleanups: Readonly<Record<string, BackdropCleanup>>;
  /** Отпечаток содержимого → имя файла относительно папки demo. */
  readonly files: Readonly<Record<string, string>>;
}

export interface MutableWebDemoState {
  exportedAt: string;
  defaultUserId: string | null;
  tree: TreeNode[];
  rooms: Room[];
  objects: PlanObject[];
  maintenance: MaintenanceEvent[];
  users: UserAccount[];
  audit: AuditEvent[];
  changeLog: ChangeLogEntry[];
  settings: AppSettings;
  regulations: Regulation[];
  regulationVersions: RegulationVersion[];
  regulationDocuments: LocalDocument[];
  regulationTemplates: RegulationTemplate[];
  backdrops: PlanBackdrop[];
  calibrations: Record<string, PlanCalibration>;
  cleanups: Record<string, BackdropCleanup>;
  files: Record<string, string>;
}

export function mutableSnapshot(value: WebDemoSnapshot): MutableWebDemoState {
  return JSON.parse(JSON.stringify(value)) as MutableWebDemoState;
}
