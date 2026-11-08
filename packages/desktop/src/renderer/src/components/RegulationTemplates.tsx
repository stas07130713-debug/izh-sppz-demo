/**
 * Шаблоны регламентов (ТЗ, Дополнение 5, часть Р12).
 *
 * Смысл шаблона — повтор: настроив порядок обслуживания кранов в одном цехе,
 * тот же порядок переносят в остальные, не набирая состав работ заново.
 *
 * Шаблон ничего не назначает сам по себе. Он только заполняет черновик, а
 * действующим регламент становится, лишь когда пользователь выпустит версию.
 * Иначе применение шаблона молча меняло бы сроки по всему предприятию.
 */

import { useState } from 'react';
import type { RegulationTemplate } from '@izh/contracts';
import { SelectField } from './SelectField';

export interface RegulationTemplatesProps {
  readonly typeCode: string;
  readonly templates: readonly RegulationTemplate[];
  readonly busy: boolean;
  readonly onApply: (template: RegulationTemplate) => void;
  readonly onSave: (title: string) => void;
}

export function RegulationTemplates(props: RegulationTemplatesProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [naming, setNaming] = useState(false);

  // Шаблон одного вида оборудования к другому не подходит: состав работ у
  // огнетушителя и у пожарного крана общего не имеет.
  const own = props.templates.filter((template) => template.typeCode === props.typeCode);
  const selected = own.find((template) => template.id === selectedId) ?? null;

  return (
    <section className="regulation-templates">
      <h4>Шаблоны</h4>

      {own.length === 0 ? (
        <p className="muted small">Шаблонов по этому виду оборудования пока нет.</p>
      ) : (
        <div className="field-row">
          <label className="field">
            <span>Готовый шаблон</span>
            <SelectField
              value={selectedId}
              placeholder="— выберите —"
              disabled={props.busy}
              options={own.map((template) => ({
                value: template.id,
                title: `${template.title} (периодичностей: ${template.periodicities.length})`,
              }))}
              onChange={setSelectedId}
            />
          </label>
          <button
            type="button"
            disabled={props.busy || selected === null}
            onClick={() => { if (selected !== null) props.onApply(selected); }}
          >
            Применить к черновику
          </button>
        </div>
      )}

      {naming ? (
        <div className="field-row">
          <label className="field">
            <span>Название шаблона</span>
            <input
              value={title}
              autoFocus
              placeholder="Порядок для цехов с постоянным присутствием"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={props.busy || title.trim() === ''}
            onClick={() => { props.onSave(title); setTitle(''); setNaming(false); }}
          >
            Сохранить
          </button>
          <button type="button" className="link" onClick={() => setNaming(false)}>отмена</button>
        </div>
      ) : (
        <button type="button" className="link" disabled={props.busy} onClick={() => setNaming(true)}>
          Сохранить текущий черновик как шаблон
        </button>
      )}

      <p className="muted small">
        Применение шаблона заполняет черновик, но ничего не меняет в действующем регламенте: он
        начнёт действовать, только когда вы выпустите версию.
      </p>
    </section>
  );
}
