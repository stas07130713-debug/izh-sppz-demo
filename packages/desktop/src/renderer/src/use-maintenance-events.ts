/**
 * Все мероприятия всех объектов.
 *
 * Загружаются целиком, как объекты и дерево: данных немного, а расчёт статуса
 * в ячейках журнала (`activityCellsForObject`) всё равно проходит по полному
 * списку событий каждого объекта.
 */

import { useCallback, useEffect, useState } from 'react';
import type { MaintenanceEvent } from '@izh/contracts';

export interface MaintenanceEventsState {
  readonly events: readonly MaintenanceEvent[];
  readonly reload: () => Promise<void>;
}

export function useMaintenanceEvents(): MaintenanceEventsState {
  const [events, setEvents] = useState<readonly MaintenanceEvent[]>([]);

  const reload = useCallback(async (): Promise<void> => {
    const list = await window.izh.maintenance.list();
    setEvents(list.ok ? list.value : []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, reload };
}
