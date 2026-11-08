/**
 * Пропуска телефонов на время обхода.
 *
 * Заказчик: «должна быть привязка к учётной записи, и перенос по веб-приложению».
 * Значит, телефон должен как-то доказать серверу, кто он, — и доказывать это
 * при каждом обращении, а не один раз при входе.
 *
 * Пропуск живёт **только в памяти**. Перезапустили программу — все пропуска
 * недействительны, и телефон входит заново. Так и правильно: пропуск не
 * документ, а разрешение на текущий обход.
 *
 * Пароль в пропуске не хранится и на телефон не уезжает. Подписывать записи
 * обхода всё равно придётся паролем, введённым в тот момент (63-ФЗ, статья 5
 * часть 2) — тем же порядком, что в настольной программе.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Сколько живёт пропуск: рабочая смена и запас на дорогу. */
const LIFETIME_MS = 12 * 60 * 60 * 1000;

interface Pass {
  readonly userId: string;
  readonly until: number;
}

export interface FieldTokens {
  /** Выдать пропуск учётной записи. */
  readonly issue: (userId: string, now: number) => string;
  /** Чей это пропуск. `null` — поддельный или просроченный. */
  readonly userOf: (token: string | null, now: number) => string | null;
  /** Отозвать все пропуска: выход, смена пароля, остановка переноса. */
  readonly revokeAll: () => void;
}

export function createFieldTokens(lifetimeMs: number = LIFETIME_MS): FieldTokens {
  const passes = new Map<string, Pass>();

  return {
    issue: (userId, now) => {
      // 32 байта случайности: перебрать такой пропуск нельзя.
      const token = randomBytes(32).toString('base64url');
      passes.set(token, { userId, until: now + lifetimeMs });
      return token;
    },

    userOf: (token, now) => {
      if (token === null || token === '') return null;
      const pass = passes.get(token);
      if (pass === undefined) return null;
      if (pass.until <= now) {
        // Просроченный убирается сразу: иначе память копила бы мусор смен.
        passes.delete(token);
        return null;
      }
      return pass.userId;
    },

    revokeAll: () => passes.clear(),
  };
}

/**
 * Сверка коротких секретов без утечки по времени.
 *
 * Обычное сравнение строк отвечает тем быстрее, чем раньше нашлось
 * расхождение, и по времени ответа код подбирается посимвольно. Здесь
 * сравнение идёт за одно и то же время при любом входе.
 */
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Код сопряжения: шесть цифр на видном месте настольной программы.
 *
 * Одного логина с паролем мало: сеть предприятия — не безопасное место, и
 * подбирать пароль по сети можно сколько угодно. Код меняется при каждом
 * включении переноса и называется человеку, который сидит за настольной
 * программой; без него вход не проходит, даже с верным паролем.
 */
export function pairingCode(): string {
  // Ровно шесть цифр: короче подбирается, длиннее не наберут в перчатке.
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
}
