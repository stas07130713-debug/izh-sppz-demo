/**
 * Как простая электронная подпись выглядит в графе журнала.
 *
 * Заказчик: «в журнале также в графе регистрируется ПЭП».
 *
 * Строка журнала — про оборудование, а подпись стоит под записью проверки.
 * Поэтому в графе показывается подпись **последней** записи по этому элементу:
 * она отвечает на вопрос «кто подтвердил последнюю проверку». Всю историю
 * подписей смотрят в окне истории элемента — там каждая запись со своей.
 *
 * Пока проверок не было, показывается подпись под самим заведением строки:
 * «эту единицу оборудования внёс в журнал такой-то». Заказчик: «при заведении
 * нового огнетушителя или элемента, и вообще при создании новых строк в
 * журнале должна ставиться ПЭП». Без неё в графе стояла бы пустота у всего
 * только что заведённого — а это как раз то, за что отвечают лично.
 */

import type { MaintenanceEvent, PlanObject, SimpleSignature } from '@izh/contracts';
import { formatDateRu } from '../format';
import { shortAccountName } from './AppHeader';

/** Последняя по дате выполнения запись: её подпись и показывается. */
export function lastEvent(events: readonly MaintenanceEvent[], objectId: string): MaintenanceEvent | null {
  const own = events.filter((event) => event.objectId === objectId);
  if (own.length === 0) return null;
  return own.reduce((latest, event) => (
    event.performedOn > latest.performedOn
      || (event.performedOn === latest.performedOn && event.createdAt > latest.createdAt)
      ? event : latest
  ));
}

export function signatureCell(
  events: readonly MaintenanceEvent[],
  object: PlanObject,
  onOpen: (event: MaintenanceEvent) => void,
  canSign: boolean,
): React.JSX.Element | null {
  const event = lastEvent(events, object.id);

  /*
   * Проверок ещё не было — показывается подпись под заведением строки.
   *
   * Подписать задним числом нечего: заведение состоялось однажды, и кнопки
   * «подписать» здесь нет. У оборудования, заведённого до этого правила,
   * графа остаётся пустой — так и есть на самом деле.
   */
  if (event === null) {
    const registration = object.registrationSignature ?? null;
    return registration === null ? null : signed(registration, undefined);
  }

  const signature = event.signature ?? null;
  if (signature === null) {
    return canSign ? (
      <button
        type="button"
        className="journal-signature-button unsigned"
        onClick={(click) => { click.stopPropagation(); onOpen(event); }}
      >
        Подписать ПЭП
      </button>
    ) : <span className="muted">без подписи</span>;
  }

  return signed(signature, () => onOpen(event));
}

/**
 * Как выглядит поставленная подпись: кто и когда.
 *
 * Одна и та же на обе подписи графы — под последней проверкой и под самим
 * заведением строки. Разными они выглядеть не должны: в графе стоит ПЭП, и
 * человеку важно, кто её поставил, а не то, к чему именно она относится; за
 * этим он открывает запись.
 *
 * `onOpen` не задан — открывать нечего: заведение строки записью журнала не
 * является, и подпись под ним просто показывается.
 */
function signed(
  signature: SimpleSignature,
  onOpen: (() => void) | undefined,
): React.JSX.Element {
  const when = formatDateRu(signature.signedAt.slice(0, 10));
  const signer = shortAccountName(signature.signerName);
  const what = signature.kind === 'заведение в журнал' ? 'Строку в журнал внёс' : 'Подписано простой электронной подписью';
  const title = `${what}: ${signature.signerName}, ${when}`;

  if (onOpen === undefined) {
    return (
      <span className="journal-signed" title={title}>
        <span className="journal-signature-name">✔ {signer}</span>
        <span className="journal-signature-date">ПЭП · {when}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="journal-signed"
      title={title}
      onClick={(click) => { click.stopPropagation(); onOpen(); }}
    >
      <span className="journal-signature-name">✔ {signer}</span>
      <span className="journal-signature-date">ПЭП · {when}</span>
    </button>
  );
}
