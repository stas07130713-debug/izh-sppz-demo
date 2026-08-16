/**
 * Всё, что нужно сценариям работы с подложкой.
 *
 * Зависимости передаются явным параметром, а не берутся из глобального
 * состояния и не собираются фреймворком. Благодаря этому сценарий можно
 * запустить в тесте, подставив поддельные хранилище и часы, и получить
 * предсказуемый результат.
 */

import type {
  BackdropRepository,
  Clock,
  FileStore,
  IdGenerator,
  PlanSourceEngine,
} from '@izh/contracts';

export interface BackdropDeps {
  readonly engine: PlanSourceEngine;
  readonly fileStore: FileStore;
  readonly backdrops: BackdropRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
