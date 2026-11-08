/**
 * Схема базы: таблицы, связи и правила целостности.
 *
 * Разделение — то самое, которое назвал заказчик (пункт 11): пользователи;
 * объекты (цеха, здания, этажи, склады, характеристики пожарной безопасности);
 * элементы СППЗ с их опознавательными данными; данные отдельных видов;
 * история; журнал действий пользователей.
 *
 * **Связи настоящие, а не по совпадению строк.** Внешние ключи включены, и
 * база сама не даёт завести элемент в несуществующем узле или запись проверки
 * без элемента. Прежде связь держалась на том, что в двух файлах JSON совпадал
 * идентификатор, и ничто этого не проверяло.
 *
 * **Что удаляется вместе с родителем, а что нет.** Помещение принадлежит
 * этажу и уходит с ним (`ON DELETE CASCADE`) — само по себе оно не значит
 * ничего. Записи журнала эксплуатации не уходят никогда: они доказательство
 * проведённых работ (AGENTS.md, правило 10), и элемент из обращения выводят
 * пометкой, а не удалением. Журнал изменений и журнал действий не привязаны
 * внешним ключом к тому, о чём написаны, — иначе они исчезали бы вместе с
 * удалённым, ровно тогда, когда нужнее всего.
 *
 * **Почему у видовых карточек одна таблица, а не двенадцать.** Заказчик
 * допустил и то и другое: «специфические характеристики должны храниться в
 * соответствующих сущностях/таблицах **либо связанных структурах**». У
 * двенадцати видов оборудования — от огнетушителя до насосной станции — в
 * сумме больше трёхсот характеристик, и каждая новая правка контрактов
 * означала бы правку схемы и перенос данных. Поэтому карточка вида — своя
 * строка в `object_profiles`, связанная с элементом и помеченная видом
 * характеристик; а те несколько полей, по которым программа **считает нормы**,
 * вынесены отдельными колонками в `objects` — по ним и идут выборки.
 */

import type { Db, Migration } from './database';

