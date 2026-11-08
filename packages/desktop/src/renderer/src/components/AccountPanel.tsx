/**
 * Личный кабинет (ТЗ, Дополнение 7, Д5).
 *
 * Самое необходимое: кто я, какая у меня роль, что мне поручено и как сменить
 * пароль. Роль и перечень узлов показываются, но не правятся — их назначает
 * администратор, и кнопка, которой человек поменял бы себе роль, обессмыслила бы
 * всё разграничение.
 *
 * ФИО и должность править можно: они подставляются исполнителем работ и попадают
 * в подпись, и держать их в чужих руках значило бы просить администратора
 * поправить опечатку в собственной фамилии.
 *
 * У администратора здесь ещё две вкладки — «Пользователи в системе» и «История
 * действий» (требование заказчика). Обе только его: в первой раздают права, во
 * второй видно, кто когда заходил, — сведения о людях, а не об оборудовании.
 */

import { useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { TreeNode, UserAccount } from '@izh/contracts';
import { LEGAL_DOCUMENTS, can, changePassword, updateOwnProfile } from '@izh/core';
import { AuditLogPanel } from './AuditLogPanel';
import { UsersSettings } from './UsersSettings';
import { accessDeps } from '../deps';
import { useBusyRun } from '../use-busy-run';
import { formatDateRu } from '../format';

export interface AccountPanelProps {
  readonly user: UserAccount;
  readonly nodes: readonly TreeNode[];
  readonly onClose: () => void;
  readonly onChanged: (user: UserAccount) => void;
  /** Все учётные записи: нужны вкладке «Пользователи в системе». */
  readonly users: readonly UserAccount[];
  readonly onUsersChanged: () => void;
  /**
   * Открыть первоисточник строки истории.
   *
   * Кабинет не показывает копию записи — он ведёт к ней. Куда именно вести,
   * решает окно программы: у него есть и дерево, и журнал, и карточки.
   *
   * Элемента может не быть — тогда ведём к узлу дерева: правки здания, этажа
   * и помещения относятся к нему, и открывать по ним нечего, кроме него.
   */
  readonly onOpenActivity: (target: { readonly objectId: string | null; readonly nodeId: string | null }) => void;
}

type AccountTab = 'профиль' | 'пользователи' | 'история';

export function AccountPanel(props: AccountPanelProps): React.JSX.Element {
  const user = props.user;
  const [fullName, setFullName] = useState(user.fullName);
  const [position, setPosition] = useState(user.position ?? '');
  /*
   * Организация, в которой человек работает.
   *
   * Заказчик: «в личном кабинете и при создании аккаунта пользователь должен
   * добавить ФИО, должность и организацию, где работает; потом эта информация
   * подставляется в соответствующие графы при проверке оборудования».
   *
   * Это не организация из дерева объекта: дерево отвечает «чьё оборудование»,
   * а здесь — «от кого человек». У подрядчика это разные вещи, и в акте должна
   * стоять его собственная организация.
   */
  const [organization, setOrganization] = useState(user.organization ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [current, setCurrent] = useState('');
  const [tab, setTab] = useState<AccountTab>('профиль');
  const [next, setNext] = useState('');
  // Занятость и отказ ведёт общий помощник: см. `use-busy-run`.
  const { busy, message, setMessage, run } = useBusyRun();

  const scope = user.role === 'администратор'
    ? 'вся программа'
    : user.scope.length === 0
      ? 'ничего не поручено — обратитесь к администратору'
      : user.scope
        .map((id) => props.nodes.find((node) => node.id === id)?.name ?? 'узел удалён')
        .join(', ');

  const saveProfile = (): void => {
    /*
     * Свой профиль правится отдельным сценарием, без права «пользователи.править».
     * Роль и область в него не входят вовсе — подсунуть их нельзя, и повысить
     * себя через личный кабинет не получится.
     */
    void run(async () => {
      const saved = await updateOwnProfile(accessDeps, {
        id: user.id, fullName, position, organization, email,
      }, user);
      if (saved.ok) props.onChanged(saved.value);
      return saved;
    }).then((done) => { if (done) setMessage('Сохранено.'); });
  };

  const savePassword = (): void => {
    void run(async () => {
      const changed = await changePassword(accessDeps, {
        id: user.id, currentPassword: current, newPassword: next,
      });
      if (changed.ok) props.onChanged(changed.value);
      return changed;
    }).then((done) => {
      if (!done) return;
      // Поля очищаются только после успеха: иначе после отказа человек
      // набирал бы прежний пароль заново, не зная, что именно не подошло.
      setCurrent('');
      setNext('');
      setMessage('Пароль изменён.');
    });
  };

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal account-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Личный кабинет</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        {/*
          * Вкладки появляются только у администратора: остальным показывать
          * пустые заголовки, за которыми ничего нет, незачем.
          */}
        {can(user, 'пользователи.править') && (
          <div className="settings-tabs">
            {(['профиль', 'пользователи', 'история'] as const).map((name) => (
              <button
                key={name}
                type="button"
                className={tab === name ? 'settings-tab active' : 'settings-tab'}
                aria-selected={tab === name}
                onClick={() => setTab(name)}
              >
                {name === 'профиль' ? 'Профиль' : name === 'пользователи' ? 'Пользователи в системе' : 'История действий'}
              </button>
            ))}
          </div>
        )}

        {tab === 'пользователи' && (
          <UsersSettings
            actor={user}
            users={props.users}
            nodes={props.nodes}
            onChanged={props.onUsersChanged}
          />
        )}

        {tab === 'история' && (
          <AuditLogPanel
            reader={user}
            users={props.users}
            onOpen={(line) => props.onOpenActivity({
              objectId: line.link?.objectId ?? null,
              nodeId: line.link?.nodeId ?? null,
            })}
          />
        )}

        {tab === 'профиль' && <>
        <div className="account-facts">
          <div><dt>Имя для входа</dt><dd>{user.login}</dd></div>
          <div><dt>Роль</dt><dd>{user.role}</dd></div>
          <div><dt>Доступ</dt><dd>{scope}</dd></div>
        </div>

        <section className="settings-section">
          <h4>Сведения о себе</h4>
          <p className="muted small">
            ФИО подставляется исполнителем работ в чек-листах и попадает в электронную подпись.
          </p>
          <label className="field">
            <span>ФИО</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Должность</span>
              <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Инженер по ПБ" />
            </label>
            <label className="field">
              <span>Организация</span>
              <input
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                placeholder="ООО «Пример»"
                title="Подставится в акты проверок графой «организация исполнителя»"
              />
            </label>
            <label className="field">
              <span>Электронная почта</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ivanov@example.ru" />
            </label>
          </div>
          <button
            type="button"
            disabled={busy || fullName.trim() === '' || position.trim() === '' || organization.trim() === ''}
            onClick={saveProfile}
          >Сохранить</button>
        </section>

        <section className="settings-section">
          <h4>Пароль</h4>
          <p className="muted small">
            Пароль хранится отпечатком и известен только вам. Забыли — администратор выдаст
            временный, и программа попросит заменить его при первом входе.
          </p>
          <div className="field-row">
            <label className="field">
              <span>Нынешний пароль</span>
              <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} />
            </label>
            <label className="field">
              <span>Новый пароль</span>
              <input type="password" value={next} onChange={(event) => setNext(event.target.value)} />
            </label>
          </div>
          <button type="button" disabled={busy || current === '' || next === ''} onClick={savePassword}>
            Сменить пароль
          </button>
        </section>

        {/*
          * Принятые условия можно перечитать в любой момент.
          *
          * Документ, который показали один раз при первом входе и спрятали,
          * человек не считает принятым по-настоящему — и правильно делает:
          * согласие, которое нельзя перечитать, ничего не подтверждает.
          */}
        <section className="settings-section">
          <h4>Условия работы в программе</h4>
          <p className="muted small">
            {props.user.acceptedLegalVersion === null || props.user.acceptedLegalVersion === undefined
              ? 'Не приняты.'
              : `Приняты ${props.user.acceptedLegalAt === null || props.user.acceptedLegalAt === undefined
                ? ''
                : formatDateRu(props.user.acceptedLegalAt.slice(0, 10))}, редакция ${props.user.acceptedLegalVersion}.`}
          </p>
          {LEGAL_DOCUMENTS.map((document) => (
            <details key={document.id} className="legal-details">
              <summary>{document.title}</summary>
              <div className="legal-text">{document.text}</div>
            </details>
          ))}
        </section>
        </>}

        {message !== null && <p className="muted small">{message}</p>}
      </div>
    </div>
  );
}
