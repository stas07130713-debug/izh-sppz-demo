/**
 * История действий — вкладка личного кабинета.
 *
 * Заказчик (пункты 9 и 10 перечня доработок): история должна отражать **все**
 * значимые изменения, а не только входы и работу с учётными записями; при этом
 * копии записей основной истории здесь заводить не нужно — «в личном кабинете
 * отображается "05.09.2026 — Иванов И.И. — Выполнил проверку ПК №24"; при
 * нажатии на эту запись программа должна открыть соответствующую запись в
 * основной истории элемента».
 *
 * Поэтому лента ничего не хранит: она собирается из трёх журналов, которые
 * программа ведёт и без неё, — действий, изменений и эксплуатации
 * (`userActivity` в ядре). У строки есть ссылка на первоисточник, и по щелчку
 * окно открывает его, а не вторую копию.
 *
 * Отбор по человеку и по источнику: администратор смотрит и всех, и одного.
 * Свежее сверху — журнал читают с последнего события.
 */

import { useEffect, useState } from 'react';
import type { PlanObject, UserAccount } from '@izh/contracts';
import type { ActivityLine, ActivitySource } from '@izh/core';
import { AUDIT_KEEP_DAYS, readAudit, readChangeLog, userActivity } from '@izh/core';
import { auditDeps, changeLogDeps, maintenanceDeps, objectDeps } from '../deps';
import { SelectField } from './SelectField';
import { formatDateTime } from '../format';

export interface AuditLogPanelProps {
  readonly reader: UserAccount;
  readonly users: readonly UserAccount[];
  /** Открыть первоисточник строки: элемент или запись его истории. */
  readonly onOpen: (line: ActivityLine) => void;
}

/**
 * Дата и время события — тем же видом, что во всей программе.
 *
 * Свой вид здесь и был причиной разнобоя: лента показывала полный год, а
 * журнал рядом — сокращённый.
 */
function whenText(at: string): string {
  return formatDateTime(at);
}

/** Цвет строки: отказ во входе и удаление заметнее прочего. */
function toneOf(line: ActivityLine): string {
  if (line.action === 'отказ во входе' || line.action.startsWith('Удалил')) return 'audit-danger';
  if (line.source === 'эксплуатация' || line.action === 'подписана запись') return 'audit-ok';
  return '';
}

const SOURCES: readonly { readonly value: string; readonly title: string }[] = [
  { value: '', title: 'Все источники' },
  { value: 'действия', title: 'Вход и учётные записи' },
  { value: 'изменения', title: 'Правки данных' },
  { value: 'эксплуатация', title: 'Проверки и обслуживание' },
];

export function AuditLogPanel(props: AuditLogPanelProps): React.JSX.Element {
  const [lines, setLines] = useState<readonly ActivityLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [source, setSource] = useState('');

  useEffect(() => {
    void (async () => {
      const audit = await readAudit(auditDeps, props.reader);
      if (!audit.ok) { setError(audit.error.message); return; }

      const tree = await objectDeps.tree.list();
      const nodes = tree.ok ? tree.value : [];
      const changes = await readChangeLog(changeLogDeps, { reader: props.reader, nodes });
      if (!changes.ok) { setError(changes.error.message); return; }

      const events = await maintenanceDeps.events.list();
      const objects = await objectDeps.objects.list();

      setLines(userActivity({
        audit: audit.value,
        changes: changes.value,
        maintenance: events.ok ? events.value : [],
        objects: objects.ok ? (objects.value as readonly PlanObject[]) : [],
        // Дерево — ради полного пути в графе «Над чем»: одного «Этаж 1» мало.
        nodes,
      }));
    })();
  }, [props.reader]);

  if (error !== null) return <p className="error">{error}</p>;
  if (lines === null) return <p className="muted small">Читаем журналы…</p>;

  const shown = lines
    .filter((line) => userId === '' || line.actorId === userId)
    .filter((line) => source === '' || line.source === (source as ActivitySource));

  return (
    <section className="settings-section">
      <h4>История действий</h4>
      <p className="muted small">
        Вход в программу, правки данных и проведённые проверки — одной лентой. Записи не
        дублируются: строка ведёт в тот журнал, где событие записано. Вход и работа с учётными
        записями хранятся {AUDIT_KEEP_DAYS} дней, правки и проверки — бессрочно.
      </p>

      <div className="field-row audit-filters">
        <SelectField
          label="Пользователь"
          value={userId}
          placeholder="Все пользователи"
          options={[
            { value: '', title: 'Все пользователи' },
            ...props.users.map((user) => ({ value: user.id, title: user.fullName })),
          ]}
          onChange={setUserId}
        />
        <SelectField label="Источник" value={source} options={[...SOURCES]} onChange={setSource} />
      </div>

      {shown.length === 0 ? (
        <p className="muted small">Событий пока нет.</p>
      ) : (
        <table className="journal-table audit-table">
          <thead>
            <tr>
              <th>Когда</th>
              <th>Кто</th>
              <th>Что</th>
              <th>Над чем</th>
              <th>Что изменилось</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((line) => {
              /*
               * Ведёт вся строка, а не слово в ней.
               *
               * Заказчик: «ссылки, где написано, над чем внесены изменения, не
               * открывают этот раздел — пусть будет кликабельна сама строка».
               * Ссылкой было только название предмета правки, и по узлу дерева
               * её не было вовсе: у него нет элемента, к которому вести, — а
               * вести есть куда, к самому узлу.
               */
              const goes = (line.link?.objectId ?? null) !== null || (line.link?.nodeId ?? null) !== null;
              return (
              <tr
                key={line.id}
                className={goes ? `${toneOf(line)} audit-row-link` : toneOf(line)}
                {...(goes ? {
                  tabIndex: 0,
                  role: 'button' as const,
                  title: 'Открыть запись, о которой строка',
                  onClick: () => props.onOpen(line),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    // С клавиатуры — как обычная кнопка: Enter и пробел.
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    props.onOpen(line);
                  },
                } : {})}
              >
                <td className="muted small">{whenText(line.at)}</td>
                <td>
                  {line.actorName}
                  {line.actorRole !== null && <span className="muted small"> · {line.actorRole}</span>}
                </td>
                <td>{line.action}</td>
                <td className={goes ? 'audit-subject' : 'muted small'}>
                  {line.subject ?? ''}
                  {/*
                    * Полный путь под названием: «Этаж 1» без здания и цеха
                    * ничего не говорит — таких этажей на предприятии столько
                    * же, сколько зданий.
                    */}
                  {line.place !== null && <div className="muted small audit-place">{line.place}</div>}
                </td>
                <td className="muted small">{line.details ?? ''}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
