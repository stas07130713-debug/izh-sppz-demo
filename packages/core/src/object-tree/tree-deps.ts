/**
 * Всё, что нужно сценариям работы с деревом объекта.
 *
 * Зависимости передаются параметром, а не берутся из глобального состояния:
 * тогда сценарий запускается в тесте с поддельным хранилищем и предсказуемыми
 * часами, и его результат можно сравнивать с эталоном целиком.
 */

import type { Clock, IdGenerator, ObjectTreeRepository } from '@izh/contracts';

export interface TreeDeps {
  readonly tree: ObjectTreeRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
