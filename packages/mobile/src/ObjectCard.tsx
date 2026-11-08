/**
 * Карточка оборудования на обходе.
 *
 * Отвечает на три вопроса в том порядке, в каком их задают, стоя перед
 * предметом: что это и где, в каком оно состоянии, что с ним предстоит сделать
 * и когда. Всё остальное — паспортные подробности, история, документы —
 * смотрят за столом, в настольной программе.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { elementTitle, type ActivityScheduleSource } from '@izh/core';
import { fieldStatus, nextWorks } from './field-status';
import { placeOf, type FieldSnapshot } from './field-data';

export interface ObjectCardProps {
  readonly snapshot: FieldSnapshot;
  readonly object: PlanObject;
  readonly events: readonly MaintenanceEvent[];
  readonly today: string;
  readonly soonThresholdDays: number;
  readonly source: ActivityScheduleSource;
}

/** Дата по-русски: день, месяц, год — как во всей программе. */
function dateRu(iso: string | null): string {
  if (iso === null) return '—';
  const [year, month, day] = iso.split('-');
  return year === undefined || month === undefined || day === undefined ? iso : `${day}.${month}.${year}`;
}

/** «через 12 дней», «просрочено на 3 дня» — на обходе считают днями, а не датами. */
function whenText(daysLeft: number | null, overdue: boolean): string {
  if (daysLeft === null) return 'срок не рассчитан';
  if (overdue) return `просрочено на ${Math.abs(daysLeft)} дн.`;
  if (daysLeft === 0) return 'сегодня';
  return `через ${daysLeft} дн.`;
}

export function ObjectCard(props: ObjectCardProps): React.JSX.Element {
  const { object } = props;
  const status = fieldStatus(object, props.events, props.today, props.soonThresholdDays, props.source);
  const works = nextWorks(object, props.events, props.today, props.soonThresholdDays, props.source);

  return (
    <div className="card">
      <section className="block">
        <h2>Что это</h2>
        <dl>
          <div className="fact"><dt>Учётный номер</dt><dd>{object.regNumber ?? 'без номера'}</dd></div>
          <div className="fact"><dt>Вид</dt><dd>{elementTitle(object.typeCode)}</dd></div>
          {object.model !== null && <div className="fact"><dt>Марка</dt><dd>{object.model}</dd></div>}
          <div className="fact"><dt>Где</dt><dd>{placeOf(props.snapshot, object.nodeId)}</dd></div>
          <div className="fact">
            <dt>Состояние</dt>
            <dd className={`pill pill-${status.color}`}>{status.label}</dd>
          </div>
        </dl>
      </section>

      <section className="block">
        <h2>Что предстоит</h2>
        {works.length === 0 ? (
          <p className="empty">Работы по этому виду оборудования не заведены в регламенте.</p>
        ) : (
          works.map((work) => (
            <div className="work" key={work.title}>
              <span>{work.title}</span>
              <span className={`work-when${work.overdue ? ' work-overdue' : ''}`}>
                {dateRu(work.date)}
                <br />
                <small>{whenText(work.daysLeft, work.overdue)}</small>
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
