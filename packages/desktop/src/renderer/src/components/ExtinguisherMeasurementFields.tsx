import type { MaintenanceMeasurement } from '@izh/contracts';

interface ExtinguisherMeasurementFieldsProps {
  readonly typeCode: string;
  readonly values: ReadonlyMap<string, string>;
  readonly onChange: (code: string, value: string) => void;
}

interface MeasurementField {
  readonly code: string;
  readonly label: string;
  readonly unit: string | null;
  readonly kind?: 'text' | 'number';
}

/** Поля измерений для вида оборудования. Экспортируется ради сплошной проверки. */
export function fieldsFor(typeCode: string): readonly MeasurementField[] {
  if (typeCode === 'extinguisher-co2' || typeCode === 'extinguisher-halon') return [
    { code: 'tare-mass-kg', label: 'Конструкционная масса', unit: 'кг', kind: 'number' },
    { code: 'initial-agent-mass-kg', label: 'Первоначальная масса ОТВ', unit: 'кг', kind: 'number' },
    { code: 'actual-full-mass-kg', label: 'Фактическая полная масса', unit: 'кг', kind: 'number' },
    { code: 'allowed-loss-percent', label: 'Допустимая потеря', unit: '%', kind: 'number' },
    { code: 'horn-condition', label: 'Состояние раструба', unit: null },
  ];
  if (typeCode === 'extinguisher-powder') return [
    { code: 'pressure-mpa', label: 'Фактическое давление', unit: 'МПа', kind: 'number' },
    { code: 'full-mass-kg', label: 'Фактическая масса', unit: 'кг', kind: 'number' },
    { code: 'pressure-sector', label: 'Положение стрелки', unit: null },
    { code: 'powder-brand', label: 'Марка порошка', unit: null },
    { code: 'powder-sample', label: 'Результат выборочной проверки порошка', unit: null },
  ];
  if (typeCode === 'extinguisher-water' || typeCode === 'extinguisher-foam'
    || typeCode === 'extinguisher-emulsion' || typeCode === 'extinguisher-bantl') return [
    { code: 'agent-volume-l', label: 'Фактический объем ОТВ', unit: 'л', kind: 'number' },
    { code: 'agent-brand', label: 'Марка/состав ОТВ', unit: null },
    { code: 'agent-concentration-percent', label: 'Концентрация', unit: '%', kind: 'number' },
    { code: 'inner-coating-condition', label: 'Состояние внутреннего покрытия', unit: null },
  ];
  return [];
}

export function measurementsFrom(
  typeCode: string,
  values: ReadonlyMap<string, string>,
): readonly MaintenanceMeasurement[] {
  const result: MaintenanceMeasurement[] = fieldsFor(typeCode).flatMap((field) => {
    const raw = values.get(field.code)?.trim() ?? '';
    if (raw === '') return [];
    const numeric = field.kind === 'number' ? Number(raw.replace(',', '.')) : Number.NaN;
    return [{ code: field.code, label: field.label, value: Number.isFinite(numeric) ? numeric : raw, unit: field.unit }];
  });
  if (typeCode === 'extinguisher-co2' || typeCode === 'extinguisher-halon') {
    const tare = numeric(values, 'tare-mass-kg');
    const initial = numeric(values, 'initial-agent-mass-kg');
    const actualFull = numeric(values, 'actual-full-mass-kg');
    if (tare !== null && initial !== null && actualFull !== null && initial > 0) {
      const actualAgent = actualFull - tare;
      const loss = initial - actualAgent;
      result.push(
        { code: 'actual-agent-mass-kg', label: 'Фактическая масса ОТВ', value: round(actualAgent), unit: 'кг' },
        { code: 'mass-loss-kg', label: 'Потеря массы', value: round(loss), unit: 'кг' },
        { code: 'mass-loss-percent', label: 'Потеря массы', value: round((loss / initial) * 100), unit: '%' },
      );
    }
  }
  return result;
}

export function ExtinguisherMeasurementFields(props: ExtinguisherMeasurementFieldsProps): React.JSX.Element | null {
  const fields = fieldsFor(props.typeCode);
  if (fields.length === 0) return null;
  const calculated = measurementsFrom(props.typeCode, props.values);
  const loss = calculated.find((item) => item.code === 'mass-loss-percent');
  return <details className="measurement-fields">
    <summary>Дополнительные измерения (необязательно)</summary>
    <div className="measurement-grid">
      {fields.map((field) => <label className="field" key={field.code}><span>{field.label}{field.unit === null ? '' : `, ${field.unit}`}</span>
        <input inputMode={field.kind === 'number' ? 'decimal' : undefined} value={props.values.get(field.code) ?? ''} onChange={(e) => props.onChange(field.code, e.target.value)} />
      </label>)}
    </div>
    {loss !== undefined && <p className="muted small">Рассчитанная потеря массы: {String(loss.value)}%.</p>}
  </details>;
}

function numeric(values: ReadonlyMap<string, string>, code: string): number | null {
  const value = Number((values.get(code) ?? '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
