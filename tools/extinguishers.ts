/**
 * Проверка расстановки огнетушителей на настоящих данных.
 *
 * Тесты проверяют правило по выдуманному примеру, а здесь видно, что скажет
 * программа человеку, открывшему свой этаж: те ли помещения, те ли нормы, не
 * сыплются ли нарушения там, где их нет. Без такой прогонки движок «правильный
 * по тестам» и бесполезный на деле.
 *
 * Запуск: npx vite-node tools/extinguishers.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BuildingProfile, PlanCalibration, PlanObject, Room, TreeNode } from '@izh/contracts';
import { checkExtinguisherPlacement, purposeOfFunctionalClasses } from '@izh/core';

const DATA = join(process.env.APPDATA ?? '', '@izh', 'desktop', 'data');

function read<T>(name: string, field: string): readonly T[] {
  const raw = JSON.parse(readFileSync(join(DATA, `${name}.json`), 'utf8')) as Record<string, unknown>;
  const list = raw[field];
  return Array.isArray(list) ? (list as readonly T[]) : [];
}

const nodes = read<TreeNode>('tree', 'nodes');
const objects = read<PlanObject>('objects', 'objects');
const rooms = read<Room>('rooms', 'rooms');
// Масштаб и подложки лежат в одном файле: у калибровки нет жизни отдельно от неё.
const calibrations = read<PlanCalibration>('backdrops', 'calibrations');
const backdrops = read<{ readonly id: string; readonly nodeId: string }>('backdrops', 'backdrops');

const levels = nodes.filter((node) => node.kind === 'level' && node.archivedAt === null);
console.log(`Этажей: ${levels.length}, помещений: ${rooms.length}, объектов: ${objects.length}\n`);

for (const level of levels) {
  const levelRooms = rooms.filter((room) => room.levelId === level.id);
  const levelObjects = objects.filter((object) => object.nodeId === level.id);
  const backdrop = backdrops.find((item) => item.nodeId === level.id) ?? null;
  const calibration = backdrop === null
    ? null
    : calibrations.find((item) => item.backdropId === backdrop.id) ?? null;

  // Характеристика здания: по ней норма считается, пока помещений нет.
  const path: TreeNode[] = [];
  let cursor: TreeNode | undefined = level;
  while (cursor !== undefined) {
    path.push(cursor);
    const parentId: string | null = cursor.parentId;
    cursor = parentId === null ? undefined : nodes.find((item) => item.id === parentId);
  }
  const profile: BuildingProfile | null = path.find((node) => node.kind === 'building')?.building ?? null;

  const report = checkExtinguisherPlacement({
    rooms: levelRooms,
    objects: levelObjects,
    metersPerPixel: calibration?.metersPerPixel ?? null,
    buildingPurpose: purposeOfFunctionalClasses(profile?.functionalClasses ?? null),
    building: profile === null ? null : {
      category: profile.explosionCategory,
      purpose: purposeOfFunctionalClasses(profile.functionalClasses),
      areaM2: profile.builtAreaM2,
      fireClasses: (profile.fireClasses ?? '').split(',').map((item) => item.trim()).filter(Boolean),
      hasSuppression: false,
    },
  });

  console.log(`${level.name}: ${report.verdict} — помещений ${report.rooms.length}, огнетушителей ${report.total} (на плане ${report.placed})`);
  for (const finding of report.findings) console.log(`  этаж · ${finding.severity}: ${finding.text}`);
  for (const room of report.rooms) {
    console.log(`  «${room.roomName}» (${room.category ?? 'без категории'}, ${room.areaM2 ?? '?'} м²): ${room.verdict}`);
    for (const finding of room.findings) console.log(`    ${finding.severity}: ${finding.text}`);
  }
  console.log('');
}
