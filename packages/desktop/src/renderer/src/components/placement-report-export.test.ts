/**
 * Справка о размещении огнетушителей выгружается по образцу заказчика.
 *
 * Образец — «Информационная справка о соответствии размещения первичных средств
 * пожаротушения (огнетушителей) на объекте защиты». Проверяется не вёрстка, а
 * то, что в документе есть всё, чем справка является: характеристика объекта,
 * требования ППР с таблицами норм, обоснование выбора, вывод и приложение со
 * схемой. Документ без любой из этих частей подписывать нельзя.
 */

import { describe, expect, it } from 'vitest';
import type { BuildingProfile, PlanObject, Room } from '@izh/contracts';
import { checkExtinguisherPlacement } from '@izh/core';
import { buildPlacementDocument } from './placement-report-export';

const OUTLINE = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];

function room(patch: Partial<Room> = {}): Room {
  return {
    id: 'помещение', siteId: 'объект', levelId: 'этаж', name: 'Участок отгрузки', number: '12',
    category: 'В3', categoryBasis: null, heightM: null, purpose: 'производственное',
    fireClasses: ['A', 'B', 'E'], hasSuppression: false, outline: OUTLINE, areaM2: 400,
    archivedAt: null, createdAt: '', updatedAt: '', rowVersion: 1, ...patch,
  };
}

function extinguisher(id: string, x: number): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'этаж', typeCode: 'extinguisher-emulsion', regNumber: id,
    roomId: null, position: { x, y: 20 }, technicalState: 'исправен', archivedAt: null,
    extinguisherProfile: { fireRating: '3A, 70B, C, E', execution: 'переносной', nominalCharge: 10 },
  } as unknown as PlanObject;
}

const BUILDING = {
  functionalClasses: 'Ф5.1', fireResistance: 'II', constructiveClass: 'С0',
  explosionCategory: 'В', fireClasses: 'A, B, E', builtAreaM2: 3994.2, heightM: 18.6,
} as unknown as BuildingProfile;

function document(rooms: readonly Room[], objects: readonly PlanObject[]): string {
  const report = checkExtinguisherPlacement({ rooms, objects, metersPerPixel: 1 });
  return buildPlacementDocument('word', {
    report,
    objectName: 'АО «Кольская ГМК», цех электролиза никеля, отделение готовой продукции',
    levelName: '1 этаж',
    elevation: 'отм. +0.000',
    building: BUILDING,
    marks: [{ mark: 'ОВЭ-10', count: 8 }, { mark: 'ОП-8', count: 1 }],
    schemeDataUrl: 'data:image/png;base64,000',
  }).wordHtml ?? '';
}

const GOOD = document([room()], [extinguisher('ОВЭ-1', 12), extinguisher('ОВЭ-2', 28)]);

describe('справка о размещении огнетушителей', () => {
  it('называется так же, как документ заказчика', () => {
    expect(GOOD).toContain('Информационная справка о соответствии размещения первичных средств пожаротушения');
  });

  it('содержит характеристику объекта', () => {
    expect(GOOD).toContain('АО «Кольская ГМК»');
    expect(GOOD).toContain('Степень огнестойкости');
    expect(GOOD).toContain('Ф5.1');
  });

  it('приводит требования ППР и обе таблицы норм', () => {
    expect(GOOD).toContain('не должно превышать 20 метров');
    expect(GOOD).toContain('Таблица 1. Нормы обеспечения переносными огнетушителями');
    expect(GOOD).toContain('Таблица 2. Нормы оснащения помещений передвижными огнетушителями');
  });

  it('обосновывает выбор ранга словами справки', () => {
    expect(GOOD).toContain('не ниже 3A, 70B, C, E');
  });

  it('делает вывод о достаточности', () => {
    expect(GOOD).toContain('соответствует требованиям пожарной безопасности');
  });

  it('прикладывает схему и перечень марок по отметке', () => {
    expect(GOOD).toContain('Приложение 1. Схема расположения огнетушителей');
    expect(GOOD).toContain('На отм. +0.000 — 9 огнетушителей (ОВЭ-10 — 8 шт., ОП-8 — 1 шт.)');
    expect(GOOD).toContain('data:image/png;base64,000');
  });

  it('лист книжный: справка — текст, а не широкая таблица журнала', () => {
    expect(GOOD).toContain('mso-page-orientation:portrait');
  });

  it('при нарушении вывод другой, и нарушения перечислены', () => {
    // Один огнетушитель в углу цеха 40×40 метров при норме 30 метров до
    // противоположного угла не достаёт.
    const bad = document([room()], [extinguisher('ОВЭ-1', 0)]);
    expect(bad).toContain('требованиям пожарной безопасности не соответствует');
    expect(bad).toContain('Замечания и нарушения');
  });

  it('без сведений о помещении вывод не делается вовсе', () => {
    const unknown = document(
      [room({ purpose: null, fireClasses: [] })],
      [extinguisher('ОВЭ-1', 12), extinguisher('ОВЭ-2', 28)],
    );
    expect(unknown).toContain('Вывод о достаточности не сделан');
  });

  it('без подложки схема не подделывается', () => {
    const report = checkExtinguisherPlacement({ rooms: [room()], objects: [], metersPerPixel: 1 });
    const withoutPlan = buildPlacementDocument('pdf', {
      report, objectName: 'Объект', levelName: '1 этаж', elevation: null,
      building: null, marks: [], schemeDataUrl: null,
    });
    expect(withoutPlan.html).toContain('Схема не приложена: подложка плана не загружена');
  });
});

describe('подпись плана и графа для подписи (пункт 1)', () => {
  const request = buildPlacementDocument('word', {
    report: checkExtinguisherPlacement({ rooms: [], objects: [], metersPerPixel: 1 }),
    objectName: 'АО «Пример» · Цех № 1 · Корпус № 1',
    levelName: 'Этаж 1',
    elevation: 'отм. +4.200',
    building: null,
    marks: [{ mark: 'ОП-5', count: 2 }],
    schemeDataUrl: 'data:image/png;base64,AAAA',
  });

  it('над схемой стоит та же подпись, что над чертежом в программе', () => {
    // Приложение отделяют от справки и подшивают отдельно: без подписи не
    // понять, к какому зданию и этажу относится план.
    expect(request.html).toContain('class="scheme-title"');
    expect(request.html).toContain('АО «Пример» · Цех № 1 · Корпус № 1 · отм. +4.200');
  });

  it('есть пустые графы под должность, фамилию, подпись и дату', () => {
    // Пустые намеренно: подписал тот, кто расписался, а не тот, кто был указан
    // в настройках, — подставлять человека программа не вправе.
    expect(request.html).toContain('Проверку провёл');
    for (const column of ['Должность', 'Фамилия, инициалы', 'Подпись', 'Дата']) {
      expect(request.html).toContain(`<th>${column}</th>`);
    }
    expect(request.html).toContain('class="sign-cell"');
  });

  it('графы есть и в Word-разметке', () => {
    expect(request.wordHtml ?? '').toContain('Проверку провёл');
    expect(request.wordHtml ?? '').toContain('class="scheme-title"');
  });
});
