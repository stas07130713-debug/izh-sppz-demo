/**
 * Карточка объекта СППЗ — второй режим правой панели.
 *
 * Открывается щелчком по значку на плане. Вид оборудования не меняется, но у
 * для объединённых строк в карточке уточняется служебный подтип, от которого
 * зависят модели, правила и сроки.
 *
 * Наверху карточки — состояние по мероприятиям: что и когда положено сделать,
 * что просрочено. Оно вычисляется по пакету правил и ленте выполненных работ, а
 * руками не вводится. Техническое состояние до первой проверки берётся из
 * импорта, а затем вычисляется по последнему заполненному чек-листу.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 7.2 и Дополнение 2, части П6.2–П6.3.
 */

import { useMemo, useState } from 'react';
import type { AppSettings, ControlPanelProfile, JournalExportRequest, MaintenanceEvent, PlanObject, Room, TreeNode } from '@izh/contracts';
import {
  activityCellsForObject,
  elementByCode,
  placementCondition,
  type ActivityCell,
  type ScheduleStatus,
  isMultiUnitType,
  isSystemHead,
  systemOf,
} from '@izh/core';
import { todayIso } from '../today';
import { ObjectDetailsForm, type ObjectFields } from './ObjectDetailsForm';
import { ElementIcon } from './ElementIcon';
import { ProjectDocuments } from './ProjectDocuments';
import { EMPTY_CONTROL_PANEL } from './ControlPanelFields';
import { DueBadge } from './due-badge';
import { SystemCompositionEditor, type CompositionItem } from './SystemCompositionEditor';
import { PlacementUnits, type PlacementUnitFields } from './PlacementUnits';
import { ExtinguisherCardView } from './ExtinguisherCardView';
import { useScheduleSource } from '../schedule-source-context';
export type { ObjectFields };

export interface ObjectCardProps {
  readonly object: PlanObject;
  readonly nodes: readonly TreeNode[];
  readonly rooms: readonly Room[];
  readonly busy: boolean;
  /** Лента мероприятий по всем объектам: из неё считается состояние (часть П6.2). */
  readonly events: readonly MaintenanceEvent[];
  readonly soonThresholdDays: number;
  readonly settings: AppSettings;
  readonly onExportCard: (request: JournalExportRequest) => void;
  readonly onSave: (fields: ObjectFields) => void;
  readonly onArchive: () => void;
  /** Переход «показать в журнале» — тот же переход должен работать и в обратную сторону (ТЗ, часть 7.1). */
  readonly onShowInJournal: () => void;
  readonly onShowOnPlan: () => void;
  /** Три кнопки карточки (часть П6.3). */
  readonly onOpenHistory: () => void;
  readonly onOpenChecklist: (activityCode: string, object: PlanObject) => void;
  /** Все объекты: нужны, чтобы собрать состав системы (Дополнение 6). */
  readonly allObjects: readonly PlanObject[];
  /** Переход к другому элементу: к прибору системы или к её участнику. */
  readonly onOpenSystem: (object: PlanObject) => void;
  readonly onApplyComposition: (items: readonly CompositionItem[]) => void;
  /** Сколько единиц хранится в этом месте (Дополнение 6). */
  readonly onSetPlacementCount: (count: number) => void;
  readonly onSaveUnit: (unit: PlanObject, fields: PlacementUnitFields) => void;
  /** Правка одной только карточки прибора: документы, не трогая остальных полей. */
  readonly onSaveProjectDocuments: (profile: ControlPanelProfile) => void;
  /** Какую единицу комплекта раскрыть сразу: по ней щёлкнули в журнале. */
  readonly focusUnitId: string | null;
}

