/**
 * Проверка стоимости пересчёта состояний.
 *
 * Журнал, план и дашборд пересчитывают состояние всех объектов на каждую
 * перерисовку. Пока лента разбиралась перебором заново для каждого правила
 * каждого объекта, это росло как произведение: на предприятии с пятилетней
 * историей одна перерисовка занимала около двух секунд.
 *
 * Тест закрепляет не «скорость ради скорости», а порядок роста: удесятерение
 * ленты не должно удесятерять время пересчёта.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { activityCellsForObject } from '../rules/activity-status.js';

const ACTIVITIES = ['osmotr', 'proverka-otv-voda', 'perezaryadka'];

function makeObjects(count: number): readonly PlanObject[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `obj-${i}`,
    siteId: 'site',
    nodeId: 'node',
    typeCode: 'extinguisher-water',
    regNumber: `28-${i}`,
    model: null,
    manufacturer: null,
    serialNumber: null,
    commissionedOn: null,
    serviceLifeYears: null,
    responsible: null,
    roomId: null,
    position: null,
    technicalState: 'не определено',
    note: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rowVersion: 1,
  })) as readonly PlanObject[];
}

function makeEvents(objects: readonly PlanObject[], perActivity: number): readonly MaintenanceEvent[] {
  const events: MaintenanceEvent[] = [];
  for (const object of objects) {
    for (const activityCode of ACTIVITIES) {
      for (let year = 0; year < perActivity; year++) {
        events.push({
          id: `${object.id}-${activityCode}-${year}`,
          siteId: 'site',
          objectId: object.id,
          activityCode,
          performedOn: `20${20 + year}-03-30`,
          result: 'выполнено',
          checklist: [],
          defect: null,
          executor: null,
          note: null,
          createdAt: `20${20 + year}-03-30T10:00:00.000Z`,
        });
      }
    }
  }
  return events;
}

/** Один проход = одна перерисовка списка: состояние считается для каждого объекта. */
function renderPass(objects: readonly PlanObject[], events: readonly MaintenanceEvent[]): void {
  for (const object of objects) activityCellsForObject(object, events, '2026-08-22', 14);
}

function measure(objectCount: number, yearsOfHistory: number): number {
  const objects = makeObjects(objectCount);
  const events = makeEvents(objects, yearsOfHistory);
  renderPass(objects, events); // первый проход разбирает ленту
  const started = performance.now();
  for (let i = 0; i < 5; i++) renderPass(objects, events);
  return (performance.now() - started) / 5;
}

describe('стоимость пересчёта состояний', () => {
  it('время растёт линейно, а не как произведение объектов на ленту', () => {
    const small = measure(100, 1);
    const large = measure(1000, 5);

    // Объектов в 10 раз больше, лента в 50 раз длиннее. При прежнем переборе
    // это давало рост в сотни раз; при разложенной ленте — в десятки.
    expect(large).toBeLessThan(Math.max(small, 0.5) * 60);
  });

  it('повторные перерисовки не разбирают ленту заново', () => {
    const objects = makeObjects(500);
    const events = makeEvents(objects, 5);

    const firstStarted = performance.now();
    renderPass(objects, events);
    const first = performance.now() - firstStarted;

    /*
     * Повторные проходы меряются лучшим из пяти, а не одним замером.
     *
     * Измеряется время на машине, где в тот же миг идут другие проверки:
     * случайная задержка планировщика или уборка мусора попадала в
     * единственный замер, и проверка падала через раз, ничего не показав.
     * Помеха время только прибавляет — значит, наименьшее из нескольких
     * измерений и есть настоящая стоимость прохода.
     *
     * Первый проход остаётся одним: он холодный, и повторить его нельзя —
     * лента после него уже разобрана. Помеха в нём делает проверку строже, а
     * не слабее, и потому безопасна.
     */
    let second = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const started = performance.now();
      renderPass(objects, events);
      second = Math.min(second, performance.now() - started);
    }

    // Разбор ленты происходит один раз на массив, поэтому вторая перерисовка
    // не может быть заметно дороже первой.
    expect(second).toBeLessThanOrEqual(Math.max(first, 1) * 2);
  });
});
