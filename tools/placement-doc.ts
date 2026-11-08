/**
 * Предпросмотр справки о размещении огнетушителей.
 *
 * Тест проверяет, что в документе есть нужные части, но не показывает, как он
 * выглядит на листе. Справку подписывают и подшивают — вёрстку нужно увидеть.
 *
 * Запуск: npx vite-node tools/placement-doc.ts <путь к файлу>
 */

import { writeFileSync } from 'node:fs';
import type { BuildingProfile, PlanObject, Room } from '@izh/contracts';
import { checkExtinguisherPlacement } from '@izh/core';
import { buildPlacementDocument } from '../packages/desktop/src/renderer/src/components/placement-report-export.js';

const outline = (side: number): readonly { x: number; y: number }[] =>
  [{ x: 0, y: 0 }, { x: side, y: 0 }, { x: side, y: side }, { x: 0, y: side }];

function room(id: string, name: string, category: string, area: number, patch: Partial<Room> = {}): Room {
  return {
    id, siteId: 'объект', levelId: 'этаж', name, number: null,
    category, categoryBasis: 'Расчёт категорий 2024', heightM: null, purpose: 'производственное',
    fireClasses: ['A', 'B', 'E'], hasSuppression: false, outline: outline(60), areaM2: area,
    archivedAt: null, createdAt: '', updatedAt: '', rowVersion: 1, ...patch,
  } as Room;
}

function extinguisher(id: string, x: number, y: number, rating: string, charge: number, type: string): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'этаж', typeCode: type, regNumber: id,
    roomId: null, position: { x, y }, technicalState: 'исправен', archivedAt: null,
    extinguisherProfile: { fireRating: rating, execution: 'переносной', nominalCharge: charge },
  } as unknown as PlanObject;
}

const rooms = [
  room('1', 'Участок готовой продукции', 'В3', 3994.2),
  room('2', 'Электрощитовая', 'Д', 84, { areaM2: 84 }),
  room('3', 'Кабинет мастеров', '', 48, { category: null, purpose: 'административное', areaM2: 48 }),
];

const objects = [
  extinguisher('45931', 20, 20, '3A, 70B, C, E', 10, 'extinguisher-emulsion'),
  extinguisher('45932', 45, 40, '3A, 70B, C, E', 10, 'extinguisher-emulsion'),
  extinguisher('45933', 55, 10, '2A, 55B, C, E', 8, 'extinguisher-powder'),
];

const report = checkExtinguisherPlacement({ rooms, objects, metersPerPixel: 1 });

const building = {
  functionalClasses: 'Ф5.1', fireResistance: 'II', constructiveClass: 'С0', floorsAbove: 1,
  explosionCategory: 'В', categoryBasis: 'Расчёт категорий 2024', fireClasses: 'A, B, E',
  builtAreaM2: 3994.2, heightM: 18.6,
} as unknown as BuildingProfile;

const request = buildPlacementDocument('pdf', {
  report,
  objectName: 'АО «Кольская ГМК», цех электролиза никеля № 2, отделение готовой продукции, инв. № 40005',
  levelName: '1 этаж',
  elevation: 'отм. +0.000',
  building,
  marks: [{ mark: 'ОВЭ-10', count: 8 }, { mark: 'ОП-8', count: 1 }],
  schemeDataUrl: null,
});

const target = process.argv[2] ?? 'справка.html';
writeFileSync(target, request.html, 'utf8');
console.log(`Вывод: ${report.verdict}. Файл: ${target}`);
