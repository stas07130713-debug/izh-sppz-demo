/**
 * Поддельные зависимости для проверки подписанного переноса журнала.
 *
 * Хранилище держится в памяти и настоящее: что записали — то и читается. Без
 * этого проверка «неверный пароль не завёл ни одной строки» ничего не значила
 * бы: смотреть было бы некуда.
 */

import type {
  MaintenanceEvent, MaintenanceEventRepository, PasswordHasher, PlanObject,
  PlanObjectRepository, Result, UserAccount,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { MaintenanceDeps } from '../rules/maintenance-deps.js';
import { fakePasswordHasher } from './access-doubles.js';

const NOW = '2026-09-08T10:00:00.000Z';

export const hasher: PasswordHasher = fakePasswordHasher();

export const object: PlanObject = {
  id: 'о1', siteId: 'объект', nodeId: 'этаж', typeCode: 'extinguisher-powder',
  regNumber: 'ОП-1', model: 'ОП-5', manufacturer: null, serialNumber: null,
  commissionedOn: null, responsible: null, roomId: null, position: null,
  technicalState: 'исправен', note: null, archivedAt: null,
  createdAt: NOW, updatedAt: NOW, rowVersion: 1,
} as unknown as PlanObject;

/** Подписывающий: пароль настоящий, отпечаток берётся тем же поддельным хешем. */
export const user: UserAccount = {
  id: 'п1', login: 'ivanov', fullName: 'Иванов И. И.', position: 'Инженер ПБ',
  organization: null, email: null, role: 'ответственный', scope: ['этаж'],
  password: { algorithm: 'scrypt', salt: 'соль-1', digest: '', costN: 1, blockSizeR: 1, parallelP: 1, keyLength: 1 },
  keyGeneration: 1, mustChangePassword: false,
  archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
} as unknown as UserAccount;

export interface MaintenanceStand {
  readonly deps: MaintenanceDeps;
  /** Что действительно записано в хранилище. */
  readonly saved: () => Promise<readonly MaintenanceEvent[]>;
}

export async function makeMaintenanceDeps(): Promise<MaintenanceStand> {
  // Отпечаток пароля считается тем же хешем, каким его потом проверяют.
  const digest = await hasher.hash('верный-пароль-1');
  if (!digest.ok) throw new Error('не удалось завести пароль');
  const signer = { ...user, password: digest.value } as UserAccount;
  Object.assign(user, signer);

  let rows: MaintenanceEvent[] = [];

  const events: MaintenanceEventRepository = {
    async list(): Promise<Result<readonly MaintenanceEvent[]>> { return ok(rows); },
    async listByObject(objectId): Promise<Result<readonly MaintenanceEvent[]>> {
      return ok(rows.filter((row) => row.objectId === objectId));
    },
    async save(event): Promise<Result<void>> { rows = [...rows, event]; return ok(undefined); },
    async saveMany(list): Promise<Result<void>> { rows = [...rows, ...list]; return ok(undefined); },
  };

  const objects: PlanObjectRepository = {
    async list(): Promise<Result<readonly PlanObject[]>> { return ok([object]); },
    async listByNode(): Promise<Result<readonly PlanObject[]>> { return ok([object]); },
    async getById(id: string): Promise<Result<PlanObject>> {
      return id === object.id ? ok(object) : err('NOT_FOUND', 'нет такого элемента');
    },
    async save(): Promise<Result<void>> { return ok(undefined); },
    async saveMany(): Promise<Result<void>> { return ok(undefined); },
  } as unknown as PlanObjectRepository;

  let counter = 0;
  return {
    deps: {
      events,
      objects,
      clock: { nowUtc: () => NOW },
      ids: { newId: () => { counter += 1; return `м${counter}`; } },
    },
    saved: async () => rows,
  };
}
