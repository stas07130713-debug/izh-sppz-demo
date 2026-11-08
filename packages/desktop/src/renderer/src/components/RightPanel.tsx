/**
 * Правое поле: библиотека элементов или карточка выбранного объекта.
 *
 * Два режима одной панели, а не две панели: делить правое поле пополам значит
 * сделать неудобными оба. Пока ничего не выбрано на плане — библиотека; щёлкнул
 * значок — карточка этого объекта.
 *
 * Панель сворачивается: после расстановки оборудования место нужнее плану.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 6.5.
 */

import { useEffect, useState } from 'react';
import type { ControlPanelProfile, AppSettings, JournalExportRequest, MaintenanceEvent, PlanObject, Room, TreeNode } from '@izh/contracts';
import { elementByCode, placementCondition, type PlanKind } from '@izh/core';
import { todayIso } from '../today';
import { ElementLibrary } from './ElementLibrary';
import { ObjectCard, type ObjectFields } from './ObjectCard';
import { SystemSummaryPanel } from './SystemSummaryPanel';
import type { CompositionItem } from './SystemCompositionEditor';
import type { PlacementUnitFields } from './PlacementUnits';
import { useScheduleSource } from '../schedule-source-context';
import { presentCondition } from './condition-presentation';

export interface RightPanelProps {
  /** В журнале галочки фильтруют весь журнал узла, на плане — только размещённые точки. */
  readonly filterContext: 'plan' | 'journal';
  readonly planKind: PlanKind;
  readonly nodes: readonly TreeNode[];
  readonly selectedNode: TreeNode | null;
  readonly allObjects: readonly PlanObject[];
  /** Объекты, которые рисует план этого узла. */
  readonly planObjects: readonly PlanObject[];
  readonly libraryReset: number;
  readonly hiddenTypes: ReadonlySet<string>;
  readonly onToggleType: (typeCode: string) => void;
  /** Показать или скрыть сразу все виды раздела. */
  readonly onSetTypesVisible: (typeCodes: readonly string[], visible: boolean) => void;
  readonly selectedObject: PlanObject | null;
  readonly rooms: readonly Room[];
  readonly busy: boolean;
  readonly maintenanceEvents: readonly MaintenanceEvent[];
  readonly soonThresholdDays: number;
  readonly settings: AppSettings;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly onDropObject: (objectId: string) => void;
  readonly onBatchCreate: (typeCode: string) => void;
  readonly onSaveObject: (fields: ObjectFields) => void;
  readonly onArchiveObject: () => void;
  readonly onCloseCard: () => void;
  readonly onShowInJournal: () => void;
  readonly onShowOnPlan: () => void;
  readonly onOpenHistory: () => void;
  readonly onOpenChecklist: (activityCode: string, object: PlanObject) => void;
  /** Переход к другому элементу: к прибору системы или к её участнику. */
  readonly onOpenSystem: (object: PlanObject) => void;
  readonly onApplyComposition: (items: readonly CompositionItem[]) => void;
  readonly onSetPlacementCount: (count: number) => void;
  readonly onSaveUnit: (unit: PlanObject, fields: PlacementUnitFields) => void;
  readonly onSaveProjectDocuments: (profile: ControlPanelProfile) => void;
  readonly focusUnitId: string | null;
  readonly onExportCard: (request: JournalExportRequest) => void;
  readonly onOpenType: (typeCode: string) => void;
}

export function RightPanel(props: RightPanelProps): React.JSX.Element {
  // Регламент организации, а где его нет — нормативная библиотека (Дополнение 5, Р19).
  const scheduleSource = useScheduleSource();
  const [libraryMode, setLibraryMode] = useState(false);
  useEffect(() => { setLibraryMode(false); }, [props.libraryReset]);
  if (props.collapsed) {
    return (
      <aside className="inspector collapsed">
        <button type="button" className="panel-expand" onClick={props.onToggle} title="Открыть библиотеку элементов">
          <span aria-hidden="true">‹</span>
          <span>Элементы</span>
        </button>
      </aside>
    );
  }

  const object = props.selectedObject;
  const element = object === null ? null : elementByCode(object.typeCode);
  // То же состояние, что показывает значок на плане: сроки и исправность по
  // худшей единице комплекта. Считается в ядре — иначе шапка панели и план
  // расходятся, и непонятно, какому месту верить (Дополнение 6).
  const condition = object === null
    ? null
    : placementCondition(object, props.allObjects, props.maintenanceEvents, todayIso(), props.soonThresholdDays, scheduleSource);
  const presentedCondition = condition === null ? null : presentCondition(condition);
  return (
    <aside className="inspector">
      <div className="panel-head">
        {object === null ? (
          <h3>{libraryMode ? 'Библиотека элементов' : 'Системы объекта'}</h3>
        ) : (
          <div className="panel-head-object">
            <span className="panel-head-title">
              {element?.title ?? object.typeCode}
              {object.regNumber !== null && ` № ${object.regNumber}`}
            </span>
            {presentedCondition !== null && (
              <span className={`status-pill status-${presentedCondition.color}`}>
                <span className="status-dot" />
                {presentedCondition.label}
              </span>
            )}
          </div>
        )}
        <div className="panel-head-actions">
          <button type="button" className="panel-action-button" onClick={() => { if (object !== null) props.onCloseCard(); setLibraryMode(false); }} title="Сводка систем текущего объекта">Системы</button>
          <button type="button" className="panel-action-button" onClick={() => { if (object !== null) props.onCloseCard(); setLibraryMode(true); }} title="Библиотека элементов">Библиотека</button>
          <button type="button" className="panel-icon-button" onClick={props.onToggle} title="Свернуть правую панель" aria-label="Свернуть правую панель">
            ›
          </button>
        </div>
      </div>

      {props.selectedObject === null && libraryMode ? (
        <ElementLibrary planKind={props.planKind} onDropObject={props.onDropObject} onBatchCreate={props.onBatchCreate} />
      ) : props.selectedObject === null ? (
        <SystemSummaryPanel
          context={props.filterContext}
          node={props.selectedNode}
          nodes={props.nodes}
          objects={props.allObjects}
          planObjects={props.planObjects}
          onOpenType={props.onOpenType}
          hiddenTypes={props.hiddenTypes}
          onToggleType={props.onToggleType}
          onSetTypesVisible={props.onSetTypesVisible}
        />
      ) : (
        <ObjectCard
          key={props.selectedObject.id}
          object={props.selectedObject}
          nodes={props.nodes}
          rooms={props.rooms}
          busy={props.busy}
          events={props.maintenanceEvents}
          soonThresholdDays={props.soonThresholdDays}
          settings={props.settings}
          onExportCard={props.onExportCard}
          onSave={props.onSaveObject}
          onArchive={props.onArchiveObject}
          onShowInJournal={props.onShowInJournal}
          onShowOnPlan={props.onShowOnPlan}
          onOpenHistory={props.onOpenHistory}
          onOpenChecklist={props.onOpenChecklist}
          allObjects={props.allObjects}
          onOpenSystem={props.onOpenSystem}
          onApplyComposition={props.onApplyComposition}
          onSetPlacementCount={props.onSetPlacementCount}
          onSaveUnit={props.onSaveUnit}
          onSaveProjectDocuments={props.onSaveProjectDocuments}
          focusUnitId={props.focusUnitId}
        />
      )}
    </aside>
  );
}

/** Цвет плашки по состоянию сроков. Тот же набор цветов, что у значка на плане. */
