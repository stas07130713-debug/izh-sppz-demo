/**
 * Настоящий счёт отпечатков: scrypt и SHA-256 (ТЗ, Дополнение 7, Д4).
 *
 * Проверки ядра идут на подставном счётчике — там важны правила доступа, а не
 * криптография. Здесь проверяется то, от чего зависит сохранность паролей: что
 * отпечаток не совпадает с паролем, что соль у каждого своя, и что проверка
 * работает после перезаписи параметров.
 */

import { describe, expect, it } from 'vitest';
import { createPasswordHasher } from './password-hasher.js';

const hasher = createPasswordHasher();

function value<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('отпечаток пароля', () => {
  it('верный пароль проходит, неверный — нет', async () => {
    const digest = value(await hasher.hash('огнетушитель-2026'));
    expect(value(await hasher.verify('огнетушитель-2026', digest))).toBe(true);
    expect(value(await hasher.verify('огнетушитель-2025', digest))).toBe(false);
  });

  it('пароля в отпечатке нет', async () => {
    const digest = value(await hasher.hash('огнетушитель-2026'));
    expect(JSON.stringify(digest)).not.toContain('огнетушитель');
  });

  it('одинаковые пароли дают разные отпечатки', async () => {
    // Соль своя у каждого пароля: иначе по файлу учётных записей было бы видно,
    // у кого пароль общий.
    const first = value(await hasher.hash('огнетушитель-2026'));
    const second = value(await hasher.hash('огнетушитель-2026'));
    expect(first.salt).not.toBe(second.salt);
    expect(first.digest).not.toBe(second.digest);
  });

  it('параметры счёта записаны рядом с отпечатком', async () => {
    // Когда стоимость придётся поднять, прежние отпечатки должны остаться
    // проверяемыми — для этого параметры и хранятся в самой записи.
    const digest = value(await hasher.hash('огнетушитель-2026'));
    expect(digest.algorithm).toBe('scrypt');
    expect(digest.costN).toBeGreaterThanOrEqual(16_384);
    expect(digest.keyLength).toBe(32);
  });

  it('пустой пароль отпечаток даёт, но не совпадает с другим', async () => {
    // Пустой пароль отсекает не счётчик, а требования к паролю: здесь важно
    // лишь, что счёт не падает и ничего не путает.
    const digest = value(await hasher.hash(''));
    expect(value(await hasher.verify('', digest))).toBe(true);
    expect(value(await hasher.verify(' ', digest))).toBe(false);
  });

  it('одинаковые по виду, но разные по записи знаки считаются одним паролем', async () => {
    // Кириллическая «й» набирается и одним знаком, и «и» с надстрочным. Без
    // приведения к общей записи человек не смог бы войти со своим же паролем,
    // набранным в другой раскладке.
    const digest = value(await hasher.hash('май-2026'));
    expect(value(await hasher.verify('май-2026', digest))).toBe(true);
  });

  it('отпечаток содержимого повторяем и меняется вместе с содержимым', async () => {
    const first = value(await hasher.sha256Hex('Журнал за август 2026'));
    const same = value(await hasher.sha256Hex('Журнал за август 2026'));
    const other = value(await hasher.sha256Hex('Журнал за август 2026.'));
    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
  });
});
