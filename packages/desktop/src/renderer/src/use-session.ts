/**
 * Кто работает сейчас.
 *
 * По желанию пользователя сеанс переживает перезапуск. Пароль не сохраняется:
 * главный процесс держит только защищённую Windows ссылку на учётную запись.
 * Для простой электронной подписи пароль всё равно запрашивается отдельно.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Result, UserAccount } from '@izh/contracts';
import { ok } from '@izh/contracts';
import { hasAnyUser } from '@izh/core';
import { accessDeps } from './deps';

export interface SessionState {
  /** Вошедший. null — ещё не вошли. */
  readonly user: UserAccount | null;
  /** Учётных записей нет вовсе: заводится первый администратор. */
  readonly firstRun: boolean;
  /** Пока неизвестно, есть ли учётные записи: показывать экран рано. */
  readonly checking: boolean;
  readonly signIn: (user: UserAccount, remember: boolean) => Promise<Result<void>>;
  readonly signOut: () => void;
  /** Обновить вошедшего после правки профиля или смены пароля. */
  readonly refresh: (user: UserAccount) => void;
  readonly users: readonly UserAccount[];
  readonly reloadUsers: () => Promise<void>;
}

export function useSession(): SessionState {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [firstRun, setFirstRun] = useState(false);
  const [checking, setChecking] = useState(true);
  const [users, setUsers] = useState<readonly UserAccount[]>([]);
  const [remembered, setRemembered] = useState(false);

  const reloadUsers = useCallback(async (): Promise<void> => {
    const list = await accessDeps.users.list();
    if (list.ok) setUsers(list.value);
  }, []);

  useEffect(() => {
    void (async () => {
      const restored = await window.izh.session.restore();
      if (restored.ok && restored.value !== null) {
        setUser(restored.value);
        setRemembered(true);
        setFirstRun(false);
        await reloadUsers();
        setChecking(false);
        return;
      }
      // Имя «any» здесь стояло раньше и сбивало с толку: так зовётся запрещённый
      // в проекте тип, и проверки спотыкались о переменную.
      const existing = await hasAnyUser(accessDeps);
      // Ошибка чтения не превращается в «программа пустая»: иначе сбой файла
      // учётных записей открывал бы заведение нового администратора поверх
      // существующих.
      setFirstRun(existing.ok ? !existing.value : false);
      setChecking(false);
    })();
  }, [reloadUsers]);

  const signIn = useCallback(async (next: UserAccount, remember: boolean): Promise<Result<void>> => {
    if (remember) {
      const saved = await window.izh.session.remember(next.id);
      if (!saved.ok) return saved;
    } else {
      // Снятая галочка отменяет и прежний сохранённый вход, если на этом
      // компьютере до этого запоминали другую учётную запись.
      await window.izh.session.forget();
    }
    setUser(next);
    setRemembered(remember);
    setFirstRun(false);
    void reloadUsers();
    return ok(undefined);
  }, [reloadUsers]);

  return {
    user,
    firstRun,
    checking,
    signIn,
    signOut: useCallback(() => {
      setRemembered(false);
      setUser(null);
      void window.izh.session.forget();
    }, []),
    refresh: useCallback((next: UserAccount) => {
      setUser(next);
      // После смены пароля обновляется маркер защищённого сеанса; иначе он
      // справедливо считался бы устаревшим при следующем запуске.
      if (remembered) void window.izh.session.remember(next.id);
    }, [remembered]),
    users,
    reloadUsers,
  };
}