export function ObjectCard(props: ObjectCardProps): React.JSX.Element {
  // Регламент организации, а где его нет — нормативная библиотека (Дополнение 5, Р19).
  const scheduleSource = useScheduleSource();
  const { object } = props;
  const element = elementByCode(object.typeCode);
  const head = systemOf(props.allObjects, object);
  const [draftFields, setDraftFields] = useState<ObjectFields | null>(null);
  const previewObject: PlanObject = draftFields === null ? object : { ...object, ...draftFields };

  /** Мероприятия объекта со сроками и состоянием — то же, что колонки журнала. */
  const cells = useMemo(
    () => activityCellsForObject(previewObject, props.events, todayIso(), props.soonThresholdDays, scheduleSource),
    [previewObject, props.events, props.soonThresholdDays],
  );

  // Состояние в шапке — то же самое, что показывает значок на плане: и сроки,
  // и исправность, по худшей единице комплекта. Считается в ядре, чтобы
  // карточка и план не расходились (Дополнение 6).
  const condition = placementCondition(
    previewObject, props.allObjects, props.events, todayIso(), props.soonThresholdDays, scheduleSource,
  );

  /**
   * Какое мероприятие открывает кнопка «Чек-лист проверки»: самое срочное.
   * Просроченное важнее приближающегося, приближающееся — важнее спокойного;
   * при равном состоянии берётся то, у которого раньше плановая дата.
   */
  /**
   * Чей чек-лист открывать (ТЗ, Дополнение 6).
   *
   * У элемента системы своего чек-листа нет: систему проверяют целиком, одним
   * заходом и по регламенту прибора, а отметка ложится каждому проверенному
   * элементу. Отдельный чек-лист на извещатель означал бы два разных состава
   * работ на одну и ту же проверку.
   */
  const checklistObject = head ?? previewObject;
  const checklistCells = head === null
    ? cells
    : activityCellsForObject(head, props.events, todayIso(), props.soonThresholdDays, scheduleSource);

  const urgent: ActivityCell | null =
    checklistCells.length === 0
      ? null
      : [...checklistCells].sort((a, b) => {
          const rank = statusRank(a.schedule.status) - statusRank(b.schedule.status);
          if (rank !== 0) return rank;
          return (a.schedule.nextDate ?? '9999-12-31').localeCompare(b.schedule.nextDate ?? '9999-12-31');
        })[0] ?? null;

  return (
    <div className="object-card">
      <div className="object-type" data-condition={condition.color}>
        <ElementIcon typeCode={object.typeCode} size="large" />
        <div>
          <strong>{element?.title ?? object.typeCode}</strong>
          <div className="muted small">
            {object.position === null ? 'не размещён на плане' : 'на плане'}
            {/* Элемент автоматики без указания системы обслуживается сам по
                себе — это стоит видеть сразу, а не выяснять из журнала. */}
            {head !== null && <> · в составе системы <button type="button" className="link" onClick={() => props.onOpenSystem(head)}>{systemLabel(head)}</button></>}
          </div>
        </div>
      </div>

      <section className="card-status">
        <h4>Состояние по мероприятиям</h4>
        {head !== null && (
          <p className="muted small">
            Сроки свои у каждого элемента, а проверка — общая по системе: отметка ложится всем,
            кого закрыли этим заходом.
          </p>
        )}
        {cells.length === 0 ? (
          <p className="muted small">
            Для этого типа пакет правил ещё не заведён, поэтому сроков нет. Мероприятия появятся, как только
            для типа будут указаны периодичность и чек-лист.
          </p>
        ) : (
          <ul className="status-rows">
            {cells.map((cell) => (
              <li key={cell.rule.activityCode}>
                <button
                  type="button"
                  className={`status-row ${statusClass(cell.schedule.status)}`}
                  // У элемента системы проверка идёт по прибору: щелчок по
                  // сроку открывает общий чек-лист, а не заводит свой.
                  onClick={() => props.onOpenChecklist(
                    head === null ? cell.rule.activityCode : (urgent?.rule.activityCode ?? cell.rule.activityCode),
                    checklistObject,
                  )}
                  title={`${cell.rule.title}: ${cell.rule.ndReference}`}
                >
                  <span className="status-dot" />
                  <span className="status-row-title">{cell.rule.title}</span>
                  {/* Срок и его цвет — те же, что в окне проверки: пользователь
                      сверяет их глазами, переходя из карточки в чек-лист. */}
                  <DueBadge schedule={cell.schedule} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Комплект в одном месте: самоспасатели учитываются поштучно, но на
          плане обозначены одной точкой (Дополнение 6). */}
      {isMultiUnitType(object.typeCode) && (object.placementId ?? null) === null && (
        <PlacementUnits
          head={object}
          focusUnitId={props.focusUnitId}
          objects={props.allObjects}
          busy={props.busy}
          onSetCount={props.onSetPlacementCount}
          onSaveUnit={props.onSaveUnit}
        />
      )}

      {isSystemHead(object) && (
        <SystemCompositionEditor
          head={object}
          objects={props.allObjects}
          nodes={props.nodes}
          busy={props.busy}
          onApply={props.onApplyComposition}
          onOpenMember={props.onOpenSystem}
        />
      )}

      <div className="card-buttons">
        <button type="button" onClick={props.onOpenHistory}>
          История
        </button>
        <button
          type="button"
          disabled={urgent === null}
          title={urgent === null
            ? 'Мероприятий по этому типу пока нет'
            : head === null ? urgent.rule.title : `Общий чек-лист системы: ${urgent.rule.title}`}
          onClick={() => {
            if (urgent !== null) props.onOpenChecklist(urgent.rule.activityCode, checklistObject);
          }}
        >
          {head === null ? 'Чек-лист проверки' : 'Чек-лист системы'}
        </button>
        <button type="button" onClick={props.onShowInJournal}>
          Показать в журнале
        </button>
        <button type="button" onClick={props.onShowOnPlan}>
          Показать на плане
        </button>
      </div>

      <ObjectDetailsForm
        object={object}
        nodes={props.nodes}
        allObjects={props.allObjects}
        rooms={props.rooms}
        events={props.events}
        settings={props.settings}
        busy={props.busy}
        onTypeDirtyChange={() => undefined}
        onDraftChange={setDraftFields}
        onTypeSelected={props.onSave}
        onSave={props.onSave}
        beforeNote={isSystemHead(object) ? (
          /* Документация стоит перед примечанием — последним из сведений о
             системе. Хранится у прибора, а не у каждого извещателя: проект
             один на систему, и копия в каждой карточке разошлась бы с
             оригиналом (Дополнение 6). */
          <ProjectDocuments
            value={object.controlPanelProfile?.projectDocuments ?? []}
            busy={props.busy}
            onChange={(projectDocuments) => props.onSaveProjectDocuments({
              ...(object.controlPanelProfile ?? EMPTY_CONTROL_PANEL),
              projectDocuments,
            })}
          />
        ) : null}
      />
      <ExtinguisherCardView object={previewObject} nodes={props.nodes} events={props.events} settings={props.settings} onExport={props.onExportCard} />

      <h4>Действия</h4>
      <button type="button" className="link danger" onClick={props.onArchive} disabled={props.busy}>
        вывести из эксплуатации
      </button>
      <p className="muted small">
        Вывод из эксплуатации убирает объект и с плана, и из работы. Записи журнала о выполненных
        мероприятиях остаются: журнал задним числом не переписывается.
      </p>
      <p className="muted small">
        Чтобы перенести объект в другое здание или на другой этаж, воспользуйтесь переносом:
        на новом месте его нужно будет поставить на план.
      </p>

    </div>
  );
}

function statusClass(status: ScheduleStatus): string {
  if (status === 'норма') return 'status-ok';
  if (status === 'скоро') return 'status-warn';
  if (status === 'просрочено') return 'status-danger';
  return 'status-unknown';
}

/** Чем меньше число, тем срочнее: по этому порядку выбирается мероприятие по умолчанию. */
function statusRank(status: ScheduleStatus): number {
  if (status === 'просрочено') return 0;
  if (status === 'скоро') return 1;
  if (status === 'норма') return 2;
  return 3;
}

/** Как назвать систему в ссылке: номером прибора, а если его нет — видом. */
function systemLabel(head: PlanObject): string {
  return head.regNumber === null || head.regNumber.trim() === ''
    ? (elementByCode(head.typeCode)?.title ?? head.typeCode)
    : `ППКУ № ${head.regNumber}`;
}
