import { useState } from 'react';
import type { MaintenanceEvent, UserAccount } from '@izh/contracts';
import { backdropClose } from './modal-backdrop';
import {
  can, checkSignature, formatSignature, recordAudit, signedJournalContent, signSimple,
} from '@izh/core';
import { accessDeps, auditDeps, maintenanceDeps, objectDeps } from '../deps';
import { formatDateRu } from '../format';

const WRONG_PASSWORD_TEXT = 'Пароль введен неправильно, повторите пароль.';

function isWrongPassword(message: string): boolean {
  const normalized = message.toLocaleLowerCase('ru-RU');
  return normalized.includes('пароль') && normalized.includes('невер');
}

export interface MaintenanceSignatureModalProps {
  readonly event: MaintenanceEvent;
  readonly user: UserAccount | null;
  readonly onClose: () => void;
  readonly onSaved: (message: string) => void;
}

/** Подписание существующей записи не меняет её содержание — добавляет только ПЭП. */
export function MaintenanceSignatureModal(props: MaintenanceSignatureModalProps): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [passwordWrong, setPasswordWrong] = useState(false);
  const signature = props.event.signature ?? null;
  const canSign = props.user !== null
    && can(props.user, 'подпись.ставить')
    && !props.user.mustChangePassword;

  const verify = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      const checked = await checkSignature(
        accessDeps.hasher,
        signature,
        signedJournalContent(props.event),
        accessDeps.keys,
      );
      const verdict = checked.ok ? checked.value.verdict : checked.error.message;
      setMessage(verdict);
      setMessageIsError(!checked.ok || verdict.includes('не сходится'));
    } finally {
      setBusy(false);
    }
  };

  const sign = async (): Promise<void> => {
    if (props.user === null || !canSign || signature !== null) return;
    setBusy(true);
    setMessage(null);
    setMessageIsError(false);
    setPasswordWrong(false);
    try {
      const signed = await signSimple(accessDeps.hasher, {
        user: props.user,
        password,
        kind: 'запись журнала',
        content: signedJournalContent(props.event),
        at: objectDeps.clock.nowUtc(),
        keys: accessDeps.keys,
      });
      if (!signed.ok) {
        const wrongPassword = isWrongPassword(signed.error.message);
        setPasswordWrong(wrongPassword);
        setMessage(wrongPassword ? WRONG_PASSWORD_TEXT : signed.error.message);
        setMessageIsError(true);
        return;
      }

      const saved = await maintenanceDeps.events.save({ ...props.event, signature: signed.value });
      if (!saved.ok) { setMessage(saved.error.message); setMessageIsError(true); return; }

      await recordAudit(auditDeps, {
        actor: props.user,
        kind: 'подписана запись',
        subject: props.event.activityCode,
        details: `Запись журнала от ${props.event.performedOn}`,
      });
      props.onSaved('Запись журнала подписана ПЭП.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal maintenance-signature-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Простая электронная подпись</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>
        <dl className="facts">
          <dt>Дата проверки</dt><dd>{formatDateRu(props.event.performedOn)}</dd>
          <dt>Результат</dt><dd>{props.event.result}</dd>
        </dl>

        {signature === null ? (
          canSign ? (
            <>
              <label className={passwordWrong ? 'field signature-password-field invalid' : 'field signature-password-field'}>
                <span>Пароль для подтверждения подписи</span>
                <input
                  type="password"
                  value={password}
                  autoComplete="off"
                  aria-invalid={passwordWrong}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (passwordWrong) {
                      setPasswordWrong(false);
                      setMessage(null);
                      setMessageIsError(false);
                    }
                  }}
                />
              </label>
              <p className="muted small">
                Подпись закрепляется за этой записью. Результат проверки и ответы чек-листа после
                подписания не изменяются.
              </p>
              <div className="actions">
                <button type="button" onClick={props.onClose}>Отмена</button>
                <button
                  type="button"
                  className="primary"
                  disabled={busy || password.trim() === ''}
                  onClick={() => { void sign(); }}
                >
                  Подписать ПЭП
                </button>
              </div>
            </>
          ) : (
            <p className="banner error">У этой учётной записи нет права подписывать журнал.</p>
          )
        ) : (
          <>
            <p className="signature-summary">{formatSignature(signature)}</p>
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => { void verify(); }}>
                Проверить подпись
              </button>
            </div>
          </>
        )}

        {message !== null && (
          <p className={messageIsError ? 'signature-verdict signature-error' : 'signature-verdict'} role={messageIsError ? 'alert' : undefined}>
            {messageIsError && <span className="signature-error-icon" aria-hidden="true">!</span>}
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
