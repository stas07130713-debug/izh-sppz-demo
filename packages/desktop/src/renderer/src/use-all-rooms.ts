/**
 * Все помещения всех этажей.
 *
 * Журналу и дашборду выше уровня этажа (здание, цех) нужны названия чужих
 * этажей для колонки «Место установки» и фильтра по помещению — так же, как
 * `useAllPlanObjects` читает объекты целиком, а не по одному узлу.
 *
 * Выведенные из эксплуатации не отдаются: помещения нет, и показывать его
 * нечем — ни строкой, ни обводкой на плане.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@izh/contracts';

export interface AllRoomsState {
  readonly rooms: readonly Room[];
  readonly reload: () => Promise<void>;
}

export function useAllRooms(): AllRoomsState {
  const [rooms, setRooms] = useState<readonly Room[]>([]);

  const reload = useCallback(async (): Promise<void> => {
    const list = await window.izh.rooms.list();
    setRooms(list.ok ? list.value.filter((room) => room.archivedAt === null) : []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rooms, reload };
}
