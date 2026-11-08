/**
 * Всё, что нужно сценариям работы с помещениями.
 *
 * Дерево здесь тоже нужно: помещение заводится только на этаже, и проверить это
 * можно, лишь заглянув в узел. Зависимости передаются параметром, поэтому
 * сценарий запускается в тесте с поддельными хранилищем и часами.
 */

import type { Clock, IdGenerator, ObjectTreeRepository, RoomRepository } from '@izh/contracts';

export interface RoomDeps {
  readonly rooms: RoomRepository;
  readonly tree: ObjectTreeRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
