/**
 * Список оборудования на обходе и поиск по нему.
 *
 * Первое, что делает обходчик, — находит предмет: по учётному номеру,
 * написанному на корпусе, или по месту. Поэтому поиск стоит сверху и ищет
 * сразу по номеру, марке, виду и месту: человек не должен угадывать, по какому
 * полю искать.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { elementTitle, type ActivityScheduleSource } from '@izh/core';
import { fieldStatus } from './field-status';
import { placeOf, type FieldSnapshot } from './field-data';

export interface ObjectListProps {
  readonly snapshot: FieldSnapshot;
  readonly objects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  readonly today: string;
  readonly soonThresholdDays: number;
  readonly source: ActivityScheduleSource;
  readonly query: string;
  readonly onQuery: (value: string) => void;
  readonly onOpen: (object: PlanObject) => void;
}

/** Строка поиска приводится к общему виду: регистр и лишние пробелы не в счёт. */
function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}

export function matches(
  object: PlanObject,
  place: string,
  query: string,
): boolean {
  const needle = normalized(query);
  if (needle === '') return true;
  const haystack = [
    object.regNumber ?? '',
    object.model ?? '',
    elementTitle(object.typeCode),
    place,
  ].map(normalized).join(' ');
  return haystack.includes(needle);
}

export function ObjectList(props: ObjectListProps): React.JSX.Element {
  const rows = props.objects
    .map((object) => ({ object, place: placeOf(props.snapshot, object.nodeId) }))
    .filter((row) => matches(row.object, row.place, props.query));

  return (
    <>
      <div className="search">
        <input
          type="search"
          inputMode="search"
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
          placeholder="Номер, марка, вид или место"
          aria-label="Поиск оборудования"
        />
      </div>

      <p className="count">
        {/* Число видно всегда: по нему сразу понятно, сузился поиск или нет. */}
        Найдено: {rows.length} из {props.objects.length}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Ничего не нашлось. Проверьте номер — на корпусе он бывает с буквами.</p>
      ) : (
        <ul className="list">
          {rows.map(({ object, place }) => {
            const status = fieldStatus(object, props.events, props.today, props.soonThresholdDays, props.source);
            return (
              <li key={object.id}>
                <button type="button" className="row" onClick={() => props.onOpen(object)}>
                  <span className="row-head">
                    <span className={`dot dot-${status.color}`} />
                    <span className="row-number">{object.regNumber ?? 'без номера'}</span>
                    <span className={`pill pill-${status.color}`}>{status.label}</span>
                  </span>
                  <span className="row-kind">
                    {elementTitle(object.typeCode)}
                    {object.model !== null && ` · ${object.model}`}
                  </span>
                  <span className="row-place">{place}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
