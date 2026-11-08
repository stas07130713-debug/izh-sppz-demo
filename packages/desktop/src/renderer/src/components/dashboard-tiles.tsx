/**
 * Верхний ряд дашборда: показатели.
 *
 * Плитка — это вход в отобранный журнал, а не украшение: нажал «просрочено» —
 * получил список просроченного (ТЗ, Дополнение 3, часть К4). Число под меткой
 * то же, что покажет журнал, потому что считается по тем же меткам отбора.
 */

import type { FilterTag } from '@izh/core';
import { share, type BlockContext } from './dashboard-context';
import type { JournalIntent } from './status-filter';

interface TileProps {
  readonly title: string;
  readonly value: string;
  readonly note?: string;
  readonly tone?: 'ok' | 'warn' | 'danger';
  /** Без обработчика плитка не кликабельна и не притворяется таковой. */
  readonly onClick?: () => void;
}

export function Tile(props: TileProps): React.JSX.Element {
  const tone = props.tone === undefined ? '' : ` tile-${props.tone}`;
  const content = (
    <>
      <div className="tile-value">
        {props.value}
        {props.note !== undefined && <span className="tile-note"> {props.note}</span>}
      </div>
      <div className="tile-title">{props.title}</div>
    </>
  );

  if (props.onClick === undefined) return <div className={`tile${tone}`}>{content}</div>;
  return (
    <button type="button" className={`tile tile-clickable${tone}`} onClick={props.onClick}>
      {content}
    </button>
  );
}

export function tileFor(id: string, context: BlockContext): React.JSX.Element | null {
  const { summary, onOpenJournal } = context;
  const open = (tags: readonly FilterTag[]): (() => void) =>
    () => onOpenJournal({ typeCode: null, statusTags: new Set(tags) as JournalIntent['statusTags'] });

  const tag = (name: FilterTag): number => summary.tagCounts[name];

  switch (id) {
    case 'показатель-всего':
      return <Tile key={id} title="Всего элементов" value={String(summary.total)} onClick={open([])} />;
    case 'показатель-норма':
      return <Tile
        key={id} title="В норме" value={String(tag('норма'))}
        note={share(tag('норма'), summary.total)} tone="ok" onClick={open(['норма'])}
      />;
    case 'показатель-скоро':
      return <Tile
        key={id} title="Требует внимания" value={String(tag('скоро'))}
        note={share(tag('скоро'), summary.total)}
        tone={tag('скоро') > 0 ? 'warn' : undefined} onClick={open(['скоро'])}
      />;
    case 'показатель-просрочено':
      return <Tile
        key={id} title="Просрочено" value={String(tag('просрочено'))}
        note={share(tag('просрочено'), summary.total)}
        tone={tag('просрочено') > 0 ? 'danger' : undefined} onClick={open(['просрочено'])}
      />;
    case 'показатель-неисправно': {
      /*
       * Просрочка считается здесь же.
       *
       * Заказчик: «не нужно графы просрочено — это всё входит в неисправно».
       * И по существу верно: оборудование с прошедшим сроком проверки к
       * применению не готово так же, как сломанное, — по нему нельзя сказать,
       * сработает ли оно.
       *
       * Считается по элементам, а не сложением двух чисел: у элемента бывают
       * обе метки сразу, и сумма посчитала бы его дважды.
       */
      const count = summary.brokenOrOverdue;
      return <Tile
        key={id} title="Неисправны" value={String(count)}
        note={share(count, summary.total)}
        tone={count > 0 ? 'danger' : undefined} onClick={open(['неисправно', 'просрочено'])}
      />;
    }
    case 'показатель-нет-данных':
      return <Tile
        key={id} title="Нет данных" value={String(tag('нет данных'))}
        note={share(tag('нет данных'), summary.total)} onClick={open(['нет данных'])}
      />;
    case 'показатель-на-складе':
      /*
       * Склад — отдельная справочная величина.
       *
       * Заказчик: «на дашборде может существовать отдельная справочная
       * метрика "На складе / В резерве", но она не должна смешиваться с
       * фактически установленными элементами». Поэтому доли от общего числа
       * у неё нет: она не часть оснащённости объекта, а хранение.
       */
      return <Tile key={id} title="На складе" value={String(summary.inStorage)} />;
    case 'показатель-не-размещено':
      // «Требуют размещения» — не состояние и не вид, а отдельная ось: есть ли
      // у элемента точка на плане. Отбора журнала под неё нет, поэтому плитка
      // не кликабельна — притворяться ссылкой она не должна.
      return <Tile
        key={id} title="Требуют размещения" value={String(summary.unplaced)}
        tone={summary.unplaced > 0 ? 'warn' : undefined}
      />;
    default:
      return null;
  }
}
