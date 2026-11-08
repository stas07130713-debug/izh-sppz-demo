/**
 * Откуда полевой помощник берёт сведения.
 *
 * На телефоне нет ни базы настольной программы, ни её главного процесса.
 * Помощник работает с **копией журнала**, снятой с настольной программы: в
 * здании связи может не быть вовсе, и рассчитывать на неё нельзя.
 *
 * Порт описан отдельно от того, кто его исполняет: сегодня копию читают из
 * файла, завтра — из хранилища телефона под Capacitor. Экран об этом не знает
 * и знать не должен — то же правило, что в настольной программе (AGENTS.md,
 * правило 4).
 */

import type { MaintenanceEvent, PlanObject, Room, TreeNode } from '@izh/contracts';

/** Снимок журнала, с которым уходят на обход. */
export interface FieldSnapshot {
  /** Когда снят: обходчик должен видеть, насколько свежи сроки. */
  readonly takenAt: string;
  readonly nodes: readonly TreeNode[];
  readonly objects: readonly PlanObject[];
  readonly rooms: readonly Room[];
  readonly events: readonly MaintenanceEvent[];
}

export interface FieldSource {
  /** Читает снимок. Пусто — на телефон ещё ничего не переносили. */
  load(): Promise<FieldSnapshot | null>;
}

/** Пустой снимок: помощник запущен, а журнал ещё не перенесён. */
export const EMPTY_SNAPSHOT: FieldSnapshot = {
  takenAt: '', nodes: [], objects: [], rooms: [], events: [],
};

/**
 * Снимок из файлов выгрузки настольной программы.
 *
 * Читает те же файлы, которые настольная программа хранит в своей папке
 * данных. Формат общий намеренно: отдельный формат «для телефона» пришлось бы
 * поддерживать вторым, и он разошёлся бы с первым при первой же правке.
 */
export function filesSource(base: string): FieldSource {
  return {
    async load(): Promise<FieldSnapshot | null> {
      /*
       * Нет файла — это «не переносили», а не «сломалось».
       *
       * Разница не косметическая: «перенесите заново» посылает человека
       * повторять то, чего он не делал, и он будет искать несуществующую
       * ошибку. Поэтому недоступный или нечитаемый файл здесь просто пуст, а
       * судит о переносе то, что нашлось в дереве узлов.
       *
       * Ответ разбирается осторожно: сервер отдаёт на неизвестный путь
       * страницу, а не отказ, и `json()` на ней срывается.
       */
      const read = async <T>(name: string, key: string): Promise<readonly T[]> => {
        try {
          const answer = await fetch(`${base}/${name}`);
          if (!answer.ok) return [];
          const parsed = await answer.json() as Record<string, unknown>;
          const rows = parsed[key];
          return Array.isArray(rows) ? rows as T[] : [];
        } catch {
          return [];
        }
      };

      const nodes = await read<TreeNode>('tree.json', 'nodes');
      if (nodes.length === 0) return null;

      return {
        takenAt: new Date().toISOString(),
        nodes,
        objects: await read<PlanObject>('objects.json', 'objects'),
        rooms: await read<Room>('rooms.json', 'rooms'),
        events: await read<MaintenanceEvent>('maintenance.json', 'events'),
      };
    },
  };
}

/**
 * Действующее оборудование снимка.
 *
 * Выведенное из эксплуатации в обход не берут: его нет. Тот же отбор, что в
 * настольной программе, — и по той же причине, по которой там однажды осталась
 * призрачная обводка (часть С147).
 */
export function liveObjects(snapshot: FieldSnapshot): readonly PlanObject[] {
  const live = new Set(snapshot.nodes.filter((node) => node.archivedAt === null).map((node) => node.id));
  return snapshot.objects.filter((object) => object.archivedAt === null && live.has(object.nodeId));
}

/** Путь до оборудования словами: «МВАСО · 2 этаж». Обходчик ищет по нему. */
export function placeOf(snapshot: FieldSnapshot, nodeId: string): string {
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const parts: string[] = [];
  let current = byId.get(nodeId);
  while (current !== undefined) {
    parts.unshift(current.name);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  // Организация в подписи не нужна: на обходе она одна и та же у всего.
  return parts.slice(1).join(' · ');
}

/** Кто вошёл: под его именем встанет подпись под записями обхода. */
export interface FieldUser {
  readonly id: string;
  readonly фио: string;
  readonly роль: string;
  readonly должность: string | null;
}

export interface EnterResult {
  readonly пропуск: string;
  readonly кто: FieldUser;
}

/** Адрес без хвостовой косой черты: её набирают по привычке. */
function clean(address: string): string {
  return address.trim().replace(/\/+$/, '');
}

/**
 * Вход в настольную программу по сети и получение пропуска.
 *
 * Заказчик: «привязка к учётной записи и перенос по веб-приложению». Пароль
 * уходит один раз, при входе, и на телефоне не остаётся: дальше телефон
 * предъявляет пропуск, выданный на смену.
 */
export async function enterField(
  address: string,
  login: string,
  password: string,
  code: string,
): Promise<{ readonly ok: true; readonly value: EnterResult } | { readonly ok: false; readonly error: string }> {
  const answer = await fetch(`${clean(address)}/api/вход`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password, code }),
  });
  const body = await answer.json() as Record<string, unknown>;
  if (!answer.ok) return { ok: false, error: String(body['ошибка'] ?? 'Войти не удалось.') };
  return { ok: true, value: body as unknown as EnterResult };
}

/** Снимок по выданному пропуску. */
export function serverSource(address: string, token: string): FieldSource {
  return {
    async load(): Promise<FieldSnapshot | null> {
      const answer = await fetch(`${clean(address)}/api/журнал`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!answer.ok) return null;
      return await answer.json() as FieldSnapshot;
    },
  };
}
