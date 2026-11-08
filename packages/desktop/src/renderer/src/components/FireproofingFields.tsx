/**
 * Поля карточки огнезащитной обработки (ТЗ, Дополнение 6).
 *
 * Огнезащита — не изделие на стене, а состояние конструкции: её нанесли, у неё
 * есть срок действия, и по его истечении её возобновляют. Поэтому здесь нет ни
 * заводского номера, ни срока службы по паспорту: есть обработанная
 * конструкция, состав, дата обработки и до какого числа она действует.
 */

import { FIREPROOFED_STRUCTURES, FIREPROOFING_KINDS, FIREPROOFING_REQUIREMENTS } from '@izh/core';
import type { FireproofingProfile } from '@izh/contracts';
import { ComboField } from './ComboField';
import { SelectField } from './SelectField';

export const EMPTY_FIREPROOFING: FireproofingProfile = {
  structure: null,
  treatmentKind: null,
  material: null,
  manufacturer: null,
  areaM2: null,
  requirement: null,
  treatedOn: null,
  warrantyYears: null,
  performer: null,
};

export interface FireproofingFieldsProps {
  readonly value: FireproofingProfile;
  readonly onChange: (value: FireproofingProfile) => void;
}

/** Число из поля ввода: пустая строка и мусор дают «не указано», а не ноль. */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * До какого числа действует обработка.
 *
 * Считается, а не вводится: срок отсчитывается от даты обработки по гарантии
 * изготовителя, и вводить его отдельно значило бы завести вторую версию того
 * же числа, которая разойдётся с первой.
 */
function expiresOn(treatedOn: string | null, years: number | null): string | null {
  if (treatedOn === null || years === null) return null;
  const [year, month, day] = treatedOn.split('-').map((part) => Number(part));
  if (year === undefined || month === undefined || day === undefined) return null;
  return `${String(year + years).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function FireproofingFields(props: FireproofingFieldsProps): React.JSX.Element {
  const set = <K extends keyof FireproofingProfile>(key: K, value: FireproofingProfile[K]): void =>
    props.onChange({ ...props.value, [key]: value });
  const expires = expiresOn(props.value.treatedOn, props.value.warrantyYears);

  return (
    <>
      <ComboField
        label="Что обработано"
        value={props.value.structure}
        options={FIREPROOFED_STRUCTURES}
        onChange={(structure) => set('structure', structure)}
      />

      <label className="field">
        <span>Вид огнезащиты</span>
        <SelectField
          value={props.value.treatmentKind ?? ''}
          placeholder="не указан"
          options={FIREPROOFING_KINDS.map((item) => ({ value: item, title: item }))}
          onChange={(value) => set('treatmentKind', value === '' ? null : value)}
        />
      </label>

      <div className="field-row">
        <label className="field"><span>Марка состава</span>
          <input
            value={props.value.material ?? ''}
            placeholder="ОГРАКС-МСК"
            onChange={(event) => set('material', event.target.value.trim() === '' ? null : event.target.value)}
          />
        </label>
        <label className="field"><span>Изготовитель состава</span>
          <input
            value={props.value.manufacturer ?? ''}
            placeholder="ЗАО «Унихимтек»"
            onChange={(event) => set('manufacturer', event.target.value.trim() === '' ? null : event.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field"><span>Площадь обработки, м²</span>
          <input
            inputMode="decimal" placeholder="640" value={props.value.areaM2 ?? ''}
            onChange={(event) => set('areaM2', numberOrNull(event.target.value))}
          />
        </label>
        <ComboField
          label="Требуемый показатель"
          value={props.value.requirement}
          options={FIREPROOFING_REQUIREMENTS}
          onChange={(requirement) => set('requirement', requirement)}
        />
      </div>

      <div className="field-row">
        <label className="field"><span>Дата обработки</span>
          <input
            type="date" title="Пример: 15.03.2026" value={props.value.treatedOn ?? ''}
            onChange={(event) => set('treatedOn', event.target.value === '' ? null : event.target.value)}
          />
        </label>
        <label className="field"><span>Срок действия по документации, лет</span>
          <input
            inputMode="numeric" placeholder="5" value={props.value.warrantyYears ?? ''}
            onChange={(event) => set('warrantyYears', numberOrNull(event.target.value))}
          />
        </label>
      </div>

      {/* Дата окончания считается сама: вводить её отдельно значило бы завести
          вторую версию того же числа, которая разойдётся с первой. */}
      {expires !== null && (
        <p className="muted small">
          Обработка действует до {expires.split('-').reverse().join('.')}. По истечении её возобновляют.
        </p>
      )}

      <label className="field"><span>Кто выполнял обработку</span>
        <input
          value={props.value.performer ?? ''}
          placeholder="ООО «Огнезащита», лицензия МЧС"
          onChange={(event) => set('performer', event.target.value.trim() === '' ? null : event.target.value)}
        />
      </label>
    </>
  );
}
