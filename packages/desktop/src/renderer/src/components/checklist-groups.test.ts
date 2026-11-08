/**
 * Разбиение чек-листа по срокам обслуживания.
 *
 * Проверяющий закрывает срок, а не отдельную работу: пришёл на квартальный
 * обход — закрыл всё квартальное. Плоский список работ этого не показывал, и
 * настройки с чек-листом выглядели как два разных устройства.
 *
 * Источников правил два, устроены они по-разному, а пользователь обязан видеть
 * одно и то же — это здесь и закреплено.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { activityCellsForObject, rulePackageSource, type ActivityCell } from '@izh/core';
import { groupChecklistCells } from './checklist-groups';

function object(typeCode: string): PlanObject {
  return {
    id: 'obj-1', siteId: 'org', nodeId: 'f1', typeCode, regNumber: '1',
    model: null, manufacturer: null, serialNumber: null, commissionedOn: null,
    responsible: null, roomId: null, position: null, technicalState: 'исправен',
    note: null, archivedAt: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', rowVersion: 1,
  } as unknown as PlanObject;
}

function cellsFor(typeCode: string): readonly ActivityCell[] {
  return activityCellsForObject(object(typeCode), [], '2026-08-23', 14, rulePackageSource);
}

describe('работы разложены по срокам', () => {
  it('у пожарного шкафа три срока, а не три работы вперемешку', () => {
    // Осмотр раз в месяц, испытание клапана раз в полгода, перекатка раз в год.
    const groups = groupChecklistCells(cellsFor('fire-hydrant-indoor'));

    expect(groups.map((group) => group.title)).toEqual(['Ежемесячно', 'Раз в полгода', 'Ежегодно']);
  });

  it('внутри срока лежат его работы', () => {
    const groups = groupChecklistCells(cellsFor('fire-hydrant-indoor'));
    const yearly = groups.find((group) => group.title === 'Ежегодно');

    expect(yearly?.cells.map((cell) => cell.rule.title)).toContain('Перекатка рукава на новую скатку');
  });

  it('сроки идут от частого к редкому', () => {
    // Ежемесячное закрывают чаще всего: держать его под годовым значило бы
    // каждый раз прокручивать мимо.
    for (const typeCode of ['extinguisher-powder', 'fire-hydrant-indoor', 'control-panel']) {
      const months = groupChecklistCells(cellsFor(typeCode)).map((group) => group.months);
      expect([...months].sort((a, b) => a - b), typeCode).toEqual(months);
    }
  });

  it('у каждого срока есть число месяцев, пустых сроков не бывает', () => {
    // Эталон обновлён 23.08.2026: проверялось на порошковом огнетушителе, у
    // которого ежемесячной работой было общее требование ППР без срока. Его
    // убрали. Ежемесячный срок теперь настоящий — визуальный контроль
    // давления у BONTEL, назначенный заказчиком.
    expect(groupChecklistCells(cellsFor('extinguisher-bantl')).some((group) => group.title === 'Ежемесячно')).toBe(true);
    for (const typeCode of ['extinguisher-powder', 'extinguisher-bantl', 'control-panel']) {
      expect(groupChecklistCells(cellsFor(typeCode)).every((group) => group.months > 0), typeCode).toBe(true);
    }
  });

  it('ни одна работа при раскладке не теряется и не задваивается', () => {
    for (const typeCode of ['extinguisher-co2', 'fire-hydrant-indoor', 'control-panel', 'hydrant']) {
      const cells = cellsFor(typeCode);
      const inGroups = groupChecklistCells(cells).flatMap((group) => group.cells);
      expect(inGroups.length, typeCode).toBe(cells.length);
      expect(new Set(inGroups.map((cell) => cell.rule.activityCode)).size, typeCode).toBe(cells.length);
    }
  });
});

describe('регламент организации: работа и есть срок', () => {
  /** Правило из конструктора: у него есть периодичность, а название — её имя. */
  function periodicityCell(title: string): ActivityCell {
    return {
      rule: {
        activityCode: 'per-1', title, periodicityMonths: 3, checklist: ['Осмотр шкафа'],
        ndReference: 'Регламент организации', needsVerification: false,
        regulationVersionId: 'ver-1', periodicityId: 'per-1',
      },
      schedule: { status: 'норма', nextDate: '2026-12-01', lastDate: null, daysToNext: 100 },
      history: [],
    } as unknown as ActivityCell;
  }

  it('название работы не повторяется под заголовком срока', () => {
    // Иначе «Ежеквартально» стояло бы дважды подряд — заголовком и строкой.
    const groups = groupChecklistCells([periodicityCell('Ежеквартально')]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Ежеквартально');
    expect(groups[0]?.titleIsWork).toBe(true);
  });

  it('у библиотеки название работы отличается от срока и потому показывается', () => {
    const groups = groupChecklistCells(cellsFor('fire-hydrant-indoor'));

    expect(groups.every((group) => !group.titleIsWork)).toBe(true);
  });
});
