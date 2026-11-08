/**
 * Люди и следы их работы: учётные записи, журнал изменений, журнал действий.
 *
 * Три хранилища в одном файле, потому что у них общая тема и общее правило
 * связей: **журналы не привязаны внешним ключом к тому, о чём написаны**.
 * Иначе запись о том, кто удалил узел, исчезала бы вместе с узлом — ровно
 * тогда, когда она нужнее всего.
 *
 * Область прав человека лежит отдельной таблицей `user_scopes`: это связь
 * «многие ко многим» с узлами дерева, а не поле учётной записи. Первый признак
 * нормальной схемы — что список в поле стал таблицей.
 */

import type {
  AuditEvent, AuditRepository, ChangeLogEntry, ChangeLogFilter, ChangeLogRepository,
  ChangedField, PasswordDigest, Result, SigningKey, UserAccount, UserRepository,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { Db } from './database';
import { flag, integer, json, jsonList, required, text, toFlag, toJson, type Row } from './rows';

// ── Учётные записи ─────────────────────────────────────────────────────────

function toUser(db: Db, row: Row): UserAccount {
  const id = required(row['id'], 'пользователь.id');
  const scope = db
    .all<{ node_id: string }>('SELECT node_id FROM user_scopes WHERE user_id = ?', [id])
    .map((item) => item.node_id);

  return {
    id,
    login: required(row['login'], 'пользователь.login'),
    fullName: required(row['full_name'], 'пользователь.fullName'),
    position: text(row['position']),
    organization: text(row['organization']),
    email: text(row['email']),
    role: required(row['role'], 'пользователь.role') as UserAccount['role'],
    scope,
    password: json<PasswordDigest>(row['password_json']),
    signingKey: json<SigningKey>(row['signing_key_json']),
    mustChangePassword: flag(row['must_change_password']),
    acceptedLegalVersion: text(row['accepted_legal_version']),
    acceptedLegalAt: text(row['accepted_legal_at']),
    archivedAt: text(row['archived_at']),
    createdAt: required(row['created_at'], 'пользователь.createdAt'),
    updatedAt: required(row['updated_at'], 'пользователь.updatedAt'),
    rowVersion: integer(row['row_version'], 1),
  } as unknown as UserAccount;
}

export function saveUserRow(db: Db, user: UserAccount): void {
  db.transaction(() => {
    db.run(
      `INSERT INTO users(id, login, full_name, position, organization, email, role, password_json,
         signing_key_json, must_change_password, accepted_legal_version, accepted_legal_at,
         archived_at, created_at, updated_at, row_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         login = excluded.login,
         full_name = excluded.full_name,
         position = excluded.position,
         organization = excluded.organization,
         email = excluded.email,
         role = excluded.role,
         password_json = excluded.password_json,
         signing_key_json = excluded.signing_key_json,
         must_change_password = excluded.must_change_password,
         accepted_legal_version = excluded.accepted_legal_version,
         accepted_legal_at = excluded.accepted_legal_at,
         archived_at = excluded.archived_at,
         updated_at = excluded.updated_at,
         row_version = excluded.row_version`,
      [
        user.id, user.login, user.fullName, user.position, user.organization ?? null,
        user.email ?? null, user.role,
        toJson(user.password), toJson(user.signingKey ?? null), toFlag(user.mustChangePassword),
        user.acceptedLegalVersion ?? null, user.acceptedLegalAt ?? null,
        user.archivedAt, user.createdAt, user.updatedAt, integer(user.rowVersion, 1),
      ],
    );

    // Область прав переписывается целиком: это перечень, а не набор правок.
    db.run('DELETE FROM user_scopes WHERE user_id = ?', [user.id]);
    for (const nodeId of user.scope) {
      db.run('INSERT INTO user_scopes(user_id, node_id) VALUES (?,?)', [user.id, nodeId]);
    }
  });
}

/**
 * Хранилище учётных записей.
 *
 * Шире договора на один метод: `resetAll` очищает список целиком и нужен
 * первому запуску — когда программу разворачивают заново на чистой машине.
 * В договор ядра он не входит намеренно: сценариям такое право ни к чему.
 */
export function createUserStore(db: Db): UserRepository & { resetAll(): Promise<Result<void>> } {
  return {
    async list(): Promise<Result<readonly UserAccount[]>> {
      const rows = db.all<Row>('SELECT * FROM users ORDER BY full_name');
      return ok(rows.map((row) => toUser(db, row)));
    },

    async getById(id: string): Promise<Result<UserAccount>> {
      const row = db.get<Row>('SELECT * FROM users WHERE id = ?', [id]);
      if (row === null) return err('NOT_FOUND', 'Учётная запись не найдена.');
      return ok(toUser(db, row));
    },

    async findByLogin(login: string): Promise<Result<UserAccount | null>> {
      /*
       * Регистр имени не важен: человек набирает его руками, и «Ivanov» с
       * «ivanov» — один и тот же человек. Сравнение делает база, а не окно.
       */
      const row = db.get<Row>('SELECT * FROM users WHERE lower(login) = lower(?)', [login]);
      return ok(row === null ? null : toUser(db, row));
    },

    async save(user: UserAccount): Promise<Result<void>> {
      saveUserRow(db, user);
      return ok(undefined);
    },

    async remove(id: string): Promise<Result<void>> {
      // Область прав уходит следом сама: связь объявлена каскадной.
      db.run('DELETE FROM users WHERE id = ?', [id]);
      return ok(undefined);
    },

    async resetAll(): Promise<Result<void>> {
      db.run('DELETE FROM users');
      return ok(undefined);
    },
  };
}

// ── Журнал изменений ───────────────────────────────────────────────────────

function toEntry(row: Row): ChangeLogEntry {
  return {
    id: required(row['id'], 'изменение.id'),
    at: required(row['at'], 'изменение.at'),
    authorId: required(row['author_id'], 'изменение.authorId'),
    authorName: required(row['author_name'], 'изменение.authorName'),
    authorRole: required(row['author_role'], 'изменение.authorRole') as ChangeLogEntry['authorRole'],
    command: required(row['command'], 'изменение.command'),
    action: required(row['action'], 'изменение.action') as ChangeLogEntry['action'],
    subject: required(row['subject'], 'изменение.subject') as ChangeLogEntry['subject'],
    subjectId: required(row['subject_id'], 'изменение.subjectId'),
    subjectTitle: required(row['subject_title'], 'изменение.subjectTitle'),
    nodeId: text(row['node_id']),
    fields: jsonList<ChangedField>(row['fields_json']),
  };
}

function insertEntry(db: Db, entry: ChangeLogEntry): void {
  db.run(
    `INSERT INTO change_log(id, at, author_id, author_name, author_role, command,
       action, subject, subject_id, subject_title, node_id, fields_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      entry.id, entry.at, entry.authorId, entry.authorName, entry.authorRole,
      entry.command, entry.action, entry.subject, entry.subjectId, entry.subjectTitle,
      entry.nodeId, toJson(entry.fields),
    ],
  );
}

export { insertEntry as insertChangeRow };

export function createChangeLogStore(db: Db): ChangeLogRepository {
  return {
    async list(filter?: ChangeLogFilter): Promise<Result<readonly ChangeLogEntry[]>> {
      /*
       * Отбор делает база. Журнал изменений — самая длинная таблица программы:
       * он пополняется на каждую команду и никогда не укорачивается, и
       * перегонять его целиком ради одного узла значило бы отдавать окну тем
       * больше, чем дольше работает предприятие.
       */
      const where: string[] = [];
      const params: unknown[] = [];

      if (filter?.subject !== undefined) { where.push('subject = ?'); params.push(filter.subject); }
      if (filter?.authorId !== undefined) { where.push('author_id = ?'); params.push(filter.authorId); }
      if (filter?.from !== undefined) { where.push('at >= ?'); params.push(filter.from); }
      if (filter?.to !== undefined) { where.push('at <= ?'); params.push(filter.to); }
      if (filter?.nodeIds !== undefined) {
        const marks = filter.nodeIds.map(() => '?').join(',');
        where.push(`node_id IN (${marks === '' ? 'NULL' : marks})`);
        params.push(...filter.nodeIds);
      }

      const sql = 'SELECT * FROM change_log'
        + (where.length === 0 ? '' : ` WHERE ${where.join(' AND ')}`)
        + ' ORDER BY at';

      return ok(db.all<Row>(sql, params).map(toEntry));
    },

    async append(entry): Promise<Result<void>> {
      insertEntry(db, entry);
      return ok(undefined);
    },

    async appendMany(entries): Promise<Result<void>> {
      db.transaction(() => {
        for (const entry of entries) insertEntry(db, entry);
      });
      return ok(undefined);
    },
  };
}

// ── Журнал действий пользователей ──────────────────────────────────────────

function toAudit(row: Row): AuditEvent {
  return {
    id: required(row['id'], 'действие.id'),
    at: required(row['at'], 'действие.at'),
    actorId: text(row['actor_id']),
    actorName: required(row['actor_name'], 'действие.actorName'),
    actorRole: text(row['actor_role']) as AuditEvent['actorRole'],
    kind: required(row['kind'], 'действие.kind') as AuditEvent['kind'],
    subject: text(row['subject']),
    details: text(row['details']),
  };
}

export function insertAuditRow(db: Db, event: AuditEvent): void {
  db.run(
    `INSERT INTO audit_events(id, at, actor_id, actor_name, actor_role, kind, subject, details)
     VALUES (?,?,?,?,?,?,?,?)`,
    [event.id, event.at, event.actorId, event.actorName, event.actorRole,
      event.kind, event.subject, event.details],
  );
}

export function createAuditStore(db: Db): AuditRepository {
  return {
    async list(): Promise<Result<readonly AuditEvent[]>> {
      return ok(db.all<Row>('SELECT * FROM audit_events ORDER BY at').map(toAudit));
    },

    async append(event): Promise<Result<void>> {
      insertAuditRow(db, event);
      return ok(undefined);
    },

    async prune(olderThan): Promise<Result<number>> {
      /*
       * Единственное место, где программа удаляет данные, и оно ограничено
       * прямым требованием заказчика: журнал действий живёт тридцать дней.
       * Сколько убрано — считается до удаления: после него считать уже нечего.
       */
      const before = db.get<{ n: number }>(
        'SELECT count(*) AS n FROM audit_events WHERE at < ?', [olderThan],
      )?.n ?? 0;
      if (before === 0) return ok(0);

      db.run('DELETE FROM audit_events WHERE at < ?', [olderThan]);
      return ok(before);
    },
  };
}
