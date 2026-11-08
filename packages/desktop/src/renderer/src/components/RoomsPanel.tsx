/**
 * Помещения этажа в карточке узла.
 *
 * Здесь заводится экспликация: название, номер, категория по взрывопожарной
 * опасности и документ-основание. Площадь в списке появляется сама — после того
 * как помещение обведено на плане.
 *
 * Категорию программа не рассчитывает: для расчёта нужны сведения о веществах,
 * которых в журнале СПЗ нет. Значение берётся из расчёта категорий или проекта.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 5.5.
 */

import { useState } from 'react';
import type { Room } from '@izh/contracts';
import { ROOM_CATEGORIES, categoryColor } from '@izh/core';
import { RoomHazardFields, type RoomHazardPatch } from './RoomHazardFields';
import { SelectField } from './SelectField';

export interface NewRoom {
  readonly name: string;
  readonly number: string | null;
  readonly category: string | null;
}

export interface RoomsPanelProps {
  readonly rooms: readonly Room[];
  readonly busy: boolean;
  readonly hasPlan: boolean;
  readonly hasScale: boolean;
  readonly drawingRoomId: string | null;
  readonly onAdd: (room: NewRoom) => void;
  readonly onDraw: (roomId: string) => void;
  /**
   * Показать обведённое помещение на плане.
   *
   * Заказчик: «добавь кнопку в карточке узла, в созданном помещении —
   * показать на плане, и обводка помещения подсвечивается и пропадает».
   * Кнопка есть у обведённых: у необведённого показывать нечего.
   */
  readonly onShowOnPlan: (roomId: string) => void;
  /** Убрать фигуру с плана, оставив само помещение. */
  readonly onClearOutline: (roomId: string) => void;
  /**
   * Сколько точек обводки уже поставлено.
   *
   * Заказчик: «кнопка готово при выделении помещения отображается не там,
   * пускай она отображается там же, в карточке учёта узла». Кнопка стоит здесь,
   * рядом с «отметить на плане», — и чтобы знать, есть ли что замыкать, ей
   * нужно число точек.
   */
  readonly outlinePointCount: number;
  readonly onFinishOutline: () => void;
  readonly onCancelOutline: () => void;
  /** Помещение под мышью: подсветка на плане включается наведением на строку. */
  readonly hoveredRoomId: string | null;
  readonly onHoverRoom: (roomId: string | null) => void;
  readonly onArchive: (roomId: string) => void;
  /**
   * Правка сведений, от которых зависит норма: категория, назначение,
   * классы пожара, АУП.
   *
   * Раньше они правились в окне проверки расстановки. Так выходило, что
   * сведения о помещении заводят из окна проверки — а живут они здесь, в
   * карточке помещения. Проверка теперь только называет недостающее и
   * ведёт сюда.
   */
  readonly onChangeHazard: (roomId: string, patch: RoomHazardPatch) => void;
  /** Помещение, к которому прислала проверка: его сведения раскрыты сразу. */
  readonly hazardRoomId: string | null;
}

