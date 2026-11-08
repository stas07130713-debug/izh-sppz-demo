/**
 * История элемента (ТЗ, Дополнение 2, часть П6.3).
 *
 * Что и когда происходило с элементом, кто вносил записи — строками, как в
 * журнале, но подробнее: видны отметки чек-листа, замечания и исполнитель.
 *
 * Открывается окном поверх левых полей, чтобы читать историю, не теряя из виду
 * план и дерево.
 *
 * Записи только показываются. Историю нельзя править и удалять — это прямое
 * требование к журналу эксплуатации: он предъявляется при проверке.
 *
 * Показывается история **всей проверочной группы**, а не одного объекта. Так
 * записывает чек-лист: подошёл к шкафу — отметил все пять самоспасателей;
 * проверил систему — отметка ушла её извещателям. Карточка при этом открыта на
 * месте хранения или на приборе, и история, отобранная по одному его номеру,
 * выглядела пустой, хотя проверки были. Когда в группе не один элемент, у
 * записи подписано, к какому она относится.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { backdropClose } from './modal-backdrop';
import { elementByCode } from '@izh/core';
import { todayIso } from '../today';
import { useScheduleSource } from '../schedule-source-context';
import { formatDateRu } from '../format';
import { ElementIcon } from './ElementIcon';
import { StoredDocumentActions } from './StoredDocumentActions';
import { shortAccountName } from './AppHeader';

export interface ObjectHistoryModalProps {
  readonly object: PlanObject;
  readonly events: readonly MaintenanceEvent[];
  readonly onClose: () => void;
  readonly onOpenSignature: (event: MaintenanceEvent) => void;
}

/** Сколько записей показывать сразу: у системы на сотню извещателей их тысячи. */
const SHOWN_LIMIT = 60;

