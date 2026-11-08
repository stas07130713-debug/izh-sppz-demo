/**
 * Веб-приложение для переноса журнала на телефон.
 *
 * Заказчик: «должна быть привязка к учётной записи, и перенос по
 * веб-приложению».
 *
 * Сделано так: настольная программа поднимает у себя маленький веб-сервер в
 * локальной сети предприятия. Телефон открывает его в браузере, входит **той
 * же учётной записью**, что и настольная программа, и получает свой снимок
 * журнала. Никакого облака: данные не покидают сеть предприятия — то же
 * правило, по которому вся программа работает без интернета.
 *
 * Что защищает перенос:
 *
 * 1. **Логин и пароль** — те же, что в программе, и сверяются тем же scrypt.
 *    Пароль на телефон не уезжает и в пропуске не хранится.
 * 2. **Код сопряжения** — шесть цифр, показанных на экране настольной
 *    программы. Сеть предприятия небезопасна, и одного пароля мало: без кода
 *    вход не проходит даже с верным паролем.
 * 3. **Область прав** — уезжает ровно то, до чего человек дотягивается по
 *    дереву. Отбор делает ядро (`fieldSnapshot`), а не сервер.
 * 4. **Выключено по умолчанию.** Перенос включает человек, и он же его
 *    выключает; остановка отзывает все пропуска.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import type { PasswordHasher } from '@izh/contracts';
import { fieldSnapshot } from '@izh/core';
import type { Storage } from './db/storage.js';
import { createFieldTokens, pairingCode, sameSecret } from './field-tokens.js';

/** Тело запроса: больше этого на входе не читаем — защита от «бесконечного» тела. */
const MAX_BODY_BYTES = 1024 * 1024;

export interface FieldServerOptions {
  readonly storage: Storage;
  readonly hasher: PasswordHasher;
  /** Порт. 0 — свободный выбирает система. */
  readonly port: number;
  /** Откуда отдавать само веб-приложение. Не задан — отдаётся только обмен. */
  readonly appDir?: string | null;
}

export interface RunningFieldServer {
  /** Адрес, который называют обходчику: «откройте на телефоне». */
  readonly address: string;
  /** Код сопряжения на экране настольной программы. */
  readonly code: string;
  readonly stop: () => Promise<void>;
}

/** Адрес компьютера в локальной сети — тот, который наберут на телефоне. */
export function localAddress(port: number): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) return `http://${item.address}:${port}`;
    }
  }
  // Сети нет вовсе: называть чужой адрес нельзя, называем свой.
  return `http://127.0.0.1:${port}`;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const part = chunk as Buffer;
    size += part.length;
    if (size > MAX_BODY_BYTES) throw new Error('Слишком большой запрос.');
    chunks.push(part);
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    // Веб-приложение лежит на этом же сервере, чужим страницам обмен не нужен.
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

/** Пропуск из заголовка. Своего имени заголовку не выдумываем — стандартный. */
function tokenOf(request: IncomingMessage): string | null {
  const raw = request.headers.authorization ?? '';
  return raw.startsWith('Bearer ') ? raw.slice(7) : null;
}

