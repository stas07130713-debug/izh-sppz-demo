/**
 * Пользователи в настройках: кто заведён, с какой ролью и что ему поручено.
 *
 * Самое необходимое, чтобы разграничение заработало: завести человека, назначить
 * роль и узлы, сбросить забытый пароль, отключить ушедшего. Ничего сверх этого —
 * ни групп, ни отдельных прав поверх роли: чем больше рычагов, тем вероятнее,
 * что кому-то по недосмотру откроют лишнее.
 *
 * Область прав выдаётся отметками по дереву. Права идут вниз, поэтому отмечать
 * каждый этаж не нужно — достаточно здания.
 */

import { useState } from 'react';
import type { TreeNode, UserAccount, UserRole } from '@izh/contracts';
import { USER_ROLES } from '@izh/contracts';
import {
  MIN_PASSWORD_LENGTH, createUser, deleteUser, recordAudit, resetPassword, setUserArchived,
  updateUser, userDeletionCheck,
} from '@izh/core';
import { accessDeps, auditDeps } from '../deps';
import { useBusyRun } from '../use-busy-run';
import { UserScopePicker, scopeSummary } from './UserScopePicker';
import { SelectField } from './SelectField';

export interface UsersSettingsProps {
  readonly actor: UserAccount;
  readonly users: readonly UserAccount[];
  readonly nodes: readonly TreeNode[];
  readonly onChanged: () => void;
  /**
   * Записи журнала: по ним видно, подписывал ли человек.
   *
   * Необязательны: там, где их нет, удаление просто не предлагается — лучше не
   * дать удалить, чем удалить того, чья подпись стоит под проверкой.
   */
  readonly events?: readonly { readonly signature?: { readonly signerId: string } | null }[];
}

