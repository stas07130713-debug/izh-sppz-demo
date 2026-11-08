/**
 * Зависимости сценариев регламентов.
 *
 * Как и у остальных сценариев ядра: хранилище приходит портом, время и
 * идентификаторы — тоже. Внутри `Date.now()` и `crypto.randomUUID()` нет, иначе
 * сценарии нельзя было бы проверить воспроизводимо.
 */

import type { Clock, IdGenerator, RegulationRepository } from '@izh/contracts';

export interface RegulationDeps {
  readonly regulations: RegulationRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
