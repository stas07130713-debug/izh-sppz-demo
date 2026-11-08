import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { buildExtinguisherCardExportRequest } from './ExtinguisherCardView';

const object: PlanObject = {
  id: 'ext-1', siteId: 'site', nodeId: 'level', typeCode: 'extinguisher-co2',
  regNumber: 'ОУ-15', model: 'ОУ-5', manufacturer: 'Пожтехника', serialNumber: '12345',
  commissionedOn: '2026-01-15', serviceLifeMonths: 120, responsible: 'Иванов И.И.',
  extinguisherProfile: null, roomId: null, position: null, technicalState: 'исправен', note: null,
  archivedAt: null, createdAt: '2026-01-15T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z', rowVersion: 1,
};

describe('выгрузка карточки огнетушителя', () => {
  it('формирует книжный документ без дубля ответственного в таблице', () => {
    const request = buildExtinguisherCardExportRequest('pdf', object, [], [], 'ООО «Пример»');
    expect(request.landscape).toBe(false);
    expect(request.html).toContain('Карточка учёта огнетушителя № ОУ-15');
    expect(request.html).toContain('ООО «Пример»');
    expect(request.html).not.toContain('не заполнено');
    expect(request.html).not.toContain('<th>Ответственное лицо и подпись</th>');
    const sheet = request.sheets[0];
    expect(sheet).toBeDefined();
    expect(sheet?.rows).toContainEqual(['Ответственное лицо', 'Иванов И.И.']);
    expect(sheet?.rows).toContainEqual(['Подпись', '']);
  });
});
