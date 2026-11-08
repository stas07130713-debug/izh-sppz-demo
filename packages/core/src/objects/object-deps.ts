/**
 * Всё, что нужно сценариям работы с объектами СППЗ.
 *
 * Дерево нужно, чтобы проверить, куда именно ставится объект: рабочая область
 * зависит от вида узла, и на генплане извещателя быть не может.
 */

import type { Clock, IdGenerator, ObjectTreeRepository, PlanObjectRepository } from '@izh/contracts';

export interface ObjectDeps {
  readonly objects: PlanObjectRepository;
  readonly tree: ObjectTreeRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
