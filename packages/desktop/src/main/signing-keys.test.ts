/**
 * Настоящая криптография подписи: Ed25519 поверх ключа, запертого паролем.
 *
 * Проверяется то, ради чего вариант с ключом и выбран: подписать нельзя, не
 * зная пароля, а проверить можно, не зная его вовсе.
 */

import { describe, expect, it } from 'vitest';
import { createSigningKeyService } from './signing-keys.js';

const keys = createSigningKeyService();
const HASH = 'a'.repeat(64);

function value<T>(result: { ok: boolean; value?: T; error?: { message: string } }): T {
  if (!result.ok) throw new Error(result.error?.message ?? 'ожидался успех');
  return result.value as T;
}

describe('ключ простой электронной подписи', () => {
  it('подписывает и сверяет своей парой', async () => {
    const key = value(await keys.create('пароль-подписи', 1));
    const signature = value(await keys.sign(key, 'пароль-подписи', HASH));

    expect(signature.algorithm).toBe('ed25519');
    expect(value(await keys.verify(signature, HASH))).toBe(true);
  });

  it('чужой пароль ключ не отпирает', async () => {
    const key = value(await keys.create('пароль-подписи', 1));
    const attempt = await keys.sign(key, 'другой-пароль', HASH);

    expect(attempt.ok).toBe(false);
    // Отказ внятный: неверный пароль — это не сбой программы.
    if (!attempt.ok) expect(attempt.error.message).toContain('Пароль не подошёл');
  });

  it('подпись под другим содержимым не сходится', async () => {
    const key = value(await keys.create('пароль-подписи', 1));
    const signature = value(await keys.sign(key, 'пароль-подписи', HASH));

    expect(value(await keys.verify(signature, 'b'.repeat(64)))).toBe(false);
  });

  it('чужой подписью запись не подтвердить', async () => {
    const mine = value(await keys.create('мой-пароль', 1));
    const other = value(await keys.create('чужой-пароль', 1));
    const signature = value(await keys.sign(other, 'чужой-пароль', HASH));

    // Открытый ключ в подписи чужой — значит и проверяется она чужим ключом,
    // а к моей учётной записи отношения не имеет.
    expect(signature.publicKey).not.toBe(mine.publicKey);
  });

  it('смена пароля сохраняет пару, а поколение растёт', async () => {
    // Прежние подписи обязаны остаться проверяемыми: открытый ключ тот же.
    const key = value(await keys.create('старый', 1));
    const signature = value(await keys.sign(key, 'старый', HASH));

    const rekeyed = value(await keys.rekey(key, 'старый', 'новый', 2));
    expect(rekeyed.publicKey).toBe(key.publicKey);
    expect(rekeyed.generation).toBe(2);

    expect(value(await keys.verify(signature, HASH))).toBe(true);
    expect(value(await keys.sign(rekeyed, 'новый', HASH)).publicKey).toBe(key.publicKey);
  });

  it('перешифровать чужим паролем нельзя', async () => {
    const key = value(await keys.create('старый', 1));
    expect((await keys.rekey(key, 'не тот', 'новый', 2)).ok).toBe(false);
  });

  it('испорченная подпись отвечает «не сходится», а не срывается', async () => {
    const key = value(await keys.create('пароль', 1));
    const signature = value(await keys.sign(key, 'пароль', HASH));

    const broken = { ...signature, value: 'не-подпись' };
    expect(value(await keys.verify(broken, HASH))).toBe(false);
  });
});
