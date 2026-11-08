/**
 * Все объекты СППЗ всех организаций.
 *
 * Журналу нужен не один узел, а целое поддерево (часть 3.1 ТЗ), поэтому
 * список читается целиком и фильтруется в памяти через `journalScope` из
 * ядра — так же, как дерево объекта.
 */

import { useCallback, useEffect, useState } from 'react';
import type { PlanObject } from '@izh/contracts';

export interface AllPlanObjectsState {
  readonly objects: readonly PlanObject[];
  readonly reload: () => Promise<void>;
}

export function useAllPlanObjects(): AllPlanObjectsState {
  const [objects, setObjects] = useState<readonly PlanObject[]>([]);

  const reload = useCallback(async (): Promise<void> => {
    const list = await window.izh.objects.list();
    setObjects(list.ok ? list.value : []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { objects, reload };
}