export function startFieldServer(options: FieldServerOptions): Promise<RunningFieldServer> {
  const tokens = createFieldTokens();
  const code = pairingCode();
  const { storage, hasher } = options;

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    /*
     * Путь приводится к читаемому виду.
     *
     * Браузер отправляет русские буквы в пути закодированными процентами, и
     * сравнение с «/api/вход» не сходилось никогда: сервер отвечал «нет
     * такого обращения» на всё подряд.
     */
    const path = decodeURIComponent(url.pathname);

    if (path === '/api/вход' && request.method === 'POST') {
      const body = await readBody(request) as { login?: string; password?: string; code?: string } | null;
      const login = body?.login ?? '';
      const password = body?.password ?? '';

      /*
       * Код сверяется первым и всегда.
       *
       * Иначе по времени ответа было бы видно, существует ли учётная запись:
       * перебор логинов начинался бы ещё до подбора пароля.
       */
      if (!sameSecret(body?.code ?? '', code)) {
        send(response, 403, { ошибка: 'Код сопряжения не совпадает. Он показан в настольной программе.' });
        return;
      }

      const found = await storage.users.findByLogin(login);
      const user = found.ok ? found.value : null;
      if (user === null || user.password === null || user.archivedAt !== null) {
        send(response, 403, { ошибка: 'Учётная запись не найдена или закрыта.' });
        return;
      }

      const matched = await hasher.verify(password, user.password);
      if (!matched.ok || !matched.value) {
        send(response, 403, { ошибка: 'Пароль указан неверно.' });
        return;
      }

      send(response, 200, {
        пропуск: tokens.issue(user.id, Date.now()),
        кто: { id: user.id, фио: user.fullName, роль: user.role, должность: user.position },
      });
      return;
    }

    if (path === '/api/журнал' && request.method === 'GET') {
      const userId = tokens.userOf(tokenOf(request), Date.now());
      if (userId === null) {
        send(response, 401, { ошибка: 'Пропуск недействителен. Войдите заново.' });
        return;
      }

      const user = await storage.users.getById(userId);
      if (!user.ok) { send(response, 401, { ошибка: 'Учётная запись больше не доступна.' }); return; }

      const [nodes, objects, rooms, events] = await Promise.all([
        storage.tree.list(), storage.objects.list(), storage.rooms.list(), storage.maintenance.list(),
      ]);
      if (!nodes.ok || !objects.ok || !rooms.ok || !events.ok) {
        send(response, 500, { ошибка: 'Не удалось прочитать журнал.' });
        return;
      }

      send(response, 200, fieldSnapshot({
        user: user.value,
        at: new Date().toISOString(),
        nodes: nodes.value, objects: objects.value, rooms: rooms.value, events: events.value,
      }));
      return;
    }

    /*
     * Само веб-приложение отдаётся этим же сервером.
     *
     * Так у обходчика один адрес, а не два, и нет обращения на чужой источник:
     * браузер такие обращения запрещает, и телефон отвечал «программа не
     * отвечает», хотя она отвечала прекрасно — просто в другом месте.
     */
    if (options.appDir != null && (request.method === 'GET' || request.method === 'HEAD')) {
      const file = appFile(options.appDir, path);
      if (file !== null) {
        response.writeHead(200, { 'Content-Type': mimeOf(file), 'Cache-Control': 'no-store' });
        if (request.method === 'HEAD') { response.end(); return; }
        createReadStream(file).pipe(response);
        return;
      }
    }

    send(response, 404, { ошибка: 'Нет такого обращения.' });
  };

  const server: Server = createServer((request, response) => {
    void handle(request, response).catch(() => {
      // Подробности наружу не выдаём: по ним изучают внутреннее устройство.
      send(response, 400, { ошибка: 'Запрос не разобран.' });
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(options.port, () => {
      const bound = server.address();
      const port = typeof bound === 'object' && bound !== null ? bound.port : options.port;
      resolve({
        address: localAddress(port),
        code,
        stop: () => new Promise<void>((done) => {
          tokens.revokeAll();
          server.close(() => done());
        }),
      });
    });
  });
}

/** Какого вида файл отдаём. Больше видов веб-приложению не нужно. */
const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function mimeOf(file: string): string {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Файл веб-приложения по запрошенному пути.
 *
 * Путь проверяется на выход за пределы папки приложения: «../» в запросе — это
 * попытка прочитать чужой файл на компьютере, и её обязан отбить сервер, а не
 * надежда на то, что так никто не сделает.
 *
 * Неизвестный путь отдаёт `index.html`: у приложения свои экраны, и переход по
 * ним не должен упираться в «нет такой страницы».
 */
function appFile(dir: string, path: string): string | null {
  const wanted = path === '/' ? 'index.html' : path.replace(new RegExp('^/+'), '');
  const full = normalize(join(dir, wanted));
  if (!full.startsWith(normalize(dir) + sep) && full !== normalize(dir)) return null;

  if (existsSync(full) && statSync(full).isFile()) return full;
  const index = join(dir, 'index.html');
  return existsSync(index) ? index : null;
}
