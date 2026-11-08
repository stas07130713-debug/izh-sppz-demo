export type { BackdropDeps } from './backdrop-deps.js';
export {
  createBackdropFromImage,
  createBackdropFromPdf,
  createBackdropFromSource,
  type CreateBackdropFromImageInput,
  type CreateBackdropFromPdfInput,
  type CreateBackdropFromSourceInput,
} from './create-backdrop.js';
export {
  calibrateByBuildingExtents,
  calibrateByDrawingScale,
  calibrateByTwoPoints,
  type CalibrateByBuildingExtentsInput,
  type CalibrateByDrawingScaleInput,
  type CalibrateByTwoPointsInput,
} from './calibrate-backdrop.js';
export {
  applyBackdropCleanup,
  resetBackdropCleanup,
  type ApplyBackdropCleanupInput,
} from './cleanup-backdrop.js';

// Дерево объекта: структура предприятия, к которой привязано всё остальное.
export type { TreeDeps } from './object-tree/tree-deps.js';
export {
  NODE_KIND_RULES,
  allowedChildKinds,
  canContain,
  hasWorkArea,
  ruleFor,
  type NodeKindRule,
  type PlanKind,
} from './object-tree/tree-rules.js';
export {
  BUILDING_PROFILE_FIELDS,
  EMPTY_BUILDING_PROFILE,
  missingProfileFields,
  type ProfileField,
  type ProfileFieldKind,
} from './object-tree/building-profile.js';
export {
  buildForest,
  childrenOf,
  descendantsOf,
  filterForest,
  formatElevation,
  isDescendantOf,
  nodeTitle,
  pathToNode,
  planCaption,
  type BuildForestOptions,
  type TreeNodeView,
} from './object-tree/tree-shape.js';
export { branchOf, branchRoot, type BranchStep } from './object-tree/tree-branch.js';
export {
  DASHBOARD_BLOCKS,
  RECOMMENDED_DASHBOARD_BLOCKS,
  dashboardBlock,
  normalizeDashboardBlocks,
  type DashboardBlock,
  type DashboardBlockKind,
} from './dashboard/dashboard-blocks.js';
export {
  dashboardScope,
  dashboardSummary,
  type BrokenItem,
  type DashboardSummary,
  type DashboardSummaryInput,
  type OverdueWork,
  type PlaceTally,
  type SystemTally,
  type TypeTally,
  type UpcomingItem,
  type UpcomingWork,
} from './rules/dashboard-summary.js';
export type { DashboardTrendInput, TrendPoint } from './rules/dashboard-trend.js';
export { dashboardTrend } from './rules/dashboard-trend.js';
export {
  DEFAULT_REQUEST_COLUMNS,
  DEFAULT_REQUEST_FOOTER,
  OWN_COLUMN_SOURCE,
  REQUEST_COLUMN_SOURCES,
  requestColumnSource,
  type RequestColumnSource,
} from './requests/request-columns.js';
export { systemCondition, type SystemCondition } from './rules/system-condition.js';
export {
  FILTER_TAG_LABELS,
  FILTER_TAG_ORDER,
  conditionFilterTags,
  matchesFilterTags,
  type FilterTag,
} from './rules/filter-tags.js';
export {
  createChildNode,
  createOrganization,
  type CreateChildNodeInput,
  type CreateOrganizationInput,
} from './object-tree/create-node.js';
export {
  reorderNode,
  reorderNodeAround,
  setInCommonJournal,
  setObjectsPinned,
  updateNode,
  type ReorderNodeAroundInput,
  type ReorderNodeInput,
  type SetInCommonJournalInput,
  type SetObjectsPinnedInput,
  type UpdateNodeInput,
} from './object-tree/update-node.js';
export { moveNode, type MoveNodeInput } from './object-tree/move-node.js';
export {
  FUNCTIONAL_CLASSES, FUNCTIONAL_CLASS_TITLES, functionalClassLabel,
} from './object-tree/functional-classes.js';

