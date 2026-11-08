/**
 * Ранг тушения выводится из того, что человек вводит (ТЗ, Дополнение 6, С90).
 *
 * Заказчик: «программа должна сама определять ранг огнетушителя по его
 * характеристикам. Пользователь вводит только вид огнетушителя, его объём и вид
 * ОТВ, соответственно потом программа сама по таблице определяет ранг».
 *
 * Здесь закреплён именно этот путь: три введённых значения — и ранг есть.
 * Отдельно закреплено, что при нехватке сведений программа называет
 * недостающее, а не требует вписать сам ранг.
 */

import { describe, expect, it } from 'vitest';
import type { ExtinguisherProfile, PlanObject } from '@izh/contracts';
import { extinguisherFitness, formatFireRank, rankOfExtinguisher, roomRequirement } from '../index.js';

const EMPTY: ExtinguisherProfile = {
  placedOn: null, installationPoint: null, manufacturedOn: null,
  lastRechargeOn: null, nextAnnualCheckOn: null, nextWeighingOn: null,
  nextCylinderTestOn: null, serviceLifeEndsOn: null,
  responsiblePosition: null, responsibleOrganization: null,
  agent: null, propulsion: null, execution: null,
  nominalCharge: null, chargeUnit: null, tareMassKg: null, nominalFullMassKg: null,
  nominalPressureMpa: null, pressureMinMpa: null, pressureMaxMpa: null,
  temperatureMinC: null, temperatureMaxC: null, fireClasses: [], fireRating: null,
  certificateNumber: null, passportFile: null, bodyMaterial: null, innerCoating: null,
  stabilizedMulticomponentCharge: false, adverseConditions: [],
};

const rankOf = (typeCode: string, profile: Partial<ExtinguisherProfile>): string | null => {
  const { rank } = rankOfExtinguisher(typeCode, { ...EMPTY, ...profile });
  return rank === null ? null : formatFireRank(rank);
};

describe('ранг по введённым характеристикам', () => {
  it('вид ОТВ и заряд дают ранг без вида огнетушителя в дереве', () => {
    // Так заведено большинство карточек заказчика: вид общий, «Огнетушитель».
    // Вещество и заряд человек переписывает с этикетки — этого достаточно.
    expect(rankOf('extinguisher', { agent: 'порошок', nominalCharge: 4 })).toBe('2A, 55B, C, E');
  });

  it('шесть килограммов порошка — строкой выше', () => {
    expect(rankOf('extinguisher', { agent: 'порошок', nominalCharge: 6 })).toBe('3A, 70B, C, E');
  });

  it('вид огнетушителя из дерева заменяет вещество', () => {
    // Карточка заведена как «Огнетушитель углекислотный» — вещество спрашивать
    // уже незачем, оно следует из вида.
    expect(rankOf('extinguisher-co2', { nominalCharge: 5 })).toBe('55B, C, E');
  });

  it('без заряда ранга нет, сколько бы ни было известно про вещество', () => {
    expect(rankOf('extinguisher', { agent: 'порошок' })).toBeNull();
  });

  it('ранг из паспорта главнее вычисленного', () => {
    // У воздушно-эмульсионных класс E подтверждают испытаниями, а таблица о нём
    // молчит: вписанный ранг должен перекрывать вычисленный.
    const { rank, fromCard } = rankOfExtinguisher('extinguisher-emulsion', {
      ...EMPTY, nominalCharge: 10, fireRating: '3A, 70B, C, E',
    });
    expect(fromCard).toBe(true);
    expect(rank === null ? '' : formatFireRank(rank)).toBe('3A, 70B, C, E');
  });
});

describe('чего не хватает для ранга', () => {
  const object = (profile: Partial<ExtinguisherProfile>): PlanObject => ({
    id: 'x', siteId: 's', nodeId: 'n', typeCode: 'extinguisher',
    regNumber: null, model: null, manufacturer: null, serialNumber: null,
    commissionedOn: null, serviceLifeMonths: null, responsible: null,
    roomId: null, position: null, technicalState: 'исправен',
    archivedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    rowVersion: 1, note: null, extinguisherProfile: { ...EMPTY, ...profile },
  });

  const requirement = roomRequirement({
    category: 'В1', purpose: 'производственное', areaM2: 200, fireClasses: ['A'], hasSuppression: false,
  });

  it('называет вещество и заряд, а не «заполните ранг»', () => {
    const reason = extinguisherFitness(object({}), requirement).reason ?? '';
    expect(reason).toContain('не указаны ни огнетушащее вещество, ни заряд ОТВ');
    expect(reason).toContain('укажите их, и ранг посчитается сам');
  });

  it('называет только недостающее', () => {
    const reason = extinguisherFitness(object({ agent: 'порошок' }), requirement).reason ?? '';
    expect(reason).toContain('не указан заряд ОТВ');
    expect(reason).not.toContain('огнетушащее вещество');
  });
});
