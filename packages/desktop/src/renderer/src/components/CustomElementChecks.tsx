/**
 * Проверки и сроки своего вида — прямо в конструкторе (движок E4).
 *
 * Простой вид того же, что делает конструктор регламентов: «раз в столько-то —
 * вот такие работы». Всё богатство регламентов (измерения, критерии годности,
 * ссылки на пункты НПА, фото и документы) остаётся там, и раздел прямо туда
 * ведёт: заказчик просил простой механизм без излишеств.
 *
 * Записывается это регламентом, а не рядом с описанием вида: сроки считает
 * движок регламентов, и второе хранилище дало бы два ответа на вопрос «когда
 * следующая проверка».
 */

import { useState } from 'react';
import type { RegulationPeriodicity } from '@izh/contracts';
import { periodicityFromInput } from '@izh/core';
import { SelectField } from './SelectField';

type Unit = 'день' | 'месяц' | 'год';

interface Draft {
  readonly id: string;
  readonly title: string;
  readonly every: string;
  readonly unit: Unit;
  readonly works: readonly { readonly id: string; readonly title: string }[];
}

export interface CustomElementChecksProps {
  /** Что уже записано регламентом этого вида. Пусто — проверок ещё нет. */
  readonly current: readonly RegulationPeriodicity[];
  readonly newId: () => string;
  readonly busy: boolean;
  readonly onSave: (periodicities: readonly RegulationPeriodicity[]) => void;
  readonly onOpenRegulations: () => void;
}

const UNITS: readonly Unit[] = ['день', 'месяц', 'год'];

function draftsOf(items: readonly RegulationPeriodicity[]): readonly Draft[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    // Показывается только простое правило «раз в N единиц». Сложное правило —
    // календарное, событийное, по сроку службы — конструктор не притворяется
    // умеющим: оно останется как есть и правится в конструкторе регламентов.
    every: item.rule.kind === 'интервал' ? String(item.rule.every) : '',
    unit: item.rule.kind === 'интервал' ? item.rule.unit : 'месяц',
    works: item.activities.map((activity) => ({ id: activity.id, title: activity.title })),
  }));
}

export function CustomElementChecks(props: CustomElementChecksProps): React.JSX.Element {
  const [drafts, setDrafts] = useState<readonly Draft[]>(() => draftsOf(props.current));
  const [error, setError] = useState<string | null>(null);

  const patch = (id: string, change: Partial<Draft>): void => {
    setDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
    setError(null);
  };

  const save = (): void => {
    for (const draft of drafts) {
      if (draft.title.trim() === '') { setError('У каждой проверки должно быть название.'); return; }
      const every = Number(draft.every);
      if (!Number.isFinite(every) || every < 1) {
        setError(`У проверки «${draft.title}» укажите, раз во сколько она проводится.`);
        return;
      }
      if (draft.works.every((work) => work.title.trim() === '')) {
        setError(`У проверки «${draft.title}» нет ни одной работы: в чек-листе будет пусто.`);
        return;
      }
    }

    props.onSave(drafts.map((draft) => periodicityFromInput({
      id: draft.id,
      title: draft.title,
      every: Number(draft.every),
      unit: draft.unit,
      works: draft.works,
    })));
  };

  return (
    <>
      {drafts.length === 0 && (
        <p className="muted small">
          Проверок пока нет. Пока их нет, элемент этого вида показывается как «нет данных»: сроков
          у него не назначено.
        </p>
      )}

      <ul className="plain-list custom-checks">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <div className="field-row">
              <label className="field">
                <span>Название проверки</span>
                <input
                  value={draft.title}
                  placeholder="Ежемесячный осмотр"
                  onChange={(event) => patch(draft.id, { title: event.target.value })}
                />
              </label>
              <label className="field custom-check-every">
                <span>Раз в</span>
                <input
                  type="number" min={1} value={draft.every}
                  onChange={(event) => patch(draft.id, { every: event.target.value })}
                />
              </label>
              <label className="field custom-check-unit">
                <span>&nbsp;</span>
                <SelectField
                  value={draft.unit}
                  options={UNITS.map((unit) => ({ value: unit, title: unit }))}
                  onChange={(value) => patch(draft.id, { unit: value as Unit })}
                />
              </label>
              <button
                type="button"
                className="link small"
                onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
              >
                убрать
              </button>
            </div>

            <div className="custom-works">
              <span className="muted small">Что делают при этой проверке — строки чек-листа:</span>
              {draft.works.map((work) => (
                <div key={work.id} className="custom-work-row">
                  <input
                    value={work.title}
                    placeholder="Осмотреть, нет ли повреждений"
                    onChange={(event) => patch(draft.id, {
                      works: draft.works.map((item) => (item.id === work.id
                        ? { ...item, title: event.target.value }
                        : item)),
                    })}
                  />
                  <button
                    type="button"
                    className="link small"
                    onClick={() => patch(draft.id, { works: draft.works.filter((item) => item.id !== work.id) })}
                  >
                    убрать
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="link small"
                onClick={() => patch(draft.id, { works: [...draft.works, { id: props.newId(), title: '' }] })}
              >
                добавить работу
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error !== null && <p className="error">{error}</p>}

      <div className="actions">
        <button
          type="button"
          onClick={() => setDrafts((current) => [...current, {
            id: props.newId(), title: '', every: '1', unit: 'месяц',
            works: [{ id: props.newId(), title: '' }],
          }])}
        >
          Добавить проверку
        </button>
        <button type="button" className="primary" disabled={props.busy} onClick={save}>
          Сохранить проверки
        </button>
      </div>

      {/* Правки выпускаются новой версией регламента: записи журнала ссылаются
          на версию, и прошлые проверки сохраняют свой состав работ. */}
      <p className="muted small">
        Сохранение выпускает новую версию регламента этого вида: проведённые проверки сохраняют тот
        состав работ, который действовал в их день. Измерения, критерии годности и ссылки на
        нормативные документы задаются в{' '}
        <button type="button" className="link" onClick={props.onOpenRegulations}>
          конструкторе регламентов
        </button>.
      </p>
    </>
  );
}