// Объекты СППЗ: каталог элементов, размещение на плане, карточка.
export type { ObjectDeps } from './objects/object-deps.js';
export {
  ELEMENT_CATALOG,
  configurableFamily,
  isExtinguisherType,
  type ElementType,
} from './objects/element-catalog.js';
export {
  elementByCode,
  elementTitle,
  elementsFor,
  replaceableFor,
} from './objects/element-lookup.js';
export {
  CUSTOM_TYPE_PREFIX,
  activeCustomElementTypes,
  customElementByCode,
  customElementTypes,
  isCustomTypeCode,
  planKindsOf,
  resetCustomElementTypes,
  setCustomElementTypes,
} from './objects/custom-element-registry.js';
export {
  elementTitleOverride,
  elementTitleOverrides,
  resetElementTitleOverrides,
  setElementTitleOverrides,
} from './objects/element-title-registry.js';
export { incompleteCards, missingCardFields } from './objects/card-completeness.js';
export {
  countInStorage, countNeedingPlacement, inStorage, needsPlacement, storageNodeIds,
} from './objects/storage-placement.js';
export { signedJournalContent, signedObjectContent } from './access/signed-content.js';
export { journalSearchText, matchesSearch, type JournalSearchParts } from './rules/journal-search.js';
export {
  AUDIT_KEEP_DAYS, auditCutoff, readAudit, recordAudit, type AuditDeps, type RecordAuditInput,
} from './access/audit-log.js';
export {
  buildCustomElement,
  customElementUsage,
  removeCustomElement,
  setCustomElementArchived,
  upsertCustomElement,
  type CustomElementDraft,
  type CustomElementRemoval,
  type CustomElementUsage,
  type SaveCustomElementInput,
} from './objects/custom-element-rules.js';
export {
  customElementRegulation,
  latestVersion,
  periodicityFromInput,
  saveCustomElementChecks,
  type NewPeriodicityInput,
  type SaveCustomChecksInput,
} from './objects/custom-element-checks.js';
export {
  ELEMENT_GROUP_ORDER,
  groupOf,
  groupOfType,
  type ElementGroup,
} from './objects/element-groups.js';
export {
  librarySections,
  type LibraryGroup,
  type LibrarySection,
} from './objects/library-sections.js';
export {
  ELEMENT_FAMILIES, FIRE_DETECTOR_TYPES,
  familyOf,
  isFamilyMember,
  isFamilyParent,
  type ElementFamily,
} from './objects/element-families.js';
export { modelsFor, type ModelOption } from './objects/model-catalog.js';
// Система пожарной автоматики: ППКУ и входящее в него оборудование (Дополнение 6).
export {
  SYSTEM_HEAD_TYPE,
  SYSTEM_MEMBER_TYPES,
  canJoinSystem,
  isSystemHead,
  systemComposition,
  systemFloors,
  systemMembers,
  systemOf,
} from './objects/fire-system.js';
export {
  setSystemComposition,
  type SetSystemCompositionInput,
  type SystemCompositionItem,
  type SystemCompositionResult,
} from './objects/system-composition-scenarios.js';
export {
  extinguisherManufacturerName,
  extinguisherManufacturers,
  extinguisherManufacturersForType,
  extinguisherModelsForManufacturer,
  extinguisherReferenceByManufacturerAndModel,
  extinguisherReferenceModelsForType,
  serviceLifeEndsOn,
  serviceLifeYearsOf,
  type ExtinguisherManufacturerOption,
  type ExtinguisherReferenceModel,
} from './objects/extinguisher-reference.js';
export {
  archiveObject,
  moveObject,
  placeObject,
  relocateObject,
  setStorageSection,
  swapObjects,
  updateObject,
  type MoveObjectInput,
  type PlaceObjectInput,
  type RelocateObjectInput,
  type UpdateObjectInput,
} from './objects/object-scenarios.js';
export type { UnplaceNodeObjectsInput } from './objects/unplace-node-objects.js';
export { unplaceNodeObjects } from './objects/unplace-node-objects.js';
export {
  distributeAlongOutline,
  duplicateRegNumbers,
  generateRegNumbers,
  type NumberingScheme,
} from './objects/batch-placement.js';

