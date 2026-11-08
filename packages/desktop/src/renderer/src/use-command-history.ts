/**
 * Отмена и возврат команд — и заполнение журнала вносимых изменений.
 *
 * Оба дела здесь по одной причине: команда одна. Всё, что меняет данные,
 * проходит через `run` — и то же самое должно попасть в журнал. Дописывать
 * запись в журнал в каждом сценарии и в каждом окне значило бы забыть её в
 * половине из них; заказчик просит обратного — чтобы история отражала **все**
 * значимые изменения, а не выбранные вручную.
 *
 * Что именно поменялось, считать заново не нужно: история команд и так
 * получает каждое изменение с тем, что было до и что стало после, — иначе ей
 * нечего было бы откатывать. Она отдаёт этот перечень при завершении команды,
 * ядро переводит его на человеческий язык (`describeChange`), и запись ложится
 * в журнал.
 *
 * Отмена и возврат тоже пишутся в журнал, отдельными записями: прежнюю из него
 * не вычёркивают. Так же ведут бумажный журнал — ошибку не вырывают, рядом
 * пишут исправление.
 *
 * Отказ записи в журнал **не срывает саму команду**: если человек сохранил
 * карточку, а служебная запись не легла, карточка остаётся сохранённой.
 */

import { useCallback, useEffect, useState } from 'react';
import type { HistoryCommit, HistoryState, UserAccount } from '@izh/contracts';
import { describeChange, recordChanges } from '@izh/core';
import { changeLogDeps } from './deps';

const EMPTY: HistoryState = { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 };

export interface CommandHistoryState {
  readonly state: HistoryState;
  readonly reload: () => Promise<void>;
  readonly run: <T>(label: string, action: () => Promise<T>) => Promise<T | null>;
  readonly undo: () => Promise<void>;
  readonly redo: () => Promise<void>;
}

/**
 * Заносит изменения команды в журнал.
 *
 * Без автора запись не делается: журнал отвечает на вопрос «кто изменил», и
 * запись без ответа на него бесполезна. Такое бывает только до входа —
 * значимых изменений там нет.
 */
async function logCommit(commit: HistoryCommit, author: UserAccount | null): Promise<void> {
  if (author === null || commit.changes.length === 0) return;

  /*
   * Вся команда — одной записью в хранилище. Заведение сотни огнетушителей
   * задевает сотню записей, и писать их по одной значило бы переписать файл
   * журнала сто раз подряд.
   */
  const inputs = commit.changes
    .map((change) => describeChange(change))
    .filter((described): described is NonNullable<typeof described> => described !== null)
    .map((described) => ({ author, command: commit.label, ...described }));

  await recordChanges(changeLogDeps, inputs);
}

export function useCommandHistory(onChanged: () => void, author: UserAccount | null): CommandHistoryState {
  const [state, setState] = useState<HistoryState>(EMPTY);

  const reload = useCallback(async (): Promise<void> => {
    const result = await window.izh.history.state();
    if (result.ok) setState(result.value);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
      const started = await window.izh.history.begin(label);
      if (!started.ok) return null;
      try {
        const result = await action();
        const committed = await window.izh.history.commit();
        if (committed.ok) {
          setState(committed.value.state);
          await logCommit(committed.value, author);
        }
        return result;
      } catch (e) {
        await window.izh.history.cancel();
        throw e;
      }
    },
    [author],
  );

  const undo = useCallback(async (): Promise<void> => {
    const result = await window.izh.history.undo();
    if (result.ok) {
      setState(result.value.state);
      await logCommit(result.value, author);
      onChanged();
    }
  }, [onChanged, author]);

  const redo = useCallback(async (): Promise<void> => {
    const result = await window.izh.history.redo();
    if (result.ok) {
      setState(result.value.state);
      await logCommit(result.value, author);
      onChanged();
    }
  }, [onChanged, author]);

  return { state, reload, run, undo, redo };
}
