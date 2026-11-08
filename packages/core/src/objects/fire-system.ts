/**
 * Система пожарной автоматики: ППКУ и входящее в него оборудование
 * (ТЗ, Дополнение 6).
 *
 * Автоматика — не набор независимых железок, а одна система. Извещатель сам по
 * себе не защищает: он защищает через прибор, к которому подключён. Поэтому у
 * системы один главный элемент — прибор приёмно-контрольный и управления, —
 * а датчики, ручные извещатели, оповещатели и клапаны входят в его состав.
 *
 * Обслуживают систему тоже целиком: выезжает бригада и проверяет прибор вместе
 * с шлейфами, а не один датчик в отрыве. Но отметку о проверке нужно поставить
 * каждому проверенному элементу — иначе в карточке датчика будет пусто, и при
 * замене его никто не вспомнит, когда он проверялся последний раз.
 *
 * Отдельной сущности «система» здесь нет: система — это сам объект ППКУ.
 * Заводить рядом вторую запись с тем же номером, зданием и ответственным
 * значило бы держать две истины об одном и ждать, когда они разойдутся.
 */

import type { PlanObject, PlanObjectId, TreeNode } from '@izh/contracts';
import { childrenOf } from '../object-tree/tree-shape.js';

/** Тип элемента, который является головой системы. */
export const SYSTEM_HEAD_TYPE = 'control-panel';

/**
 * Виды оборудования, входящие в систему пожарной автоматики.
 *
 * Автономная установка пожаротушения сюда не входит намеренно: она срабатывает
 * без прибора управления и обслуживается сама по себе.
 */
export const SYSTEM_MEMBER_TYPES: readonly string[] = [
  'smoke-detector', 'heat-detector', 'flame-detector', 'fire-detector',
  'manual-call-point', 'sounder', 'sounder-audible', 'sounder-speech', 'sounder-light', 'sounder-combined', 'smoke-valve', 'smoke-fan', 'damper-fire', 'damper-smoke', 'damper-dual', 'damper-pressure', 'fan-exhaust', 'fan-supply',
  'combined-detector', 'gas-detector', 'aspiration-detector',
  'fire-suppression-system', 'sprinkler', 'powder-module', 'gas-module',
  'aup-sprinkler',
  'aup-drencher',
  'aup-sprinkler-drencher',
  'aup-mist',
  'aup-foam',
  'aup-gas',
  'aup-powder',
  'aup-aerosol',
  'aup-combined',
  'aup-robotic',
];

export function isSystemHead(object: PlanObject): boolean {
  return object.typeCode === SYSTEM_HEAD_TYPE;
}

export function canJoinSystem(typeCode: string): boolean {
  return SYSTEM_MEMBER_TYPES.includes(typeCode);
}

/** Оборудование, входящее в систему этого прибора. Выведенное из эксплуатации не в счёт. */
export function systemMembers(
  objects: readonly PlanObject[],
  headId: PlanObjectId,
): readonly PlanObject[] {
  return objects.filter((object) => object.systemId === headId && object.archivedAt === null);
}

/** Система, к которой принадлежит элемент. null — элемент сам по себе. */
export function systemOf(
  objects: readonly PlanObject[],
  object: PlanObject,
): PlanObject | null {
  if (object.systemId === null || object.systemId === undefined) return null;
  return objects.find((item) => item.id === object.systemId) ?? null;
}

/** Сколько элементов каждого вида в системе — то, что показывается рядом со значками. */
export function systemComposition(
  objects: readonly PlanObject[],
  headId: PlanObjectId,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const member of systemMembers(objects, headId)) {
    counts.set(member.typeCode, (counts.get(member.typeCode) ?? 0) + 1);
  }
  return counts;
}

/**
 * Этажи здания, на которые можно завести оборудование системы.
 *
 * Берутся этажи того здания, где стоит прибор: система защищает здание, и её
 * оборудование живёт в нём же. Если этажей не заведено, остаётся сам узел
 * прибора — иначе завести оборудование было бы некуда.
 *
 * Этаж каждому элементу указывает пользователь. Раскладывать состав за него —
 * пусть даже поровну — программа не вправе: она не знает, где на самом деле
 * стоят извещатели, а придуманная раскладка выглядела бы как достоверная.
 */
export function systemFloors(
  nodes: readonly TreeNode[],
  head: PlanObject,
): readonly TreeNode[] {
  const own = nodes.find((node) => node.id === head.nodeId) ?? null;
  if (own === null) return [];

  // Прибор стоит на этаже — этажи ищем у здания, которому этот этаж принадлежит.
  const buildingId = own.kind === 'level' ? own.parentId : own.id;
  if (buildingId === null) return [own];

  const floors = childrenOf(nodes, buildingId).filter((node) => node.kind === 'level' && node.archivedAt === null);
  return floors.length === 0 ? [own] : floors;
}
