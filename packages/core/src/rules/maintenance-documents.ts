/**
 * Документы, приложенные к проверкам элемента (ТЗ, Дополнение 6).
 *
 * Всё, что прикладывают в чек-листе, должно быть видно в карточке этого
 * элемента — иначе загруженный акт исчезает из виду: он лежит в ленте истории,
 * а её открывают редко. Проверяющий же спрашивает документ по конкретной
 * лестнице или огнетушителю, и искать его по всем записям журнала нельзя.
 *
 * Собирается из трёх мест сразу, потому что приложить документ можно тремя
 * способами: акт проверки по работе, акт и протокол сторонней организации,
 * снимок или файл к отдельному пункту чек-листа. Для карточки это всё одно и
 * то же — бумаги по этому элементу.
 */

import type { MaintenanceEvent, PlanObjectId, StoredDocumentReference } from '@izh/contracts';

export interface MaintenanceDocument {
  /** Запись журнала, к которой приложен документ. */
  readonly eventId: string;
  /** Что это за бумага: акт проверки, акт подрядчика, протокол, вложение к пункту. */
  readonly kind: 'акт проверки' | 'акт подрядчика' | 'протокол' | 'вложение';
  /** Дата работ: по ней документы упорядочены, свежие сверху. */
  readonly performedOn: string;
  /** Чем эта бумага подписана в списке: работа, номер акта, пункт чек-листа. */
  readonly title: string;
  readonly document: StoredDocumentReference;
}

/**
 * Бумаги по элементу, свежие сверху.
 *
 * Один и тот же файл дважды не показывается: акт, приложенный сразу к
 * нескольким элементам одной проверкой, в карточке каждого из них один.
 */
export function maintenanceDocuments(
  objectId: PlanObjectId,
  events: readonly MaintenanceEvent[],
): readonly MaintenanceDocument[] {
  const own = events
    .filter((event) => event.objectId === objectId)
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt));

  const collected: MaintenanceDocument[] = [];
  const seen = new Set<string>();
  const add = (item: MaintenanceDocument): void => {
    if (seen.has(item.document.hash)) return;
    seen.add(item.document.hash);
    collected.push(item);
  };

  for (const event of own) {
    const act = event.inspectionAct;
    if (act !== null && act !== undefined) {
      add({
        eventId: event.id, kind: 'акт проверки', performedOn: event.performedOn,
        title: `акт проверки № ${act.number}`, document: act.file,
      });
    }

    const evidence = event.externalEvidence;
    if (evidence !== null && evidence !== undefined) {
      add({
        eventId: event.id, kind: 'акт подрядчика', performedOn: event.performedOn,
        title: `акт № ${evidence.actNumber}, ${evidence.organization}`, document: evidence.actFile,
      });
      if (evidence.protocolFile !== null && evidence.protocolFile !== undefined) {
        add({
          eventId: event.id, kind: 'протокол', performedOn: event.performedOn,
          title: `протокол к акту № ${evidence.actNumber}`, document: evidence.protocolFile,
        });
      }
    }

    for (const answer of event.checklist) {
      for (const file of answer.attachments ?? []) {
        add({
          eventId: event.id, kind: 'вложение', performedOn: event.performedOn,
          title: answer.item, document: file,
        });
      }
    }
  }

  return collected;
}
