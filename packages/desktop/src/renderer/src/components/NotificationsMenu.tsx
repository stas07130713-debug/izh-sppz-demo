/**
 * Колокольчик в шапке: что требует действий прямо сейчас.
 *
 * Заказчик: «значок уведомления должен отображать необходимые действия с
 * объектами — при нажатии выскакивает мини-окно, где кратко: требуют
 * расстановки на плане, требуют ТО и тому подобное».
 *
 * Считается по всему объекту, а не по выбранному узлу: колокольчик отвечает на
 * вопрос «что где-то ждёт меня», и ответ, зависящий от того, какой этаж сейчас
 * открыт, на этот вопрос не отвечает.
 *
 * Каждая строка ведёт туда, где с этим работают: просрочка и неисправности — в
 * журнал с этим отбором, нерасставленное — на план. Уведомление, из которого
 * некуда перейти, заставляет искать то же самое руками.
 */

import { useRef, useState } from 'react';
import { useAnchoredMenu } from '../menu-placement';

/** Одна строка внутри категории: элемент или работа, к которой можно перейти. */
export interface NotificationLine {
  readonly id: string;
  readonly title: string;
  readonly note?: string;
  readonly onOpen: () => void;
}

export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly count: number;
  /** Насколько это срочно: от этого зависит цвет числа. */
  readonly tone: 'danger' | 'warn' | 'muted';
  /**
   * Куда ведёт сама категория.
   *
   * Может не вести никуда: у ближайших сроков число считается по работам, а
   * отбор журнала — по метке состояния, и совпадают они не всегда. Такая
   * категория только раскрывается списком, а ведёт к элементу уже строка.
   */
  readonly onOpen?: () => void;
  /**
   * Что именно скрывается за числом.
   *
   * Заказчик: «каждое число в счётчике должно соответствовать реальной записи;
   * при нажатии на категорию пользователь должен увидеть список соответствующих
   * элементов». Раньше «ТО в ближайшие 30 дней — 1» вело в журнал с отбором
   * «скоро», а такой метки у работы через двадцать дней нет: журнал
   * открывался пустым, и число выглядело выдуманным.
   */
  readonly lines?: readonly NotificationLine[];
}

export interface NotificationsMenuProps {
  readonly items: readonly NotificationItem[];
}

export function NotificationsMenu(props: NotificationsMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  /** Какая категория раскрыта: список показывается под ней. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const style = useAnchoredMenu(menuRef, anchorRef, open);

  /** В счётчике на значке — только то, что требует действий сегодня. */
  const urgent = props.items
    .filter((item) => item.tone !== 'muted')
    .reduce((sum, item) => sum + item.count, 0);

  const shown = props.items.filter((item) => item.count > 0);

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        className={open ? 'icon-button active' : 'icon-button'}
        title="Что требует внимания"
        aria-label="Что требует внимания"
        onClick={() => setOpen((value) => !value)}
      >
        🔔
        {urgent > 0 && <span className="bell-count">{urgent > 99 ? '99+' : urgent}</span>}
      </button>

      {open && (
        <>
          <div className="journal-menu-catch" onClick={() => setOpen(false)} />
          <div className="context-menu notifications-menu" style={style} ref={menuRef}>
            {shown.length === 0 ? (
              <p className="muted small">Ничего не ждёт: сроки соблюдены, всё размещено.</p>
            ) : (
              shown.map((item) => (
                <div key={item.id} className="notification-group">
                  <button
                    type="button"
                    className={`notification-item notification-${item.tone}`}
                    onClick={() => {
                      // Есть что показать — раскрываем список прямо здесь.
                      // Нечего — ведём туда, где с этим работают.
                      if ((item.lines ?? []).length > 0) {
                        setExpanded((current) => (current === item.id ? null : item.id));
                        return;
                      }
                      // Некуда вести и нечего показывать — категория молчит:
                      // закрывать меню впустую значит сбивать человека с толку.
                      if (item.onOpen === undefined) return;
                      setOpen(false);
                      item.onOpen();
                    }}
                  >
                    <span>{item.title}</span>
                    <span className={item.tone === 'muted' ? 'muted small' : `${item.tone} small`}>
                      {item.count}
                    </span>
                  </button>

                  {expanded === item.id && (item.lines ?? []).map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      className="notification-line"
                      onClick={() => { setOpen(false); line.onOpen(); }}
                    >
                      <span>{line.title}</span>
                      {line.note !== undefined && <span className="muted small">{line.note}</span>}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
