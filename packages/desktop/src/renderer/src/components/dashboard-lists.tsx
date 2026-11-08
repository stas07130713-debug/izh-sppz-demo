/**
 * Блоки дашборда, которые перечисляют: что просрочено, что предстоит, что
 * сломано, какие системы проблемнее прочих.
 *
 * Каждая строка ведёт к своему элементу или к отобранному журналу: список на
 * дашборде — это вход в работу, а не отчёт для чтения.
 */

import type { FilterTag } from '@izh/core';
import { formatDateRu } from '../format';
import { ElementIcon } from './ElementIcon';
import { objectTitle, placeOf, typeTitle, type BlockContext } from './dashboard-context';

/** Метки, по которым отбирают «проблемное»: просрочка и полное отсутствие сведений. */
const PROBLEM_TAGS: ReadonlySet<FilterTag> = new Set<FilterTag>(['просрочено', 'нет данных']);

export function TypesCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onOpenJournal } = context;

  return (
    <section className="dash-card">
      <h3>Состояние по видам систем</h3>
      {summary.byType.length === 0 ? (
        <p className="muted small">Ни одна система не выбрана.</p>
      ) : (
        <ul className="plain-list dash-types">
          {summary.byType.map((tally) => {
            const alarming = tally.counts['просрочено'] + tally.counts['нет данных'];
            return (
              <li key={tally.typeCode}>
                <ElementIcon typeCode={tally.typeCode} />
                <button
                  type="button"
                  className="link"
                  onClick={() => onOpenJournal({ typeCode: tally.typeCode, statusTags: new Set() })}
                >
                  {typeTitle(tally.typeCode)}
                </button>
                <span className="muted small"> — {tally.total} шт.</span>
                {alarming > 0 && <span className="error small"> · требуют внимания: {alarming}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Системы с проблемами — от самой проблемной.
 *
 * Отбор идёт по просрочке и отсутствию сведений: и то и другое означает, что
 * за системой не следят. «Скоро» сюда не входит — это ещё не проблема, а
 * предупреждение, и ему отведён свой показатель наверху.
 */
export function ProblemTypesCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onOpenJournal } = context;

  const rows = summary.byType
    .map((tally) => ({
      typeCode: tally.typeCode,
      total: tally.total,
      overdue: tally.counts['просрочено'],
      unknown: tally.counts['нет данных'],
      problems: tally.counts['просрочено'] + tally.counts['нет данных'],
    }))
    .filter((row) => row.problems > 0)
    .sort((a, b) => b.problems - a.problems || b.total - a.total)
    .slice(0, 6);

  const worst = rows[0]?.problems ?? 1;

  return (
    <section className="dash-card">
      <h3>Системы с проблемами</h3>
      {rows.length === 0 ? (
        <p className="muted small">Просроченного и неучтённого нет.</p>
      ) : (
        <ul className="plain-list dash-problems">
          {rows.map((row) => (
            <li key={row.typeCode}>
              <div className="dash-problem-head">
                <ElementIcon typeCode={row.typeCode} />
                <button
                  type="button"
                  className="link"
                  onClick={() => onOpenJournal({ typeCode: row.typeCode, statusTags: PROBLEM_TAGS })}
                >
                  {typeTitle(row.typeCode)}
                </button>
                <span className="error small">{row.problems} из {row.total}</span>
              </div>
              {/* Полоса меряется по худшей системе, а не по общему числу:
                  иначе у крупного объекта все полосы были бы одинаково коротки. */}
              <div className="dash-problem-bar">
                <span style={{ width: `${(row.problems / worst) * 100}%` }} />
              </div>
              <div className="muted small">
                просрочено: {row.overdue} · нет данных: {row.unknown}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OverdueCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, nodes, onShowObject, onOpenJournal } = context;
  const shown = summary.overdue.slice(0, 8);

  // Таблица на всю ширину: в узкой колонке название элемента ломается на три
  // строки, и глазом не связать его с датой в правой графе.
  return (
    <section className="dash-card dash-card-wide">
      <h3>Просроченные проверки</h3>
      {shown.length === 0 ? (
        <p className="muted small">Просроченных работ нет.</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr><th>Элемент</th><th>Работа</th><th>Срок</th></tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={`${item.object.id}-${item.activityTitle}`}>
                <td>
                  <ElementIcon typeCode={item.object.typeCode} />
                  <button type="button" className="link" onClick={() => onShowObject(item.object)}>
                    {objectTitle(item.object)}
                  </button>
                  <div className="muted small">{placeOf(nodes, item.object.nodeId)}</div>
                </td>
                <td className="muted small">{item.activityTitle}</td>
                <td className="error small">
                  {formatDateRu(item.date)}
                  <div className="muted small">просрочено на {item.daysLate} дн.</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {summary.overdue.length > shown.length && (
        <button
          type="button"
          className="link small"
          onClick={() => onOpenJournal({ typeCode: null, statusTags: new Set<FilterTag>(['просрочено']) })}
        >
          Показать все просроченные ({summary.overdue.length})
        </button>
      )}
    </section>
  );
}

export function UpcomingCard(
  { context, days }: { readonly context: BlockContext; readonly days: 7 | 30 },
): React.JSX.Element {
  const { summary, nodes, onShowObject } = context;
  const works = days === 7 ? summary.upcoming7 : summary.upcoming30;

  /*
   * Что именно предстоит — поимённо.
   *
   * Заказчик: «выделенная одна система, которая требует ТО в течение
   * 30 дней, не отображается в программе». И правда не отображалась: строка
   * говорила «Осмотр (1 шт.)», а какой именно предмет за этой единицей — не
   * говорила нигде. Число без имени не даёт ничего сделать: чтобы найти
   * систему, приходилось перебирать журнал вручную.
   *
   * Теперь под каждой строкой стоят сами элементы, и по имени открывается
   * карточка. Перечень тот же, что даёт сводка: второго счёта сроков в
   * программе нет.
   */
  const named = new Map<string, typeof summary.upcomingItems>();
  for (const item of summary.upcomingItems) {
    if (item.daysLeft > days) continue;
    const key = `${item.activityTitle}|${item.date}`;
    named.set(key, [...(named.get(key) ?? []), item]);
  }

  return (
    <section className="dash-card">
      <h3>Ближайшие проверки и ТО: {days} дней</h3>
      {works.length === 0 ? (
        <p className="muted small">На этот срок работ не запланировано.</p>
      ) : (
        <ul className="plain-list dash-upcoming">
          {works.slice(0, 12).map((item) => {
            const items = named.get(`${item.activityTitle}|${item.date}`) ?? [];
            return (
              <li key={`${item.activityTitle}-${item.date}`}>
                <strong>{formatDateRu(item.date)}</strong> — {item.activityTitle}
                <span className="muted small"> ({item.count} шт.)</span>
                {items.length > 0 && (
                  <ul className="plain-list dash-upcoming-items">
                    {/* Шесть имён: дальше строка перестаёт читаться, а
                        остальные видны в журнале по этой же работе. */}
                    {items.slice(0, 6).map((one) => (
                      <li key={one.object.id}>
                        <ElementIcon typeCode={one.object.typeCode} />
                        <button type="button" className="link" onClick={() => onShowObject(one.object)}>
                          {objectTitle(one.object)}
                        </button>
                        <span className="muted small"> · {placeOf(nodes, one.object.nodeId)}</span>
                      </li>
                    ))}
                    {items.length > 6 && (
                      <li className="muted small">И ещё {items.length - 6}.</li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {works.length > 12 && <p className="muted small">И ещё {works.length - 12}.</p>}
    </section>
  );
}

export function BrokenCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, nodes, onShowObject, onOpenJournal } = context;

  return (
    <section className="dash-card dash-card-wide">
      <h3>Неисправное оборудование</h3>
      {summary.broken.length === 0 ? (
        <p className="muted small">Неисправностей не отмечено.</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr><th>Элемент</th><th>Объект</th><th>Состояние</th></tr>
          </thead>
          <tbody>
            {summary.broken.slice(0, 8).map((item) => (
              <tr key={item.object.id}>
                <td>
                  <ElementIcon typeCode={item.object.typeCode} />
                  <button type="button" className="link" onClick={() => onShowObject(item.object)}>
                    {objectTitle(item.object)}
                  </button>
                </td>
                <td className="muted small">{placeOf(nodes, item.object.nodeId)}</td>
                <td className="error small">{item.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {summary.broken.length > 8 && (
        <button
          type="button"
          className="link small"
          onClick={() => onOpenJournal({ typeCode: null, statusTags: new Set<FilterTag>(['неисправно']) })}
        >
          Показать все неисправные ({summary.broken.length})
        </button>
      )}
    </section>
  );
}

/**
 * Системы пожарной автоматики: у прибора два состояния.
 *
 * Своё — исправен ли сам прибор и соблюдены ли его сроки. По системе — худшее
 * по прибору и всем его извещателям, оповещателям и модулям. Прибор бывает
 * исправен при полусотне нечищеных извещателей, и одно число об этом молчит.
 *
 * Состояние системы не зависит от отбора справа: отбор решает, что показать, а
 * не что исправно.
 */
export function SystemsCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onShowObject } = context;

  return (
    <section className="dash-card">
      <h3>Системы пожарной автоматики</h3>
      {summary.systems.length === 0 ? (
        <p className="muted small">Приборы приёмно-контрольные на этом уровне не заведены.</p>
      ) : (
        <ul className="plain-list dash-systems">
          {summary.systems.map(({ head, condition }) => (
            <li key={head.id}>
              <ElementIcon typeCode={head.typeCode} />
              <button type="button" className="link" onClick={() => onShowObject(head)}>
                {objectTitle(head)}
              </button>
              <div className="dash-system-states">
                <span className={`status-pill status-${condition.own.color}`} title="Состояние самого прибора">
                  <span className="status-dot" />
                  прибор: {condition.own.schedule}
                </span>
                <span
                  className={`status-pill status-${condition.whole.color}`}
                  title={`Худшее по прибору и ${condition.memberCount} подключённым элементам`}
                >
                  <span className="status-dot" />
                  система: {condition.whole.schedule}
                </span>
                <span className="muted small">элементов: {condition.memberCount}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
