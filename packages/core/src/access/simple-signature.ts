/**
 * Постановка и сверка простой электронной подписи (63-ФЗ, статьи 5, 6, 9).
 *
 * Подписание — осознанное действие, а не следствие того, что программа
 * открыта. Поэтому пароль спрашивается заново в момент подписания: по статье 5
 * части 2 простая электронная подпись подтверждает факт подписания «посредством
 * использования кодов, паролей», и если пароль ввели только утром при входе, то
 * подтверждается вход, а не подпись.
 *
 * Подписывается не «запись вообще», а её содержимое: у подписи хранится
 * отпечаток того, что подписали. Изменили содержимое — сверка это покажет.
 * Именно так подпись под выгруженным журналом относится к напечатанному, а не
 * к журналу как таковому.
 *
 * Временный пароль подписывать не даёт. Пароль, выданный администратором,
 * знают двое, и подпись им подтверждала бы не подписавшего.
 */

import type {
  PasswordHasher, Result, SignatureCheck, SignedKind, SigningKeyService, SimpleSignature,
  UserAccount,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { can } from './permissions.js';

export interface SignInput {
  readonly user: UserAccount;
  /** Пароль, введённый в момент подписания. */
  readonly password: string;
  readonly kind: SignedKind;
  /**
   * Подписываемое содержимое, приведённое к тексту.
   *
   * Готовит его тот, кто подписывает: у записи журнала это её значимые поля, у
   * выгрузки — весь файл. Ядро не решает за них, что считать содержимым, но
   * требует, чтобы это был один и тот же текст при подписании и при сверке.
   */
  readonly content: string;
  /** Реквизиты документа организации о применении простой электронной подписи. */
  readonly basis?: string | null;
  readonly at: string;
  /**
   * Ключи подписи. Без них подпись остаётся отметкой «кто и когда подтвердил».
   *
   * Заказчик выбрал решение с ключом у каждого подписывающего: подпись должна
   * проверяться снаружи программы, открытым ключом, а не «на слово» той же
   * программе, которая её поставила.
   */
  readonly keys?: SigningKeyService;
}

export async function signSimple(
  hasher: PasswordHasher,
  input: SignInput,
): Promise<Result<SimpleSignature>> {
  const user = input.user;

  if (!can(user, 'подпись.ставить')) {
    return err('FORBIDDEN', `Роль «${user.role}» не подписывает: подпись — это принятие ответственности за запись.`);
  }
  if (user.password === null) {
    return err('FORBIDDEN', 'У учётной записи нет пароля: подписывать нечем.');
  }
  if (user.mustChangePassword) {
    return err(
      'FORBIDDEN',
      'Пароль выдан администратором и ещё не заменён. Смените его — временный пароль знают двое,'
        + ' и подпись им подтверждала бы не вас.',
    );
  }

  const matched = await hasher.verify(input.password, user.password);
  if (!matched.ok) return matched;
  if (!matched.value) return err('FORBIDDEN', 'Пароль указан неверно: подпись не поставлена.');

  const hash = await hasher.sha256Hex(input.content);
  if (!hash.ok) return hash;

  /*
   * Криптографическая часть подписи.
   *
   * Ставится, когда у человека есть ключ и программа умеет с ним обращаться.
   * Если ключа нет — подпись всё равно ставится: она остаётся отметкой «кто и
   * когда подтвердил», и терять её из-за того, что ключ ещё не заведён,
   * незачем. Но отпечаток содержимого в ней есть всегда.
   */
  let keySignature = null;
  const key = user.signingKey ?? null;
  if (input.keys !== undefined && key !== null) {
    const signed = await input.keys.sign(key, input.password, hash.value);
    if (!signed.ok) return signed;
    keySignature = signed.value;
  }

  return ok({
    signerId: user.id,
    signerName: user.fullName,
    signerPosition: user.position,
    signerRole: user.role,
    signedAt: input.at,
    kind: input.kind,
    contentHash: hash.value,
    keyGeneration: user.keyGeneration,
    basis: input.basis?.trim() === '' ? null : input.basis ?? null,
    key: keySignature,
  });
}

/**
 * Сверка: то ли это содержимое, которое подписали.
 *
 * Сверка ничего не знает о пароле и знать не должна. Она отвечает на один
 * вопрос — не менялось ли подписанное после подписания; кто подписал, записано
 * в самой подписи.
 */
export async function checkSignature(
  hasher: PasswordHasher,
  signature: SimpleSignature | null,
  content: string,
  /** Проверка ключом: без неё сверяется только отпечаток содержимого. */
  keys?: SigningKeyService,
): Promise<Result<SignatureCheck>> {
  if (signature === null) return ok({ verdict: 'не подписано' });

  const hash = await hasher.sha256Hex(content);
  if (!hash.ok) return hash;

  if (hash.value !== signature.contentHash) {
    return ok({ verdict: 'содержимое изменено', expected: signature.contentHash, actual: hash.value });
  }

  /*
   * Отпечаток сошёлся — но этого мало.
   *
   * Отпечаток говорит, что содержимое то же. Подпись ключом говорит, что его
   * подтвердил именно этот человек: подделать её, не зная пароля, нельзя, а
   * подменить содержимое вместе с отпечатком — можно, если у того, кто правит
   * файл, есть доступ к нему.
   */
  const key = signature.key ?? null;
  if (keys !== undefined && key !== null) {
    const good = await keys.verify(key, signature.contentHash);
    if (!good.ok) return good;
    if (!good.value) {
      return ok({ verdict: 'подпись не сходится' });
    }
  }

  return ok({ verdict: 'подпись верна' });
}

/**
 * Как подпись выглядит в документе и на экране.
 *
 * Ровно те сведения, которые делают её подписью: кто, в какой должности, когда.
 * Основание приписывается, если организация издала документ о применении
 * простой электронной подписи, — без него равнозначности собственноручной
 * подписи нет, и обещать её нельзя.
 */
export function formatSignature(signature: SimpleSignature): string {
  const who = signature.signerPosition === null
    ? signature.signerName
    : `${signature.signerPosition} ${signature.signerName}`;
  const when = signature.signedAt.slice(0, 16).replace('T', ' ');
  const basis = signature.basis === null ? '' : `, основание: ${signature.basis}`;
  return `Подписано простой электронной подписью: ${who}, ${when}${basis}`;
}
