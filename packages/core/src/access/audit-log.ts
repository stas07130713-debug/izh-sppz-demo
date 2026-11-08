/**
 * Запись и чтение журнала действий пользователей.
 *
 * Правило хранения одно и записано здесь, а не в хранилище: **тридцать дней**.
 * Заказчик: «чтобы не много места занимала данная база данных и записывала
 * события за последние 30 дней».
 *
 * Старение идёт при каждой записи, а не по расписанию: у настольной программы
 * нет ни служб, ни заданий по времени, а «почистить при запуске» не сработает
 * у того, кто не закрывает программу неделями.
 *
 * Читать журнал вправе только администратор. Это не формальность: в нём видно,
 * кто когда заходил, — сведения о людях, а не об оборудовании.
 */

import type {
  AuditEvent, AuditKind, AuditRepository, Clock, IdGenerator, Result, UserAccount,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { can } from './permissions.js';

/** Сколько дней хранится журнал действий. Требование заказчика. */
export const AUDIT_KEEP_DAYS = 30;

export interface AuditDeps {
  readonly audit: AuditRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export interface RecordAuditInput {
  /** Кто действовал. `null` — действие до входа: отказ во входе, например. */
  readonly actor: UserAccount | null;
  /** Имя для записи, когда действующего ещё нет: введённое имя для входа. */
  readonly actorName?: string;
  readonly kind: AuditKind;
  readonly subject?: string | null;
  readonly details?: string | null;
}

/** Граница хранения: всё, что старше, уходит. */
export function auditCutoff(now: string, keepDays = AUDIT_KEEP_DAYS): string {
  const at = new Date(now);
  at.setUTCDate(at.getUTCDate() - keepDays);
  return at.toISOString();
}

/**
 * Заносит действие в журнал.
 *
 * Отказ записи журнала действий **не срывает само действие**: если человек
 * вошёл, а служебная запись не легла, вход остаётся состоявшимся. Поэтому
 * ошибка возвращается, но вызывающие её обычно только показывают, а не
 * отменяют сделанное.
 */
export async function recordAudit(deps: AuditDeps, input: RecordAuditInput): Promise<Result<AuditEvent>> {
  const now = deps.clock.nowUtc();

  const event: AuditEvent = {
    id: deps.ids.newId(),
    at: now,
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.fullName ?? input.actorName ?? 'неизвестный',
    actorRole: input.actor?.role ?? null,
    kind: input.kind,
    subject: input.subject ?? null,
    details: input.details ?? null,
  };

  const saved = await deps.audit.append(event);
  if (!saved.ok) return saved;

  // Старение при записи: своих служб у настольной программы нет, а «почистить
  // при запуске» не сработает у того, кто не закрывает её неделями.
  await deps.audit.prune(auditCutoff(now));

  return ok(event);
}

/** Читает журнал действий. Только администратор: в нём сведения о людях. */
export async function readAudit(
  deps: AuditDeps,
  reader: UserAccount | null,
): Promise<Result<readonly AuditEvent[]>> {
  if (!can(reader, 'пользователи.править')) {
    return err('FORBIDDEN', 'Журнал действий доступен только администратору.');
  }

  const all = await deps.audit.list();
  if (!all.ok) return all;

  // Свежие сверху: журнал действий читают с последнего события.
  return ok([...all.value].sort((a, b) => b.at.localeCompare(a.at)));
}
