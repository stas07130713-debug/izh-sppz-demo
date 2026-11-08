/**
 * Бумаги по элементу в его карточке (ТЗ, Дополнение 6).
 *
 * Приложенное в чек-листе должно быть видно в карточке этого элемента: иначе
 * акт исчезает из виду — он лежит в ленте истории, а её открывают редко.
 * Проверяющий спрашивает документ по конкретной лестнице, и искать его по всем
 * записям журнала нельзя.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent } from '@izh/contracts';
import { maintenanceDocuments } from '../rules/maintenance-documents.js';

const file = (name: string) => ({ hash: name.padEnd(64, '0'), fileName: `${name}.pdf` });

function event(overrides: Partial<MaintenanceEvent> = {}): MaintenanceEvent {
  return {
    id: 'e1', siteId: 's', objectId: 'ladder-1', activityCode: 'ispytanie',
    performedOn: '2026-05-12', result: 'выполнено', checklist: [], defect: null,
    executor: null, note: null, createdAt: '2026-05-12T00:00:00.000Z', ...overrides,
  } as MaintenanceEvent;
}

describe('какие бумаги собираются', () => {
  it('акт проверки, акт подрядчика, протокол и вложения к пунктам', () => {
    // Приложить документ можно тремя способами, и для карточки это всё одно и
    // то же — бумаги по этому элементу.
    const events = [event({
      inspectionAct: { number: '14/26', date: '2026-05-14', file: file('act') },
      externalEvidence: {
        organization: 'ООО «Высота»', inn: '1', licenseNumber: '', actNumber: '7',
        actDate: '2026-05-12', actFile: file('podryad'), protocolFile: file('protokol'),
      },
      checklist: [{ item: 'Ступени целы', result: 'выполнено', defect: null, attachments: [file('foto')] }],
    })];

    const documents = maintenanceDocuments('ladder-1', events);

    expect(documents.map((item) => item.kind)).toEqual([
      'акт проверки', 'акт подрядчика', 'протокол', 'вложение',
    ]);
  });

  it('свежие сверху', () => {
    const documents = maintenanceDocuments('ladder-1', [
      event({ id: 'e1', performedOn: '2025-05-12', inspectionAct: { number: '1', date: '2025-05-12', file: file('старый') } }),
      event({ id: 'e2', performedOn: '2026-05-12', inspectionAct: { number: '2', date: '2026-05-12', file: file('свежий') } }),
    ]);

    expect(documents.map((item) => item.title)).toEqual(['акт проверки № 2', 'акт проверки № 1']);
  });

  it('один и тот же файл не показывается дважды', () => {
    // Акт, приложенный одной проверкой сразу к нескольким элементам, в карточке
    // каждого из них один.
    const same = file('одинаковый');
    const documents = maintenanceDocuments('ladder-1', [
      event({ id: 'e1', inspectionAct: { number: '1', date: '2026-05-12', file: same } }),
      event({ id: 'e2', inspectionAct: { number: '1', date: '2026-05-12', file: same } }),
    ]);

    expect(documents).toHaveLength(1);
  });

  it('чужие бумаги не попадают', () => {
    const documents = maintenanceDocuments('ladder-1', [
      event({ objectId: 'другой', inspectionAct: { number: '9', date: '2026-05-12', file: file('чужой') } }),
    ]);

    expect(documents).toEqual([]);
  });
});
