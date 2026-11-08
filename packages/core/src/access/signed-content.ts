/**
 * Что именно подписывается в записи журнала.
 *
 * Подпись относится к содержимому, а не к «записи вообще»: в ней хранится
 * отпечаток, и сверка отвечает на вопрос «не менялось ли подписанное». Значит
 * текст содержимого обязан собираться **одним** способом при подписании и при
 * сверке — иначе подпись, верная в день постановки, назавтра объявит подделку
 * из-за перестановки полей.
 *
 * Поэтому сборка живёт здесь, отдельной функцией, и её зовут обе стороны.
 *
 * В содержимое входит то, что делает запись записью: какой объект, какая
 * работа, когда выполнена, с каким результатом, кто исполнитель, что отвечено в
 * чек-листе, какой акт приложен. Не входит служебное — идентификатор записи,
 * время её создания в хранилище, ссылка на версию регламента: они не меняют
 * смысла проверки, а от их появления подпись рвалась бы на пустом месте.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';

/**
 * Перевод строки задан явно.
 *
 * Отпечаток считается от текста побайтно, и разница между переводами строки
 * сделала бы подпись непроверяемой на другой машине.
 */
const LINE_BREAK = '\n';

/** Строка «ключ: значение». Пустое значение опускается целиком. */
function line(title: string, value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text === '' ? '' : `${title}: ${text}`;
}

export function signedJournalContent(event: MaintenanceEvent): string {
  const checklist = event.checklist
    .map((answer) => `${answer.item} = ${answer.result}${answer.defect === null ? '' : ` (${answer.defect})`}`)
    .join('; ');

  const measurements = (event.measurements ?? [])
    .map((item) => `${item.label} = ${String(item.value)}${item.unit === null ? '' : ` ${item.unit}`}`)
    .join('; ');

  const act = event.inspectionAct ?? null;

  return [
    line('объект', event.objectId),
    line('работа', event.activityCode),
    line('выполнено', event.performedOn),
    line('результат', event.result),
    line('замечание', event.defect),
    line('исполнитель', event.executor),
    line('исполнитель (ФИО)', event.executorDetails?.fullName ?? null),
    line('должность', event.executorDetails?.position ?? null),
    line('организация', event.executorDetails?.organization ?? null),
    line('сторонняя организация', event.externalEvidence?.organization ?? null),
    line('акт', act === null ? null : `№ ${act.number} от ${act.date} (${act.file.hash})`),
    line('чек-лист', checklist),
    line('измерения', measurements),
    line('примечание', event.note),
  ].filter((part) => part !== '').join(LINE_BREAK);
}

/**
 * Что подписывается при заведении строки в журнал.
 *
 * Не вся карточка, а те сведения, которыми оборудование опознают: где оно
 * числится, что это, под каким номером, какой марки, чьего изготовления, с
 * какого дня в работе и за кем закреплено. Подписавший отвечает за них.
 *
 * Не входит остальное содержимое карточки — оно живёт своей жизнью и меняется
 * при каждой проверке: техническое состояние, место на плане, помещение,
 * полка склада, примечание. От их правки подпись рвалась бы на пустом месте, а
 * смысл её — «эту единицу оборудования в журнал внёс такой-то» — не меняется.
 *
 * Сборка одна и та же при подписании и при сверке, как и у записи журнала:
 * иначе подпись, верная в день постановки, назавтра объявила бы подделку.
 */
export function signedObjectContent(object: PlanObject): string {
  return [
    line('узел', object.nodeId),
    line('вид', object.typeCode),
    line('учётный номер', object.regNumber),
    line('марка', object.model),
    line('изготовитель', object.manufacturer),
    line('заводской номер', object.serialNumber),
    line('введён в эксплуатацию', object.commissionedOn),
    line('ответственный', object.responsible),
  ].filter((part) => part !== '').join(LINE_BREAK);
}
