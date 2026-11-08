/**
 * Выполнение долгой работы с показом занятости.
 *
 * Написан по ошибке, которая ломала программу дважды. Занятость включали перед
 * вызовом и снимали после него:
 *
 *     setBusy(true);
 *     const result = await действие();
 *     setBusy(false);
 *
 * Пока действие возвращает отказ значением, всё хорошо. Но оно может **сорваться
 * броском** — мост к основному процессу отклоняет обещание, когда обработчик на
 * той стороне упал, а движок разбора чертежа падает на нехватке памяти. Тогда
 * `setBusy(false)` не выполняется никогда, и занятость остаётся включённой до
 * перезапуска программы. А при включённой занятости кнопки заблокированы:
 * человек нажимает, ничего не происходит, и программа выглядит сломанной без
 * единого сообщения.
 *
 * Второе, что здесь делается, — сорвавшееся действие **называется**. Прежде оно
 * уходило необработанным обещанием: ни сообщения, ни следа, и о причине узнать
 * было неоткуда.
 *
 * Правило простое: занятость снимает `finally`, отказ — и возвращённый, и
 * брошенный — доходит до человека словами.
 */

import { useCallback, useState } from 'react';
import { describeUnknown } from '@izh/contracts';

export interface BusyRun {
  readonly busy: boolean;
  /** Сообщение о последнем отказе. `null` — отказа не было. */
  readonly message: string | null;
  readonly setMessage: (message: string | null) => void;
  /**
   * Выполняет действие, показывая занятость.
   *
   * Возвращает `true`, если действие прошло. Отличать «прошло» от «сорвалось»
   * нужно вызывающему: после успеха он перечитывает данные и закрывает форму,
   * после отказа — оставляет её открытой с введённым.
   */
  readonly run: (action: () => Promise<{ readonly ok: boolean; readonly error?: { readonly message: string } }>)
  => Promise<boolean>;
}

export function useBusyRun(): BusyRun {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async (
    action: () => Promise<{ readonly ok: boolean; readonly error?: { readonly message: string } }>,
  ): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result.ok) return true;
      setMessage(result.error?.message ?? 'Не получилось.');
      return false;
    } catch (e) {
      setMessage(`Не удалось выполнить действие: ${describeUnknown(e)}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, message, setMessage, run };
}

/**
 * Тот же страж для хуков, которым занятость и сообщение приходят снаружи.
 *
 * Своего состояния у них нет — им его отдаёт главный экран, — поэтому хук
 * `useBusyRun` им не подходит. Правило то же: занятость снимает `finally`, а
 * сорвавшееся действие называется словами.
 */
export async function guardBusy(
  setBusy: (busy: boolean) => void,
  setMessage: (message: string) => void,
  action: () => Promise<void>,
): Promise<void> {
  setBusy(true);
  try {
    await action();
  } catch (e) {
    setMessage(`Не удалось выполнить действие: ${describeUnknown(e)}`);
  } finally {
    setBusy(false);
  }
}
