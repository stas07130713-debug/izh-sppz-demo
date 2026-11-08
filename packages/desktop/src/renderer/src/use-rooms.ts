/**
 * Помещения выбранного этажа.
 *
 * Загружаются по узлу: помещение принадлежит этажу и вне его не существует.
 * Проверок здесь нет — все они в сценариях ядра.
 *
 * Выведенные из эксплуатации сюда не попадают — так же, как у объектов
 * (`usePlanObjects`). Отбор стоит здесь, а не у каждого, кто эти помещения
 * показывает: список помещений его делал, а план — нет, и удалённое помещение
 * пропадало из карточки, но продолжало лежать обводкой на чертеже. Заказчик
 * прислал ровно такой снимок: «обводка осталась, а в карточке узла ничего не
 * заведено».
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from '@izh/contracts';

export interface RoomsState {
  readonly rooms: readonly Room[];
  readonly reload: () => Promise<void>;
}

interface RoomsSnapshot {
  readonly levelId: string | null;
  readonly rooms: readonly Room[];
}

export function useRooms(levelId: string | null): RoomsState {
  const [loaded, setLoaded] = useState<RoomsSnapshot>({ levelId, rooms: [] });
  /** Номер последней начатой загрузки: запоздавший ответ прежнего этажа не в счёт. */
  const requestRef = useRef(0);

  const reload = useCallback(async (): Promise<void> => {
    requestRef.current += 1;
    const request = requestRef.current;

    if (levelId === null) {
      setLoaded({ levelId: null, rooms: [] });
      return;
    }
    const list = await window.izh.rooms.listByLevel(levelId);
    if (requestRef.current !== request) return;
    setLoaded({
      levelId,
      rooms: list.ok ? list.value.filter((room) => room.archivedAt === null) : [],
    });
  }, [levelId]);

  useEffect(() => {
    /*
     * Обводки прежнего этажа убираются сразу.
     *
     * Заказчик: «при отметке выделения здания оно выделяется почему-то на всех
     * этажах». Обводка принадлежит одному этажу, но держалась на экране, пока
     * читался следующий, — и ложилась поверх чужого чертежа. Своей обводки у
     * того этажа нет, снять её было нечем: снимать нечего, она чужая.
     */
    void reload();
  }, [reload]);

  // Эффекты выполняются после кадра. Сверка ключа не даёт старому этажу
  // получить даже один кадр с обводками нового — или наоборот.
  return { rooms: loaded.levelId === levelId ? loaded.rooms : [], reload };
}
