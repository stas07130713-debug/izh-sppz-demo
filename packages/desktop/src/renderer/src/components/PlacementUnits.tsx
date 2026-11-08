/**
 * Единицы комплекта в одном месте хранения (ТЗ, Дополнение 6).
 *
 * Самоспасатели хранят шкафом: на схеме одна точка, а в ней пять штук. Здесь
 * они перечислены поштучно и раскрываются по одной.
 *
 * Учёт поштучный, потому что иначе не разобраться: у каждой штуки свой
 * заводской номер и свой срок службы по паспорту, и при замене одной из пяти
 * иначе неясно, какую заменили и когда истекает срок у остальных.
 *
 * Ответственный и примечание сюда не входят — они общие для места и живут в
 * карточке выше. Повторять их у каждой штуки значило бы заставлять править
 * пять одинаковых строк.
 */

import { useState } from 'react';
import type { PlanObject } from '@izh/contracts';
import { placementContents } from '@izh/core';
import { formatDateRu } from '../format';

export interface PlacementUnitFields {
  readonly regNumber: string;
  readonly model: string;
  readonly manufacturer: string;
  readonly serialNumber: string;
  readonly commissionedOn: string;
  readonly serviceLifeYears: string;
}

export interface PlacementUnitsProps {
  readonly head: PlanObject;
  readonly objects: readonly PlanObject[];
  readonly busy: boolean;
  readonly onSetCount: (count: number) => void;
  readonly onSaveUnit: (unit: PlanObject, fields: PlacementUnitFields) => void;
  /**
   * Единица, которую надо раскрыть сразу.
   *
   * В журнале строка на каждую штуку, и щелчок по ней обязан открыть именно её
   * сведения. Иначе пользователь попадает в общую карточку места и ищет нужную
   * штуку заново — при том что он только что по ней и щёлкнул.
   */
  readonly focusUnitId: string | null;
}

function fieldsOf(unit: PlanObject): PlacementUnitFields {
  return {
    regNumber: unit.regNumber ?? '',
    model: unit.model ?? '',
    manufacturer: unit.manufacturer ?? '',
    serialNumber: unit.serialNumber ?? '',
    commissionedOn: unit.commissionedOn ?? '',
    serviceLifeYears: unit.serviceLifeYears === null || unit.serviceLifeYears === undefined
      ? '' : String(unit.serviceLifeYears),
  };
}

export function PlacementUnits(props: PlacementUnitsProps): React.JSX.Element {
  const units = placementContents(props.objects, props.head);
  const focused = units.find((unit) => unit.id === props.focusUnitId) ?? null;
  const [openId, setOpenId] = useState<string | null>(focused?.id ?? null);
  const [draft, setDraft] = useState<PlacementUnitFields | null>(focused === null ? null : fieldsOf(focused));
  const [count, setCount] = useState(String(units.length));

  const open = (unit: PlanObject): void => {
    if (openId === unit.id) { setOpenId(null); setDraft(null); return; }
    setOpenId(unit.id);
    setDraft(fieldsOf(unit));
  };

  const set = <K extends keyof PlacementUnitFields>(field: K, value: PlacementUnitFields[K]): void =>
    setDraft((current) => (current === null ? current : { ...current, [field]: value }));

  return (
    <section className="placement-units">
      <h4>Единицы в этом месте хранения</h4>
      <p className="muted small">
        Каждая учитывается отдельно: свой номер, своя марка, свой заводской номер и срок службы,
        своя строка в журнале. На плане они показаны одной точкой с числом штук.
        Ответственный, помещение и примечание общие для места — они выше.
      </p>

      <div className="field-row placement-count">
        <label className="field">
          <span>Сколько штук хранится</span>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={props.busy || Number(count) === units.length || Number(count) < 1}
          onClick={() => props.onSetCount(Math.trunc(Number(count)))}
        >
          Применить
        </button>
      </div>

      <ul className="placement-list">
        {units.map((unit, index) => {
          const expanded = openId === unit.id;
          return (
            <li key={unit.id} className={expanded ? 'placement-unit open' : 'placement-unit'}>
              <button type="button" className="placement-unit-head" onClick={() => open(unit)}>
                <span className="muted small">{index + 1}.</span>
                <span className="placement-unit-title">
                  № {unit.regNumber ?? '—'}
                  {unit.model === null ? '' : ` · ${unit.model}`}
                </span>
                {/* Точка размещения — та единица, что стоит на плане: её видно
                    по значку, и путать её с остальными не нужно. */}
                {unit.id === props.head.id && <small className="muted">на плане</small>}
                <small className="muted">{expanded ? '▾' : '▸'}</small>
              </button>

              {expanded && draft !== null && (
                <div className="placement-unit-body">
                  <label className="field"><span>Учётный номер</span>
                    <input value={draft.regNumber} placeholder="СИЗ-14" onChange={(event) => set('regNumber', event.target.value)} />
                  </label>
                  <div className="field-row">
                    <label className="field"><span>Марка, модель</span>
                      <input value={draft.model} placeholder="ГДЗК-У" onChange={(event) => set('model', event.target.value)} />
                    </label>
                    <label className="field"><span>Производитель</span>
                      <input value={draft.manufacturer} placeholder="АО «Сорбент»" onChange={(event) => set('manufacturer', event.target.value)} />
                    </label>
                  </div>
                  <div className="field-row">
                    <label className="field"><span>Заводской №</span>
                      <input value={draft.serialNumber} placeholder="2451-00874" onChange={(event) => set('serialNumber', event.target.value)} />
                    </label>
                    <label className="field"><span>Срок службы по паспорту, лет</span>
                      <input
                        inputMode="numeric"
                        value={draft.serviceLifeYears}
                        placeholder="5"
                        onChange={(event) => set('serviceLifeYears', event.target.value)}
                      />
                    </label>
                  </div>
                  <label className="field"><span>Дата размещения / ввода в эксплуатацию</span>
                    <input
                      type="date"
                      title="Пример: 15.03.2026"
                      value={draft.commissionedOn}
                      onChange={(event) => set('commissionedOn', event.target.value)}
                    />
                  </label>
                  {draft.commissionedOn !== '' && (
                    <p className="muted small">В журнале и карточке: {formatDateRu(draft.commissionedOn)}.</p>
                  )}

                  <div className="actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={props.busy}
                      onClick={() => props.onSaveUnit(unit, draft)}
                    >
                      Сохранить единицу
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
