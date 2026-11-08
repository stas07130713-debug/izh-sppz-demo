/**
 * Конструктор регламентов ТО (ТЗ, Дополнение 5, часть Р13).
 *
 * Вид ровно тот, что описал заказчик: раскрывающиеся периодичности с
 * переключателем «использовать», внутри — состав работ галочками, снизу
 * локальный документ и действия. Настройка должна быть понятна без знания
 * программирования, поэтому здесь нет ни кодов мероприятий, ни выражений
 * периодичности — только названия и галочки.
 *
 * Изменения копятся в черновике и уходят в хранилище **новой версией**
 * (часть Р9): действующая версия не переписывается, иначе прошлые записи
 * журнала начали бы показывать сегодняшний чек-лист.
 */

import { useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { RegulationActivity, RegulationPeriodicity } from '@izh/contracts';
import { canDisableActivity } from '@izh/engine-regulations';
import { PERIODICITY_OPTIONS, periodicityTitle } from '@izh/core';
import { describePeriodicity } from './periodicity-text';
import { SelectField } from './SelectField';

export interface RegulationConstructorProps {
  readonly typeTitle: string;
  /** Оговорка над составом: чем задан порядок обслуживания этого вида. */
  readonly note?: string | null;
  readonly periodicities: readonly RegulationPeriodicity[];
  readonly busy: boolean;
  readonly onChange: (periodicities: readonly RegulationPeriodicity[]) => void;
  readonly onAddActivity: (periodicityId: string) => void;
  /** Завести срок, которого в регламенте ещё нет. */
  readonly onAddPeriodicity: (months: number) => void;
  readonly onPreview: () => void;
  readonly onRelease: () => void;
}

/** Сколько месяцев в правиле, если оно интервальное. Иначе срок задан иначе. */
function monthsOf(rule: RegulationPeriodicity['rule']): number | null {
  if (rule.kind !== 'интервал') return null;
  if (rule.unit === 'месяц') return rule.every;
  if (rule.unit === 'год') return rule.every * 12;
  return null;
}

export function RegulationConstructor(props: RegulationConstructorProps): React.JSX.Element {
  /** Обязательное требование, которое пользователь собрался отключить. */
  const [confirming, setConfirming] = useState<{ periodicityId: string; activity: RegulationActivity } | null>(null);
  /*
   * Состав работ открывается свёрнутым.
   *
   * Заказчик: «не раскрывать сразу структуру вложения». Периодичностей у
   * вида до полудюжины, у каждой с десяток работ, и раскрытые разом они
   * дают простыню на три экрана — в ней не найти ту периодичность, ради
   * которой пришли. Нужную раскрывают щелчком.
   */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggleExpanded = (id: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const replace = (id: string, change: (item: RegulationPeriodicity) => RegulationPeriodicity): void => {
    props.onChange(props.periodicities.map((item) => (item.id === id ? change(item) : item)));
  };

  const toggleUse = (item: RegulationPeriodicity): void => {
    const enabled = !item.enabled;
    replace(item.id, (current) => ({
      ...current,
      enabled,
      // Верхняя галочка управляет всей ветвью. После массового включения
      // отдельные работы по-прежнему можно снять вручную.
      activities: current.activities.map((activity) => ({ ...activity, required: enabled })),
    }));
  };

  /**
   * Смена срока организацией (ТЗ, Дополнение 5).
   *
   * Нужна там, где норматив называет мероприятия, но не называет периодичности:
   * пожарный щит, работы по внутреннему регламенту, изделия с иным сроком по
   * документации изготовителя. Раньше срок было не изменить вовсе — он приходил
   * из библиотеки и оставался таким навсегда.
   *
   * Название меняется вместе с правилом: иначе на строке остаётся «Ежемесячно»,
   * а считается раз в квартал, и разойдутся они молча.
   */
  const setMonths = (item: RegulationPeriodicity, months: number): void => {
    replace(item.id, (current) => ({
      ...current,
      title: periodicityTitle(months),
      rule: { kind: 'интервал' as const, every: months, unit: 'месяц' as const },
    }));
  };

  /** Снимает или ставит галочку без лишних вопросов. */
  const setRequired = (periodicityId: string, activityId: string, required: boolean): void => {
    replace(periodicityId, (current) => ({
      ...current,
      // Включённая вручную работа не может жить внутри выключенного раздела.
      enabled: required ? true : current.enabled,
      activities: current.activities.map((item) => (item.id === activityId ? { ...item, required } : item)),
    }));
  };

  /**
   * Включение и выключение работы внутри периодичности.
   *
   * Выключенная работа не удаляется из регламента, а помечается необязательной:
   * состав нормативной библиотеки должен остаться виден, чтобы было понятно, от
   * чего именно организация отказалась.
   *
   * Требование нормативного правового акта отключить можно, но не молча: сперва
   * показывается предупреждение с указанием документа и пункта, и нужно
   * подтверждение. Запрещать вовсе неправильно — бывают элементы, к которым
   * требование не относится, — но и снимать его наравне с рекомендацией ГОСТ
   * нельзя: за это отвечают перед проверяющим.
   */
  const toggleActivity = (periodicityId: string, activity: RegulationActivity): void => {
    const turningOff = activity.required;
    if (turningOff && !canDisableActivity(activity)) {
      setConfirming({ periodicityId, activity });
      return;
    }
    setRequired(periodicityId, activity.id, !activity.required);
  };

  return (
    <div className="regulation-constructor">
      <div className="panel-head">
        <h3>{props.typeTitle}</h3>
        <span className="muted small">Регламент технического обслуживания</span>
      </div>

      {props.note !== undefined && props.note !== null && (
        <p className="banner note">{props.note}</p>
      )}

      {/* Свой срок добавляется сюда же: список тот же, что и у существующих. */}
      <div className="periodicity-add">
        <label className="inline-field">
          <span className="muted small">Добавить срок</span>
          <SelectField
            value=""
            placeholder="— выберите —"
            disabled={props.busy}
            options={PERIODICITY_OPTIONS
              .filter((months) => !props.periodicities.some((item) => monthsOf(item.rule) === months))
              .map((months) => ({ value: String(months), title: periodicityTitle(months) }))}
            onChange={(value) => {
              const months = Number(value);
              if (!Number.isFinite(months) || months <= 0) return;
              props.onAddPeriodicity(months);
            }}
          />
        </label>
      </div>

      {props.periodicities.length === 0 && (
        <p className="muted small">
          Для этого вида оборудования нормативная библиотека пока пуста. Добавьте периодичность и
          мероприятия — они станут регламентом организации.
        </p>
      )}

      {props.periodicities.map((item) => {
        const open = expanded.has(item.id);
        return (
          <section key={item.id} className={item.enabled ? 'periodicity used' : 'periodicity'}>
            <div className="periodicity-head">
              <button
                type="button"
                className="link periodicity-toggle"
                onClick={() => toggleExpanded(item.id)}
                title={open ? 'Свернуть состав' : 'Показать состав'}
              >
                {open ? '▼' : '▶'} {item.title}
              </button>

              {/* Срок выбирается списком: те же названия, что в чек-листе. */}
              <label className="inline-field">
                <span className="muted small">Срок</span>
                <SelectField
                  value={monthsOf(item.rule) === null ? '' : String(monthsOf(item.rule))}
                  placeholder={describePeriodicity(item.rule)}
                  disabled={props.busy}
                  options={PERIODICITY_OPTIONS.map((months) => ({
                    value: String(months), title: periodicityTitle(months),
                  }))}
                  onChange={(value) => setMonths(item, Number(value))}
                />
              </label>

              <label className="checkbox periodicity-use">
                <input type="checkbox" checked={item.enabled} onChange={() => toggleUse(item)} disabled={props.busy} />
                <span className="small">Использовать</span>
              </label>
            </div>

            {open && (
              <div className="periodicity-body">
                {item.activities.length === 0 ? (
                  <p className="muted small">Состав работ не задан.</p>
                ) : (
                  <ul className="activity-list">
                    {item.activities.map((activity) => {
                      const mandatory = !canDisableActivity(activity);
                      return (
                        <li key={activity.id}>
                          <label className={mandatory ? 'checkbox mandatory' : 'checkbox'}>
                            <input
                              type="checkbox"
                              checked={activity.required}
                              disabled={props.busy}
                              onChange={() => toggleActivity(item.id, activity)}
                            />
                            <span className="small">{activity.title}</span>
                          </label>

                          {/* Основание видно всегда: пользователь должен понимать,
                              почему одну работу отключить нельзя, а другую можно. */}
                          <div className="muted small activity-source">
                            {activity.sources.map((source) => source.reference).join('; ')}
                            {mandatory && <span className="badge warn"> обязательное по НПА</span>}
                            {activity.answerKind === 'число' && <span className="badge"> измерение</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button type="button" className="link" disabled={props.busy} onClick={() => props.onAddActivity(item.id)}>
                  + Добавить своё мероприятие
                </button>
              </div>
            )}
          </section>
        );
      })}

      <div className="actions regulation-actions">
        <button type="button" disabled={props.busy} onClick={props.onPreview}>
          Просмотреть итоговый регламент
        </button>
        <button type="button" className="primary" disabled={props.busy} onClick={props.onRelease}>
          Выпустить новую версию
        </button>
      </div>

      {confirming !== null && (
        <div className="modal-backdrop" {...backdropClose(() => setConfirming(null))}>
          <div className="modal confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-head"><h3>Отключить обязательное требование?</h3></div>
            <p><strong>{confirming.activity.title}</strong></p>
            <p className="banner error">
              Это прямое требование нормативного правового акта. Отключив его, организация
              берёт на себя ответственность объяснить проверяющему, почему работа не ведётся.
            </p>
            <p className="muted small">Основание:</p>
            <ul className="inherited-list">
              {confirming.activity.sources.map((source) => (
                <li key={source.reference} className="small">{source.reference}</li>
              ))}
            </ul>
            <p className="muted small">
              Требование не удаляется: оно останется в регламенте невыбранным, и вернуть его
              можно в любой момент.
            </p>
            <div className="actions">
              <button type="button" onClick={() => setConfirming(null)}>Оставить включённым</button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setRequired(confirming.periodicityId, confirming.activity.id, false);
                  setConfirming(null);
                }}
              >
                Отключить под ответственность организации
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="muted small">
        Изменения вступят в силу новой версией регламента. Прежняя версия сохранится: проверки,
        проведённые по ней, останутся с тем составом работ, который действовал в их день.
      </p>
    </div>
  );
}
