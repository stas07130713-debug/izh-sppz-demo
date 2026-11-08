/**
 * Зависимости сценариев доступа.
 *
 * Ровно то, что нужно: хранилище учётных записей, счёт отпечатков, часы и
 * генератор идентификаторов. Дерева здесь нет намеренно — проверки области
 * прав это чистые функции над уже прочитанным деревом (permissions.ts), и
 * тянуть его в сценарии значило бы читать дерево на каждую проверку права.
 */

import type {
  Clock, IdGenerator, PasswordHasher, SigningKeyService, UserRepository,
} from '@izh/contracts';

export interface AccessDeps {
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
  /**
   * Ключи простой электронной подписи.
   *
   * Необязательны: без них программа работает как раньше — подпись
   * остаётся отметкой «кто и когда подтвердил». С ними подпись становится
   * проверяемой снаружи (63-ФЗ, вариант с ключом у подписывающего).
   */
  readonly keys?: SigningKeyService;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
