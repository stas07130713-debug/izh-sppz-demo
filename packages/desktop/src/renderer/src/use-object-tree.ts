/**
 * Состояние дерева объекта в окне программы.
 *
 * Здесь нет ни одной проверки предметной области: все они живут в сценариях
 * ядра. Окно только показывает результат и сообщение об ошибке — иначе правила
 * разошлись бы между интерфейсом и ядром, а расходятся они молча.
 *
 * Одно исключение — область прав, и оно здесь не случайно.
 *
 * Заказчик: «создал нового пользователя, присвоил роль ответственный, выбрал
 * ему только определённые объекты, но зашёл под ним — вижу все объекты, то
 * есть контроль доступа не настроен вообще». Так и было: правила разграничения
 * в ядре написаны и проверены, но окно их не спрашивало и показывало дерево
 * целиком.
 *
 * Отбор поставлен ровно здесь — в том единственном месте, где дерево попадает
 * в программу. Дальше по нему строится всё: список узлов, журнал, дашборд,
 * выбор места для оборудования. Отбирай в каждом из них по отдельности — и
 * однажды где-нибудь забудешь; забытая проверка области и есть самая вероятная
 * ошибка разграничения.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Result, TreeNode, UserAccount } from '@izh/contracts';
import { describeUnknown } from '@izh/contracts';
import { visibleNodes } from '@izh/core';

export interface ObjectTreeState {
  readonly nodes: readonly TreeNode[];
  readonly busy: boolean;
  readonly message: string | null;
  readonly setMessage: (message: string | null) => void;
  readonly reload: () => Promise<void>;
  /**
   * Выполняет сценарий ядра: показывает ошибку, перечитывает дерево при успехе.
   * Возвращает результат сценария или null, если он не удался.
   */
  readonly run: <T>(action: () => Promise<Result<T>>) => Promise<T | null>;
}

export function useObjectTree(user: UserAccount | null): ObjectTreeState {
  const [nodes, setNodes] = useState<readonly TreeNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const list = await window.izh.tree.list();
    if (!list.ok) {
      setMessage(list.error.message);
      return;
    }

    /*
     * Само правило — в ядре (`visibleNodes`): администратору видно всё,
     * остальным достаются выданные узлы и всё, что внутри них. Здесь только
     * место, где оно применяется, — единственное на всю программу.
     */
    setNodes(visibleNodes(user, list.value));
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async <T,>(action: () => Promise<Result<T>>): Promise<T | null> => {
      setBusy(true);
      setMessage(null);

      /*
       * Занятость снимается в `finally`, а не после вызова.
       *
       * Сорвавшийся сценарий оставлял её включённой навсегда: кнопки с
       * `disabled={busy}` — «вывести из эксплуатации», «сохранить», «создать» —
       * становились мёртвыми, и программа выглядела так, будто нажатия
       * не доходят. Одна ошибка запирала работу целиком.
       */
      let result: Result<T>;
      try {
        result = await action();
      } catch (e) {
        setMessage(`Не удалось выполнить действие: ${describeUnknown(e)}`);
        return null;
      } finally {
        setBusy(false);
      }

      if (!result.ok) {
        setMessage(result.error.message);
        return null;
      }
      await reload();
      return result.value;
    },
    [reload],
  );

  return { nodes, busy, message, setMessage, reload, run };
}