// Журнал: область видимости объектов по узлу дерева (Дополнение 1, часть Д6).
export { journalScope } from './objects/journal-scope.js';
export { checkGroupFor, checkGroupTitle } from './objects/check-group.js';
export { responsibleFor } from './objects/responsible.js';
// Места хранения комплектов: самоспасатели учитываются поштучно (Дополнение 6).
export {
  MULTI_UNIT_TYPES,
  isMultiUnitType,
  isPlacementHead,
  isPlacementUnit,
  placeableObjects,
  worstOfPlacement,
  placementContents,
  placementCount,
  placementOf,
  placementUnits,
} from './objects/placement.js';
export {
  setPlacementCount,
  type PlacementResult,
  type SetPlacementCountInput,
} from './objects/placement-scenarios.js';

// Пакет правил и расчёт регламентных сроков (Дополнение 1, части Д6, Д11).
export {
  RULE_PACKAGE,
  activitiesFor,
  activitiesForObject,
  activityRule,
  alwaysApplicable,
  type ActivityChecklistItem,
  type ActivityRule,
} from './rules/rule-package.js';
export {
  npaRequirementsFor,
  EXTINGUISHER_TYPES,
  SPZ_SYSTEM_TYPES,
} from './rules/npa-requirements.js';
export {
  addMonthsIso,
  computeSchedule,
  daysBetweenIso,
  statusForDue,
  type ComputeScheduleInput,
  type ScheduleResult,
  type ScheduleStatus,
  type StatusForDueInput,
} from './rules/schedule.js';
export { activityCellsForObject, technicalStateForObject, worstObjectStatus, worstPlacementStatus, type ActivityCell } from './rules/activity-status.js';
export { PERIODICITY_OPTIONS } from './rules/periodicity-options.js';
export { maintenanceDocuments, type MaintenanceDocument } from './rules/maintenance-documents.js';
export {
  FIREPROOFED_STRUCTURES, FIREPROOFING_KINDS, FIREPROOFING_REQUIREMENTS,
} from './objects/fireproofing-reference.js';
export {
  ROOF_KINDS, PRESENCE, requiredFenceHeight,
  FIRE_BOARD_INVENTORY, SAND_BOX_VOLUMES, WATER_BARREL_VOLUMES,
  PUMP_STATION_PURPOSES, PUMP_CONTROL_MODES,
} from './objects/outdoor-equipment-reference.js';
export {
  LADDER_TYPES, LADDER_SUBTYPES, LADDER_PLACES, LADDER_PRESENCE, ladderSubtypesFor,
} from './objects/ladder-reference.js';
export {
  WATER_SOURCE_EXECUTIONS, WATER_SOURCE_PLACEMENTS, WATER_SOURCE_PAD,
  WATER_INTAKE_METHODS, WATER_SOURCE_VEHICLE_COUNTS,
  waterSourceNumberSign, waterSourceVolumeSign, waterSourceTotalVolume,
} from './objects/water-source-reference.js';
export {
  HYDRANT_PLACEMENT_KINDS, HYDRANT_PATTERNS, WATER_NETWORK_KINDS,
  NETWORK_DIAMETERS_MM, HYDRANT_HEIGHTS_MM,
  hydrantPatternSign, waterNetworkSign, formatSignDistance,
  type HydrantPattern, type WaterNetworkKind,
} from './objects/hydrant-reference.js';
export {
  AUTOMATION_MANUFACTURERS, BATTERY_KINDS, BACKUP_POWER_SOURCES, BATTERY_SOURCES, OTHER_CONTROL_PANEL,
  automationModels, isKnownAutomationManufacturer,
  type AutomationManufacturer,
} from './objects/automation-reference.js';
export {
  propagateSystemDefaults, systemDefaultsOf, inheritsFromSystem, INHERITING_SYSTEM_TYPES,
  type SystemDefaults,
} from './objects/system-inheritance.js';
export { placementCondition, objectCondition, conditionColor, technicalEscalation, type ObjectCondition, type ConditionColor } from './rules/object-condition.js';
export { rulePackageSource, type ActivityScheduleSource } from './rules/activity-source.js';
export {
  defaultPeriodicities,
  periodicityTitle,
  defaultRegulation,
  type DefaultRegulationInput,
} from './rules/rule-package-bridge.js';
export type { MaintenanceDeps } from './rules/maintenance-deps.js';
export {
  recordMaintenance,
  recordMaintenanceBatch, recordMaintenanceBatchSigned, type BatchSigner,
  type RecordMaintenanceInput,
} from './rules/maintenance-scenarios.js';

