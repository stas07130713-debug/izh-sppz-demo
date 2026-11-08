/**
 * Переименованная работа не теряет историю (ТЗ, Дополнение 6, часть С64).
 *
 * Проверка ОТВ была одним мероприятием, потом разделилась по виду заряда: у
 * порошка проверяют текучесть, у углекислоты — массу баллона, у воды — уровень.
 * Разделение верное, но записанные до него проверки остались без правила:
 * программа их не видела, считала срок от постановки на учёт и показывала
 * «норма» там, где перезарядка просрочена на годы.
 *
 * Найдено при проверке на журнале предприятия: 34 записи из 78 оказались
 * невидимыми.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { RULE_PACKAGE } from '../rules/rule-package.js';
import { activityCellsForObject } from '../rules/activity-status.js';
import { rulePackageSource } from '../rules/activity-source.js';

const TODAY = '2026-08-28';

function object(typeCode: string): PlanObject {
  return {
    id: 'o1', siteId: 'site', nodeId: 'этаж', typeCode, regNumber: 'ОП-1',
    model: null, manufacturer: null, serialNumber: null, commissionedOn: '2026-01-01',
    responsible: null, roomId: null, position: { x: 1, y: 1 },
    technicalState: 'исправен', note: null, archivedAt: null,
    createdAt: '', updatedAt: '', rowVersion: 1,
  } as unknown as PlanObject;
}

/** Проверка, записанная под прежним общим именем. */
const OLD_RECORD: MaintenanceEvent = {
  id: 'e1', objectId: 'o1', activityCode: 'proverka-otv', performedOn: '2025-03-10',
  createdAt: '2025-03-10T10:00:00.000Z', result: 'выполнено', defect: null, checklist: [],
} as unknown as MaintenanceEvent;

/** Работы вида, у которых прежнее имя должно найтись. */
const RENAMED: readonly (readonly [string, string])[] = [
  ['extinguisher-powder', 'proverka-poroshka'],
  ['extinguisher-co2', 'vzveshivanie'],
  ['extinguisher-water', 'proverka-otv-voda'],
  ['extinguisher-foam', 'proverka-otv-voda'],
];

describe('прежние имена работ', () => {
  for (const [typeCode, activityCode] of RENAMED) {
    it(`у «${typeCode}» проверка ОТВ помнит прежнее имя`, () => {
      const cells = activityCellsForObject(object(typeCode), [OLD_RECORD], TODAY, 14, rulePackageSource);
      const cell = cells.find((item) => item.rule.activityCode === activityCode);

      expect(cell).toBeDefined();
      expect(cell?.schedule.lastDate).toBe('2025-03-10');
      expect(cell?.history).toHaveLength(1);
    });
  }

  it('без прежнего имени проверка выглядела бы невыполненной', () => {
    // Ровно этим и оборачивалась потеря: «нет данных» вместо записанной
    // проверки, а срок считался от постановки на учёт.
    const cells = activityCellsForObject(object('extinguisher-powder'), [], TODAY, 14, rulePackageSource);
    const cell = cells.find((item) => item.rule.activityCode === 'proverka-poroshka');
    expect(cell?.history).toHaveLength(0);
    // Срок при этом считается от постановки на учёт — та самая подмена, из-за
    // которой просроченная проверка выглядела соблюдённой.
    expect(cell?.schedule.lastDate).toBe('2026-01-01');
  });

  it('прежнее имя не приписывает проверку чужой работе', () => {
    // История ищется по именам своей работы, а не по всем подряд: иначе
    // перезарядка закрывалась бы записью об осмотре.
    const cells = activityCellsForObject(object('extinguisher-powder'), [OLD_RECORD], TODAY, 14, rulePackageSource);
    const recharge = cells.find((item) => item.rule.activityCode === 'perezaryadka');
    expect(recharge?.history).toHaveLength(0);
  });
});

describe('целость библиотеки правил', () => {
  it('в списке прежних имён есть и нынешнее', () => {
    // Иначе правило потеряло бы собственные записи: `historyCodes` заменяет
    // список имён целиком, а не дополняет его.
    for (const rules of Object.values(RULE_PACKAGE)) {
      for (const rule of rules) {
        if (rule.historyCodes === undefined) continue;
        expect(`${rule.activityCode}: ${rule.historyCodes.join(', ')}`)
          .toContain(rule.activityCode);
      }
    }
  });

  it('у вида нет двух работ с одним именем', () => {
    // Две одноимённые работы в одном виде — это одна колонка журнала на две
    // разные проверки: закрыв одну, человек закрыл бы обе.
    for (const [typeCode, rules] of Object.entries(RULE_PACKAGE)) {
      const codes = rules.map((rule) => rule.activityCode);
      expect(`${typeCode}: ${codes.length}`).toBe(`${typeCode}: ${new Set(codes).size}`);
    }
  });
});
