/**
 * Принятие соглашений пользователем.
 *
 * Отдельным сценарием, а не полем в правке профиля: принятие — не настройка,
 * которую меняют туда-обратно, а событие с датой. Оно записывается тем, кто
 * принял, и только за себя: принять соглашение за другого нельзя.
 *
 * Отказ от принятия здесь не предусмотрен намеренно. Отказавшийся не работает в
 * программе — он её закрывает; хранить «отказался» значило бы заводить
 * состояние, в котором человек вошёл, но ничего не может.
 */

import type { IsoDateTime, Result, UserAccount } from '@izh/contracts';
import { err } from '@izh/contracts';
import type { AccessDeps } from './access-deps.js';
import { LEGAL_VERSION } from '../legal/legal-documents.js';
import { saveChangedUser } from './save-user.js';

export interface AcceptLegalInput {
  readonly id: string;
  /**
   * Какую редакцию принял. Передаётся снаружи, чтобы принятие нельзя было
   * записать «задним числом» на версию, которой человек не видел.
   */
  readonly version: string;
  readonly acceptedAt: IsoDateTime;
}

export async function acceptLegal(
  deps: AccessDeps,
  input: AcceptLegalInput,
): Promise<Result<UserAccount>> {
  if (input.version !== LEGAL_VERSION) {
    return err('INVALID_ARGUMENT', 'Принять можно только действующую редакцию соглашений.');
  }

  const current = await deps.users.getById(input.id);
  if (!current.ok) return current;

  return saveChangedUser(deps, current.value, {
    acceptedLegalVersion: input.version,
    acceptedLegalAt: input.acceptedAt,
  });
}
