/**
 * Снять с плана всё расставленное на узле — когда чертёж под значками сменился.
 *
 * Значок стоит в точке чертежа. Заменили подложку другим файлом, обрезали её
 * или развернули — и та же точка указывает уже не туда: огнетушитель из
 * коридора оказывается в стене или за краем листа. Молча оставить его там
 * нельзя: план врёт, а по нему считают расстояния до средств тушения.
 *
 * Объекты при этом не пропадают и из журнала не уходят. Они возвращаются в
 * «Требуют размещения» — то же самое состояние, в котором приходят объекты
 * после переноса на другой узел и после переноса журнала. Оттуда их ставят на
 * новый чертёж обычным перетаскиванием.
 *
 * Стирание лишнего сюда не относится: оно не меняет ни размера чертежа, ни
 * системы координат, и значки после него стоят там же, где стояли.
 */

import type { PlanObject, Result, TreeNodeId } from '@izh/contracts';
import { ok } from '@izh/contracts';
import type { ObjectDeps } from './object-deps.js';

export interface UnplaceNodeObjectsInput {
  readonly nodeId: TreeNodeId;
}

/** Возвращает объекты, которые сняли с плана. Пусто — снимать было нечего. */
export async function unplaceNodeObjects(
  deps: ObjectDeps,
  input: UnplaceNodeObjectsInput,
): Promise<Result<readonly PlanObject[]>> {
  const list = await deps.objects.listByNode(input.nodeId);
  if (!list.ok) return list;

  const placed = list.value.filter((object) => object.archivedAt === null && object.position !== null);
  if (placed.length === 0) return ok([]);

  const now = deps.clock.nowUtc();
  const unplaced = placed.map((object): PlanObject => ({
    ...object,
    position: null,
    // Помещение тоже сбрасывается: обводки помещений заданы в точках того же
    // чертежа, и после смены подложки объект числился бы в помещении, которого
    // на новом плане может не быть вовсе.
    roomId: null,
    updatedAt: now,
    rowVersion: object.rowVersion + 1,
  }));

  // Разом, а не по одному: это одно действие человека, и половина снятых
  // объектов при сбое посреди списка — худший исход, чем ни одного.
  const saved = await deps.objects.saveMany(unplaced);
  if (!saved.ok) return saved;
  return ok(unplaced);
}
