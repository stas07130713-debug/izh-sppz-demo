/**
 * Применение отмены и возврата к базе.
 *
 * История команд не знает, где лежат данные: она помнит, что было до команды и
 * что стало после, а вернуть значение на место — дело этих переходников.
 *
 * Перевод их на базу — обязательная часть перехода, а не мелочь. Прежние
 * переходники писали прямо в файлы JSON; оставь их такими — отмена правила бы
 * файлы, которых программа больше не читает, и человек нажимал бы «отменить»,
 * а на экране ничего не менялось.
 *
 * Записи журнала эксплуатации сюда не попадают вовсе: их нельзя ни править, ни
 * удалять, а значит и откатывать нечего. Историю команд это учитывает сама —
 * она не берёт их в состав команды.
 */

import type { HistoryEntityKind } from '@izh/contracts';
import { describeUnknown, err, ok, type Result } from '@izh/contracts';
import type { HistoryAdapter } from '../command-history.js';
import type { Storage } from './storage';

/**
 * Переходник поверх пары «прочитать по номеру» и «записать целиком».
 *
 * Значение приходит от истории таким, каким было записано, — тем же путём его
 * и возвращают: через то же хранилище, что и обычная правка. Второго способа
 * записи в программе нет, и появиться он не должен.
 */
function adapter<T extends { id?: string }>(
  kind: HistoryEntityKind,
  read: (id: string) => Promise<Result<T>>,
  write: (value: T) => Promise<Result<void>>,
  erase: (id: string) => void,
): HistoryAdapter {
  return {
    kind,
    async get(id: string): Promise<Result<unknown | null>> {
      const found = await read(id);
      // «Не нашлось» — это не ошибка: до команды записи могло не быть вовсе,
      // и вернуть её в это состояние значит удалить.
      return found.ok ? ok(found.value) : ok(null);
    },
    async put(value: unknown): Promise<Result<void>> {
      return write(value as T);
    },
    async remove(id: string): Promise<Result<void>> {
      try {
        erase(id);
        return ok(undefined);
      } catch (error) {
        return err('INTERNAL', 'Не удалось отменить действие.', describeUnknown(error));
      }
    },
  };
}

export function createDbHistoryAdapters(storage: Storage): readonly HistoryAdapter[] {
  const { db } = storage;

  return [
    adapter('tree',
      (id) => storage.tree.getById(id),
      (node) => storage.tree.save(node),
      (id) => db.run('DELETE FROM nodes WHERE id = ?', [id])),

    adapter('room',
      (id) => storage.rooms.getById(id),
      (room) => storage.rooms.save(room),
      (id) => db.run('DELETE FROM rooms WHERE id = ?', [id])),

    adapter('object',
      (id) => storage.objects.getById(id),
      (object) => storage.objects.save(object),
      (id) => db.run('DELETE FROM objects WHERE id = ?', [id])),

    /*
     * Настройки — одна запись на всю программу, и номера у неё нет. История
     * зовёт её по любому, поэтому чтение и запись идут мимо номера.
     */
    {
      kind: 'settings',
      async get(): Promise<Result<unknown | null>> {
        const settings = await storage.settings.get();
        return settings.ok ? ok(settings.value) : ok(null);
      },
      async put(value: unknown): Promise<Result<void>> {
        return storage.settings.save(value as Parameters<typeof storage.settings.save>[0]);
      },
      async remove(): Promise<Result<void>> {
        // Настройки не удаляют: их возвращают к прежним значениям.
        return ok(undefined);
      },
    },

    adapter('backdrop',
      (id) => storage.backdrops.getById(id),
      (backdrop) => storage.backdrops.save(backdrop),
      (id) => db.run('DELETE FROM backdrops WHERE id = ?', [id])),

    {
      kind: 'calibration',
      async get(id: string): Promise<Result<unknown | null>> {
        const found = await storage.backdrops.getCalibration(id);
        return found.ok ? ok(found.value) : ok(null);
      },
      async put(value: unknown): Promise<Result<void>> {
        return storage.backdrops.saveCalibration(
          value as Parameters<typeof storage.backdrops.saveCalibration>[0],
        );
      },
      async remove(id: string): Promise<Result<void>> {
        db.run('DELETE FROM calibrations WHERE backdrop_id = ?', [id]);
        return ok(undefined);
      },
    },

    {
      kind: 'cleanup',
      async get(id: string): Promise<Result<unknown | null>> {
        const found = await storage.backdrops.getCleanup(id);
        return found.ok ? ok(found.value) : ok(null);
      },
      async put(value: unknown): Promise<Result<void>> {
        return storage.backdrops.saveCleanup(
          value as Parameters<typeof storage.backdrops.saveCleanup>[0],
        );
      },
      async remove(id: string): Promise<Result<void>> {
        return storage.backdrops.removeCleanup(id);
      },
    },
  ];
}