export function RoomsPanel(props: RoomsPanelProps): React.JSX.Element {
  const [adding, setAdding] = useState(false);
  /**
   * Какие помещения развёрнуты по сведениям для норм.
   *
   * Своё состояние, а не `open` от свойства. Прежде раскрытие держалось на
   * `hazardRoomId`, и раскрытая человеком часть захлопывалась при первой же
   * перерисовке, где это свойство менялось: он правил категорию, а поля
   * уезжали из-под рук.
   */
  const [openHazard, setOpenHazard] = useState<ReadonlySet<string>>(new Set());
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState('');

  const live = props.rooms.filter((room) => room.archivedAt === null);

  return (
    <div className="rooms-panel">
      <div className="panel-head">
        <h4>Помещения</h4>
        <button type="button" onClick={() => setAdding(!adding)} disabled={props.busy}>
          {adding ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>

      {adding && (
        <div className="create-block">
          <label className="field">
            <span>Название</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Электрощитовая"
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Номер</span>
              <input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="105" />
            </label>
            <label className="field">
              <span>Категория</span>
              <SelectField
                value={category}
                placeholder="не задана"
                options={ROOM_CATEGORIES.map((item) => ({ value: item, title: item }))}
                onChange={setCategory}
              />
            </label>
          </div>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={props.busy || name.trim() === ''}
              onClick={() => {
                props.onAdd({
                  name,
                  number: number.trim() === '' ? null : number,
                  category: category === '' ? null : category,
                });
                setName('');
                setNumber('');
                setCategory('');
                setAdding(false);
              }}
            >
              Добавить
            </button>
          </div>
        </div>
      )}

      {live.length === 0 ? (
        <p className="muted small">
          Помещений пока нет. Заведите их здесь, а затем отметьте на плане — площадь посчитается сама.
        </p>
      ) : (
        <ul className="rooms-list">
          {live.map((room) => (
            <li
              key={room.id}
              /*
               * Наведение на строку подсвечивает помещение на плане.
               *
               * Постоянной заливки больше нет (заказчик: «в целом оно не должно
               * как-то дополнительно подсвечиваться»), и связать строку списка
               * с фигурой на чертеже стало нечем — кроме наведения.
               */
              onPointerEnter={() => props.onHoverRoom(room.id)}
              onPointerLeave={() => props.onHoverRoom(null)}
            >
              <div className="room-head">
                <span className="room-mark" style={{ background: categoryColor(room.category) }} />
                <strong>{room.name}</strong>
                {room.number !== null && <span className="muted small">№ {room.number}</span>}
              </div>
              <div className="muted small">
                Категория: {room.category ?? 'не задана'}
                {' · '}
                {room.areaM2 !== null
                  ? `${room.areaM2.toFixed(2)} м²`
                  : room.outline !== null
                    ? 'обведено, масштаб не задан'
                    : 'не отмечено на плане'}
              </div>
              <div className="muted small">
                {room.purpose ?? 'назначение не задано'}
                {' · '}
                {(room.fireClasses ?? []).length > 0
                  ? `классы пожара: ${(room.fireClasses ?? []).join(', ')}`
                  : 'классы пожара не заданы'}
                {(room.hasSuppression ?? false) && ' · под АУП'}
              </div>

              {/*
                * Сведения для норм.
                *
                * Раскрыты сами у того помещения, к которому прислала проверка,
                * и у того, где их ещё не задавали: незаполненное помещение для
                * норм бесполезно, а спрятанные поля человек не ищет — заказчик
                * просил выпадающий список «в карточке узла» именно потому, что
                * не нашёл его под свёрнутой строкой.
                *
                * Заполненные свёрнуты: нужны они не каждый день, а десяток
                * развёрнутых превращает список в простыню.
                */}
              <details
                open={openHazard.has(room.id)
                  || room.id === props.hazardRoomId
                  || (room.category === null && room.purpose === null && (room.fireClasses ?? []).length === 0)}
                onToggle={(event) => setOpenHazard((current) => {
                  const next = new Set(current);
                  if (event.currentTarget.open) next.add(room.id);
                  else next.delete(room.id);
                  return next;
                })}
              >
                <summary className="small">Сведения для норм ППР</summary>
                <RoomHazardFields room={room} busy={props.busy} onChange={props.onChangeHazard} />
              </details>
              <div className="room-actions">
                {props.drawingRoomId === room.id ? (
                  <>
                    {/*
                      * Замыкание фигуры — здесь, в карточке узла.
                      *
                      * Заказчик: «кнопка готово отображается не там, пускай она
                      * отображается там же, в карточке учёта узла». На плане
                      * она стояла в подсказке над чертежом — далеко от того
                      * места, откуда обводку начинали, и человек её не находил.
                      */}
                    <button
                      type="button"
                      className="primary"
                      disabled={props.busy || props.outlinePointCount < 3}
                      title={props.outlinePointCount < 3
                        ? 'Поставьте на плане хотя бы три точки — фигуру нужно чем-то замкнуть'
                        : 'Замкнуть фигуру и посчитать площадь'}
                      onClick={props.onFinishOutline}
                    >
                      Готово{props.outlinePointCount > 0 && ` (${props.outlinePointCount})`}
                    </button>
                    <button type="button" className="link" disabled={props.busy} onClick={props.onCancelOutline}>
                      отменить
                    </button>
                  </>
                ) : (
                <button
                  type="button"
                  className="link"
                  disabled={props.busy || !props.hasPlan}
                  title={props.hasPlan ? 'Обвести помещение на плане' : 'Сначала загрузите подложку этажа'}
                  onClick={() => props.onDraw(room.id)}
                >
                  {room.outline === null ? 'Отметить на плане' : 'Изменить обводку'}
                </button>
                )}
                {/*
                  * Снять обводку, не трогая помещение.
                  *
                  * Заказчик: «выделяется достаточно криво, никак эту отметку не
                  * снять». Обвести заново было можно, а убрать — нечем: кривая
                  * фигура оставалась на плане, и убрать её выходило только
                  * вместе с помещением, категорией и всем, что к нему привязано.
                  */}
                {room.outline !== null && props.drawingRoomId !== room.id && (
                  <button
                    type="button"
                    className="link"
                    disabled={props.busy}
                    title="Перейти на план и подсветить эту обводку"
                    onClick={() => props.onShowOnPlan(room.id)}
                  >
                    показать на плане
                  </button>
                )}
                {room.outline !== null && (
                  <button
                    type="button"
                    className="link"
                    disabled={props.busy}
                    title="Убрать фигуру с плана. Помещение и его сведения останутся"
                    onClick={() => props.onClearOutline(room.id)}
                  >
                    снять обводку
                  </button>
                )}
                <button
                  type="button"
                  className="link danger"
                  disabled={props.busy}
                  onClick={() => props.onArchive(room.id)}
                >
                  удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {props.hasPlan && !props.hasScale && live.length > 0 && (
        <p className="small warn">
          У плана не задан масштаб — обводка сохранится, но площадь посчитать не из чего.
        </p>
      )}
    </div>
  );
}