export function UsersSettings(props: UsersSettingsProps): React.JSX.Element {
  const [adding, setAdding] = useState(false);
  /*
   * Чья область прав сейчас раскрыта.
   *
   * Заказчик: «когда пользователь заведён, это всё нужно скрывать, и потом
   * кнопка открытия, если необходимо расширить ему доступы». Дерево выдачи
   * занимает пол-экрана на каждого, а трогают его редко — обычно один раз, при
   * заведении. Открытый список из пяти человек превращался в простыню, по
   * которой не найти ни одного.
   */
  const [scopeOpen, setScopeOpen] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  /*
   * Должность и организация задаются сразу при заведении.
   *
   * Заказчик: «при создании аккаунта пользователь должен добавить ФИО,
   * должность и организацию, где работает». Раньше заводили одно ФИО, а
   * должность человек дописывал себе сам в кабинете — и до тех пор в каждом
   * акте графу «должность» приходилось заполнять руками.
   */
  const [position, setPosition] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState<UserRole>('ответственный');
  const [password, setPassword] = useState('');
  /*
   * Занятость и отказ ведёт общий помощник: он снимает занятость в
   * `finally` и называет сорвавшееся действие словами. Раньше срыв моста к
   * основному процессу оставлял окно заблокированным до перезапуска.
   */
  const { busy, message, run: runAction } = useBusyRun();

  const run = (action: () => Promise<{ ok: boolean; error?: { message: string } }>): void => {
    void runAction(action).then((done) => { if (done) props.onChanged(); });
  };

  const add = (): void => run(async () => {
    const created = await createUser(accessDeps, {
      login, fullName, position, organization, role, temporaryPassword: password,
    }, props.actor);
    if (created.ok) {
      // В журнал действий: кого завели и с какой ролью.
      await recordAudit(auditDeps, {
        actor: props.actor, kind: 'заведён пользователь',
        subject: created.value.fullName, details: `роль: ${created.value.role}`,
      });
      setAdding(false);
      setLogin('');
      setFullName('');
      setPosition('');
      setOrganization('');
      setPassword('');
    }
    return created;
  });

  const toggleScope = (user: UserAccount, nodeId: string): void => run(async () => updateUser(accessDeps, {
    id: user.id,
    scope: user.scope.includes(nodeId)
      ? user.scope.filter((id) => id !== nodeId)
      : [...user.scope, nodeId],
  }, props.actor));

  return (
    <section className="settings-section">
      <h4>Пользователи</h4>
      <p className="muted small">
        Роль задаёт, что человеку можно вообще; отметки по дереву — над чем именно. Права идут
        вниз: отметили здание — доступны все его этажи и склады.
      </p>

      <ul className="users-list">
        {props.users.map((user) => (
          <li key={user.id} className={user.archivedAt === null ? undefined : 'archived'}>
            <div className="user-head">
              <strong>{user.fullName}</strong>
              <span className="muted small">{user.login}</span>
              <SelectField
                value={user.role}
                disabled={busy || user.id === props.actor.id}
                title={user.id === props.actor.id ? 'Свою роль не меняют: так теряют доступ к программе' : undefined}
                options={USER_ROLES.map((item) => ({ value: item, title: item }))}
                onChange={(value) => run(async () => updateUser(
                  accessDeps, { id: user.id, role: value as UserRole }, props.actor,
                ))}
              />
              {user.mustChangePassword && <span className="badge warn">пароль временный</span>}
              {/* Состояние входа — словом, а не отсутствием пометки: список
                  читают, чтобы понять, кто сейчас может войти. */}
              <span className={user.archivedAt === null ? 'badge ok' : 'badge muted'}>
                {user.archivedAt === null ? 'вход разрешён' : 'вход приостановлен'}
              </span>
            </div>

            <div className="muted small user-scope-line">
              {user.position ?? 'должность не указана'} · {user.organization ?? 'организация не указана'}
              <br />
              Доступ: {scopeSummary(user, props.nodes)}
            </div>

            {/* Область прав только у тех, у кого она вообще есть: администратору
                доступно всё, и отметки по дереву ему ничего не меняют. */}
            {user.role !== 'администратор' && (
              scopeOpen === user.id ? (
                <>
                  <UserScopePicker
                    user={user}
                    nodes={props.nodes}
                    busy={busy}
                    onToggle={(nodeId) => toggleScope(user, nodeId)}
                  />
                  <div className="user-actions">
                    <button type="button" className="link" onClick={() => setScopeOpen(null)}>
                      свернуть доступы
                    </button>
                  </div>
                </>
              ) : (
                <div className="user-actions">
                  <button
                    type="button"
                    className="link"
                    disabled={busy}
                    title="Открыть дерево объекта и отметить, что этому человеку доступно"
                    onClick={() => setScopeOpen(user.id)}
                  >
                    {user.scope.length === 0 ? 'Выдать доступ…' : 'Расширить доступ…'}
                  </button>
                </div>
              )
            )}

            <div className="user-actions">
              <button
                type="button"
                className="link"
                disabled={busy}
                onClick={() => {
                  const temporary = window.prompt(
                    `Временный пароль для «${user.fullName}». Программа попросит заменить его при входе.`,
                  );
                  if (temporary === null || temporary === '') return;
                  run(async () => {
                    const done = await resetPassword(accessDeps, { id: user.id, temporaryPassword: temporary }, props.actor);
                    if (done.ok) {
                      await recordAudit(auditDeps, {
                        actor: props.actor, kind: 'сброшен пароль', subject: user.fullName,
                        details: 'ключ подписи удалён: заперт прежним паролем',
                      });
                    }
                    return done;
                  });
                }}
              >
                сбросить пароль
              </button>
              {user.id !== props.actor.id && (
                <button
                  type="button"
                  className="link"
                  disabled={busy}
                  onClick={() => run(async () => {
                    const off = user.archivedAt === null;
                    const done = await setUserArchived(accessDeps, user.id, off, props.actor);
                    if (done.ok) {
                      await recordAudit(auditDeps, {
                        actor: props.actor,
                        kind: off ? 'отключён пользователь' : 'включён пользователь',
                        subject: user.fullName,
                      });
                    }
                    return done;
                  })}
                >
                  {user.archivedAt === null ? 'отключить' : 'вернуть'}
                </button>
              )}
              {/*
                * Удаление — не то же, что отключение.
                *
                * Заказчик просил уметь и блокировать, и удалять. Удаляется
                * только тот, кто ничего не подписывал: под записями журнала
                * стоят подписи, и «подписал тот, кого в программе нет» не
                * отвечает на вопрос, кто подписал (63-ФЗ, статья 9).
                */}
              {user.id !== props.actor.id && (
                <button
                  type="button"
                  className="link"
                  disabled={busy}
                  onClick={() => {
                    const usage = userDeletionCheck(user.id, props.events ?? []);
                    if (!usage.canDelete) {
                      window.alert(
                        `«${user.fullName}» удалить нельзя: его подписью заверены записи журнала — `
                        + `${usage.signedCount}. Такую учётную запись отключают, а не удаляют: `
                        + 'подпись должна говорить, кто подписал.',
                      );
                      return;
                    }
                    if (!window.confirm(`Удалить учётную запись «${user.fullName}» совсем?`)) return;
                    run(async () => {
                      const done = await deleteUser(accessDeps, user.id, props.actor);
                      if (done.ok) {
                        await recordAudit(auditDeps, {
                          actor: props.actor, kind: 'удалён пользователь', subject: user.fullName,
                        });
                      }
                      return done;
                    });
                  }}
                >
                  удалить
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="user-add">
          <div className="field-row">
            <label className="field"><span>ФИО</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Иванов Иван Иванович" />
            </label>
            <label className="field"><span>Имя для входа</span>
              <input value={login} onChange={(event) => setLogin(event.target.value)} placeholder="ivanov" />
            </label>
          </div>
          <div className="field-row">
            <label className="field"><span>Должность</span>
              <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Инженер по пожарной безопасности" />
            </label>
            <label className="field"><span>Организация</span>
              <input
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                placeholder="ООО «Пример»"
                title="Подставится в акты проверок графой «организация исполнителя»"
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field"><span>Роль</span>
              <SelectField
                value={role}
                options={USER_ROLES.map((item) => ({ value: item, title: item }))}
                onChange={(value) => setRole(value as UserRole)}
              />
            </label>
            <label className="field"><span>Временный пароль</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} />
              {/* Требования названы до ввода, а не отказом после: иначе
                  человек узнаёт о них, уже нажав «Завести». */}
              <span className="muted small">
                не короче {MIN_PASSWORD_LENGTH} знаков, не «12345678»
              </span>
            </label>
          </div>
          <p className="muted small">
            Пароль временный: программа попросит заменить его при первом входе. До замены
            подписывать нельзя — такой пароль знают двое.
          </p>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy || login.trim() === '' || fullName.trim() === ''
                || position.trim() === '' || organization.trim() === '' || password === ''}
              onClick={add}
            >
              Завести
            </button>
            <button type="button" className="link" onClick={() => setAdding(false)}>отмена</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}>Завести пользователя</button>
      )}

      {message !== null && <p className="sign-in-error">{message}</p>}
    </section>
  );
}