// Перенос существующих журналов из Excel (Дополнение 1, части Д12–Д13).
export {
  detectExtinguisherType,
  looksLikePlaceholder,
  normalizeModel,
  parseExcelDate,
  parseTechnicalState,
  type ParsedDate,
} from './import/excel-values.js';
export {
  detectHeaderRow,
  hasAmbiguity,
  matchColumn,
  matchColumns,
  type ColumnMatch,
  type MatchConfidence,
  type TargetField,
} from './import/column-mapping.js';
export {
  buildImportPreview,
  type BuildPreviewInput,
  type ImportPreview,
  type PreviewRow,
  type RowVerdict,
} from './import/import-preview.js';
export { datesToActivities, type ImportedActivity } from './import/date-to-activity.js';

// Настройки: порог «скоро» (Дополнение 1, часть Д11).
export type { SettingsDeps } from './settings/settings-deps.js';
export { updateSoonThreshold } from './settings/settings-scenarios.js';

// Помещения этажа: категория, обводка на плане, площадь по обводке.
// Проверка расстановки огнетушителей (ППР РФ № 1479, приложения № 1 и 2).
export type { FireClass, FireRank } from './extinguishers/fire-rank.js';
export {
  EMPTY_RANK, FIRE_CLASSES, formatFireRank, isEmptyRank, mergeFireRanks,
  parseFireRank, rankSatisfies, rankShortfall,
} from './extinguishers/fire-rank.js';
export type {
  AgentMinimum, HazardRow, MobileNorm, MobileOption, PortableMassNorm, PortableNorm, RoomPurpose,
} from './extinguishers/ppr-tables.js';
export {
  CATEGORY_D_EXEMPT_AREA_M2, MIN_PER_LEVEL, REACH_BY_CATEGORY, REACH_PUBLIC_M, ROOM_PURPOSES,
  TABLE_1, TABLE_2, TABLE_3, hazardRowOf, massNorm, mobileNorm, normalizeCategory, portableNorm,
  purposeOfFunctionalClasses,
} from './extinguishers/ppr-tables.js';
export type { MissingFact, MobileRequirement, RoomHazard, RoomRequirement } from './extinguishers/room-requirement.js';
export type { BuildingHazard } from './extinguishers/building-hazard.js';
export { roomRequirement } from './extinguishers/room-requirement.js';
export {
  countBySystemKind,
  systemKindOf,
  systemKindTitle,
} from './objects/system-kind.js';
export { acceptLegal, type AcceptLegalInput } from './access/legal-scenarios.js';
export {
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  needsLegalAcceptance,
  type LegalDocument,
} from './legal/legal-documents.js';
export { filledRowCount, isFilledRow } from './import/filled-rows.js';
export { guessTypeFromSheetName, type SheetTypeGuess } from './import/sheet-type-guess.js';
export { derivedRank } from './extinguishers/derived-rank.js';
export {
  agentOfType,
  agentFromModel,
  chargeFromModel,
  impliedProfileFields,
} from './extinguishers/implied-profile.js';
export type { RoomCoverage } from './extinguishers/coverage.js';
export { coverRoom, pointInPolygon, sampleRoom } from './extinguishers/coverage.js';
export type { ExtinguisherFitness, FitnessVerdict } from './extinguishers/extinguisher-fitness.js';
export {
  cardRank, extinguisherFitness, extinguisherMark, markWithCharge, rankOfExtinguisher,
} from './extinguishers/extinguisher-fitness.js';
export type {
  FindingSeverity, PlacementCheckInput, PlacementFinding, PlacementFix, PlacementReport, RoomPlacement, RoomVerdict,
} from './extinguishers/placement-check.js';
export { checkExtinguisherPlacement } from './extinguishers/placement-check.js';
export { ROOM_KINDS, roomKindById, type RoomKind } from './extinguishers/room-kinds.js';

