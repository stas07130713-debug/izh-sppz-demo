/**
 * База данных программы: открытие, версия схемы, транзакции.
 *
 * Заказчик (пункт 11 перечня доработок): «нужно привести хранение информации к
 * нормальной связанной структуре. Не следует хранить одну и ту же информацию
 * одновременно в нескольких независимых таблицах… Пример связей: User →
 * AuditEvent → FireProtectionElement… Не создавать две независимые записи с
 * одинаковым содержимым». И отдельно: «НУЖНО СДЕЛАТЬ НОРМАЛЬНУЮ БАЗУ ДАННЫХ».
 *
 * До этого каждая сущность лежала своим файлом JSON: программа читала файл
 * целиком, меняла один объект и переписывала весь файл обратно. Связей между
 * файлами не было никаких — только совпадение строковых идентификаторов,
 * которое ничто не проверяло: узел можно было удалить, а элементы оставить
 * висеть в пустоте.
 *
 * **Почему SQLite.** Программа настольная, работает без сервера, и данные
 * предприятия должны лежать в одном файле, который можно скопировать и
 * приложить к акту проверки. SQLite ровно для этого и сделан: один файл,
 * транзакции, внешние ключи, целостность на уровне хранилища.
 *
 * **Почему сборка на WebAssembly, а не родная.** Родной драйвер
 * (`better-sqlite3`) требует компилятора C++ на каждой машине, где программу
 * ставят или пересобирают, — на этой его не оказалось, и установка сорвалась.
 * Сборка на WebAssembly работает всюду одинаково, ничего не требует и кладётся
 * в поставку как обычный файл. Настольному журналу на десятки тысяч записей её
 * скорости достаточно с большим запасом.
 *
 * **Один процесс — один открытый файл.** База открывается в основном процессе,
 * окно к ней не имеет доступа вовсе (AGENTS.md, правило 4): оно спрашивает
 * данные через мост, как и прежде.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Database } from 'node-sqlite3-wasm';

/**
 * Открытая база.
 *
 * Тонкая обёртка, а не свой слой запросов: SQL пишется там, где он нужен, —
 * в хранилищах сущностей. Здесь только то, что у всех общее.
 */
export interface Db {
  /** Выполнить запрос без ответа: вставка, правка, удаление. */
  run(sql: string, params?: readonly unknown[]): void;
  /** Все строки ответа. */
  all<T>(sql: string, params?: readonly unknown[]): readonly T[];
  /** Первая строка ответа или `null`. */
  get<T>(sql: string, params?: readonly unknown[]): T | null;
  /** Несколько запросов подряд: схема, служебные настройки. */
  exec(sql: string): void;
  /**
   * Выполнить всё разом или не выполнять ничего.
   *
   * Одно действие человека почти всегда задевает несколько таблиц: завести
   * огнетушитель — это запись в `objects` и в `object_profiles`, перенести
   * этаж — правка узла и всех его элементов. Половина записанного — это
   * испорченные данные, и лучше не записать ничего.
   */
  transaction<T>(work: () => T): T;
  close(): void;
}

/** Текущая версия схемы. Растёт с каждым изменением состава таблиц. */
export const SCHEMA_VERSION = 1;

/** Шаг перехода на следующую версию схемы. */
export interface Migration {
  readonly version: number;
  /** Что сделать, чтобы схема стала этой версии. */
  readonly up: (db: Db) => void;
}

function wrap(raw: InstanceType<typeof Database>): Db {
  let depth = 0;

  return {
    run(sql, params) {
      raw.run(sql, params === undefined ? undefined : [...params] as never);
    },
    all<T>(sql: string, params?: readonly unknown[]): readonly T[] {
      return raw.all(sql, params === undefined ? undefined : [...params] as never) as unknown as readonly T[];
    },
    get<T>(sql: string, params?: readonly unknown[]): T | null {
      const row = raw.get(sql, params === undefined ? undefined : [...params] as never);
      return (row ?? null) as unknown as T | null;
    },
    exec(sql) {
      raw.exec(sql);
    },
    transaction<T>(work: () => T): T {
      /*
       * Вложенные вызовы не начинают вторую сделку: SQLite их не поддерживает,
       * а сценарии ядра свободно вызывают друг друга. Внешний вызов и решает,
       * записать всё или отменить.
       */
      if (depth > 0) return work();

      depth += 1;
      raw.exec('BEGIN');
      try {
        const result = work();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },
    close() {
      raw.close();
    },
  };
}

/**
 * Открывает базу и доводит её схему до текущей версии.
 *
 * Версия хранится в самой базе (`PRAGMA user_version`), а не рядом с ней:
 * файл базы копируют и переносят, и версия обязана ехать вместе с ним.
 */
export function openDatabase(path: string, migrations: readonly Migration[]): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = wrap(new Database(path));

  /*
   * Внешние ключи в SQLite по умолчанию выключены — это наследие
   * совместимости. Без них связи в схеме остались бы украшением: можно было бы
   * удалить узел и оставить его элементы висеть в пустоте, ровно как в файлах
   * JSON до этого.
   */
  db.exec('PRAGMA foreign_keys = ON');
  /*
   * Ждать освобождения файла, а не падать сразу: основной процесс работает с
   * базой из нескольких мест, и короткое ожидание лучше отказа.
   */
  db.exec('PRAGMA busy_timeout = 5000');

  migrate(db, migrations);
  return db;
}

/** Доводит схему до последней версии, применяя недостающие шаги по порядку. */
export function migrate(db: Db, migrations: readonly Migration[]): void {
  const current = db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  const pending = [...migrations]
    .filter((step) => step.version > current)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) return;

  /*
   * Каждый шаг — своей сделкой, и версия поднимается в ней же. Иначе
   * прерванный переход оставил бы схему на полпути, а номер версии — прежним
   * или уже новым: и то и другое хуже, чем не начинать.
   */
  for (const step of pending) {
    db.transaction(() => {
      step.up(db);
      // Номер подставляется числом: PRAGMA не принимает параметров.
      db.exec(`PRAGMA user_version = ${Math.trunc(step.version)}`);
    });
  }
}

/** Версия схемы в открытой базе. */
export function schemaVersion(db: Db): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}
