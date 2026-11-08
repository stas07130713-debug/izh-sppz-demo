/**
 * Круги состояния по каждому виду оборудования.
 *
 * Отдельным файлом от прочих графиков: блок крупный, и вместе с кругами,
 * полосами и динамикой он выводил файл за предел в 300 строк (AGENTS.md,
 * правило 7).
 */

import type { ScheduleStatus } from '@izh/core';
import { systemKindOf, systemKindTitle } from '@izh/core';
import { DonutChart } from './DonutChart';
import { ElementIcon } from './ElementIcon';
import { STATUS_COLOR_VAR, STATUS_ORDER, share, type BlockContext } from './dashboard-context';
import type { FilterTag } from './status-filter';

/** Состояние как метка отбора журнала: имена совпадают, приведение явное. */
function statusTag(status: ScheduleStatus): ReadonlySet<FilterTag> {
  return new Set<FilterTag>([status]);
}
/**
 * Свой круг на каждый вид оборудования.
 *
 * Заказчик: «мини-графики только по каждому виду элементов отдельно — по
 * огнетушителям всем, по ПК, по ПГ и так далее». Общий круг отвечает на
 * вопрос «как дела в целом», а этот — «с чем именно неладно»: сотня
 * огнетушителей в норме легко закрывает собой три просроченных крана.
 *
 * Подвиды сложены в вид: порошковые и углекислотные огнетушители — один
 * круг, как их и считают.
 */
export function KindDonuts({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onOpenJournal } = context;

  /*
   * Складываем подвиды в виды. Заодно запоминаем первый встреченный подвид:
   * журнал отбирает по коду вида, который на уровне действительно есть, а
   * общего кода семейства среди заведённых может и не быть.
   */
  const kinds = new Map<string, {
    total: number;
    counts: Record<ScheduleStatus, number>;
    firstType: string;
  }>();
  for (const tally of summary.byType) {
    const kind = systemKindOf(tally.typeCode);
    const known = kinds.get(kind);
    const counts = known?.counts ?? { 'норма': 0, 'скоро': 0, 'просрочено': 0, 'нет данных': 0 };
    for (const status of STATUS_ORDER) counts[status] += tally.counts[status];
    kinds.set(kind, {
      total: (known?.total ?? 0) + tally.total,
      counts,
      firstType: known?.firstType ?? tally.typeCode,
    });
  }

  const rows = [...kinds.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <section className="dash-card dash-card-wide">
      <h3>Состояние каждого вида</h3>
      {rows.length === 0 ? (
        <p className="muted small">Ни одна система не выбрана.</p>
      ) : (
        <div className="dash-kinds">
          {rows.map(([kind, item]) => (
            <div key={kind} className="dash-kind">
              <button
                type="button"
                className="link dash-kind-title"
                onClick={() => onOpenJournal({ typeCode: item.firstType, statusTags: new Set() })}
              >
                <ElementIcon typeCode={kind} />
                <span>{systemKindTitle(kind)}</span>
              </button>
              <DonutChart
                size={96}
                centerValue={String(item.total)}
                centerLabel="шт."
                segments={STATUS_ORDER.map((status) => ({
                  key: status, label: status, value: item.counts[status], color: STATUS_COLOR_VAR[status],
                }))}
                onPick={(key) => onOpenJournal({
                  typeCode: item.firstType, statusTags: statusTag(key as ScheduleStatus),
                })}
              />
              {/* Заказчик: «с отображением визуального значка элемента и
                  указанными числами и процентами». Доля считается от числа
                  элементов этого вида, а не от всех: круг тоже о нём одном. */}
              <div className="muted small dash-kind-legend">
                {STATUS_ORDER.filter((status) => item.counts[status] > 0).map((status) => (
                  <span key={status} title={status}>
                    <span className="group-dot" style={{ background: STATUS_COLOR_VAR[status] }} />
                    {item.counts[status]}
                    <span className="dash-kind-share"> · {share(item.counts[status], item.total)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
