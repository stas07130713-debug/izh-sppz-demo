/**
 * Оборудование, которое закрывается одной проверкой (ТЗ, Дополнение 6, С5).
 *
 * Обход не делают по одной железке. Приходят с проверкой на объект и за один
 * визит закрывают всё однотипное: все порошковые огнетушители в корпусе, все
 * дымовые извещатели одной системы. Отметку при этом надо поставить **каждому**
 * проверенному элементу — иначе в его карточке будет пусто, и при замене никто
 * не вспомнит, когда он проверялся.
 *
 * Группа зависит от того, что за оборудование:
 *
 * — единица комплекта (самоспасатели): всё, что лежит в том же месте хранения.
 *   Подошёл к шкафу — проверил все пять, и отметка нужна каждой;
 * — прибор приёмно-контрольный: **вся его система целиком**, любых видов. Он и
 *   есть система, обслуживают её одним заходом, и чек-лист у неё единый
 *   (Дополнение 6);
 * — элемент системы пожарной автоматики: однотипные элементы **той же системы**.
 *   За пределы системы группа не выходит: у соседнего прибора свой регламент и
 *   свои сроки, и закрывать его чужой проверкой нельзя;
 * — огнетушитель: однотипные огнетушители того же здания. Системы у них нет,
 *   а обходят их по зданию;
 * — всё остальное: только сам элемент. Гидрант или пожарную лестницу проверяют
 *   поштучно, и предлагать «партию» здесь значило бы путать.
 */

import type { PlanObject, TreeNode } from '@izh/contracts';
import { descendantsOf, pathToNode } from '../object-tree/tree-shape.js';
import { isSystemHead, systemMembers } from './fire-system.js';
import { isMultiUnitType, placementContents, placementOf } from './placement.js';

/**
 * Однотипное оборудование, которое можно закрыть одной проверкой.
 *
 * Сам элемент в списке всегда — даже когда он единственный: проверка идёт по
 * нему, и убирать его из собственного списка бессмысленно.
 */
export function checkGroupFor(
  nodes: readonly TreeNode[],
  objects: readonly PlanObject[],
  source: PlanObject,
): readonly PlanObject[] {
  const group = collect(nodes, objects, source);
  return group.some((object) => object.id === source.id) ? group : [source, ...group];
}

function collect(
  nodes: readonly TreeNode[],
  objects: readonly PlanObject[],
  source: PlanObject,
): readonly PlanObject[] {
  // Комплект в одном месте закрывают одним визитом: подошёл к шкафу и
  // проверил все пять самоспасателей. Отметка при этом нужна каждому.
  if (isMultiUnitType(source.typeCode)) {
    const head = placementOf(objects, source) ?? source;
    return placementContents(objects, head).filter((object) => object.archivedAt === null);
  }

  // Прибор отвечает за систему целиком: обслуживают её одним заходом, и
  // отметка нужна каждому элементу, а не только самому прибору. Виды здесь не
  // разделяются намеренно — в отличие от элемента системы, который закрывает
  // только своих однотипных соседей.
  if (isSystemHead(source)) {
    return [source, ...systemMembers(objects, source.id).filter((object) => object.archivedAt === null)];
  }

  const systemId = source.systemId ?? null;
  if (systemId !== null) {
    return systemMembers(objects, systemId).filter((object) => object.typeCode === source.typeCode);
  }

  if (source.typeCode.startsWith('extinguisher')) {
    const building = pathToNode(nodes, source.nodeId).find((node) => node.kind === 'building');
    // Поддерево здания берётся напрямую, а не через `journalScope`: тот
    // учитывает флаг «показывать в общем журнале», а это настройка вида. Этаж,
    // убранный из общего журнала, обходят так же, как остальные, и его
    // огнетушители обязаны попасть в ту же проверку.
    const scopeIds = building === undefined
      ? new Set([source.nodeId])
      : new Set([building.id, ...descendantsOf(nodes, building.id).map((node) => node.id)]);

    return objects.filter((object) => object.archivedAt === null
      && object.typeCode === source.typeCode
      && scopeIds.has(object.nodeId));
  }

  return [source];
}

/**
 * Как назвать группу в окне проверки.
 *
 * Заголовок называет то, что человек видит перед собой, а не абстрактную
 * «партию»: «Дымовые извещатели этой системы», «Порошковые огнетушители
 * здания». Иначе у извещателя стояло бы слово «огнетушители», как и было до
 * этой правки.
 */
export function checkGroupTitle(source: PlanObject, elementTitle: string): string {
  if (isMultiUnitType(source.typeCode)) return `${elementTitle} — другие в этом же месте хранения`;
  if (isSystemHead(source)) return `${elementTitle} — вся система целиком`;
  if ((source.systemId ?? null) !== null) return `${elementTitle} — другие в этой же системе`;
  if (source.typeCode.startsWith('extinguisher')) return `${elementTitle} — другие в этом здании`;
  return elementTitle;
}
