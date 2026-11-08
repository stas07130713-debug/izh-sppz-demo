/**
 * Счёт отпечатков паролей и содержимого.
 *
 * scrypt выбран не случайно. Обычный SHA-256 от пароля считается миллиардами в
 * секунду на видеокарте, и восьмизначный пароль по такому отпечатку подбирают
 * за вечер. scrypt намеренно медленный и требует памяти: подбор дорожает во
 * столько же раз, во сколько дорожает одна проверка, а проверка нужна раз в
 * день — при входе.
 *
 * Соль своя у каждого пароля. Без неё одинаковые пароли давали бы одинаковые
 * отпечатки, и по файлу учётных записей было бы видно, у кого пароль общий.
 *
 * Сравнение отпечатков — постоянного времени. Обычное сравнение строк выходит
 * из цикла на первом несовпавшем байте, и по времени ответа отпечаток
 * подбирается побайтно.
 */

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordDigest, PasswordHasher, Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';

/**
 * Стоимость счёта.
 *
 * 16384 — принятая нижняя граница для интерактивной проверки: около сотни
 * миллисекунд на обычном рабочем компьютере. Человек этого не замечает при
 * входе, а подбор дорожает на четыре порядка.
 */
const COST_N = 16_384;
const BLOCK_SIZE_R = 8;
const PARALLEL_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, digest: Omit<PasswordDigest, 'salt' | 'digest'>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      digest.keyLength,
      { N: digest.costN, r: digest.blockSizeR, p: digest.parallelP, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error === null ? resolve(key) : reject(error)),
    );
  });
}

export function createPasswordHasher(): PasswordHasher {
  return {
    async hash(password: string): Promise<Result<PasswordDigest>> {
      const salt = randomBytes(SALT_LENGTH);
      const shape = {
        algorithm: 'scrypt' as const,
        costN: COST_N,
        blockSizeR: BLOCK_SIZE_R,
        parallelP: PARALLEL_P,
        keyLength: KEY_LENGTH,
      };
      try {
        const key = await derive(password, salt, shape);
        return ok({ ...shape, salt: salt.toString('base64'), digest: key.toString('base64') });
      } catch (error) {
        return err('INTERNAL', 'Не удалось посчитать отпечаток пароля.', String(error));
      }
    },

    async verify(password: string, digest: PasswordDigest): Promise<Result<boolean>> {
      try {
        // Параметры берутся из самого отпечатка, а не из констант выше: когда
        // стоимость придётся поднять, прежние отпечатки должны остаться
        // проверяемыми.
        const salt = Buffer.from(digest.salt, 'base64');
        const expected = Buffer.from(digest.digest, 'base64');
        const actual = await derive(password, salt, digest);
        if (actual.length !== expected.length) return ok(false);
        return ok(timingSafeEqual(actual, expected));
      } catch (error) {
        return err('INTERNAL', 'Не удалось проверить пароль.', String(error));
      }
    },

    async sha256Hex(text: string): Promise<Result<string>> {
      return ok(createHash('sha256').update(text, 'utf8').digest('hex'));
    },
  };
}