export function ObjectHistoryModal(props: ObjectHistoryModalProps): React.JSX.Element {
  const scheduleSource = useScheduleSource();
  const element = elementByCode(props.object.typeCode);
  // Названия работ берутся из действующего регламента: история должна
  // называть работу так же, как её называет чек-лист и журнал.
  const rules = scheduleSource.rulesFor(props.object, todayIso());

  /*
   * История — только этой единицы.
   *
   * Прежде сюда попадали записи всей проверочной группы: обход закрывает
   * одним визитом все однотипные огнетушители здания, и каждому пишется
   * своя отметка. Для проведения проверки группа нужна, а для истории —
   * нет: в карточке огнетушителя № 12 не должно быть записей про № 13.
   * Заказчик: «в истории показывать только то, что относится к конкретной
   * единице системы».
   */
  const history = props.events
    .filter((event) => event.objectId === props.object.id)
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt));
  const shown = history.slice(0, SHOWN_LIMIT);

  const titleOf = (activityCode: string): string =>
    rules.find((rule) => rule.activityCode === activityCode)?.title ?? activityCode;

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal history-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3 className="titled-with-icon">
            <ElementIcon typeCode={props.object.typeCode} />
            <span>
              История: {element?.title ?? props.object.typeCode}
              {props.object.regNumber !== null && ` № ${props.object.regNumber}`}
            </span>
          </h3>
          <button type="button" className="link" onClick={props.onClose}>
            закрыть ✕
          </button>
        </div>

        <dl className="facts">
          <dt>Заведён в программе</dt>
          <dd>{formatDateRu(props.object.createdAt.slice(0, 10))}</dd>
          {props.object.commissionedOn !== null && (
            <>
              <dt>Введён в эксплуатацию</dt>
              <dd>{formatDateRu(props.object.commissionedOn)}</dd>
            </>
          )}
          <dt>Записей в истории</dt>
          <dd>{history.length}{history.length > shown.length && ` (показаны последние ${shown.length})`}</dd>
        </dl>

        {history.length === 0 ? (
          <p className="muted small">
            По этому элементу ещё не проводилось ни одного мероприятия. Записи появятся после первой
            проверки — её открывает кнопка «Чек-лист проверки» или ячейка в журнале.
          </p>
        ) : (
          <ul className="history-list">
            {shown.map((event) => (
              <li key={event.id}>
                <div className="history-head">
                  <strong>
                    {formatDateRu(event.performedOn)} — {titleOf(event.activityCode)}
                  </strong>
                  <span className={resultClass(event.result)}>{event.result}</span>
                </div>

                {event.executorDetails !== null && event.executorDetails !== undefined
                  ? <div className="muted small">Исполнитель: {event.executorDetails.fullName}, {event.executorDetails.position}, {event.executorDetails.organization}</div>
                  : event.executor !== null && <div className="muted small">Исполнитель: {event.executor}</div>}
                {/* Акт проверки — отдельно от акта сторонней организации: тот
                    говорит, кто работал, этот — что проверка состоялась. */}
                {event.inspectionAct !== null && event.inspectionAct !== undefined && <div className="muted small">
                  Акт проверки № {event.inspectionAct.number} от {formatDateRu(event.inspectionAct.date)}
                  <div className="history-documents">
                    <StoredDocumentActions document={event.inspectionAct.file} />
                  </div>
                </div>}
                {event.externalEvidence !== null && event.externalEvidence !== undefined && <div className="muted small">
                  Сторонняя организация: {event.externalEvidence.organization}, ИНН {event.externalEvidence.inn}{event.externalEvidence.licenseNumber.trim() === '' ? '' : `, лицензия ${event.externalEvidence.licenseNumber}`}; акт № {event.externalEvidence.actNumber} от {formatDateRu(event.externalEvidence.actDate)}
                  <div className="history-documents">
                    <StoredDocumentActions document={event.externalEvidence.actFile} />
                    {event.externalEvidence.protocolFile !== null && event.externalEvidence.protocolFile !== undefined && (
                      <StoredDocumentActions document={event.externalEvidence.protocolFile} />
                    )}
                  </div>
                </div>}
                {event.groupId !== null && event.groupId !== undefined && <div className="muted small">Групповое мероприятие: {event.groupId}</div>}
                {event.defect !== null && <div className="small error">Замечание: {event.defect}</div>}
                {event.note !== null && <div className="muted small">{event.note}</div>}

                {event.signature !== null && event.signature !== undefined ? (
                  <button
                    type="button"
                    className="history-signature"
                    title={`Подписано простой электронной подписью: ${event.signature.signerName}`}
                    onClick={() => props.onOpenSignature(event)}
                  >
                    <span aria-hidden="true">✔</span>
                    <span>Подписано ПЭП · {shortAccountName(event.signature.signerName)}</span>
                    <span className="history-signature-date">
                      {formatDateRu(event.signature.signedAt.slice(0, 10))}
                    </span>
                  </button>
                ) : (
                  <div className="muted small history-signature-empty">ПЭП не поставлена</div>
                )}

                {event.checklist.length > 0 && (
                  <ul className="history-checklist">
                    {event.checklist.map((answer) => (
                      <li key={answer.item} className={answer.result === 'выполнено' ? 'done' : ''}>
                        {answer.result === 'выполнено' ? '✓' : answer.result === 'не выполнено' ? '✗' : '⚠'}{' '}
                        {answer.item}
                        {answer.defect !== null && <span className="error"> — {answer.defect}</span>}
                        {(answer.attachments?.length ?? 0) > 0 && <div className="history-documents">{answer.attachments?.map((file) => <StoredDocumentActions key={file.hash} document={file} />)}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {(event.measurements?.length ?? 0) > 0 && <ul className="history-checklist">
                  {event.measurements?.map((measurement) => <li key={measurement.code}>{measurement.label}: {String(measurement.value)}{measurement.unit === null ? '' : ` ${measurement.unit}`}</li>)}
                </ul>}

                <div className="muted small">Запись внесена: {formatDateRu(event.createdAt.slice(0, 10))}</div>
              </li>
            ))}
          </ul>
        )}

        <p className="muted small">Записи, результаты измерений и ссылки на акты хранятся в неизменяемой истории.</p>
      </div>
    </div>
  );
}

function resultClass(result: string): string {
  if (result === 'выполнено') return 'badge ok';
  if (result === 'не выполнено') return 'badge error';
  return 'badge warn';
}
