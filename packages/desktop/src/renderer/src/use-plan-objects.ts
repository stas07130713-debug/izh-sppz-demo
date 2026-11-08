/**
 * Объекты СППЗ выбранного узла.
 *
 * Один и тот же список — и значки на плане, и будущие строки журнала: запись
 * одна, читается один раз.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanObject } from '@izh/contracts';

export interface PlanObjectsState {
  readonly objects: readonly PlanObject[];
  readonly reload: () => Promise<void>;
}

interface LoadedObjects {
  readonly nodeId: string | null;
  readonly objects: readonly PlanObject[];
}

export function usePlanObjects(nodeId: string | null): PlanObjectsState {
  const [loaded, setLoaded] = useState<LoadedObjects>({ nodeId, objects: [] });
  /** Номер последней начатой загрузки: запоздавший ответ прежнего узла не в счёт. */
  const requestRef = useRef(0);

  const reload = useCallback(async (): Promise<void> => {
    requestRef.current += 1;
    const request = requestRef.current;

    if (nodeId === null) {
      setLoaded({ nodeId: null, objects: [] });
      return;
    }
    const list = await window.izh.objects.listByNode(nodeId);
    if (requestRef.current !== request) return;
    setLoaded({
      nodeId,
      objects: list.ok ? list.value.filter((object) => object.archivedAt === null) : [],
    });
  }, [nodeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Эффект очистил бы прежние значки только после первого кадра нового узла.
  // Ключ узла отсекает их синхронно, ещё до вывода на экран.
  const objects = loaded.nodeId === nodeId ? loaded.objects : [];
  return { objects, reload };
}
