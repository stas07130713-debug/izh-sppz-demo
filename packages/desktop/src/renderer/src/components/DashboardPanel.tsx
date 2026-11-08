/**
 * Режим «Дашборд» (ТЗ, Дополнение 2, часть П5; Дополнение 6, части С49–С51).
 *
 * Показанное складывается из трёх вещей:
 *
 *     уровень объекта + выбранные системы + настройки состава.
 *
 * Уровень выбирают в дереве слева, системы — галочками справа, состав блоков —
 * в настройках программы. Любое из трёх меняется — экран пересчитывается сам.
 *
 * Область уровня берётся тем же `journalScope`, что и журнал, поэтому цифры
 * дашборда и строки журнала не могут разойтись. Сводку считает ядро
 * (`dashboardSummary`): у отбора есть правило, и его нужно уметь проверить, а
 * не пересказывать в каждом блоке заново.
 */

import { useEffect, useMemo } from 'react';
import type { AppSettings, MaintenanceEvent, PlanObject, TreeNode } from '@izh/contracts';
import {
  dashboardBlock, dashboardSummary, dashboardTrend, journalScope, normalizeDashboardBlocks,
  storageNodeIds,
} from '@izh/core';
import { todayIso } from '../today';
import { cardFor, tileFor, type BlockContext } from './dashboard-views';
import type { JournalIntent } from './status-filter';
import { useScheduleSource } from '../schedule-source-context';

export interface DashboardPanelProps {
  readonly nodes: readonly TreeNode[];
  readonly node: TreeNode;
  readonly allObjects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  readonly soonThresholdDays: number;
  readonly settings: AppSettings;
  /** Скрытые виды — общий отбор систем для плана, журнала и дашборда. */
  readonly hiddenTypes: ReadonlySet<string>;
  /** Какие виды есть на уровне — правое поле показывает их же. */
  readonly onTypesChange: (counts: ReadonlyMap<string, number>) => void;
  readonly onShowObject: (object: PlanObject) => void;
  /** Переход «показатель → отфильтрованный журнал» (ТЗ, Дополнение 3, часть К4). */
  readonly onOpenJournal: (intent: JournalIntent) => void;
  /** Открыть состав дашборда. Нет — у этого человека нет права на настройки. */
  readonly onOpenSettings?: () => void;
}

export function DashboardPanel(props: DashboardPanelProps): React.JSX.Element {
  // Регламент организации, а где его нет — нормативная библиотека (Дополнение 5, Р19).
  const scheduleSource = useScheduleSource();

  const scope = useMemo(
    () => journalScope(props.nodes, props.allObjects, props.node.id),
    [props.nodes, props.allObjects, props.node.id],
  );

  /** Какие виды есть на уровне и сколько их — это же показывает правое поле. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const object of scope) map.set(object.typeCode, (map.get(object.typeCode) ?? 0) + 1);
    return map;
  }, [scope]);

  // Правое поле живёт снаружи: при смене уровня состав систем другой, и отметки
  // нужно пересобрать — иначе на новом уровне остался бы отбор со старого, где
  // этих систем нет вовсе, и дашборд показывал бы нули без всякой причины.
  const { onTypesChange } = props;
  useEffect(() => { onTypesChange(counts); }, [counts, onTypesChange]);

  /** Виды уровня за вычетом скрытых — то же, что видно на плане и в журнале. */
  const shownTypes = useMemo(
    () => new Set([...counts.keys()].filter((typeCode) => !props.hiddenTypes.has(typeCode))),
    [counts, props.hiddenTypes],
  );

  const summary = useMemo(
    () => dashboardSummary({
      objects: scope,
      events: props.events,
      today: todayIso(),
      soonThresholdDays: props.soonThresholdDays,
      source: scheduleSource,
      typeCodes: shownTypes,
      levelObjects: scope,
      // Склад — не этаж: элементы в нём не требуют размещения на плане.
      storageNodeIds: storageNodeIds(props.nodes),
    }),
    [scope, props.events, props.soonThresholdDays, scheduleSource, shownTypes],
  );

  const blocks = useMemo(
    () => normalizeDashboardBlocks(props.settings.dashboardBlocks),
    [props.settings.dashboardBlocks],
  );

  /*
   * Динамика считается только когда её блок включён.
   *
   * Счёт тяжёлый: на каждую из полутора десятков точек состояние всех
   * элементов уровня определяется заново. У кого график выключен, тот не
   * должен за него платить задержкой при каждом открытии дашборда.
   */
  const wantsTrend = blocks.includes('график-динамика');
  const trend = useMemo(
    () => (wantsTrend
      ? dashboardTrend({
        objects: scope.filter((object) => shownTypes.has(object.typeCode)),
        events: props.events,
        today: todayIso(),
        soonThresholdDays: props.soonThresholdDays,
        source: scheduleSource,
        days: 180,
      })
      : []),
    [wantsTrend, scope, shownTypes, props.events, props.soonThresholdDays, scheduleSource],
  );

  if (scope.length === 0) {
    return (
      <div className="empty">
        <h2>Показывать нечего</h2>
        <p>
          В «{props.node.name}» и во всём, что в него входит, пока нет ни одного объекта. Заведите
          оборудование перетаскиванием на план или перенесите существующий журнал.
        </p>
      </div>
    );
  }

  const context: BlockContext = {
    summary,
    trend,
    nodes: props.nodes,
    onShowObject: props.onShowObject,
    onOpenJournal: props.onOpenJournal,
  };

  const tiles = blocks
    .filter((id) => dashboardBlock(id)?.kind === 'показатель')
    .map((id) => tileFor(id, context))
    .filter((tile): tile is React.JSX.Element => tile !== null);
  const cards = blocks
    .filter((id) => dashboardBlock(id)?.kind !== 'показатель')
    .map((id) => cardFor(id, context))
    .filter((card): card is React.JSX.Element => card !== null);

  return (
    <div className="dashboard-panel">
      {/* Ни одной системы — законный отбор, а не поломка: человек снял все
          галочки и должен увидеть причину пустых цифр, а не гадать о ней. */}
      {shownTypes.size === 0 && (
        <p className="banner note">
          Ни одна система не выбрана. Отметьте нужные справа — по отдельности или галочкой раздела.
          Этот же отбор действует на плане и в журнале.
        </p>
      )}

      {blocks.length === 0 ? (
        <div className="empty">
          <h2>Все блоки выключены</h2>
          <p>Состав дашборда задаётся в настройках программы, вкладка «Дашборд».</p>
          {props.onOpenSettings === undefined ? (
            <p className="muted small">Состав дашборда задаёт администратор.</p>
          ) : (
            <div className="actions">
              <button type="button" className="primary" onClick={props.onOpenSettings}>
                Открыть настройки дашборда
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {tiles.length > 0 && <div className="dash-overview"><div className="tiles">{tiles}</div></div>}
          {cards.length > 0 && <div className="dash-columns">{cards}</div>}
        </>
      )}
    </div>
  );
}
