/**
 * Центр главного экрана: рабочая область и журнал выбранного узла.
 *
 * Наверху — подпись схемы, собранная из дерева. Это та самая строка, которая
 * попадёт в штамп печатного плана, поэтому она всегда перед глазами.
 *
 * Рабочая область зависит от уровня: у здания генплан объекта, у этажа
 * поэтажный план, у склада окно склада. План, журнал и дашборд — три режима
 * одних и тех же данных: режим выбирается вкладкой над самой областью, узел —
 * в дереве.
 *
 * Кнопки режима стоят в его же вкладке, а не в шапке программы: «закрепить
 * объекты» относится к плану, и в шапке, рядом с темой и учётной записью, она
 * читалась как настройка всей программы.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 5 и Дополнение 2, часть П2.
 */

import type {
  AppSettings, JournalExportRequest, MaintenanceEvent, PixelPoint, PlanObject, Room, TreeNode,
} from '@izh/contracts';
import { placeableObjects, ruleFor, type PlanKind } from '@izh/core';
import type { ViewMode } from './AppHeader';
import { DashboardPanel } from './DashboardPanel';
import { JournalPanel } from './JournalPanel';
import { ModeTabs, type ModeOption } from './ModeTabs';
import { PendingStrip } from './PendingStrip';
import { PlanCanvas } from './PlanCanvas';
import type { CoverageLayer } from './plan-coverage';
import type { PickMode } from './plan-selection';
import { StoragePanel } from './StoragePanel';
import type { JournalIntent } from './status-filter';
import type { StorageSection } from '@izh/contracts';

