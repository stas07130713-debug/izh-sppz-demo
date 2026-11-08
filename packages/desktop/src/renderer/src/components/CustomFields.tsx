/**
 * Поля карточки, заведённые пользователем в конструкторе видов (движок E4).
 *
 * Значения хранятся строками, а вид поля решает только, чем их вводят: датой,
 * числом, списком или галочкой. Хранить их разобранными нельзя — описание вида
 * живёт в настройках и меняется, а уже введённое обязано остаться читаемым,
 * даже если поле переделали из числа в список.
 */

import type { CustomElementType } from '@izh/contracts';
import { SelectField } from './SelectField';

export type CustomFieldValues = Readonly<Record<string, string>>;

export interface CustomFieldsProps {
  readonly type: CustomElementType;
  readonly values: CustomFieldValues;
  readonly onChange: (values: CustomFieldValues) => void;
}

export function CustomFields(props: CustomFieldsProps): React.JSX.Element | null {
  if (props.type.fields.length === 0) return null;

  const set = (id: string, value: string): void => props.onChange({ ...props.values, [id]: value });

  return (
    <section className="custom-fields-section">
      <h5>{props.type.title}</h5>
      {props.type.fields.map((field) => {
        const value = props.values[field.id] ?? '';

        if (field.kind === 'да/нет') {
          return (
            <label key={field.id} className="checkbox">
              {/* Галочка хранится теми же строками «да» и «нет», а не true/false:
                  в журнале и в отчёте её показывают словом, и переводить его
                  обратно пришлось бы в каждом месте показа. */}
              <input
                type="checkbox"
                checked={value === 'да'}
                onChange={(event) => set(field.id, event.target.checked ? 'да' : 'нет')}
              />
              <span>{field.title}</span>
            </label>
          );
        }

        return (
          <label key={field.id} className="field">
            <span>
              {field.title}
              {field.unit !== null && <span className="muted small"> , {field.unit}</span>}
            </span>
            {field.kind === 'список' ? (
              <SelectField
                value={value}
                placeholder="— не выбрано —"
                options={field.options.map((option) => ({ value: option, title: option }))}
                onChange={(next) => set(field.id, next)}
              />
            ) : (
              <input
                type={field.kind === 'дата' ? 'date' : field.kind === 'число' ? 'number' : 'text'}
                value={value}
                onChange={(event) => set(field.id, event.target.value)}
              />
            )}
            {field.hint !== null && <span className="muted small">{field.hint}</span>}
          </label>
        );
      })}
    </section>
  );
}

/**
 * Оставляет только те значения, у которых есть поле в нынешнем описании вида.
 *
 * Поле могли убрать из вида уже после того, как его заполнили. Значение такого
 * поля в карточку не показывается — показывать нечего, — но и переписывать его
 * молча нельзя: до сохранения карточки оно остаётся в данных. Отсев делается
 * при сборке, чтобы в свежесохранённой карточке не оставалось невидимых полей.
 */
export function keepKnownFields(type: CustomElementType | null, values: CustomFieldValues): CustomFieldValues | null {
  if (type === null) return null;
  const known = new Set(type.fields.map((field) => field.id));
  const kept: Record<string, string> = {};
  for (const [id, value] of Object.entries(values)) {
    if (known.has(id) && value.trim() !== '') kept[id] = value;
  }
  return kept;
}
