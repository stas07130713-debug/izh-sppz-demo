/**
 * Окно пароля для простой электронной подписи.
 *
 * Одно на все действия, которые заводят записи журнала: заведение элемента,
 * партии, расстановки по щелчкам. Спрашивает ровно одно — пароль — и прямо
 * называет, что именно будет подписано: подписывают не «вообще», а конкретное
 * (63-ФЗ, статья 9 часть 1 — подпись относится к подписанному документу).
 */

import { useEffect, useRef, useState } from 'react';
import { describeUnknown } from '@izh/contracts';
import { endSentence } from '../format';
import { backdropClose } from './modal-backdrop';

export interface SignPasswordModalProps {
  /** Что будет подписано, словами человека: «заведение огнетушителя ОП-12». */
  readonly reason: string;
  readonly onCancel: () => void;
  /** Возвращает текст ошибки или null, если подпись принята. */
  readonly onSubmit: (password: string) => Promise<string | null>;
}

export function SignPasswordModal(props: SignPasswordModalProps): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  // Курсор сразу в поле: окно открылось ради одного ввода, и лишний щелчок
  // мышью здесь — чистая помеха.
  useEffect(() => { fieldRef.current?.focus(); }, []);

  const submit = (): void => {
    if (password.trim() === '' || busy) return;
    setBusy(true);
    void (async () => {
      try {
        const failure = await props.onSubmit(password);
        if (failure === null) return;
        setError(failure);
        setPassword('');
        fieldRef.current?.focus();
      } catch (thrown) {
        setError(describeUnknown(thrown));
      } finally {
        // Снятие занятости — только в finally: сорвись сверка пароля, и окно
        // осталось бы запертым до перезапуска программы.
        setBusy(false);
      }
    })();
  };

  return (
    <div className="modal-backdrop" {...backdropClose(props.onCancel)}>
      <div className="modal sign-password-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Подписать простой электронной подписью</h3>
          <button type="button" className="link" onClick={props.onCancel}>закрыть ✕</button>
        </div>

        <p className="muted small">{endSentence(`Подписывается: ${props.reason}`)}</p>

        <label className="field">
          <span>Пароль</span>
          <input
            ref={fieldRef}
            type="password"
            value={password}
            onChange={(event) => { setPassword(event.target.value); setError(null); }}
            onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
            placeholder="ваш пароль"
          />
        </label>

        {error !== null && <p className="small warn">{error}</p>}

        <p className="muted small">
          Пароль спрашивается заново, а не берётся из входа: подпись подтверждается тем, что вы
          предъявили именно её. До конца работы или четверти часа без подписей он больше
          не потребуется.
        </p>

        <div className="actions">
          <button type="button" onClick={props.onCancel} disabled={busy}>Отмена</button>
          <button
            type="button"
            className="primary"
            disabled={busy || password.trim() === ''}
            onClick={submit}
          >
            Подписать
          </button>
        </div>
      </div>
    </div>
  );
}
