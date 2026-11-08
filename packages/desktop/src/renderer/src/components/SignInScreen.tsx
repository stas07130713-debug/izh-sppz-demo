/**
 * Вход в программу (ТЗ, Дополнение 7).
 *
 * Один экран на три случая, потому что для человека это один вопрос — «как мне
 * начать работать»:
 *
 *  1. **первый запуск.** Учётных записей нет, и заводится первый администратор.
 *     Иначе завести его было бы некому: войти не под кем;
 *  2. **обычный вход** по имени и паролю;
 *  3. **замена временного пароля.** Пароль, выданный администратором, знают
 *     двое, и работать под ним нельзя: подпись им подтверждала бы не того, кто
 *     расписался.
 *
 * Вход можно запомнить на этом компьютере. Пароль при этом не сохраняется:
 * Windows защищает короткую ссылку на учётную запись, а подпись по-прежнему
 * требует пароль. Восстановления по почте нет — пока программа локальная,
 * письмо отправлять нечем, и пароль сбрасывает администратор.
 *
 * Кроме одного: «Не удаётся войти?». Пароль администратора сбрасывать некому —
 * он и есть администратор, — и без выхода забытый пароль запирал бы программу
 * насовсем. Выход честный: учётные записи убираются, и программа начинает с
 * заведения администратора заново. Данные объекта при этом целы.
 */

import { useEffect, useRef, useState } from 'react';
import type { Result, UserAccount } from '@izh/contracts';
import { changePassword, createUser, recordAudit, signIn } from '@izh/core';
import { accessDeps, auditDeps } from '../deps';

export interface SignInScreenProps {
  /** В программе ещё нет ни одной учётной записи: заводим первого администратора. */
  readonly firstRun: boolean;
  readonly onSignedIn: (user: UserAccount, remember: boolean) => Promise<Result<void>>;
}

type Mode = 'вход' | 'первый запуск' | 'замена пароля';

