/**
 * Соглашения при первом входе (ТЗ, Дополнение 7, часть Д12).
 *
 * Заказчик: «пользователь при первом входе ОБЯЗАН прочитать и согласиться на
 * сбор и обработку персональных данных, а также с другими условиями работы в
 * программе».
 *
 * Отсюда три свойства экрана:
 *
 * 1. Мимо него не пройти: пока соглашения не приняты, программа не открывается.
 *    Кнопки «потом» нет — «потом» означало бы работу без принятых условий;
 * 2. Отметки раздельные. Согласие на обработку персональных данных даётся
 *    отдельно и осознанно (152-ФЗ, статья 9), и общая галочка «согласен со
 *    всем» этого не даёт;
 * 3. Отметка становится доступной, только когда текст пролистан до конца.
 *    Проверить, что человек прочитал, нельзя, но поставить отметку не читая
 *    вовсе — можно; это то немногое, что здесь в силах программы.
 *
 * Выйти можно всегда: кнопка «Не принимаю» закрывает программу.
 */

import { useCallback, useState } from 'react';
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from '@izh/core';

export interface LegalConsentScreenProps {
  readonly userName: string;
  readonly busy: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

export function LegalConsentScreen(props: LegalConsentScreenProps): React.JSX.Element {
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string): void => setAccepted((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /**
   * Долистал ли до низа: до этого отметка не даётся.
   *
   * Текст, который **помещается целиком**, считается прочитанным сразу. Без
   * этого получалась ловушка: события прокрутки у непрокручиваемого поля не
   * бывает, отметка оставалась заблокированной навсегда, и программа не
   * открывалась вовсе. А поместиться текст может легко — на высоком экране,
   * при уменьшенном масштабе окна или если документ однажды сократят.
   */
  const markRead = useCallback((id: string, element: HTMLDivElement | null): void => {
    if (element === null) return;
    if (element.scrollTop + element.clientHeight < element.scrollHeight - 24) return;
    setRead((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);

  const all = LEGAL_DOCUMENTS.every((document) => accepted.has(document.id));

  return (
    <div className="legal-screen">
      <div className="legal-card">
        <div className="panel-head">
          <h3>Условия работы в программе</h3>
          <span className="muted small">редакция от {LEGAL_VERSION}</span>
        </div>

        <p className="muted small">
          {props.userName}, прежде чем начать работу, прочитайте два документа и подтвердите
          согласие. Без этого программа не откроется.
        </p>

        {LEGAL_DOCUMENTS.map((document) => (
          <section key={document.id} className="legal-document">
            <h4>{document.title}</h4>
            <div
              className="legal-text"
              /* Проверяем и при появлении поля: текст мог поместиться целиком,
                 и тогда прокрутки не будет никогда. */
              ref={(element) => markRead(document.id, element)}
              onScroll={(event) => markRead(document.id, event.currentTarget)}
            >
              {document.text}
            </div>
            <label className={read.has(document.id) ? 'checkbox' : 'checkbox muted'}>
              <input
                type="checkbox"
                checked={accepted.has(document.id)}
                disabled={props.busy || !read.has(document.id)}
                onChange={() => toggle(document.id)}
              />
              <span>
                {document.consent}
                {!read.has(document.id) && <span className="muted small"> — дочитайте до конца</span>}
              </span>
            </label>
          </section>
        ))}

        <div className="actions">
          <button type="button" className="primary" disabled={props.busy || !all} onClick={props.onAccept}>
            Принимаю
          </button>
          <button type="button" disabled={props.busy} onClick={props.onDecline}>
            Не принимаю и выхожу
          </button>
        </div>

        <p className="muted small">
          Принятое сохраняется вместе с датой и редакцией. Прочитать документы снова можно в
          личном кабинете.
        </p>
      </div>
    </div>
  );
}
