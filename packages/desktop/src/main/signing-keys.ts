/**
 * Ключи простой электронной подписи: заведение, перешифровка, подпись, сверка.
 *
 * Ed25519 выбран не случайно: подпись короткая (64 байта), проверка быстрая,
 * реализация есть в самом Node — сторонней криптографии в программе не
 * появляется, а её в такой задаче лучше не иметь вовсе.
 *
 * Закрытый ключ лежит зашифрованным AES-256-GCM. Ключ шифрования выводится из
 * пароля через scrypt со своей солью — той же стоимости, что и отпечаток
 * пароля. Смысл: программа не может подписать за человека. Она не хранит ни
 * пароля, ни расшифрованного ключа; отпереть ключ можно только паролем, который
 * человек вводит в момент подписания.
 *
 * GCM выбран ради метки подлинности: при неверном пароле расшифровка не выдаёт
 * мусор, а честно срывается. Иначе «подписали неверным паролем» превратилось бы
 * в подпись, которую никто не может проверить, вместо внятного отказа.
 */

import {
  createCipheriv, createDecipheriv, createPrivateKey, createPublicKey,
  generateKeyPairSync, randomBytes, scrypt, sign as signBytes, verify as verifyBytes,
} from 'node:crypto';
import type { KeySignature, Result, SigningKey, SigningKeyService } from '@izh/contracts';
import { err, ok } from '@izh/contracts';

/** Та же стоимость, что у отпечатка пароля: подбор дорожает одинаково. */
const COST_N = 16_384;
const BLOCK_SIZE_R = 8;
const PARALLEL_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: COST_N, r: BLOCK_SIZE_R, p: PARALLEL_P, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error === null ? resolve(key) : reject(error)),
    );
  });
}

/** Запирает закрытый ключ паролем. Возвращает готовую запись ключа. */
async function lock(privateKeyDer: Buffer, publicKeyDer: Buffer, password: string, generation: number): Promise<SigningKey> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const secret = await deriveKey(password, salt);

  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyDer), cipher.final()]);

  return {
    algorithm: 'ed25519',
    publicKey: publicKeyDer.toString('base64'),
    encryptedPrivateKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    salt: salt.toString('base64'),
    generation,
  };
}

/** Отпирает закрытый ключ. Неверный пароль срывает расшифровку — это и нужно. */
async function unlock(key: SigningKey, password: string): Promise<Buffer> {
  const secret = await deriveKey(password, Buffer.from(key.salt, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(key.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(key.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(key.encryptedPrivateKey, 'base64')),
    decipher.final(),
  ]);
}

export function createSigningKeyService(): SigningKeyService {
  return {
    async create(password, generation): Promise<Result<SigningKey>> {
      try {
        const pair = generateKeyPairSync('ed25519');
        const privateDer = pair.privateKey.export({ type: 'pkcs8', format: 'der' });
        const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
        return ok(await lock(privateDer, publicDer, password, generation));
      } catch {
        return err('INTERNAL', 'Не удалось завести ключ подписи.');
      }
    },

    async rekey(key, oldPassword, newPassword, generation): Promise<Result<SigningKey>> {
      let privateDer: Buffer;
      try {
        privateDer = await unlock(key, oldPassword);
      } catch {
        return err('FORBIDDEN', 'Прежний пароль не подошёл: ключ подписи остался прежним.');
      }
      try {
        const publicDer = Buffer.from(key.publicKey, 'base64');
        return ok(await lock(privateDer, publicDer, newPassword, generation));
      } catch {
        return err('INTERNAL', 'Не удалось перешифровать ключ подписи.');
      }
    },

    async sign(key, password, contentHash): Promise<Result<KeySignature>> {
      let privateDer: Buffer;
      try {
        privateDer = await unlock(key, password);
      } catch {
        return err('FORBIDDEN', 'Пароль не подошёл: подпись не поставлена.');
      }
      try {
        const privateKey = createPrivateKey({ key: privateDer, format: 'der', type: 'pkcs8' });
        // Подписывается отпечаток, а не всё содержимое: отпечаток уже посчитан
        // и хранится в подписи, и сверять надо ровно то, что записано.
        const value = signBytes(null, Buffer.from(contentHash, 'utf8'), privateKey);
        return ok({ algorithm: 'ed25519', value: value.toString('base64'), publicKey: key.publicKey });
      } catch {
        return err('INTERNAL', 'Не удалось поставить подпись.');
      }
    },

    async verify(signature, contentHash): Promise<Result<boolean>> {
      try {
        const publicKey = createPublicKey({
          key: Buffer.from(signature.publicKey, 'base64'), format: 'der', type: 'spki',
        });
        const good = verifyBytes(
          null,
          Buffer.from(contentHash, 'utf8'),
          publicKey,
          Buffer.from(signature.value, 'base64'),
        );
        return ok(good);
      } catch {
        // Испорченный ключ или подпись — это «не сходится», а не сбой программы:
        // сверка обязана отвечать на свой вопрос при любом содержимом.
        return ok(false);
      }
    },
  };
}