export function SignInScreen(props: SignInScreenProps): React.JSX.Element {
  const [mode, setMode] = useState<Mode>(props.firstRun ? 'первый запуск' : 'вход');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [organization, setOrganization] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [pending, setPending] = useState<UserAccount | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [remember, setRemember] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  /*
   * Нативное подтверждение восстановления на Windows иногда возвращает фокус
   * рамке Electron, а не странице. Внешне это выглядит как полностью
   * заблокированная форма: поле видно, но курсор в него не ставится даже после
   * смены режима. Возвращаем фокус в первое поле после каждого такого перехода.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void window.izh.window.focusContent().then(() => {
        window.focus();
        firstFieldRef.current?.focus({ preventScroll: true });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const doSignIn = (): void => void run(async () => {
    const result = await signIn(accessDeps, { login, password });
    if (!result.ok) {
      /*
       * Отказ во входе тоже событие журнала действий.
       *
       * Пять отказов подряд ночью — это то, ради чего журнал и заводят.
       * Пароль в запись, разумеется, не попадает: только введённое имя.
       */
      await recordAudit(auditDeps, { actor: null, actorName: login, kind: 'отказ во входе' });
      setMessage(result.error.message);
      return;
    }

    // Временный пароль сразу ведёт к замене: работать под ним нельзя.
    if (result.value.mustChangePassword) {
      setPending(result.value);
      setMode('замена пароля');
      return;
    }
    await recordAudit(auditDeps, { actor: result.value, kind: 'вход' });
    const entered = await props.onSignedIn(result.value, remember);
    if (!entered.ok) setMessage(entered.error.message);
  });

  const doRegister = (): void => void run(async () => {
    const created = await createUser(accessDeps, {
      login, fullName, position, organization, role: 'администратор', temporaryPassword: password,
    }, null);
    if (!created.ok) { setMessage(created.error.message); return; }

    // Первый администратор задаёт пароль сам, поэтому временным он не считается:
    // менять только что придуманное было бы бессмысленной обязанностью.
    const settled = await changePassword(accessDeps, {
      id: created.value.id, currentPassword: password, newPassword: password,
    });
    const entered = await props.onSignedIn(settled.ok ? settled.value : created.value, remember);
    if (!entered.ok) setMessage(entered.error.message);
  });

  const doChangePassword = (): void => void run(async () => {
    if (pending === null) return;
    if (newPassword !== repeat) { setMessage('Пароли не совпадают.'); return; }

    const changed = await changePassword(accessDeps, {
      id: pending.id, currentPassword: password, newPassword,
    });
    if (!changed.ok) { setMessage(changed.error.message); return; }
    const entered = await props.onSignedIn(changed.value, remember);
    if (!entered.ok) setMessage(entered.error.message);
  });

  return (
    <div className="sign-in-screen">
      <form
        className="sign-in-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === 'вход') doSignIn();
          else if (mode === 'первый запуск') doRegister();
          else doChangePassword();
        }}
      >
        <div className="brand">
          <span className="brand-mark">СППЗ</span>
          <span className="brand-sub muted">интерактивный журнал</span>
        </div>

        {mode === 'первый запуск' && (
          <p className="muted small">
            Программа запускается впервые. Заведите учётную запись администратора: она задаёт
            настройки, регламенты и выдаёт доступы остальным.
          </p>
        )}
        {mode === 'замена пароля' && (
          <p className="muted small">
            Пароль выдан администратором и его знают двое. Придумайте свой — подписывать можно
            только своим.
          </p>
        )}

        {mode !== 'замена пароля' && (
          <>
            {mode === 'первый запуск' && (
              <>
                <label className="field">
                  <span>ФИО</span>
                  <input
                    ref={firstFieldRef}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Иванов Иван Иванович"
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span>Должность</span>
                  <input
                    value={position}
                    onChange={(event) => setPosition(event.target.value)}
                    placeholder="Инженер по пожарной безопасности"
                  />
                </label>
                <label className="field">
                  <span>Организация</span>
                  <input
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                    placeholder="ООО «Пример»"
                  />
                </label>
              </>
            )}
            <label className="field">
              <span>Имя для входа</span>
              <input
                ref={mode === 'вход' ? firstFieldRef : undefined}
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="ivanov"
                autoFocus={mode === 'вход'}
              />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          </>
        )}

        {mode === 'замена пароля' && (
          <>
            <label className="field">
              <span>Новый пароль</span>
              <input
                ref={firstFieldRef}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              <span>Ещё раз</span>
              <input type="password" value={repeat} onChange={(event) => setRepeat(event.target.value)} />
            </label>
          </>
        )}

        <label className="check-line sign-in-remember">
          <input
            type="checkbox"
            checked={remember}
            disabled={busy}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <strong>Запомнить меня</strong>
        </label>

        {message !== null && <p className="sign-in-error">{message}</p>}

        <button
          type="submit"
          className="primary"
          disabled={busy || (mode === 'первый запуск' && (
            fullName.trim() === '' || position.trim() === '' || organization.trim() === ''
            || login.trim() === '' || password === ''
          ))}
        >
          {mode === 'вход' ? 'Войти' : mode === 'первый запуск' ? 'Завести и войти' : 'Сменить и войти'}
        </button>

        <p className="muted small">
          Пароль хранится отпечатком: восстановить его нельзя ни программе, ни администратору.
          В сохранённый вход пароль не записывается. Кнопка «Выйти» отключает автоматический вход.
        </p>

        {mode === 'вход' && !stuck && (
          <button type="button" className="link" onClick={() => setStuck(true)}>
            Не удаётся войти?
          </button>
        )}

        {stuck && (
          <div className="sign-in-stuck">
            <p className="muted small">
              Если забыл пароль <strong>единственный администратор</strong>, сбросить его некому:
              он и есть тот, кто сбрасывает. Тогда остаётся начать с учётных записей заново —
              программа снова попросит завести администратора.
            </p>
            <p className="muted small">
              <strong>Данные объекта не пострадают</strong>: дерево, оборудование, планы, журнал
              и регламенты останутся как есть. Прежние учётные записи не удаляются, а
              откладываются в сторону — записи журнала и подписи ссылаются на их авторов.
            </p>
            <div className="actions">
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void run(async () => {
                  const yes = window.confirm(
                    'Убрать все учётные записи и завести администратора заново?'
                      + ' Данные объекта останутся на месте.',
                  );
                  if (!yes) return;
                  const done = await window.izh.users.resetAll();
                  if (!done.ok) { setMessage(done.error.message); return; }
                  setStuck(false);
                  setMode('первый запуск');
                  setFullName('');
                  setPosition('');
                  setOrganization('');
                  setLogin('');
                  setPassword('');
                })}
              >
                Начать с учётными записями заново
              </button>
              <button type="button" className="link" onClick={() => setStuck(false)}>отмена</button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
