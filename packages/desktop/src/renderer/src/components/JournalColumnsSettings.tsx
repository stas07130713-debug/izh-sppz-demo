/**
 * Состав таблицы журнала по видам оборудования.
 *
 * Заказчик: «вкладка журнал должна сразу отображать три основные функции:
 * 1 — возможность изменять состав таблицы относительно каждого элемента».
 *
 * Настройка своя у каждого вида: у огнетушителя одни графы, у противопожарной
 * двери другие, и общий список сводил бы их к наименьшему общему.
 *
 * Правка записывается сразу, без общей кнопки. Галочка выглядит действием, а
 * не заполнением поля: кто снял её и закрыл окно крестиком, вправе считать,
 * что графа убрана (урок части С140).
 */

import { useState } from 'react';
import type { AppSettings } from '@izh/contracts';
import { elementByCode, elementsFor } from '@izh/core';
import { ElementTypePicker } from './ElementTypePicker';
import {
  journalColumnChoices, hiddenJournalColumns, resetJournalColumns, toggleJournalColumn,
} from './journal-column-choice';

export interface JournalColumnsSettingsProps {
  readonly columns: AppSettings['journalColumns'];
  /** Записывается сразу: окно при этом остаётся открытым. */
  readonly onCommit: (columns: AppSettings['journalColumns']) => void;
}

/** Все виды программы одним списком — журнал ведут по любому из них. */
function allTypes(): ReturnType<typeof elementsFor> {
  const seen = new Map<string, ReturnType<typeof elementsFor>[number]>();
  for (const kind of ['general', 'floor', 'storage'] as const) {
    for (const type of elementsFor(kind)) seen.set(type.typeCode, type);
  }
  return [...seen.values()];
}

export function JournalColumnsSettings(props: JournalColumnsSettingsProps): React.JSX.Element {
  const types = allTypes();
  const [typeCode, setTypeCode] = useState(types[0]?.typeCode ?? 'extinguisher');

  const choices = journalColumnChoices(typeCode);
  const hidden = hiddenJournalColumns(typeCode, { journalColumns: props.columns });
  const shownCount = choices.length - choices.filter((choice) => hidden.has(choice.key)).length;

  /** Виды, у которых что-то убрано, — чтобы настройку было видно целиком. */
  const changed = Object.keys(props.columns);

  return (
    <section className="settings-section">
      <h4>Состав таблицы журнала</h4>
      <p className="muted small">
        Какие графы показывать по каждому виду оборудования — на экране и в выгруженном журнале.
        Графы проверок задаёт регламент: они ниже, отдельной настройкой.
      </p>

      <label className="field">
        <span>Вид оборудования</span>
        <ElementTypePicker types={types} value={typeCode} onChange={setTypeCode} />
      </label>

      <div className="journal-columns-list">
        {choices.map((choice) => (
          <label key={choice.key} className="checkbox">
            <input
              type="checkbox"
              checked={!hidden.has(choice.key)}
              onChange={() => props.onCommit(toggleJournalColumn(
                { journalColumns: props.columns }, typeCode, choice.key,
              ))}
            />
            <span>{choice.title}</span>
          </label>
        ))}
      </div>

      <p className="muted small">
        {/* Графа «№» не выключается: по ней строки считают и на неё ссылаются
            в замечаниях проверяющего. */}
        Показано граф: {shownCount} из {choices.length}. Номер по порядку стоит всегда.
      </p>

      {hidden.size > 0 && (
        <button
          type="button"
          onClick={() => props.onCommit(resetJournalColumns({ journalColumns: props.columns }, typeCode))}
        >
          Вернуть все графы этому виду
        </button>
      )}

      {changed.length > 0 && (
        <p className="muted small">
          Состав изменён у видов: {changed
            .map((code) => elementByCode(code)?.title ?? code)
            .join(', ')}.
        </p>
      )}
    </section>
  );
}
