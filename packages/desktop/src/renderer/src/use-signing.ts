/**
 * Пароль подписи на время работы.
 *
 * Заказчик: «при заведении нового огнетушителя или элемента, и вообще при
 * создании новых строк в журнале должна ставиться ПЭП», и отдельно про перенос
 * — «пользователь просто один раз вводит пароль и подписывает ПЭП».
 *
 * Отсюда правило: пароль спрашивается на **действие**, а не на строку. Завести
 * партию, расставить очередь по щелчкам, перенести чужой журнал — это по
 * одному действию каждое, сколько бы строк в них ни завелось. Требовать пароль
 * на каждый значок, поставленный мышью, значило бы превратить подпись в
 * мучение и добиться того, что её станут обходить, — а обойти её здесь можно
 * только одним способом: перестать вести журнал в программе.
 *
 * Пароль живёт в памяти окна и никуда не уходит: ни в хранилище, ни в главный
 * процесс, ни в сохранённый сеанс (там лежит только защищённая Windows ссылка
 * на учётную запись). Он забывается сам через четверть часа без подписей, при
 * выходе и при смене вошедшего.
 *
 * Почему вход не считается за подпись: по 63-ФЗ (статья 5 часть 2) простая
 * электронная подпись подтверждается тем, что человек предъявил именно её.
 * Вход подтверждает вход. Поэтому пароль спрашивается заново, отдельным окном,
 * с прямым указанием, что именно будет подписано.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserAccount } from '@izh/contracts';
import type { Signer } from '@izh/core';
import { can } from '@izh/core';
import { accessDeps } from './deps';

/** Сколько пароль помнится без новых подписей. */
const REMEMBER_MS = 15 * 60 * 1000;

interface Pending {
  /** Что будет подписано — теми же словами, что и в окне. */
  readonly reason: string;
  readonly run: (signer: Signer) => void;
}

export interface Signing {
  /** Вправе ли вошедший подписывать вообще. */
  readonly canSign: boolean;
  /** Чем объяснить отказ. null — подписывать можно. */
  readonly hint: string | null;
  /** Что сейчас спрашивается. null — окно пароля закрыто. */
  readonly asking: string | null;
  /**
   * Выполнить действие за подписью.
   *
   * Пароль уже введён и ещё помнится — действие идёт сразу. Нет — открывается
   * окно, и действие ждёт. Отказались от ввода — не выполняется ничего:
   * заведение без подписи в этой программе не предусмотрено.
   */
  readonly withSignature: (reason: string, run: (signer: Signer) => void) => void;
  /** Ввели пароль. Возвращает текст ошибки или null, если подпись принята. */
  readonly submit: (password: string) => Promise<string | null>;
  readonly cancel: () => void;
  readonly forget: () => void;
}

export function useSigning(user: UserAccount | null): Signing {
  const passwordRef = useRef<{ readonly value: string; readonly at: number } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const canSign = user !== null && can(user, 'подпись.ставить') && !user.mustChangePassword;

  const hint = user === null
    ? 'Войдите в программу, чтобы заводить записи журнала.'
    : !can(user, 'подпись.ставить')
      ? `Роль «${user.role}» не подписывает, поэтому и записи журнала не заводит: `
        + 'строка журнала появляется только за подписью того, кто за неё отвечает.'
      : user.mustChangePassword
        ? 'Пароль выдан администратором и ещё не заменён. Смените его — временный пароль знают '
          + 'двое, и подпись им подтверждала бы не вас.'
        : null;

  const forget = useCallback((): void => {
    passwordRef.current = null;
    pendingRef.current = null;
    setAsking(null);
  }, []);

  // Сменился вошедший — прежний пароль забывается тут же: подписывать чужой
  // учётной записью нельзя даже случайно.
  useEffect(() => { forget(); }, [user?.id, forget]);

  const signerFor = useCallback((account: UserAccount): Signer | null => {
    const kept = passwordRef.current;
    if (kept === null || Date.now() - kept.at > REMEMBER_MS) return null;
    // Каждое обращение продлевает память: работа идёт — пароль нужен.
    passwordRef.current = { value: kept.value, at: Date.now() };
    return { user: account, password: kept.value, hasher: accessDeps.hasher, keys: accessDeps.keys };
  }, []);

  const withSignature = useCallback((reason: string, run: (signer: Signer) => void): void => {
    if (user === null || !canSign) return;
    const ready = signerFor(user);
    if (ready !== null) { run(ready); return; }
    pendingRef.current = { reason, run };
    setAsking(reason);
  }, [user, canSign, signerFor]);

  const submit = useCallback(async (password: string): Promise<string | null> => {
    if (user === null || user.password === null) return 'Подписывать нечем: у учётной записи нет пароля.';

    /*
     * Пароль сверяется до того, как его запомнить.
     *
     * Иначе опечатка запомнилась бы, и все следующие подписи срывались бы одна
     * за другой без объяснения — человек считал бы, что сломалась программа.
     */
    const matched = await accessDeps.hasher.verify(password, user.password);
    if (!matched.ok) return matched.error.message;
    if (!matched.value) return 'Пароль указан неверно: подпись не поставлена.';

    passwordRef.current = { value: password, at: Date.now() };
    const pending = pendingRef.current;
    pendingRef.current = null;
    setAsking(null);
    if (pending !== null) {
      const signer = signerFor(user);
      if (signer !== null) pending.run(signer);
    }
    return null;
  }, [user, signerFor]);

  const cancel = useCallback((): void => {
    pendingRef.current = null;
    setAsking(null);
  }, []);

  return { canSign, hint, asking, withSignature, submit, cancel, forget };
}
