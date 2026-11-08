/**
 * Шаблон заявки: название, графы и подписи (ТЗ, Дополнение 6, часть С54).
 *
 * Графа — это пара «как назвать» и «откуда взять». Название пишет пользователь,
 * источник выбирается из каталога ядра: подставить программа может только то,
 * что уже знает. Своя графа остаётся пустой — её заполняют от руки в готовом
 * документе, и это сказано прямо, чтобы её не искали в данных.
 */

import { REQUEST_COLUMN_SOURCES, requestColumnSource } from '@izh/core';
import type { RequestColumn } from '@izh/contracts';
import { SelectField } from './SelectField';

export interface RequestTemplateEditorProps {
  readonly documentTitle: string;
  readonly onDocumentTitleChange: (value: string) => void;
  readonly columns: readonly RequestColumn[];
  readonly onColumnsChange: (columns: readonly RequestColumn[]) => void;
  readonly footer: readonly string[];
  readonly onFooterChange: (footer: readonly string[]) => void;
}

export function RequestTemplateEditor(props: RequestTemplateEditorProps): React.JSX.Element {
  const { columns, onColumnsChange } = props;

  const replace = (at: number, column: RequestColumn): void =>
    onColumnsChange(columns.map((item, index) => (index === at ? column : item)));

  const move = (at: number, direction: -1 | 1): void => {
    const target = at + direction;
    if (columns[target] === undefined) return;
    onColumnsChange(columns.map((item, index) =>
      index === at ? (columns[target] as RequestColumn) : index === target ? (columns[at] as RequestColumn) : item));
  };

  return (
    <>
      <label className="field">
        <span>Название заявки в документе</span>
        <input
          value={props.documentTitle}
          placeholder="Заявка на техническое обслуживание"
          onChange={(event) => props.onDocumentTitleChange(event.target.value)}
        />
      </label>

      <h4>Графы заявки</h4>
      <p className="muted small">
        Слева — как графа называется в документе, справа — откуда берётся значение. «Своя графа»
        остаётся пустой: её заполняют от руки уже в готовом файле.
      </p>

      <ul className="request-columns">
        {columns.map((column, index) => (
          <li key={index} className="request-column">
            <input
              value={column.title}
              placeholder="Заголовок графы"
              onChange={(event) => replace(index, { ...column, title: event.target.value })}
            />
            <SelectField
              value={column.source}
              options={REQUEST_COLUMN_SOURCES.map((item) => ({ value: item.id, title: item.title }))}
              onChange={(next) => {
                const source = requestColumnSource(next);
                // Название подставляется вместе с источником, только если его
                // ещё не переписали своим: иначе выбор источника затирал бы
                // заголовок, который человек уже набрал.
                const keepTitle = column.title.trim() !== ''
                  && requestColumnSource(column.source)?.title !== column.title;
                replace(index, {
                  title: keepTitle ? column.title : source?.title ?? column.title,
                  source: next,
                });
              }}
            />
            <span className="request-column-move">
              <button
                type="button" aria-label="Левее" title="Левее"
                disabled={index === 0} onClick={() => move(index, -1)}
              >←</button>
              <button
                type="button" aria-label="Правее" title="Правее"
                disabled={index === columns.length - 1} onClick={() => move(index, 1)}
              >→</button>
              <button
                type="button" className="danger" aria-label="Убрать графу" title="Убрать графу"
                onClick={() => onColumnsChange(columns.filter((_, at) => at !== index))}
              >✕</button>
            </span>
            <span className="muted small request-column-hint">
              {requestColumnSource(column.source)?.hint ?? ''}
            </span>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button
          type="button"
          onClick={() => onColumnsChange([...columns, { title: 'Новая графа', source: 'свой' }])}
        >
          + Добавить графу
        </button>
      </div>

      <h4>Подписи под таблицей</h4>
      <p className="muted small">
        Каждая строка печатается под заявкой отдельной строкой: должность, подпись, дата.
      </p>
      <textarea
        rows={4}
        value={props.footer.join('\n')}
        placeholder={'Заявку составил: ______________ / ______________ /\nДата: «__» __________ 20__ г.'}
        onChange={(event) => props.onFooterChange(
          event.target.value.split('\n').filter((line) => line.trim() !== ''),
        )}
      />
    </>
  );
}