export type { RoomDeps } from './rooms/room-deps.js';
export { polygonAreaM2, polygonAreaPx } from './rooms/room-area.js';
export { ROOM_CATEGORIES, categoryColor, isHighHazard } from './rooms/room-categories.js';
export {
  archiveRoom,
  clearRoomOutline,
  createRoom,
  setRoomOutline,
  updateRoom,
  type CreateRoomInput,
  type SetRoomOutlineInput,
  type UpdateRoomInput,
} from './rooms/room-scenarios.js';
export { archiveNode, restoreNode, type ArchiveNodeInput } from './object-tree/archive-node.js';
export {
  archiveHierarchy,
  archiveRoomHierarchy,
  type ArchiveHierarchyInput,
  type ArchiveHierarchyResult,
  type ArchiveRoomHierarchyResult,
  type HierarchyArchiveDeps,
} from './object-tree/archive-hierarchy.js';

// Логические ограничения данных (Дополнение 7): запреты и предупреждения.
export {
  blocking,
  forbid,
  warn,
  warnings,
  type Problem,
  type ProblemSeverity,
} from './validation/problem.js';
export {
  objectProblems,
  type ObjectConstraintContext,
} from './validation/object-constraints.js';
export {
  maintenanceProblems,
  type MaintenanceConstraintContext,
  type MaintenanceConstraintInput,
} from './validation/maintenance-constraints.js';
export {
  documentReferenceProblems,
  localDocumentProblems,
  periodicityProblems,
} from './validation/regulation-constraints.js';

// Регламенты ТО: конструктор организации поверх нормативной библиотеки (Дополнение 5).
export type { RegulationDeps } from './regulations/regulation-deps.js';
export {
  archiveRegulation,
  createRegulation,
  releaseRegulationVersion,
  saveRegulationTemplate,
  type CreateRegulationInput,
  type ReleaseVersionInput,
  type SaveTemplateInput,
} from './regulations/regulation-scenarios.js';
export {
  documentActiveOn,
  saveLocalDocument,
  type SaveLocalDocumentInput,
} from './regulations/local-document-scenarios.js';

// Разграничение доступа, роли и простая электронная подпись (Дополнение 7).
export type { AccessDeps } from './access/access-deps.js';
export { can, canOnNode, canReachNode, reachableNodeIds, visibleNodes } from './access/permissions.js';
export { fieldSnapshot, type FieldSnapshot, type SnapshotInput } from './field/field-snapshot.js';
export { MIN_PASSWORD_LENGTH, SIGN_IN_REFUSED, checkPasswordStrength } from './access/password-policy.js';
export type { CreateUserInput, SignInInput, UpdateOwnProfileInput, UpdateUserInput } from './access/user-scenarios.js';
export type { ChangePasswordInput, ResetPasswordInput } from './access/password-scenarios.js';
export {
  deleteUser,
  userDeletionCheck, createUser, hasAnyUser, setUserArchived, signIn, updateOwnProfile, updateUser } from './access/user-scenarios.js';
export { changePassword, resetPassword } from './access/password-scenarios.js';
export type { SignInput } from './access/simple-signature.js';
export { checkSignature, formatSignature, signSimple } from './access/simple-signature.js';
export type { Signer } from './access/signer.js';
export type { ChangeLogDeps, ReadChangeLogInput, RecordChangeInput } from './access/change-log.js';
export { changedField, readChangeLog, recordChange, recordChanges } from './access/change-log.js';
export { describeChange, type DescribedChange } from './access/change-description.js';
export { userActivity, type ActivityLine, type ActivityLink, type ActivitySource } from './access/user-activity.js';
export {
  SIGNED_RECORD_LOCKED, canReplaceEvent, signedEventsOfObject, signatureWithdrawalWarning, withoutSignature, replacementVerdict, type ReplacementVerdict,
} from './access/signed-immutability.js';
