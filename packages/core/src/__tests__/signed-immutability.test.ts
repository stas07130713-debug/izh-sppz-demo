/**
 * Подписанную запись нельзя изменить, не подписав заново.
 *
 * Заказчик: «после подписания простой электронной подписью внесение изменений
 * невозможно. После внесения изменений необходимо заново подписывать».
 *
 * Так и по закону: простая электронная подпись подтверждает, что документ
 * подписан этим человеком (63-ФЗ, статья 9 часть 1). Она относится к
 * содержимому — изменить его, оставив прежнюю подпись, значит выдать чужое
 * согласие за согласие с новым текстом.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, SimpleSignature } from '@izh/contracts';
import {
  canReplaceEvent, replacementVerdict, signedEventsOfObject, withoutSignature,
} from '../access/signed-immutability.js';
import { signedJournalContent } from '../access/signed-content.js';

const NOW = '2026-09-06T10:00:00.000Z';

function event(over: Partial<MaintenanceEvent> = {}): MaintenanceEvent {
  return {
    id: 'm1', siteId: 'site', objectId: 'o1', activityCode: 'osmotr',
    performedOn: '2026-09-01', result: 'выполнено', checklist: [],
    defect: null, executor: 'Иванов И. И.', note: null, createdAt: NOW,
    ...over,
  } as MaintenanceEvent;
}

/** Подпись под указанным содержимым: отпечаток берётся от него же. */
function signature(content: string, over: Partial<SimpleSignature> = {}): SimpleSignature {
  return {
    signerId: 'u1', signerName: 'Иванов И. И.', signerPosition: 'Инженер ПБ',
    signerRole: 'ответственный', signedAt: NOW, kind: 'запись журнала',
    contentHash: `отпечаток:${content.length}:${content.slice(0, 12)}`,
    keyGeneration: 1, basis: null,
    ...over,
  } as SimpleSignature;
}

describe('неизменность подписанного', () => {
  it('неподписанную запись править можно', () => {
    const before = event();
    const after = event({ result: 'выполнено с замечаниями' });

    expect(replacementVerdict(before, after)).toBe('не подписана');
    expect(canReplaceEvent(before, after)).toBe(true);
  });

  it('подписанную запись изменить нельзя', () => {
    const before = event({ signature: signature(signedJournalContent(event())) });
    const after = event({
      result: 'не выполнено',
      signature: before.signature,
    });

    expect(replacementVerdict(before, after)).toBe('нужна новая подпись');
    expect(canReplaceEvent(before, after)).toBe(false);
  });

  it('прежнюю подпись нельзя перенести в изменённую запись', () => {
    // Тот же обман, только в другом порядке действий: содержимое новое,
    // подпись старая.
    const original = event();
    const before = event({ signature: signature(signedJournalContent(original)) });
    const after = event({ performedOn: '2026-09-05', signature: before.signature });

    expect(canReplaceEvent(before, after)).toBe(false);
  });

  it('с новой подписью изменить можно', () => {
    const original = event();
    const before = event({ signature: signature(signedJournalContent(original)) });

    const changed = event({ result: 'не выполнено', defect: 'сорван пломбир' });
    const after = { ...changed, signature: signature(signedJournalContent(changed)) };

    expect(replacementVerdict(before, after)).toBe('переподписана');
    expect(canReplaceEvent(before, after)).toBe(true);
  });

  it('правка служебного не требует новой подписи', () => {
    /*
     * Ссылка на версию регламента в подпись не входит: она не меняет смысла
     * проверки. Требовать из-за неё новую подпись значило бы дёргать человека
     * на пустом месте.
     */
    const original = event();
    const before = event({ signature: signature(signedJournalContent(original)) });
    const after = event({
      regulationVersionId: 'v2',
      signature: before.signature,
    });

    expect(replacementVerdict(before, after)).toBe('содержимое то же');
    expect(canReplaceEvent(before, after)).toBe(true);
  });

  it('снять подпись, не меняя записи, тоже нельзя', () => {
    const original = event();
    const before = event({ signature: signature(signedJournalContent(original)) });
    // Содержимое то же, подписи нет — это попытка «разподписать».
    const after = event({ result: 'не выполнено', signature: null });

    expect(canReplaceEvent(before, after)).toBe(false);
  });

  it('подписанные записи объекта находятся', () => {
    /*
     * Нужно правке карточки: поменяли учётный номер — и подписанная строка
     * журнала говорит уже не то, под чем расписались. Такие записи надо найти
     * до правки, чтобы снять с них подпись.
     */
    const подписанная = event({ id: 'm1', signature: signature('что-то') });
    const без = event({ id: 'm2' });
    const чужая = event({ id: 'm3', objectId: 'o2', signature: signature('чужое') });

    const найдены = signedEventsOfObject([подписанная, без, чужая], 'o1');

    expect(найдены.map((item) => item.id)).toEqual(['m1']);
  });

  it('снятие подписи не считается правкой содержимого', () => {
    // Снять подпись и ничего больше — допустимо: содержимое то же, а запись
    // просто перестаёт быть заверенной.
    const подписанная = event({ signature: signature(signedJournalContent(event())) });

    expect(canReplaceEvent(подписанная, withoutSignature(подписанная))).toBe(true);
    expect(withoutSignature(подписанная).signature).toBeNull();
  });

  it('новая запись проверке не мешает', () => {
    expect(replacementVerdict(null, event())).toBe('новая запись');
    expect(canReplaceEvent(null, event())).toBe(true);
  });
});