/** Первая версия схемы: всё, что программа хранила файлами. */
const V1 = `
-- ── Пользователи ──────────────────────────────────────────────────────────
CREATE TABLE users (
  id                     TEXT PRIMARY KEY,
  login                  TEXT NOT NULL UNIQUE,
  full_name              TEXT NOT NULL,
  position               TEXT,
  role                   TEXT NOT NULL,
  -- Отпечаток пароля и ключ подписи: разбирать их по колонкам незачем, их
  -- состав задаёт способ хеширования, а не программа.
  email                  TEXT,
  password_json          TEXT,
  signing_key_json       TEXT,
  -- Требование сменить пароль: ставится при заведении и после сброса.
  must_change_password   INTEGER NOT NULL DEFAULT 0,
  accepted_legal_version TEXT,
  accepted_legal_at      TEXT,
  archived_at            TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  row_version            INTEGER NOT NULL DEFAULT 1
);

-- Область прав: какие узлы дерева человеку доступны. Отдельной таблицей —
-- это связь «многие ко многим», а не поле.
CREATE TABLE user_scopes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  PRIMARY KEY (user_id, node_id)
);

-- ── Объекты: дерево предприятия ───────────────────────────────────────────
CREATE TABLE nodes (
  id                TEXT PRIMARY KEY,
  site_id           TEXT NOT NULL,
  -- Родитель внутри того же дерева. У организации его нет.
  parent_id         TEXT REFERENCES nodes(id) ON DELETE RESTRICT,
  kind              TEXT NOT NULL,
  name              TEXT NOT NULL,
  code              TEXT,
  elevation_m       REAL,
  note              TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  in_common_journal INTEGER NOT NULL DEFAULT 1,
  objects_pinned    INTEGER NOT NULL DEFAULT 0,
  archived_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  row_version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX nodes_parent ON nodes(parent_id);
CREATE INDEX nodes_site ON nodes(site_id);

-- Характеристики здания в части пожарной безопасности: одна строка на узел.
-- Своей таблицей, потому что бывают только у здания, а не у каждого узла.
CREATE TABLE building_profiles (
  node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  data    TEXT NOT NULL
);

CREATE TABLE rooms (
  id             TEXT PRIMARY KEY,
  site_id        TEXT NOT NULL,
  -- Помещение существует только внутри этажа и уходит вместе с ним.
  level_id       TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  number         TEXT,
  category       TEXT,
  category_basis TEXT,
  purpose        TEXT,
  fire_classes   TEXT,
  height_m       REAL,
  area_m2        REAL,
  has_suppression INTEGER NOT NULL DEFAULT 0,
  outline        TEXT,
  archived_at    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  row_version    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX rooms_level ON rooms(level_id);

-- ── Элементы СППЗ ─────────────────────────────────────────────────────────
CREATE TABLE objects (
  id                  TEXT PRIMARY KEY,
  site_id             TEXT NOT NULL,
  -- Где элемент числится. Узел не удаляют, пока в нём есть элементы.
  node_id             TEXT NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
  type_code           TEXT NOT NULL,
  reg_number          TEXT,
  model               TEXT,
  manufacturer        TEXT,
  serial_number       TEXT,
  commissioned_on     TEXT,
  service_life_years  INTEGER,
  service_life_months INTEGER,
  responsible         TEXT,
  -- Помещение: элемент может стоять и вне помещений, поэтому связь необязательна.
  room_id             TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  -- Место на плане. Пусто — элемент есть в журнале, но не размещён; у склада
  -- это обычное состояние.
  position_x          REAL,
  position_y          REAL,
  technical_state     TEXT NOT NULL,
  storage_section     TEXT,
  -- Прибор, к системе которого относится элемент, и место размещения комплекта.
  system_id           TEXT REFERENCES objects(id) ON DELETE SET NULL,
  placement_id        TEXT REFERENCES objects(id) ON DELETE SET NULL,
  note                TEXT,
  archived_at         TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  row_version         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX objects_node ON objects(node_id);
CREATE INDEX objects_type ON objects(type_code);
CREATE INDEX objects_system ON objects(system_id);
CREATE INDEX objects_room ON objects(room_id);

-- Карточка вида: огнетушителя, крана, прибора и прочих. Одна строка на пару
-- «элемент и вид характеристик»; вид назван, чтобы строку нельзя было прочесть
-- не тем разбором.
CREATE TABLE object_profiles (
  object_id TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,
  data      TEXT NOT NULL,
  PRIMARY KEY (object_id, kind)
);

-- ── История эксплуатации ──────────────────────────────────────────────────
-- Проверки, обслуживание, испытания. Не удаляется никогда: это доказательство
-- проведённых работ, и вывод элемента из обращения её не трогает.
CREATE TABLE maintenance_events (
  id                    TEXT PRIMARY KEY,
  site_id               TEXT NOT NULL,
  object_id             TEXT NOT NULL REFERENCES objects(id) ON DELETE RESTRICT,
  activity_code         TEXT NOT NULL,
  performed_on          TEXT NOT NULL,
  result                TEXT NOT NULL,
  defect                TEXT,
  executor              TEXT,
  note                  TEXT,
  group_id              TEXT,
  regulation_version_id TEXT,
  periodicity_id        TEXT,
  -- Составные части записи: чек-лист, измерения, акт, сведения об исполнителе
  -- и подпись. Их состав задаёт регламент, а не схема базы.
  checklist_json        TEXT,
  measurements_json     TEXT,
  inspection_act_json   TEXT,
  executor_details_json TEXT,
  external_evidence_json TEXT,
  signature_json        TEXT,
  -- Ни времени правки, ни версии записи: журнал эксплуатации не правят.
  created_at            TEXT NOT NULL
);
CREATE INDEX maintenance_object ON maintenance_events(object_id);
CREATE INDEX maintenance_date ON maintenance_events(performed_on);

-- ── Журнал изменений: кто и какое поле изменил ────────────────────────────
-- Внешнего ключа на изменённую запись нет намеренно: журнал переживает и
-- удаление узла, и вывод элемента из обращения — ради этого его и ведут.
CREATE TABLE change_log (
  id            TEXT PRIMARY KEY,
  at            TEXT NOT NULL,
  author_id     TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  author_role   TEXT NOT NULL,
  command       TEXT NOT NULL,
  action        TEXT NOT NULL,
  subject       TEXT NOT NULL,
  subject_id    TEXT NOT NULL,
  subject_title TEXT NOT NULL,
  node_id       TEXT,
  fields_json   TEXT NOT NULL
);
CREATE INDEX change_log_at ON change_log(at);
CREATE INDEX change_log_node ON change_log(node_id);
CREATE INDEX change_log_author ON change_log(author_id);

-- ── Журнал действий пользователей ─────────────────────────────────────────
-- Служебный след за тридцать дней. Имя и роль записаны снимком: человек
-- меняет должность и уходит, а запись должна и через месяц говорить, кем он
-- был тогда.
CREATE TABLE audit_events (
  id         TEXT PRIMARY KEY,
  at         TEXT NOT NULL,
  actor_id   TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  kind       TEXT NOT NULL,
  subject    TEXT,
  details    TEXT
);
CREATE INDEX audit_at ON audit_events(at);

-- ── Подложки планов ───────────────────────────────────────────────────────
CREATE TABLE backdrops (
  id               TEXT PRIMARY KEY,
  -- Узел может быть не выбран: чертёж принимают до того, как решают, к
  -- какому этажу он относится. Такие подложки в программе уже были, и терять
  -- их при переходе на базу нельзя.
  node_id          TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  source_hash      TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  source_kind      TEXT NOT NULL,
  page_number      INTEGER,
  dpi              INTEGER,
  rotation_deg     INTEGER NOT NULL DEFAULT 0,
  crop_json        TEXT,
  width_px         INTEGER NOT NULL,
  height_px        INTEGER NOT NULL,
  data             TEXT NOT NULL,
  -- Подложку не правят по полям: приняли другой чертёж — записали заново.
  created_at       TEXT NOT NULL
);
CREATE INDEX backdrops_node ON backdrops(node_id);

CREATE TABLE calibrations (
  backdrop_id TEXT PRIMARY KEY REFERENCES backdrops(id) ON DELETE CASCADE,
  data        TEXT NOT NULL
);

CREATE TABLE cleanups (
  backdrop_id TEXT PRIMARY KEY REFERENCES backdrops(id) ON DELETE CASCADE,
  data        TEXT NOT NULL
);

-- ── Настройки и регламенты ────────────────────────────────────────────────
-- Настройки — одна строка: их читают целиком и целиком же пишут.
CREATE TABLE settings (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);

CREATE TABLE regulations (
  id   TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX regulations_kind ON regulations(kind);
`;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: (db: Db) => db.exec(V1),
  },
  /*
   * Где человек работает — колонка `users.organization`.
   *
   * Добавляется переходом, а не правкой первой версии. Первая версия — это
   * история: свежая база проходит переходы по очереди, и колонка, вписанная и
   * туда и сюда, добавлялась бы дважды. А главное — у заказчика база уже
   * заведена и наполнена, и переписывать её описание задним числом нельзя:
   * переходы для того и нужны, чтобы существующая база доехала до новой формы
   * сама, ничего не потеряв.
   */
  {
    version: 2,
    up: (db: Db) => db.exec('ALTER TABLE users ADD COLUMN organization TEXT'),
  },
  /*
   * Подпись под заведением строки в журнал — колонка
   * `objects.registration_signature_json`.
   *
   * Заказчик: «при заведении нового огнетушителя или элемента... должна
   * ставиться ПЭП». До первой проверки под строкой журнала нет ни одной
   * записи, и показывать в графе ПЭП было нечего.
   *
   * Хранится рядом с самим оборудованием, а не отдельным списком: по 63-ФЗ
   * (статья 9 часть 1) подпись содержится в подписанном документе.
   *
   * Пусто у всего, что заведено раньше: подписи задним числом не бывает.
   */
  {
    version: 3,
    up: (db: Db) => db.exec('ALTER TABLE objects ADD COLUMN registration_signature_json TEXT'),
  },
];
