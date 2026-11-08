/**
 * Вход на обходе.
 *
 * Заказчик: «должна быть привязка к учётной записи». Обходчик входит **той же**
 * учётной записью, что и в настольной программе: под его именем потом встанет
 * подпись под записями обхода.
 *
 * Три поля и ни одного лишнего. Код сопряжения показан на экране настольной
 * программы: без него в сеть предприятия не войти даже с верным паролем — сеть
 * не безопасное место, и подбирать пароль по ней можно сколько угодно.
 */

import { useState } from 'react';

export interface LoginProps {
  /** Адрес настольной программы. Обходчик набирает его один раз. */
  readonly address: string;
  readonly onAddress: (value: string) => void;
  readonly onEnter: (login: string, password: string, code: string) => Promise<string | null>;
}

export function Login(props: LoginProps): React.JSX.Element {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enter = (): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const failure = await props.onEnter(login.trim(), password, code.trim());
        setError(failure);
      } catch {
        setError('Настольная программа не отвечает. Проверьте адрес и сеть Wi-Fi.');
      } finally {
        // Только в finally: сорвись обращение — кнопка осталась бы запертой.
        setBusy(false);
      }
    })();
  };

  return (
    <div className="card">
      <section className="block">
        <h2>Вход на обход</h2>

        <label className="field">
          <span>Адрес программы</span>
          <input
            type="url" inputMode="url" autoCapitalize="off" autoCorrect="off"
            value={props.address}
            onChange={(event) => props.onAddress(event.target.value)}
            placeholder="http://192.168.0.10:8123"
          />
        </label>

        <label className="field">
          <span>Имя для входа</span>
          <input
            type="text" autoCapitalize="off" autoCorrect="off"
            value={login} onChange={(event) => setLogin(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>

        <label className="field">
          <span>Код сопряжения</span>
          <input
            type="text" inputMode="numeric" maxLength={6}
            value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="шесть цифр с экрана программы"
          />
        </label>

        {error !== null && <p className="warn">{error}</p>}

        <button
          type="button" className="primary"
          disabled={busy || login.trim() === '' || password === '' || code.length !== 6}
          onClick={enter}
        >
          {busy ? 'Вхожу…' : 'Войти и забрать журнал'}
        </button>

        <p className="hint">
          Журнал уезжает на телефон целиком — обход идёт по копии, и связь в здании не нужна.
          Уедет только то, что вам доступно по дереву объектов.
        </p>
      </section>
    </div>
  );
}
