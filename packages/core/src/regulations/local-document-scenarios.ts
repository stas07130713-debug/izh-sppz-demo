/**
 * Локальные нормативные документы организации (ТЗ, Дополнение 5, часть Р6).
 *
 * Приказ, инструкция, регламент предприятия — то, на что организация ссылается
 * наравне с ППР и ГОСТ. Требование заказчика прямое: у мероприятия должно быть
 * видно основание, и «потому что так решили» основанием не считается. Документ
 * с номером и датой утверждения — считается.
 *
 * Документ не удаляется, а закрывается датой окончания действия. Записи журнала
 * ссылаются на мероприятия, а те — на документ; удаление сделало бы прошлую
 * проверку необоснованной задним числом (AGENTS.md, правило 10).
 */

import type { IsoDate, LocalDocument, Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { RegulationDeps } from './regulation-deps.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SaveLocalDocumentInput {
  /** Пусто — заводится новый документ. Задано — правится существующий. */
  readonly id?: string | null;
  readonly title: string;
  readonly number: string | null;
  readonly approvedOn: IsoDate | null;
  readonly effectiveFrom: IsoDate | null;
  readonly effectiveTo: IsoDate | null;
  readonly organization: string | null;
  readonly department: string | null;
  /** Хеш файла в хранилище документов. Абсолютных путей пользователя здесь нет. */
  readonly fileHash: string | null;
  readonly note: string | null;
}

function clean(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = raw.trim().replace(/\s+/g, ' ');
  return value.length === 0 ? null : value;
}

/** Дата либо пустая, либо календарная. Пустая допустима: не у всякого приказа есть срок. */
function dateProblem(value: IsoDate | null, name: string): string | null {
  if (value === null) return null;
  if (!ISO_DATE.test(value)) return `${name} должна быть в формате ГГГГ-ММ-ДД.`;
  return null;
}

/**
 * Заводит или правит локальный документ.
 *
 * Правка здесь допустима, в отличие от записей журнала: документ — это карточка
 * действующего приказа, а не событие. Опечатку в номере приказа надо исправлять,
 * а не заводить второй приказ.
 */
export async function saveLocalDocument(
  deps: RegulationDeps,
  input: SaveLocalDocumentInput,
): Promise<Result<LocalDocument>> {
  const title = clean(input.title);
  if (title === null) return err('INVALID_ARGUMENT', 'У документа должно быть название.');

  for (const [value, name] of [
    [input.approvedOn, 'Дата утверждения'],
    [input.effectiveFrom, 'Дата начала действия'],
    [input.effectiveTo, 'Дата окончания действия'],
  ] as const) {
    const problem = dateProblem(value, name);
    if (problem !== null) return err('INVALID_ARGUMENT', problem);
  }

  if (input.effectiveFrom !== null && input.effectiveTo !== null && input.effectiveTo < input.effectiveFrom) {
    return err('INVALID_ARGUMENT', 'Документ не может перестать действовать раньше, чем начал.');
  }

  const document: LocalDocument = {
    id: clean(input.id) ?? deps.ids.newId(),
    title,
    number: clean(input.number),
    approvedOn: input.approvedOn,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    organization: clean(input.organization),
    department: clean(input.department),
    fileHash: clean(input.fileHash),
    note: clean(input.note),
  };

  const saved = await deps.regulations.saveDocument(document);
  if (!saved.ok) return saved;
  return ok(document);
}

/**
 * Действует ли документ на указанную дату.
 *
 * Нужно окну выбора основания: ссылаться на отменённый приказ нельзя, но и
 * прятать его насовсем нельзя — старые мероприятия на него ссылаются.
 */
export function documentActiveOn(document: LocalDocument, onDate: IsoDate): boolean {
  if (document.effectiveFrom !== null && document.effectiveFrom > onDate) return false;
  if (document.effectiveTo !== null && document.effectiveTo < onDate) return false;
  return true;
}
