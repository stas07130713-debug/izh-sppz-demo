/**
 * Выведенное из эксплуатации помещение не отдаётся экрану.
 *
 * Заказчик прислал снимок: на плане лежит обводка помещения, а в карточке узла
 * «помещений пока нет». Так и было: список помещений отбирал действующие, а
 * план рисовал всё подряд — удалённое помещение пропадало из карточки и
 * оставалось обводкой на чертеже, с подсказкой о категории и площади.
 *
 * Отбор перенесён туда, где помещения читаются, — и проверяется здесь же.
 * Держать его у каждого, кто помещения показывает, нельзя: однажды забудут,
 * что и случилось.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Room } from '@izh/contracts';
import { fileURLToPath } from 'node:url';

const NOW = '2026-09-09T07:00:00.000Z';

function room(id: string, archivedAt: string | null): Room {
  return {
    id, levelId: 'этаж', name: id, number: null, category: null,
    outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    areaM2: 100, archivedAt, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  } as unknown as Room;
}

const rooms = [room('живое', null), room('снятое', '2026-09-09T18:00:00.000Z')];

/** Мост как в программе: возвращает всё, что лежит в хранилище. */
function bridge(): void {
  vi.stubGlobal('window', {
    izh: {
      rooms: {
        list: async () => ({ ok: true, value: rooms }),
        listByLevel: async () => ({ ok: true, value: rooms }),
      },
    },
  });
}

describe('помещения для экрана', () => {
  it('этаж отдаёт только действующие помещения', async () => {
    bridge();
    const list = await window.izh.rooms.listByLevel('этаж');
    const shown = list.ok ? list.value.filter((item) => item.archivedAt === null) : [];

    // То же правило, что в use-rooms: снятое с учёта на чертеже не рисуется.
    expect(shown.map((item) => item.id)).toEqual(['живое']);
  });

  it('отбор действительно стоит в обоих чтениях помещений', () => {
    // Проверка держит правило, а не разметку: забыть его легко, и цена забвения
    // — призрачная обводка на плане, которой не соответствует ни одна строка.
    const source = [
      'use-rooms.ts',
      'use-all-rooms.ts',
    ].map((name) => readSource(name));

    for (const text of source) {
      expect(text).toContain('archivedAt === null');
    }
  });
});

function readSource(name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const here = fileURLToPath(new URL('.', import.meta.url));
  return readFileSync(`${here}${name}`, 'utf8');
}
