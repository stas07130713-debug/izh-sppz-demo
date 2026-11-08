/**
 * Сведения помещения, от которых зависит норма по огнетушителям
 * (ППР РФ № 1479, пункт 409, приложения № 1 и 2).
 *
 * Поля стоят там же, где проверка расстановки говорит об их нехватке: увидел
 * «не заполнено назначение» — заполнил, не уходя с экрана. Отдельная ходка в
 * карточку помещения ради одного выпадающего списка ничего не даёт.
 *
 * Категория правится здесь же. Программа её не рассчитывает — значение берут
 * из расчёта категорий или проекта, — но выбрать его человек должен там, где
 * ему сказали, что категории не хватает. Документ-основание остаётся в
 * карточке помещения: он длинный, и в узкой строке проверки ему не место.
 */

import type { Room } from '@izh/contracts';
import { FIRE_CLASSES, ROOM_CATEGORIES, ROOM_KINDS, ROOM_PURPOSES, roomKindById } from '@izh/core';
import { SelectField } from './SelectField';

/** Что именно меняется — сохраняется вся карточка помещения целиком. */
export interface RoomHazardPatch {
  readonly category?: string | null;
  readonly purpose?: string | null;
  readonly fireClasses?: readonly string[];
  readonly hasSuppression?: boolean;
}

export interface RoomHazardFieldsProps {
  readonly room: Room;
  readonly busy: boolean;
  readonly onChange: (roomId: string, patch: RoomHazardPatch) => void;
}

/** Пояснения к классам пожара по ГОСТ 27331 — иначе буква ни о чём не говорит. */
const CLASS_TITLES: Readonly<Record<string, string>> = {
  A: 'твёрдые горючие вещества',
  B: 'горючие жидкости',
  C: 'горючие газы',
  D: 'металлы и металлосодержащие вещества',
  E: 'электроустановки под напряжением',
};

export function RoomHazardFields(props: RoomHazardFieldsProps): React.JSX.Element {
  const classes = props.room.fireClasses ?? [];

  /*
   * Какой вид помещения сейчас подходит под заполненное.
   *
   * Выбор не хранится: хранятся сами назначение и классы, из которых норма и
   * считается. Вид — способ их задать одним движением, и показывать он должен
   * то, что в полях, а не то, что когда-то нажали.
   */
  const current = ROOM_KINDS.find((kind) =>
    kind.purpose === props.room.purpose
    && kind.fireClasses.length === classes.length
    && kind.fireClasses.every((item) => classes.includes(item))) ?? null;

  return (
    <div className="room-hazard">
      {/*
        * Вид помещения — первым.
        *
        * Заказчик: «сделай выпадающий список в карточке узла, чтобы там были
        * варианты помещений, для которых есть отдельные требования по
        * размещению огнетушителей». Отдельные требования держатся на
        * назначении и классах возможного пожара: вид заполняет и то и другое.
        *
        * Категорию вид не трогает: её выводят расчётом по СП 12.13130 и
        * утверждает организация — программа не вправе назначать её по названию
        * помещения.
        */}
      <label className="field">
        <span>Вид помещения</span>
        <SelectField
          value={current?.id ?? ''}
          placeholder="выбрать и заполнить назначение с классами"
          disabled={props.busy}
          options={ROOM_KINDS.map((kind) => ({ value: kind.id, title: kind.title }))}
          onChange={(value) => {
            const kind = roomKindById(value);
            if (kind === null) return;
            props.onChange(props.room.id, { purpose: kind.purpose, fireClasses: [...kind.fireClasses] });
          }}
        />
        <span className="muted small">
          {current === null
            ? 'Подсказка: заполняет назначение и классы возможного пожара. Категорию задайте сами — её определяет расчёт по СП 12.13130.'
            : current.why}
        </span>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Категория по взрывопожарной опасности</span>
          <SelectField
            value={props.room.category ?? ''}
            placeholder="не задана"
            disabled={props.busy}
            options={ROOM_CATEGORIES.map((item) => ({ value: item, title: item }))}
            onChange={(value) => props.onChange(props.room.id, { category: value === '' ? null : value })}
          />
        </label>

        <label className="field">
          <span>Назначение</span>
          <SelectField
            value={props.room.purpose ?? ''}
            placeholder="не задано"
            disabled={props.busy}
            options={ROOM_PURPOSES.map((purpose) => ({ value: purpose, title: purpose }))}
            onChange={(value) => props.onChange(props.room.id, { purpose: value === '' ? null : value })}
          />
        </label>

        {/* Помещения под АУП обеспечиваются огнетушителями на 50 процентов
            расчётного количества, но норма расстояния для них сохраняется. */}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={props.room.hasSuppression ?? false}
            disabled={props.busy}
            onChange={(event) => props.onChange(props.room.id, { hasSuppression: event.target.checked })}
          />
          <span>Под автоматическим пожаротушением</span>
        </label>
      </div>

      <div className="field">
        <span>Классы возможного пожара</span>
        <div className="fire-classes">
          {FIRE_CLASSES.map((fireClass) => (
            <label key={fireClass} className="checkbox" title={CLASS_TITLES[fireClass] ?? ''}>
              <input
                type="checkbox"
                checked={classes.includes(fireClass)}
                disabled={props.busy}
                onChange={(event) =>
                  props.onChange(props.room.id, {
                    fireClasses: event.target.checked
                      ? [...classes, fireClass]
                      : classes.filter((item) => item !== fireClass),
                  })
                }
              />
              <span>{fireClass}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
