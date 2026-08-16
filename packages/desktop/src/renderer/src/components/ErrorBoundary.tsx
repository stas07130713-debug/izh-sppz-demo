/**
 * Перехват сбоев интерфейса.
 *
 * Без него любая ошибка в React оставляет пользователя перед пустым белым
 * окном без единой подсказки. Для коммерческой программы это недопустимо, а при
 * разборе неполадок посторонним исполнителем — тем более.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
  readonly stack: string;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, stack: info.componentStack ?? '' });
    // eslint-disable-next-line no-console -- журнал диагностики
    console.error('Сбой интерфейса:', error, info);
  }

  override render(): ReactNode {
    const { error, stack } = this.state;
    if (error === null) return this.props.children;

    return (
      <div className="wizard">
        <h2 className="error">Сбой в работе программы</h2>
        <p>Произошла непредвиденная ошибка. Данные не пострадали — они хранятся на диске отдельно.</p>
        <p className="muted small">Сообщите разработчику текст ниже.</p>
        <pre className="crash">
          {error.message}
          {stack}
        </pre>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Перезапустить окно
        </button>
      </div>
    );
  }
}
