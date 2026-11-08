/**
 * Шапка программы (ТЗ, Дополнение 2, часть П9).
 *
 * Слева логотип, справа — отмена и возврат действия, настройки, тема,
 * уведомления, учётная запись и обращение к разработчику.
 *
 * Разделов работы здесь нет. План, журнал и дашборд стали вкладками над самой
 * рабочей областью (`ModeTabs`): в шапке, среди значков темы и учётной записи,
 * они читались как настройки программы, а не как то, чем работают. Там же, во
 * вкладке, теперь стоят и её кнопки.
 *
 * `actions` осталось для экрана подготовки подложки: у него рабочей области с
 * вкладками нет, а кнопки «загрузить другой файл» и разбора чертежа нужны.
 */

import { useTheme } from '../use-theme';
import { NotificationsMenu, type NotificationItem } from './NotificationsMenu';

/** Режим работы: что показывается в рабочей области. */
export type ViewMode = 'plan' | 'journal' | 'dashboard';

export interface AppHeaderProps {
  /** Кнопки экрана подготовки подложки. */
  readonly actions?: React.ReactNode;
  readonly canUndo?: boolean;
  readonly canRedo?: boolean;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly onReportProblem: () => void;
  readonly onOpenSettings?: () => void;
  /** Что требует действий: считается по всему объекту, а не по узлу. */
  readonly notifications?: readonly NotificationItem[];
  /**
   * Кто вошёл и что с этим можно сделать.
   *
   * Имя показывается всегда: на общем компьютере это первое, что нужно
   * проверить перед тем, как что-то подписать.
   */
  readonly account?: {
    readonly title: string;
    readonly onOpen: () => void;
    readonly onSignOut: () => void;
  };
}

/** Полное Ф.И.О. в шапке занимает место у рабочих команд — оставляем фамилию
 * целиком, а имя и отчество показываем инициалами. */
export function shortAccountName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter((part) => part !== '');
  if (parts.length <= 1) return parts[0] ?? '';
  const [surname, ...givenNames] = parts;
  const initials = givenNames.map((part) => `${part[0]?.toLocaleUpperCase('ru-RU') ?? ''}.`).join(' ');
  return `${surname} ${initials}`.trim();
}

export function AppHeader(props: AppHeaderProps): React.JSX.Element {
  const { theme, toggle } = useTheme();

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">СППЗ</span>
        <span className="brand-sub muted">интерактивный журнал</span>
      </div>

      <div className="header-actions">
        <button type="button" className="icon-button" title="Назад: отменить последнее действие" disabled={props.canUndo !== true} onClick={props.onUndo}>
          ↶
        </button>
        <button type="button" className="icon-button" title="Вперёд: вернуть отменённое действие" disabled={props.canRedo !== true} onClick={props.onRedo}>
          ↷
        </button>
        {props.actions}

        {props.onOpenSettings !== undefined && <button type="button" className="icon-button" title="Настройки программы" aria-label="Настройки программы" onClick={props.onOpenSettings}>⚙</button>}

        <button type="button" className="icon-button" title="Сообщить разработчику о проблеме" onClick={props.onReportProblem}>
          ✉
        </button>
        {/*
          * Значок показывает, куда переключишься, а не где находишься.
          *
          * Так устроены все переключатели темы, и заказчик поймал обратное:
          * «когда светло, должна быть изображена луна, и наоборот». Прежний
          * значок повторял подпись — светло и солнце, — и нажимать его было
          * незачем: и так видно, что светло.
          */}
        <button
          type="button"
          className="icon-button"
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          onClick={toggle}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        {/* Колокольчик показывает то, что ждёт действий, и ведёт туда, где
            с этим работают. На экране подготовки подложки его нет: там
            занимаются одним чертежом, а не хозяйством целиком. */}
        {props.notifications !== undefined && <NotificationsMenu items={props.notifications} />}

        {props.account !== undefined && (
          <>
            <button
              type="button"
              className="account-button"
              title={`${props.account.title} — личный кабинет`}
              onClick={props.account.onOpen}
            >
              👤 {shortAccountName(props.account.title)}
            </button>
            <button
              type="button"
              className="icon-button logout-button"
              title="Выйти: программа спросит имя и пароль заново"
              aria-label="Выйти из системы"
              onClick={props.account.onSignOut}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 3h9a1 1 0 0 1 1 1v4h-2V5H6v14h6v-3h2v4a1 1 0 0 1-1 1H4V3Z" />
                <path d="M13 11h5.2l-1.8-1.8L17.8 8l4 4-4 4-1.4-1.2 1.8-1.8H13v-2Z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