export interface PickedFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** Готовый к показу план узла: изображение подложки и его размеры. */
export interface PlanImage {
  readonly url: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface CenterAreaProps {
  readonly selected: TreeNode | null;
  readonly nodes: readonly TreeNode[];
  readonly caption: string;
  /** Подложка узла, если она уже загружена и подготовлена. */
  readonly planImage: PlanImage | null;
  /** Подложка ещё читается: не подменять её экраном «план не загружен». */
  readonly planLoading: boolean;
  readonly rooms: readonly Room[];
  /** Все помещения всех этажей — журналу выше уровня этажа нужны чужие названия (часть П4.2). */
  readonly allRooms: readonly Room[];
  readonly objects: readonly PlanObject[];
  readonly allObjects: readonly PlanObject[];
  readonly maintenanceEvents: readonly MaintenanceEvent[];
  readonly soonThresholdDays: number;
  readonly selectedObjectId: string | null;
  /** Счётчик показа на плане: меняется при каждом «показать на плане». */
  readonly planFocusTick: number;
  /** Просьба показать значок на плане: живёт в главном окне, а не в плане. */
  readonly flashRequest: { readonly objectId: string; readonly tick: number } | null;
  readonly onFlashed: () => void;
  readonly drawingRoomId: string | null;
  /** Какую обводку подсветить по просьбе из карточки узла. */
  readonly flashRoomId: string | null;
  /** Обводка найдена и подведена к глазам: с этого мига подсветка и гаснет. */
  readonly onRoomShown: () => void;
  readonly outlinePoints: readonly PixelPoint[];
  readonly onOutlinePoint: (point: PixelPoint) => void;
  readonly onOutlinePointMove: (index: number, point: PixelPoint) => void;
  readonly onOutlineClose: () => void;
  readonly onOutlinePointRemove: (index: number) => void;
  readonly hoveredRoomId: string | null;
  readonly onHoverRoom: (roomId: string | null) => void;
  /** Групповая расстановка по щелчку (ТЗ, часть 6.3): сколько объектов ещё не поставлено. */
  readonly batchRemaining: number | null;
  readonly onBatchPlaceClick: (position: PixelPoint) => void;
  readonly onCancelBatchPlacement: () => void;
  /** Режим управляется снаружи: «показать на плане» из журнала переключает его принудительно. */
  readonly mode: ViewMode;
  readonly modes: readonly ModeOption[];
  readonly onModeChange: (mode: ViewMode) => void;
  readonly settings: AppSettings;
  readonly onDashboardTypesChange: (counts: ReadonlyMap<string, number>) => void;
  /** Снять отбор систем целиком — из пустого журнала. */
  readonly onShowAllTypes: () => void;
  readonly onOpenDashboardSettings?: () => void;
  /** Групповое выделение значков: рамкой, обводкой или выключено. */
  /** Отмеривание отрезка для масштаба: два щелчка по плану. */
  readonly measuring: boolean;
  readonly onMeasured: (a: PixelPoint, b: PixelPoint) => void;
  /** Показывать на плане только огнетушители — вместе с кругами покрытия. */
  readonly onlyExtinguishers: boolean;
  /** Масштаб подложки: метров в точке. Из него под планом пишется «М ≈ 1:200». */
  readonly metersPerPixel: number | null;
  /** Приближение плана: живёт выше холста, чтобы пережить смену узла и вкладки. */
  readonly planZoom: number;
  readonly onPlanZoom: (zoom: number) => void;
  readonly selectedIds: ReadonlySet<string>;
  readonly onSelectMany: (objectIds: readonly string[], mode: PickMode) => void;
  /** Переложить складское оборудование на другую полку: резерв или ремонт. */
  readonly onSetStorageSection: (objectId: string, section: StorageSection) => void;
  /** Куда сдвинута подпись плана — долями от его размеров. */
  /** Слой проверки расстановки огнетушителей: круги нормы и непокрытые места. */
  readonly coverage: CoverageLayer | null;
  /**
   * Полоса действий над выделенным. Отдельной строкой над рабочей областью
   * и в плане, и в журнале: набор один на оба экрана, и действовать над ним
   * человек должен там, где он его собрал.
   *
   * В шапке она стоять не может — там она отнимала место у названия узла, и
   * при пяти кнопках заголовок сжимался до одного слова.
   */
  readonly selectionBar: React.ReactNode;
  /** Кнопки вкладки «План»: проверка расстановки, закрепление объектов. */
  /**
   * Кнопки вкладки «План», разложенные по сторонам.
   *
   * Слева — то, что смотрят на плане: проверки и разборы. Справа — то, чем
   * план правят: закрепление значков. Вперемешку они читались как один
   * длинный ряд, где непонятно, что смотрит, а что меняет.
   */
  readonly planActions: { readonly left: React.ReactNode; readonly right: React.ReactNode } | null;
  /** Объекты закреплены: перетаскивание по плану запрещено (Дополнение 2, П3.2). */
  readonly pinned: boolean;
  readonly onFinishOutline: (points: readonly PixelPoint[]) => void;
  readonly onCancelOutline: () => void;
  readonly onSelectObject: (objectId: string | null) => void;
  /** position = null: объект заводится без места, пока плана нет. */
  readonly onPlaceElement: (typeCode: string, position: PixelPoint | null) => void;
  readonly onMoveObject: (objectId: string, position: PixelPoint) => void;
  /** Правая кнопка мыши по значку — контекстное меню (ТЗ, Дополнение 3, часть К7). */
  readonly onObjectContextMenu: (object: PlanObject, screenPosition: { x: number; y: number }) => void;
  readonly hiddenTypes: ReadonlySet<string>;
  readonly onToggleType: (typeCode: string) => void;
  readonly onOpenActivity: (object: PlanObject, activityCode: string) => void;
  readonly canSign: boolean;
  readonly onOpenSignature: (event: MaintenanceEvent) => void;
  readonly onShowOnPlan: (object: PlanObject) => void;
  /** Выбор файла подложки через обычный диалог. */
  readonly onPickBackdrop: () => void;
  /** Файл подложки, брошенный в рабочую область. */
  readonly onDropBackdrop: (file: PickedFile) => void;
  /** Перенос существующего журнала предприятия. */
  readonly onImportJournal: () => void;
  /** Убранные графы журнала по видам — настройка «состав таблицы». */
  readonly journalColumns: Readonly<Record<string, readonly string[]>>;
  /** Выгрузка журнала (Дополнение 2, часть П4.3). */
  readonly onExportJournal: (request: JournalExportRequest) => void;
  /** Переход «показатель дашборда → отфильтрованный журнал» (ТЗ, Дополнение 3, часть К4). */
  readonly onOpenJournal: (intent: JournalIntent) => void;
  /** Фильтр, с которым журнал должен открыться один раз после перехода с дашборда. */
  readonly journalIntent: JournalIntent | null;
  readonly onJournalIntentApplied: () => void;
  readonly journalFocusObjectId: string | null;
  readonly onJournalFocusApplied: () => void;
  readonly onOpenObjectCard: (object: PlanObject) => void;
}

export function CenterArea(props: CenterAreaProps): React.JSX.Element {
  const mode = props.mode;
  const planKind: PlanKind = props.selected === null ? 'none' : ruleFor(props.selected.kind).planKind;

  return (
    <main className="workspace">
      <ModeTabs modes={props.modes} active={mode} onChange={props.onModeChange} />

      <div className={`mode-panel mode-panel-${mode}`}>
        {/* Подпись схемы — та самая строка, что попадёт в штамп печатного
            плана, поэтому она всегда перед глазами. Рядом с ней кнопки
            открытой вкладки: они относятся к тому, что под ними, и стоять
            должны там же. */}
        <div className="mode-panel-head">
          {mode === 'plan' && props.planActions !== null && (
            <div className="mode-panel-actions">
              <div className="plan-actions-side">{props.planActions.left}</div>
              <div className="plan-actions-side">{props.planActions.right}</div>
            </div>
          )}
          {/*
            * Подпись объекта — одна и того же вида, что над чертежом.
            *
            * На плане название узла написано строкой над самим чертежом
            * (`plan-title`); в журнале и на дашборде чертежа нет, и подпись
            * ставится здесь — но **тем же начертанием**. Заказчик: «оставить
            * основную строку, которая выделена жирным… привести одинаковое
            * поведение во всех соответствующих вкладках».
            *
            * Прежде здесь стояла мелкая серая строка вида «хлебных крошек»:
            * те же сведения, что на плане, но набранные иначе — переходя с
            * вкладки на вкладку, человек всякий раз искал название заново.
            *
            * Пояснение к устройству вкладки идёт отдельной строкой под
            * названием: оно про таблицу, а не про объект, и смешивать их в
            * одну строку значило бы снова получить две подписи в одной.
            */}
          {mode !== 'plan' && (
            <>
              <div className="plan-title center-caption">
                {props.caption === '' ? 'Узел не выбран' : props.caption}
              </div>
              {props.selected !== null && (
                <div className="center-caption-note muted small">{modeCaption(mode, planKind)}</div>
              )}
            </>
          )}
        </div>

        {props.selectionBar !== null && (
          <div className="plan-selection-bar">{props.selectionBar}</div>
        )}

        {/*
          * Подпись уровня здесь одна.
          *
          * Она нужна — цифры журнала и дашборда считаются по выбранному узлу, и
          * без подписи их читают, не зная, к чему они. Но раньше их было две:
          * строка над вкладками и такая же под ними. Заказчик: «под основными
          * вкладками дважды отображается информация об организации,
          * подразделении и объекте; оставить только основную строку, которая
          * выделена жирным, дублирующую подпись удалить».
          *
          * Осталась верхняя: она стоит рядом с названием вкладки и отвечает на
          * вопрос «что открыто» до того, как человек опустит глаза в таблицу.
          */}

        <div className="center-body">
          {props.selected === null ? (
            <div className="empty">
              <h2>Выберите узел в дереве</h2>
              <p>Рабочая область, журнал и дашборд показываются для выбранного узла.</p>
              <p className="muted">Если дерева ещё нет — заведите организацию слева. Дальше узлы добавляются правым щелчком по тому, внутрь чего они кладутся.</p>
            </div>
          ) : mode === 'dashboard' ? (
            <DashboardPanel
              nodes={props.nodes}
              node={props.selected}
              allObjects={props.allObjects}
              events={props.maintenanceEvents}
              soonThresholdDays={props.soonThresholdDays}
              settings={props.settings}
              hiddenTypes={props.hiddenTypes}
              onTypesChange={props.onDashboardTypesChange}
              onShowObject={props.onShowOnPlan}
              onOpenJournal={props.onOpenJournal}
              onOpenSettings={props.onOpenDashboardSettings}
            />
          ) : mode === 'plan' && planKind === 'storage' ? (
            <StoragePanel
              onContextMenu={props.onObjectContextMenu}
              selectedIds={props.selectedIds}
              onSelectMany={props.onSelectMany}
              onSetSection={props.onSetStorageSection}
              node={props.selected}
              objects={props.objects}
              events={props.maintenanceEvents}
              soonThresholdDays={props.soonThresholdDays}
              selectedObjectId={props.selectedObjectId}
              focusTick={props.planFocusTick}
              onSelectObject={props.onSelectObject}
              onPlaceElement={props.onPlaceElement}
            />
          ) : mode === 'plan' && props.planLoading ? (
            <div className="plan-loading" role="status">Загрузка плана…</div>
          ) : mode === 'plan' ? (
            <>
            <PlanCanvas
                allObjects={props.allObjects}
                focusTick={props.planFocusTick}
                flashRequest={props.flashRequest}
                onFlashed={props.onFlashed}
                imageUrl={props.planImage?.url ?? null}
                widthPx={props.planImage?.widthPx ?? 1600}
                heightPx={props.planImage?.heightPx ?? 900}
                caption={props.caption}
                rooms={props.rooms}
                coverage={props.coverage}
                measuring={props.measuring}
                onMeasured={props.onMeasured}
                onlyExtinguishers={props.onlyExtinguishers}
                metersPerPixel={props.metersPerPixel}
                zoom={props.planZoom}
                onZoom={props.onPlanZoom}
                selectedIds={props.selectedIds}
                onSelectMany={props.onSelectMany}
                objects={props.objects}
                selectedObjectId={props.selectedObjectId}
                drawingRoomId={props.drawingRoomId}
                flashRoomId={props.flashRoomId}
                onRoomShown={props.onRoomShown}
                outlinePoints={props.outlinePoints}
                onOutlinePoint={props.onOutlinePoint}
                onOutlinePointMove={props.onOutlinePointMove}
                onOutlineClose={props.onOutlineClose}
                onOutlinePointRemove={props.onOutlinePointRemove}
                hoveredRoomId={props.hoveredRoomId}
                onHoverRoom={props.onHoverRoom}
                batchRemaining={props.batchRemaining}
                pinned={props.pinned}
                events={props.maintenanceEvents}
                soonThresholdDays={props.soonThresholdDays}
                onFinishOutline={props.onFinishOutline}
                onCancelOutline={props.onCancelOutline}
                onSelectObject={props.onSelectObject}
                onPlaceElement={props.onPlaceElement}
                onMoveObject={props.onMoveObject}
                onBatchPlaceClick={props.onBatchPlaceClick}
                onCancelBatchPlacement={props.onCancelBatchPlacement}
                onContextMenu={props.onObjectContextMenu}
                onPickBackdrop={props.onPickBackdrop}
                onDropBackdrop={props.onDropBackdrop}
                hiddenTypes={props.hiddenTypes}
                onToggleType={props.onToggleType}
              />

            {/* Строка ожидающих размещения: объекты есть в журнале, места на плане
                у них пока нет. Склад сюда не попадает — у него своё окно. */}
            {props.planImage !== null && <PendingStrip
                // Единицы комплекта размещения не ждут: их место определено
                // точкой на плане, и в этой полосе им делать нечего.
                objects={placeableObjects(props.objects).filter((object) => object.position === null)}
                selectedObjectId={props.selectedObjectId}
                hasPlan
                onSelectObject={props.onSelectObject}
                selectedIds={props.selectedIds}
                onSelectMany={props.onSelectMany}
                onContextMenu={props.onObjectContextMenu}
              />}
            </>
          ) : (
            <JournalPanel
              selectedIds={props.selectedIds}
              onSelectMany={props.onSelectMany}
              nodes={props.nodes}
              node={props.selected}
              hiddenTypes={props.hiddenTypes}
              onShowAllTypes={props.onShowAllTypes}
              allObjects={props.allObjects}
              allRooms={props.allRooms}
              events={props.maintenanceEvents}
              busy={false}
              soonThresholdDays={props.soonThresholdDays}
              onOpenActivity={props.onOpenActivity}
              canSign={props.canSign}
              onOpenSignature={props.onOpenSignature}
              onShowOnPlan={props.onShowOnPlan}
              onObjectContextMenu={props.onObjectContextMenu}
              onOpenObjectCard={props.onOpenObjectCard}
              onImportJournal={props.onImportJournal}
              journalColumns={props.journalColumns}
              onExport={props.onExportJournal}
              initialFilter={props.journalIntent}
              onFilterApplied={props.onJournalIntentApplied}
              focusObjectId={props.journalFocusObjectId}
              onFocusApplied={props.onJournalFocusApplied}
            />
          )}
        </div>
      </div>
    </main>
  );
}

/** Подпись под названием узла: что именно показано в этом режиме. */
function modeCaption(mode: ViewMode, planKind: PlanKind): string {
  if (mode === 'dashboard') return 'дашборд: показатели по узлу и всему, что в него входит';
  if (mode === 'journal') return 'журнал: строка — оборудование, колонки — мероприятия';
  if (planKind === 'general') return 'генплан объекта: территория и наружные средства';
  if (planKind === 'storage') return 'склад: состав запасного оборудования';
  return 'поэтажный план: системы защиты этажа';
}
