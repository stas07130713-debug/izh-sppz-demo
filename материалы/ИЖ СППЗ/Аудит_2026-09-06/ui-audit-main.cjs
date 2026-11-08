// Аудит_2026-09-06/ui-audit-main.ts
var import_electron3 = require("electron");
var import_promises7 = require("node:fs/promises");
var import_node_path5 = require("node:path");

// ../../../../Projects/izh-sppz/packages/desktop/src/main/ipc.ts
var import_promises6 = require("node:fs/promises");
var import_node_path4 = require("node:path");
var import_electron2 = require("electron");

// ../../../../Projects/izh-sppz/packages/contracts/src/result.ts
function ok(value2) {
  return { ok: true, value: value2 };
}
function err(code, message, details) {
  return { ok: false, error: details === void 0 ? { code, message } : { code, message, details } };
}
function describeUnknown(e) {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

// ../../../../Projects/izh-sppz/packages/contracts/src/settings.ts
var DEFAULT_APP_SETTINGS = {
  soonThresholdDays: 14,
  defaultExtinguisherCardFormat: "pdf",
  dashboardBlocks: [
    "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C-\u0432\u0441\u0435\u0433\u043E",
    "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C-\u043D\u043E\u0440\u043C\u0430",
    "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C-\u0441\u043A\u043E\u0440\u043E",
    "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C-\u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E",
    "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C-\u043D\u0435\u0442-\u0434\u0430\u043D\u043D\u044B\u0445",
    "\u0433\u0440\u0430\u0444\u0438\u043A-\u0441\u0438\u0441\u0442\u0435\u043C\u044B",
    "\u0433\u0440\u0430\u0444\u0438\u043A-\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435",
    "\u0433\u0440\u0430\u0444\u0438\u043A-\u043F\u043E-\u0432\u0438\u0434\u0430\u043C",
    "\u0441\u0440\u043E\u043A\u0438-\u0442\u043E"
  ],
  requestTemplates: [],
  customElements: [],
  elementIcons: {},
  elementTitles: {}
};

// ../../../../Projects/izh-sppz/packages/desktop/src/main/channels.ts
var CHANNELS = {
  openPlanFile: "file:open-plan",
  openJournalFile: "file:open-journal",
  /** Открыть ссылку в браузере системы: внутри программы внешним страницам не место. */
  openExternal: "shell:open-external",
  openMaintenanceDocument: "file:open-maintenance-document",
  exportJournal: "file:export-journal",
  openStoredDocument: "file:open-stored-document",
  saveStoredDocument: "file:save-stored-document",
  dataDir: "app:data-dir",
  historyState: "history:state",
  historyBegin: "history:begin",
  historyCommit: "history:commit",
  historyCancel: "history:cancel",
  historyUndo: "history:undo",
  historyRedo: "history:redo",
  storePut: "store:put",
  storeGet: "store:get",
  storeExists: "store:exists",
  backdropSave: "backdrop:save",
  backdropList: "backdrop:list",
  backdropGetById: "backdrop:get-by-id",
  backdropRemove: "backdrop:remove",
  calibrationSave: "calibration:save",
  calibrationGet: "calibration:get",
  cleanupSave: "cleanup:save",
  cleanupGet: "cleanup:get",
  cleanupRemove: "cleanup:remove",
  objectList: "object:list",
  objectListByNode: "object:list-by-node",
  objectGetById: "object:get-by-id",
  objectSave: "object:save",
  objectSaveMany: "object:save-many",
  settingsGet: "settings:get",
  settingsSave: "settings:save",
  maintenanceList: "maintenance:list",
  maintenanceListByObject: "maintenance:list-by-object",
  maintenanceSave: "maintenance:save",
  maintenanceSaveMany: "maintenance:save-many",
  regulationList: "regulation:list",
  regulationListVersions: "regulation:list-versions",
  regulationListDocuments: "regulation:list-documents",
  regulationListTemplates: "regulation:list-templates",
  regulationSave: "regulation:save",
  regulationSaveVersions: "regulation:save-versions",
  regulationSaveDocument: "regulation:save-document",
  regulationSaveTemplate: "regulation:save-template",
  usersList: "users:list",
  usersRemove: "users:remove",
  /* Журнал действий пользователей: служебный след за тридцать дней. */
  auditList: "audit:list",
  auditAppend: "audit:append",
  auditPrune: "audit:prune",
  usersResetAll: "users:reset-all",
  usersFindByLogin: "users:find-by-login",
  usersGetById: "users:get-by-id",
  usersSave: "users:save",
  passwordHash: "password:hash",
  passwordVerify: "password:verify",
  /* Ключи простой электронной подписи (63-ФЗ, вариант с ключом у подписывающего). */
  signingKeyCreate: "signing-key:create",
  signingKeyRekey: "signing-key:rekey",
  signingKeySign: "signing-key:sign",
  signingKeyVerify: "signing-key:verify",
  contentSha256: "content:sha256",
  roomList: "room:list",
  roomListByLevel: "room:list-by-level",
  roomGetById: "room:get-by-id",
  roomSave: "room:save",
  treeList: "tree:list",
  treeGetById: "tree:get-by-id",
  treeSave: "tree:save"
};

// ../../../../Projects/izh-sppz/packages/desktop/src/main/file-store.ts
var import_node_crypto = require("node:crypto");
var import_promises2 = require("node:fs/promises");
var import_node_path2 = require("node:path");

// ../../../../Projects/izh-sppz/packages/desktop/src/main/storage-paths.ts
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var import_electron = require("electron");
function dataDir() {
  return (0, import_node_path.join)(import_electron.app.getPath("userData"), "data");
}
function filesDir() {
  return (0, import_node_path.join)(dataDir(), "files");
}
function backdropsFile() {
  return (0, import_node_path.join)(dataDir(), "backdrops.json");
}
function treeFile() {
  return (0, import_node_path.join)(dataDir(), "tree.json");
}
function objectsFile() {
  return (0, import_node_path.join)(dataDir(), "objects.json");
}
function roomsFile() {
  return (0, import_node_path.join)(dataDir(), "rooms.json");
}
function maintenanceFile() {
  return (0, import_node_path.join)(dataDir(), "maintenance.json");
}
function settingsFile() {
  return (0, import_node_path.join)(dataDir(), "settings.json");
}
function regulationsFile() {
  return (0, import_node_path.join)(dataDir(), "regulations.json");
}
function usersFile() {
  return (0, import_node_path.join)(dataDir(), "users.json");
}
function auditFile() {
  return (0, import_node_path.join)(dataDir(), "audit.json");
}
function historyFile() {
  return (0, import_node_path.join)(dataDir(), "history.json");
}
async function ensureDataDirs() {
  await (0, import_promises.mkdir)(filesDir(), { recursive: true });
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/file-store.ts
function sha256Hex(bytes) {
  return (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
}
function fileNameFor(hash, extension) {
  return `${hash}.${extension}`;
}
async function storedFilePath(hash) {
  try {
    const names = await (0, import_promises2.readdir)(filesDir());
    const prefix = `${hash}.`;
    const name = names.find((item) => item.startsWith(prefix)) ?? null;
    return name === null ? null : (0, import_node_path2.join)(filesDir(), name);
  } catch {
    return null;
  }
}
function createFileStore() {
  return {
    async put(bytes, extension) {
      try {
        await ensureDataDirs();
        const hash = sha256Hex(bytes);
        const path = (0, import_node_path2.join)(filesDir(), fileNameFor(hash, extension));
        const existing = await storedFilePath(hash);
        if (existing === null) {
          await (0, import_promises2.writeFile)(path, bytes);
        }
        return ok(hash);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0444\u0430\u0439\u043B.", describeUnknown(e));
      }
    },
    async get(hash) {
      try {
        const path = await storedFilePath(hash);
        if (path === null) return err("FILE_NOT_FOUND", "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435.");
        const buffer = await (0, import_promises2.readFile)(path);
        return ok(new Uint8Array(buffer));
      } catch (e) {
        return err("FILE_READ_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B.", describeUnknown(e));
      }
    },
    async exists(hash) {
      try {
        return ok(await storedFilePath(hash) !== null);
      } catch (e) {
        return err("FILE_READ_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043D\u0430\u043B\u0438\u0447\u0438\u0435 \u0444\u0430\u0439\u043B\u0430.", describeUnknown(e));
      }
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/backdrop-repository.ts
var import_promises3 = require("node:fs/promises");
var EMPTY_STATE = { backdrops: [], calibrations: [], cleanups: [] };
async function readState() {
  try {
    const text = await (0, import_promises3.readFile)(backdropsFile(), "utf8");
    const parsed = JSON.parse(text);
    return {
      // Привязка подложки к узлу дерева появилась позже: у прежних записей её нет,
      // и они остаются общими, пока пользователь не загрузит план заново.
      backdrops: (parsed.backdrops ?? []).map((backdrop) => ({
        ...backdrop,
        nodeId: backdrop.nodeId ?? null
      })),
      calibrations: parsed.calibrations ?? [],
      cleanups: parsed.cleanups ?? []
    };
  } catch {
    return EMPTY_STATE;
  }
}
async function writeState(state) {
  await ensureDataDirs();
  await (0, import_promises3.writeFile)(backdropsFile(), JSON.stringify(state, null, 2), "utf8");
}
function createBackdropRepository() {
  return {
    async save(backdrop) {
      try {
        const state = await readState();
        const others = state.backdrops.filter((b) => b.id !== backdrop.id);
        await writeState({ ...state, backdrops: [...others, backdrop] });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0435.", describeUnknown(e));
      }
    },
    async list() {
      const state = await readState();
      const sorted = [...state.backdrops].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return ok(sorted);
    },
    async getById(id) {
      const state = await readState();
      const found = state.backdrops.find((b) => b.id === id);
      if (found === void 0) return err("NOT_FOUND", "\u041F\u043E\u0434\u043B\u043E\u0436\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.");
      return ok(found);
    },
    async remove(id) {
      try {
        const state = await readState();
        await writeState({
          backdrops: state.backdrops.filter((b) => b.id !== id),
          calibrations: state.calibrations.filter((c) => c.backdropId !== id),
          cleanups: state.cleanups.filter((c) => c.backdropId !== id)
        });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0443.", describeUnknown(e));
      }
    },
    async saveCleanup(cleanup) {
      try {
        const state = await readState();
        const others = state.cleanups.filter((c) => c.backdropId !== cleanup.backdropId);
        await writeState({ ...state, cleanups: [...others, cleanup] });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043E\u0447\u0438\u0441\u0442\u043A\u0443 \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0438.", describeUnknown(e));
      }
    },
    async getCleanup(id) {
      const state = await readState();
      return ok(state.cleanups.find((c) => c.backdropId === id) ?? null);
    },
    async removeCleanup(id) {
      try {
        const state = await readState();
        await writeState({ ...state, cleanups: state.cleanups.filter((c) => c.backdropId !== id) });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u0447\u0438\u0441\u0442\u043A\u0443.", describeUnknown(e));
      }
    },
    async saveCalibration(calibration) {
      try {
        const state = await readState();
        const others = state.calibrations.filter((c) => c.backdropId !== calibration.backdropId);
        await writeState({ ...state, calibrations: [...others, calibration] });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431.", describeUnknown(e));
      }
    },
    async getCalibration(id) {
      const state = await readState();
      return ok(state.calibrations.find((c) => c.backdropId === id) ?? null);
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/json-store.ts
var import_promises4 = require("node:fs/promises");
var import_node_path3 = require("node:path");
function isMissingFile(error) {
  return typeof error === "object" && error !== null && error.code === "ENOENT";
}
async function readJsonCollection(path, key) {
  let text;
  try {
    text = await (0, import_promises4.readFile)(path, "utf8");
  } catch (e) {
    if (isMissingFile(e)) return ok([]);
    return err("FILE_READ_FAILED", `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445: ${path}`, describeUnknown(e));
  }
  if (text.trim() === "") return ok([]);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return err(
      "FILE_CORRUPTED",
      `\u0424\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u0438 \u043D\u0435 \u0431\u044B\u043B \u0438\u0437\u043C\u0435\u043D\u0451\u043D: ${path}. \u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0435 \u0435\u0433\u043E \u0438\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438.`,
      describeUnknown(e)
    );
  }
  if (parsed === null || typeof parsed !== "object") {
    return err("FILE_CORRUPTED", `\u0424\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u0438 \u043D\u0435 \u0431\u044B\u043B \u0438\u0437\u043C\u0435\u043D\u0451\u043D: ${path}.`);
  }
  const value2 = parsed[key];
  if (value2 === void 0) return ok([]);
  if (!Array.isArray(value2)) {
    return err("FILE_CORRUPTED", `\u0424\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u0438 \u043D\u0435 \u0431\u044B\u043B \u0438\u0437\u043C\u0435\u043D\u0451\u043D: ${path}.`);
  }
  return ok(value2);
}
async function readJsonRecord(path) {
  let text;
  try {
    text = await (0, import_promises4.readFile)(path, "utf8");
  } catch (e) {
    if (isMissingFile(e)) return ok(null);
    return err("FILE_READ_FAILED", `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445: ${path}`, describeUnknown(e));
  }
  if (text.trim() === "") return ok(null);
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") {
      return err("FILE_CORRUPTED", `\u0424\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u0438 \u043D\u0435 \u0431\u044B\u043B \u0438\u0437\u043C\u0435\u043D\u0451\u043D: ${path}.`);
    }
    return ok(parsed);
  } catch (e) {
    return err(
      "FILE_CORRUPTED",
      `\u0424\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u0438 \u043D\u0435 \u0431\u044B\u043B \u0438\u0437\u043C\u0435\u043D\u0451\u043D: ${path}. \u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0435 \u0435\u0433\u043E \u0438\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438.`,
      describeUnknown(e)
    );
  }
}
async function writeJsonAtomically(path, value2) {
  await (0, import_promises4.mkdir)((0, import_node_path3.dirname)(path), { recursive: true });
  const temporary = `${path}.tmp`;
  try {
    const handle = await (0, import_promises4.open)(temporary, "w");
    try {
      await handle.writeFile(JSON.stringify(value2, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await (0, import_promises4.rename)(temporary, path);
    return ok(void 0);
  } catch (e) {
    try {
      await (0, import_promises4.unlink)(temporary);
    } catch {
    }
    return err("FILE_WRITE_FAILED", `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0444\u0430\u0439\u043B \u0434\u0430\u043D\u043D\u044B\u0445: ${path}`, describeUnknown(e));
  }
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/maintenance-repository.ts
function normalizeChecklistAnswer(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const answer = raw;
  if (typeof answer.item !== "string") return null;
  const completed = "\u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E";
  const notCompleted = "\u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E";
  const completedWithRemark = "\u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E \u0441 \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0435\u043C";
  const notChecked = "\u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E";
  const notApplicable = "\u043D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F";
  const result = answer.result === completed || answer.result === notCompleted || answer.result === completedWithRemark || answer.result === notChecked || answer.result === notApplicable ? answer.result : answer.ok === true ? completed : notCompleted;
  const legacyDefect = answer.defect ?? answer.remark;
  return {
    ...raw,
    item: answer.item,
    result,
    defect: typeof legacyDefect === "string" && legacyDefect.trim() !== "" ? legacyDefect : null
  };
}
function normalizeEvent(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const event = raw;
  if (typeof event.id !== "string" || typeof event.siteId !== "string" || typeof event.objectId !== "string" || typeof event.activityCode !== "string" || typeof event.performedOn !== "string" || typeof event.result !== "string" || typeof event.createdAt !== "string") {
    return null;
  }
  return {
    ...event,
    checklist: (event.checklist ?? []).map(normalizeChecklistAnswer).filter((answer) => answer !== null),
    defect: typeof event.defect === "string" ? event.defect : null,
    executor: typeof event.executor === "string" ? event.executor : null,
    note: typeof event.note === "string" ? event.note : null
  };
}
async function readEvents() {
  const raw = await readJsonCollection(maintenanceFile(), "events");
  if (!raw.ok) return raw;
  return ok(
    raw.value.map(normalizeEvent).filter((event) => event !== null)
  );
}
function createMaintenanceRepository() {
  return {
    async list() {
      return readEvents();
    },
    async listByObject(objectId2) {
      const events = await readEvents();
      if (!events.ok) return events;
      return ok(events.value.filter((event) => event.objectId === objectId2));
    },
    async save(event) {
      const events = await readEvents();
      if (!events.ok) return events;
      const others = events.value.filter((existing) => existing.id !== event.id);
      return writeJsonAtomically(maintenanceFile(), { events: [...others, event] });
    },
    async saveMany(newEvents) {
      const events = await readEvents();
      if (!events.ok) return events;
      const incoming = new Set(newEvents.map((event) => event.id));
      const others = events.value.filter((existing) => !incoming.has(existing.id));
      return writeJsonAtomically(maintenanceFile(), { events: [...others, ...newEvents] });
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/object-repository.ts
async function readObjects() {
  const raw = await readJsonCollection(objectsFile(), "objects");
  if (!raw.ok) return raw;
  return ok(
    raw.value.map((object) => {
      const withServiceLife = {
        ...object,
        serviceLifeYears: object.serviceLifeYears ?? (object.serviceLifeMonths === void 0 || object.serviceLifeMonths === null ? null : Math.round(object.serviceLifeMonths / 12))
      };
      if (object.extinguisherProfile === null || object.extinguisherProfile === void 0) return withServiceLife;
      const legacy = object.extinguisherProfile;
      return {
        ...withServiceLife,
        extinguisherProfile: {
          ...legacy,
          lastRechargeOn: legacy.lastRechargeOn ?? null
        }
      };
    })
  );
}
function createObjectRepository() {
  return {
    async list() {
      return readObjects();
    },
    async listByNode(nodeId) {
      const objects = await readObjects();
      if (!objects.ok) return objects;
      return ok(objects.value.filter((object) => object.nodeId === nodeId));
    },
    async getById(id) {
      const objects = await readObjects();
      if (!objects.ok) return objects;
      const found = objects.value.find((object) => object.id === id);
      if (found === void 0) return err("NOT_FOUND", "\u041E\u0431\u044A\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.");
      return ok(found);
    },
    async save(object) {
      const objects = await readObjects();
      if (!objects.ok) return objects;
      const others = objects.value.filter((existing) => existing.id !== object.id);
      return writeJsonAtomically(objectsFile(), { objects: [...others, object] });
    },
    async saveMany(incoming) {
      const objects = await readObjects();
      if (!objects.ok) return objects;
      const ids = new Set(incoming.map((object) => object.id));
      const others = objects.value.filter((existing) => !ids.has(existing.id));
      return writeJsonAtomically(objectsFile(), { objects: [...others, ...incoming] });
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/room-repository.ts
function normalize(room) {
  return {
    ...room,
    purpose: room.purpose ?? null,
    fireClasses: room.fireClasses ?? [],
    hasSuppression: room.hasSuppression ?? false
  };
}
async function readRooms() {
  const raw = await readJsonCollection(roomsFile(), "rooms");
  if (!raw.ok) return raw;
  return ok(raw.value.map(normalize));
}
function createRoomRepository() {
  return {
    async listByLevel(levelId) {
      const rooms = await readRooms();
      if (!rooms.ok) return rooms;
      return ok(rooms.value.filter((room) => room.levelId === levelId));
    },
    async list() {
      return readRooms();
    },
    async getById(id) {
      const rooms = await readRooms();
      if (!rooms.ok) return rooms;
      const found = rooms.value.find((room) => room.id === id);
      if (found === void 0) return err("NOT_FOUND", "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E.");
      return ok(found);
    },
    async save(room) {
      const rooms = await readRooms();
      if (!rooms.ok) return rooms;
      const others = rooms.value.filter((existing) => existing.id !== room.id);
      return writeJsonAtomically(roomsFile(), { rooms: [...others, room] });
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/user-repository.ts
async function readUsers() {
  const raw = await readJsonCollection(usersFile(), "users");
  if (!raw.ok) return raw;
  return ok(raw.value);
}
function createUserRepository() {
  return {
    async list() {
      return readUsers();
    },
    async getById(id) {
      const users = await readUsers();
      if (!users.ok) return users;
      const found = users.value.find((user) => user.id === id);
      if (found === void 0) return err("NOT_FOUND", "\u0423\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.");
      return ok(found);
    },
    async findByLogin(login) {
      const users = await readUsers();
      if (!users.ok) return users;
      const wanted = login.trim().toLocaleLowerCase("ru");
      return ok(users.value.find((user) => user.login.toLocaleLowerCase("ru") === wanted) ?? null);
    },
    async save(user) {
      const users = await readUsers();
      if (!users.ok) return users;
      const others = users.value.filter((existing) => existing.id !== user.id);
      return writeJsonAtomically(usersFile(), { users: [...others, user] });
    },
    async remove(id) {
      const users = await readUsers();
      if (!users.ok) return users;
      const kept = users.value.filter((existing) => existing.id !== id);
      return writeJsonAtomically(usersFile(), { users: kept });
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/password-hasher.ts
var import_node_crypto2 = require("node:crypto");
var COST_N = 16384;
var BLOCK_SIZE_R = 8;
var PARALLEL_P = 1;
var KEY_LENGTH = 32;
var SALT_LENGTH = 16;
function derive(password, salt, digest) {
  return new Promise((resolve, reject) => {
    (0, import_node_crypto2.scrypt)(
      password.normalize("NFKC"),
      salt,
      digest.keyLength,
      { N: digest.costN, r: digest.blockSizeR, p: digest.parallelP, maxmem: 64 * 1024 * 1024 },
      (error, key) => error === null ? resolve(key) : reject(error)
    );
  });
}
function createPasswordHasher() {
  return {
    async hash(password) {
      const salt = (0, import_node_crypto2.randomBytes)(SALT_LENGTH);
      const shape = {
        algorithm: "scrypt",
        costN: COST_N,
        blockSizeR: BLOCK_SIZE_R,
        parallelP: PARALLEL_P,
        keyLength: KEY_LENGTH
      };
      try {
        const key = await derive(password, salt, shape);
        return ok({ ...shape, salt: salt.toString("base64"), digest: key.toString("base64") });
      } catch (error) {
        return err("INTERNAL", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043E\u0442\u043F\u0435\u0447\u0430\u0442\u043E\u043A \u043F\u0430\u0440\u043E\u043B\u044F.", String(error));
      }
    },
    async verify(password, digest) {
      try {
        const salt = Buffer.from(digest.salt, "base64");
        const expected = Buffer.from(digest.digest, "base64");
        const actual = await derive(password, salt, digest);
        if (actual.length !== expected.length) return ok(false);
        return ok((0, import_node_crypto2.timingSafeEqual)(actual, expected));
      } catch (error) {
        return err("INTERNAL", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C.", String(error));
      }
    },
    async sha256Hex(text) {
      return ok((0, import_node_crypto2.createHash)("sha256").update(text, "utf8").digest("hex"));
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/signing-keys.ts
var import_node_crypto3 = require("node:crypto");
var COST_N2 = 16384;
var BLOCK_SIZE_R2 = 8;
var PARALLEL_P2 = 1;
var KEY_LENGTH2 = 32;
var SALT_LENGTH2 = 16;
var IV_LENGTH = 12;
function deriveKey(password, salt) {
  return new Promise((resolve, reject) => {
    (0, import_node_crypto3.scrypt)(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH2,
      { N: COST_N2, r: BLOCK_SIZE_R2, p: PARALLEL_P2, maxmem: 64 * 1024 * 1024 },
      (error, key) => error === null ? resolve(key) : reject(error)
    );
  });
}
async function lock(privateKeyDer, publicKeyDer, password, generation) {
  const salt = (0, import_node_crypto3.randomBytes)(SALT_LENGTH2);
  const iv = (0, import_node_crypto3.randomBytes)(IV_LENGTH);
  const secret = await deriveKey(password, salt);
  const cipher = (0, import_node_crypto3.createCipheriv)("aes-256-gcm", secret, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyDer), cipher.final()]);
  return {
    algorithm: "ed25519",
    publicKey: publicKeyDer.toString("base64"),
    encryptedPrivateKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    salt: salt.toString("base64"),
    generation
  };
}
async function unlock(key, password) {
  const secret = await deriveKey(password, Buffer.from(key.salt, "base64"));
  const decipher = (0, import_node_crypto3.createDecipheriv)("aes-256-gcm", secret, Buffer.from(key.iv, "base64"));
  decipher.setAuthTag(Buffer.from(key.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(key.encryptedPrivateKey, "base64")),
    decipher.final()
  ]);
}
function createSigningKeyService() {
  return {
    async create(password, generation) {
      try {
        const pair = (0, import_node_crypto3.generateKeyPairSync)("ed25519");
        const privateDer = pair.privateKey.export({ type: "pkcs8", format: "der" });
        const publicDer = pair.publicKey.export({ type: "spki", format: "der" });
        return ok(await lock(privateDer, publicDer, password, generation));
      } catch {
        return err("INTERNAL", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0432\u0435\u0441\u0442\u0438 \u043A\u043B\u044E\u0447 \u043F\u043E\u0434\u043F\u0438\u0441\u0438.");
      }
    },
    async rekey(key, oldPassword, newPassword, generation) {
      let privateDer;
      try {
        privateDer = await unlock(key, oldPassword);
      } catch {
        return err("FORBIDDEN", "\u041F\u0440\u0435\u0436\u043D\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u043D\u0435 \u043F\u043E\u0434\u043E\u0448\u0451\u043B: \u043A\u043B\u044E\u0447 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u043E\u0441\u0442\u0430\u043B\u0441\u044F \u043F\u0440\u0435\u0436\u043D\u0438\u043C.");
      }
      try {
        const publicDer = Buffer.from(key.publicKey, "base64");
        return ok(await lock(privateDer, publicDer, newPassword, generation));
      } catch {
        return err("INTERNAL", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0448\u0438\u0444\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u043B\u044E\u0447 \u043F\u043E\u0434\u043F\u0438\u0441\u0438.");
      }
    },
    async sign(key, password, contentHash) {
      let privateDer;
      try {
        privateDer = await unlock(key, password);
      } catch {
        return err("FORBIDDEN", "\u041F\u0430\u0440\u043E\u043B\u044C \u043D\u0435 \u043F\u043E\u0434\u043E\u0448\u0451\u043B: \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043D\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0430.");
      }
      try {
        const privateKey = (0, import_node_crypto3.createPrivateKey)({ key: privateDer, format: "der", type: "pkcs8" });
        const value2 = (0, import_node_crypto3.sign)(null, Buffer.from(contentHash, "utf8"), privateKey);
        return ok({ algorithm: "ed25519", value: value2.toString("base64"), publicKey: key.publicKey });
      } catch {
        return err("INTERNAL", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u044C.");
      }
    },
    async verify(signature, contentHash) {
      try {
        const publicKey = (0, import_node_crypto3.createPublicKey)({
          key: Buffer.from(signature.publicKey, "base64"),
          format: "der",
          type: "spki"
        });
        const good = (0, import_node_crypto3.verify)(
          null,
          Buffer.from(contentHash, "utf8"),
          publicKey,
          Buffer.from(signature.value, "base64")
        );
        return ok(good);
      } catch {
        return ok(false);
      }
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/audit-repository.ts
async function readEvents2() {
  const raw = await readJsonCollection(auditFile(), "audit");
  if (!raw.ok) return raw;
  return ok(raw.value);
}
function createAuditRepository() {
  return {
    async list() {
      return readEvents2();
    },
    async append(event) {
      const current = await readEvents2();
      if (!current.ok) return current;
      return writeJsonAtomically(auditFile(), { audit: [...current.value, event] });
    },
    async prune(olderThan) {
      const current = await readEvents2();
      if (!current.ok) return current;
      const kept = current.value.filter((event) => event.at >= olderThan);
      const removed = current.value.length - kept.length;
      if (removed === 0) return ok(0);
      const saved = await writeJsonAtomically(auditFile(), { audit: kept });
      if (!saved.ok) return saved;
      return ok(removed);
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/regulation-repository.ts
var EMPTY = { regulations: [], versions: [], documents: [], templates: [] };
function readArray(value2) {
  return Array.isArray(value2) ? value2 : [];
}
async function readStore() {
  const raw = await readJsonRecord(regulationsFile());
  if (!raw.ok) return raw;
  if (raw.value === null) return ok(EMPTY);
  return ok({
    regulations: readArray(raw.value.regulations),
    versions: readArray(raw.value.versions),
    documents: readArray(raw.value.documents),
    templates: readArray(raw.value.templates)
  });
}
function merge(existing, incoming) {
  const ids = new Set(incoming.map((item) => item.id));
  return [...existing.filter((item) => !ids.has(item.id)), ...incoming];
}
function createRegulationRepository() {
  const update = async (change) => {
    const store = await readStore();
    if (!store.ok) return store;
    return writeJsonAtomically(regulationsFile(), change(store.value));
  };
  return {
    async listRegulations() {
      const store = await readStore();
      return store.ok ? ok(store.value.regulations) : store;
    },
    async listVersions() {
      const store = await readStore();
      return store.ok ? ok(store.value.versions) : store;
    },
    async listDocuments() {
      const store = await readStore();
      return store.ok ? ok(store.value.documents) : store;
    },
    async listTemplates() {
      const store = await readStore();
      return store.ok ? ok(store.value.templates) : store;
    },
    async saveRegulation(regulation) {
      return update((store) => ({ ...store, regulations: merge(store.regulations, [regulation]) }));
    },
    async saveVersions(versions) {
      return update((store) => ({ ...store, versions: merge(store.versions, versions) }));
    },
    async saveDocument(document) {
      return update((store) => ({ ...store, documents: merge(store.documents, [document]) }));
    },
    async saveTemplate(template) {
      return update((store) => ({ ...store, templates: merge(store.templates, [template]) }));
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/settings-repository.ts
function createSettingsRepository() {
  return {
    async get() {
      const raw = await readJsonRecord(settingsFile());
      if (!raw.ok) return raw;
      if (raw.value === null) return ok(DEFAULT_APP_SETTINGS);
      return ok({ ...DEFAULT_APP_SETTINGS, ...raw.value });
    },
    async save(settings) {
      return writeJsonAtomically(settingsFile(), settings);
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/tree-repository.ts
var LEGACY_KINDS = {
  site: "organization",
  technics: "storage",
  reserve: "storage",
  warehouse: "storage",
  custom: "storage",
  territory: "building"
};
function migrateBuildingProfile(raw) {
  if (raw.kind !== "building" || raw.building === null || raw.building === void 0) return null;
  return {
    functionalClasses: raw.building.functionalClasses ?? null,
    fireResistance: raw.building.fireResistance ?? null,
    constructiveClass: raw.building.constructiveClass ?? null,
    floorsAbove: raw.building.floorsAbove ?? null,
    floorsBelow: raw.building.floorsBelow ?? null,
    heightM: raw.building.heightM ?? null,
    builtAreaM2: raw.building.builtAreaM2 ?? null,
    volumeM3: raw.building.volumeM3 ?? null,
    explosionCategory: raw.building.explosionCategory ?? null,
    categoryBasis: raw.building.categoryBasis ?? null,
    fireClasses: raw.building.fireClasses ?? null,
    attic: raw.building.attic ?? null,
    mansardFloor: raw.building.mansardFloor ?? null,
    evacuationExits: raw.building.evacuationExits ?? null,
    builtYear: raw.building.builtYear ?? null,
    responsible: raw.building.responsible ?? null
  };
}
function migrate(raw) {
  const kind = LEGACY_KINDS[raw.kind] ?? raw.kind;
  return {
    ...raw,
    kind,
    // Поля, появившиеся позже: у старых записей их нет.
    building: migrateBuildingProfile(raw),
    inCommonJournal: raw.inCommonJournal ?? true,
    objectsPinned: raw.objectsPinned ?? false,
    elevationM: kind === "level" ? raw.elevationM : null
  };
}
async function readNodes() {
  const raw = await readJsonCollection(treeFile(), "nodes");
  if (!raw.ok) return raw;
  return ok(raw.value.map(migrate));
}
function createTreeRepository() {
  return {
    async list() {
      return readNodes();
    },
    async getById(id) {
      const nodes = await readNodes();
      if (!nodes.ok) return nodes;
      const found = nodes.value.find((node) => node.id === id);
      if (found === void 0) return err("NOT_FOUND", "\u0423\u0437\u0435\u043B \u0434\u0435\u0440\u0435\u0432\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.");
      return ok(found);
    },
    async save(node) {
      const nodes = await readNodes();
      if (!nodes.ok) return nodes;
      const others = nodes.value.filter((existing) => existing.id !== node.id);
      return writeJsonAtomically(treeFile(), { nodes: [...others, node] });
    }
  };
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/command-history.ts
var LIMIT = 10;
var CommandHistory = class {
  adapters;
  path;
  undo = [];
  redo = [];
  active = /* @__PURE__ */ new Map();
  loaded = false;
  /**
   * Путь к файлу истории передаётся явно, а не берётся из Electron: так класс
   * можно проверить тестами. `null` — история живёт только в памяти и не
   * переживает перезапуск.
   */
  constructor(adapters, path = null) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.kind, adapter]));
    this.path = path;
  }
  async begin(label) {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const id = crypto.randomUUID();
    this.active.set(id, { id, label: label.trim() || "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0445", createdAt: (/* @__PURE__ */ new Date()).toISOString(), changes: [] });
    return ok({ id });
  }
  async record(actionId, kind, id, before, after) {
    if (actionId === null || sameValue(before, after)) return;
    if (kind === "maintenance") return;
    const action = this.active.get(actionId);
    if (action === void 0) return;
    const previous = action.changes.find((change) => change.kind === kind && change.id === id);
    const nextChange = {
      kind,
      id,
      before: previous?.before ?? cloneValue(before),
      after: cloneValue(after)
    };
    const changes = [
      ...action.changes.filter((change) => !(change.kind === kind && change.id === id)),
      nextChange
    ];
    this.active.set(actionId, { ...action, changes });
  }
  async commit(actionId) {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const action = this.active.get(actionId);
    if (action === void 0) return ok(this.state());
    this.active.delete(actionId);
    if (action.changes.length === 0) return ok(this.state());
    this.undo.push(action);
    if (this.undo.length > LIMIT) this.undo.shift();
    this.redo = [];
    const saved = await this.save();
    if (!saved.ok) return saved;
    return ok(this.state());
  }
  async cancel(actionId) {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    this.active.delete(actionId);
    return ok(this.state());
  }
  async undoLast() {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const action = this.undo.pop();
    if (action === void 0) return err("INVALID_ARGUMENT", "\u041E\u0442\u043A\u0430\u0442\u044B\u0432\u0430\u0442\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0447\u0435\u0433\u043E.");
    const applied = await this.apply(action, "undo");
    if (!applied.ok) return applied;
    this.redo.push(action);
    if (this.redo.length > LIMIT) this.redo.shift();
    const saved = await this.save();
    if (!saved.ok) return saved;
    return ok(this.state());
  }
  async redoLast() {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const action = this.redo.pop();
    if (action === void 0) return err("INVALID_ARGUMENT", "\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0447\u0435\u0433\u043E.");
    const applied = await this.apply(action, "redo");
    if (!applied.ok) return applied;
    this.undo.push(action);
    if (this.undo.length > LIMIT) this.undo.shift();
    const saved = await this.save();
    if (!saved.ok) return saved;
    return ok(this.state());
  }
  async getState() {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(this.state());
  }
  async apply(action, direction) {
    const changes = direction === "undo" ? [...action.changes].reverse() : action.changes;
    for (const change of changes) {
      const adapter = this.adapters.get(change.kind);
      if (adapter === void 0) return err("INTERNAL", `\u041D\u0435\u0442 \u0430\u0434\u0430\u043F\u0442\u0435\u0440\u0430 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0434\u043B\u044F ${change.kind}.`);
      const value2 = direction === "undo" ? change.before : change.after;
      const result = value2 === null ? await adapter.remove(change.id) : await adapter.put(value2);
      if (!result.ok) return result;
    }
    return ok(void 0);
  }
  state() {
    return {
      canUndo: this.undo.length > 0,
      canRedo: this.redo.length > 0,
      undoDepth: this.undo.length,
      redoDepth: this.redo.length
    };
  }
  async load() {
    if (this.loaded) return ok(void 0);
    this.loaded = true;
    if (this.path === null) return ok(void 0);
    const stored = await readJsonRecord(this.path);
    if (!stored.ok || stored.value === null) return ok(void 0);
    const parsed = stored.value;
    this.undo = [...parsed.undo ?? []].slice(-LIMIT);
    this.redo = [...parsed.redo ?? []].slice(-LIMIT);
    return ok(void 0);
  }
  async save() {
    if (this.path === null) return ok(void 0);
    return writeJsonAtomically(this.path, { undo: this.undo, redo: this.redo });
  }
};
function cloneValue(value2) {
  if (value2 === null) return null;
  return JSON.parse(JSON.stringify(value2));
}
function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/history-adapters.ts
var import_promises5 = require("node:fs/promises");
var EMPTY_BACKDROPS = { backdrops: [], calibrations: [], cleanups: [] };
function createHistoryAdapters() {
  return [
    collectionAdapter("tree", treeFile, "nodes"),
    collectionAdapter("room", roomsFile, "rooms"),
    collectionAdapter("object", objectsFile, "objects"),
    appendOnlyAdapter("maintenance", maintenanceFile, "events"),
    settingsAdapter(),
    backdropAdapter("backdrop", "backdrops", "id"),
    backdropAdapter("calibration", "calibrations", "backdropId"),
    backdropAdapter("cleanup", "cleanups", "backdropId")
  ];
}
function appendOnlyAdapter(kind, pathFactory, key) {
  const readable = collectionAdapter(kind, pathFactory, key);
  return {
    kind,
    get: readable.get,
    async put() {
      return err("INVALID_ARGUMENT", "\u0417\u0430\u043F\u0438\u0441\u0438 \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F: \u0432\u043D\u0435\u0441\u0438\u0442\u0435 \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0449\u0443\u044E \u0437\u0430\u043F\u0438\u0441\u044C.");
    },
    async remove() {
      return err("INVALID_ARGUMENT", "\u0417\u0430\u043F\u0438\u0441\u0438 \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0435 \u0443\u0434\u0430\u043B\u044F\u044E\u0442\u0441\u044F: \u0432\u043D\u0435\u0441\u0438\u0442\u0435 \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0449\u0443\u044E \u0437\u0430\u043F\u0438\u0441\u044C.");
    }
  };
}
function collectionAdapter(kind, pathFactory, key) {
  return {
    kind,
    async get(id) {
      try {
        const state = await readJsonRecord2(pathFactory(), { [key]: [] });
        return ok(readArray2(state[key]).find((item) => objectId(item) === id) ?? null);
      } catch (e) {
        return err("FILE_READ_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u0434\u043B\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u0438.", describeUnknown(e));
      }
    },
    async put(value2) {
      try {
        const id = objectId(value2);
        if (id === null) return err("INVALID_ARGUMENT", "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C \u0431\u0435\u0437 id.");
        const state = await readJsonRecord2(pathFactory(), { [key]: [] });
        await writeJsonRecord(pathFactory(), { ...state, [key]: replaceById(readArray2(state[key]), id, value2) });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u0438\u0437 \u0438\u0441\u0442\u043E\u0440\u0438\u0438.", describeUnknown(e));
      }
    },
    async remove(id) {
      try {
        const state = await readJsonRecord2(pathFactory(), { [key]: [] });
        await writeJsonRecord(pathFactory(), { ...state, [key]: readArray2(state[key]).filter((item) => objectId(item) !== id) });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0430\u0442\u0438\u0442\u044C \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438.", describeUnknown(e));
      }
    }
  };
}
function settingsAdapter() {
  return {
    kind: "settings",
    async get() {
      try {
        return ok(await readJsonRecord2(settingsFile(), DEFAULT_APP_SETTINGS));
      } catch {
        return ok(DEFAULT_APP_SETTINGS);
      }
    },
    async put(value2) {
      try {
        await writeJsonRecord(settingsFile(), value2);
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438.", describeUnknown(e));
      }
    },
    async remove() {
      try {
        await unlinkIfExists(settingsFile());
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0430\u0442\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438.", describeUnknown(e));
      }
    }
  };
}
function backdropAdapter(kind, collection, idKey) {
  return {
    kind,
    async get(id) {
      try {
        const state = await readBackdropState();
        return ok(state[collection].find((item) => fieldValue(item, idKey) === id) ?? null);
      } catch (e) {
        return err("FILE_READ_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0438 \u0434\u043B\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u0438.", describeUnknown(e));
      }
    },
    async put(value2) {
      try {
        const id = fieldValue(value2, idKey);
        if (id === null) return err("INVALID_ARGUMENT", "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C \u0431\u0435\u0437 id.");
        const state = await readBackdropState();
        await writeBackdropState({ ...state, [collection]: replaceByField(state[collection], idKey, id, value2) });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0443 \u0438\u0437 \u0438\u0441\u0442\u043E\u0440\u0438\u0438.", describeUnknown(e));
      }
    },
    async remove(id) {
      try {
        const state = await readBackdropState();
        await writeBackdropState({ ...state, [collection]: state[collection].filter((item) => fieldValue(item, idKey) !== id) });
        return ok(void 0);
      } catch (e) {
        return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0430\u0442\u0438\u0442\u044C \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0443.", describeUnknown(e));
      }
    }
  };
}
async function readJsonRecord2(path, fallback) {
  try {
    const text = await (0, import_promises5.readFile)(path, "utf8");
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : asRecord(fallback);
  } catch {
    return asRecord(fallback);
  }
}
async function writeJsonRecord(path, value2) {
  await ensureDataDirs();
  await (0, import_promises5.writeFile)(path, JSON.stringify(value2, null, 2), "utf8");
}
async function readBackdropState() {
  const state = await readJsonRecord2(backdropsFile(), EMPTY_BACKDROPS);
  return {
    backdrops: readArray2(state.backdrops),
    calibrations: readArray2(state.calibrations),
    cleanups: readArray2(state.cleanups)
  };
}
async function writeBackdropState(state) {
  await writeJsonRecord(backdropsFile(), state);
}
function asRecord(value2) {
  return value2 !== null && typeof value2 === "object" && !Array.isArray(value2) ? value2 : {};
}
function readArray2(value2) {
  return Array.isArray(value2) ? value2 : [];
}
function objectId(value2) {
  return fieldValue(value2, "id");
}
function fieldValue(value2, field) {
  if (value2 === null || typeof value2 !== "object") return null;
  const raw = value2[field];
  return typeof raw === "string" ? raw : null;
}
function replaceById(items, id, value2) {
  return replaceByField(items, "id", id, value2);
}
function replaceByField(items, field, id, value2) {
  return [...items.filter((item) => fieldValue(item, field) !== id), value2];
}
async function unlinkIfExists(path) {
  try {
    await (0, import_promises5.unlink)(path);
  } catch {
  }
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/xlsx-styles.ts
var STYLE_INDEX = {
  \u043E\u0431\u044B\u0447\u043D\u0430\u044F: 0,
  \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A: 1,
  \u0448\u0430\u043F\u043A\u0430: 2,
  \u0434\u0430\u043D\u043D\u044B\u0435: 3
};
var STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

// ../../../../Projects/izh-sppz/packages/desktop/src/main/xlsx-writer.ts
var encoder = new TextEncoder();
function xml(value2) {
  return value2.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function columnName(index) {
  let value2 = index + 1;
  let name = "";
  while (value2 > 0) {
    value2 -= 1;
    name = String.fromCharCode(65 + value2 % 26) + name;
    value2 = Math.floor(value2 / 26);
  }
  return name;
}
function sheetName(name, taken) {
  const clean2 = name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "\u041B\u0438\u0441\u0442";
  if (!taken.has(clean2)) return clean2;
  for (let index = 2; index < 100; index += 1) {
    const suffix = ` (${index})`;
    const candidate = clean2.slice(0, 31 - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
  return clean2.slice(0, 28) + "...";
}
function colsXml(widths) {
  if (widths.length === 0) return "";
  const cols = widths.map((width, index) => {
    const value2 = Math.min(70, Math.max(8, Math.round(width * 10) / 10));
    return `<col min="${index + 1}" max="${index + 1}" width="${value2}" customWidth="1"/>`;
  }).join("");
  return `<cols>${cols}</cols>`;
}
function freezeXml(frozenRows) {
  if (frozenRows <= 0) return '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  return `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${frozenRows}" topLeftCell="A${frozenRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
}
function sheetXml(sheet) {
  const body = sheet.rows.map((row, rowIndex) => {
    const kind = sheet.rowKinds[rowIndex] ?? "\u0434\u0430\u043D\u043D\u044B\u0435";
    const style = STYLE_INDEX[kind];
    const cells = row.map((value2, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value2)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + freezeXml(sheet.frozenRows) + '<sheetFormatPr defaultRowHeight="14.5"/>' + colsXml(sheet.columnWidths) + `<sheetData>${body}</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
var CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value2 = index;
  for (let bit = 0; bit < 8; bit += 1) value2 = (value2 & 1) === 1 ? 3988292384 ^ value2 >>> 1 : value2 >>> 1;
  return value2 >>> 0;
});
function crc32(bytes) {
  let crc = 4294967295;
  for (const byte of bytes) crc = crc >>> 8 ^ (CRC_TABLE[(crc ^ byte) & 255] ?? 0);
  return (crc ^ 4294967295) >>> 0;
}
function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function localHeader(name, data, crc) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 67324752, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 2048, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  return concat([header, name, data]);
}
function centralHeader(name, data, crc, offset) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 33639248, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 2048, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, name.length, true);
  view.setUint32(42, offset, true);
  return concat([header, name]);
}
function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const local = localHeader(name, data, crc);
    locals.push(local);
    centrals.push(centralHeader(name, data, crc, offset));
    offset += local.length;
  }
  const central = concat(centrals);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 101010256, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, central.length, true);
  view.setUint32(16, offset, true);
  return concat([...locals, central, end]);
}
function createXlsx(sheets) {
  const source = sheets.length === 0 ? [{ name: "\u0416\u0443\u0440\u043D\u0430\u043B \u0421\u041F\u041F\u0417", rows: [["\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445"]], rowKinds: ["\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A"], columnWidths: [24], frozenRows: 0 }] : sheets;
  const taken = /* @__PURE__ */ new Set();
  const named = source.map((sheet) => {
    const name = sheetName(sheet.name, taken);
    taken.add(name);
    return { sheet, name };
  });
  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + named.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + "</Types>";
  const workbook = '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + named.map(({ name }, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("") + "</sheets></workbook>";
  const workbookRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + named.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("") + `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return zip([
    { name: "[Content_Types].xml", text: contentTypes },
    {
      name: "_rels/.rels",
      text: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    },
    { name: "xl/workbook.xml", text: workbook },
    { name: "xl/_rels/workbook.xml.rels", text: workbookRels },
    { name: "xl/styles.xml", text: STYLES_XML },
    ...named.map(({ sheet }, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      text: sheetXml(sheet)
    }))
  ]);
}

// ../../../../Projects/izh-sppz/packages/desktop/src/main/ipc.ts
function registerIpcHandlers() {
  const fileStore = createFileStore();
  const backdrops = createBackdropRepository();
  const tree = createTreeRepository();
  const rooms = createRoomRepository();
  const users = createUserRepository();
  const hasher = createPasswordHasher();
  const objects = createObjectRepository();
  const maintenance = createMaintenanceRepository();
  const settings = createSettingsRepository();
  const regulations = createRegulationRepository();
  const history = new CommandHistory(createHistoryAdapters(), historyFile());
  import_electron2.ipcMain.handle(
    CHANNELS.openPlanFile,
    async () => pickAndReadFile("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043B \u043F\u043B\u0430\u043D\u0430, \u0447\u0435\u0440\u0442\u0435\u0436\u0430 \u0438\u043B\u0438 \u0441\u043D\u0438\u043C\u043A\u0430", [
      {
        name: "\u041F\u043B\u0430\u043D\u044B, \u0447\u0435\u0440\u0442\u0435\u0436\u0438 \u0438 \u0441\u043D\u0438\u043C\u043A\u0438",
        extensions: [
          "pdf",
          "svg",
          "dxf",
          "json",
          "png",
          "jpg",
          "jpeg",
          "gif",
          "bmp",
          "webp",
          "tif",
          "tiff"
        ]
      },
      // Тип определяется по содержимому, а не по расширению: чертежи присылают
      // и без расширения, и с чужим. Поэтому «все файлы» остаются доступны.
      { name: "\u0412\u0441\u0435 \u0444\u0430\u0439\u043B\u044B", extensions: ["*"] }
    ])
  );
  import_electron2.ipcMain.handle(
    CHANNELS.openJournalFile,
    async () => pickAndReadFile("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043B \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E \u0436\u0443\u0440\u043D\u0430\u043B\u0430", [
      { name: "\u0422\u0430\u0431\u043B\u0438\u0446\u044B", extensions: ["xlsx", "xlsm"] },
      { name: "\u0412\u0441\u0435 \u0444\u0430\u0439\u043B\u044B", extensions: ["*"] }
    ])
  );
  import_electron2.ipcMain.handle(
    CHANNELS.openMaintenanceDocument,
    async () => pickAndReadFile("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442, \u0430\u043A\u0442 \u0438\u043B\u0438 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B", [
      { name: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B", extensions: ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"] },
      { name: "\u0412\u0441\u0435 \u0444\u0430\u0439\u043B\u044B", extensions: ["*"] }
    ])
  );
  import_electron2.ipcMain.handle(
    CHANNELS.exportJournal,
    async (_event, request) => exportJournal(request)
  );
  import_electron2.ipcMain.handle(
    CHANNELS.openStoredDocument,
    async (_event, hash) => openStoredDocument(hash)
  );
  import_electron2.ipcMain.handle(
    CHANNELS.saveStoredDocument,
    async (_event, hash, fileName) => saveStoredDocument(hash, fileName)
  );
  import_electron2.ipcMain.handle(CHANNELS.dataDir, async () => ok(dataDir()));
  import_electron2.ipcMain.handle(CHANNELS.historyState, async () => history.getState());
  import_electron2.ipcMain.handle(CHANNELS.openExternal, async (_event, url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return err("INVALID_ARGUMENT", `\u042D\u0442\u043E \u043D\u0435 \u0441\u0441\u044B\u043B\u043A\u0430: ${url}`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return err("INVALID_ARGUMENT", `\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0435\u0431-\u0441\u0441\u044B\u043B\u043A\u0438, \u0430 \u0437\u0434\u0435\u0441\u044C ${parsed.protocol}`);
    }
    await import_electron2.shell.openExternal(parsed.href);
    return ok(void 0);
  });
  import_electron2.ipcMain.handle(CHANNELS.historyBegin, async (_event, label) => history.begin(label));
  import_electron2.ipcMain.handle(CHANNELS.historyCommit, async (_event, id) => history.commit(id));
  import_electron2.ipcMain.handle(CHANNELS.historyCancel, async (_event, id) => history.cancel(id));
  import_electron2.ipcMain.handle(CHANNELS.historyUndo, async () => history.undoLast());
  import_electron2.ipcMain.handle(CHANNELS.historyRedo, async () => history.redoLast());
  import_electron2.ipcMain.handle(
    CHANNELS.storePut,
    async (_event, bytes, extension) => fileStore.put(bytes, extension)
  );
  import_electron2.ipcMain.handle(CHANNELS.storeGet, async (_event, hash) => fileStore.get(hash));
  import_electron2.ipcMain.handle(CHANNELS.storeExists, async (_event, hash) => fileStore.exists(hash));
  import_electron2.ipcMain.handle(CHANNELS.backdropSave, async (_event, backdrop, actionId) => {
    const before = await nullable(backdrops.getById(backdrop.id));
    const saved = await backdrops.save(backdrop);
    if (saved.ok) await history.record(actionId ?? null, "backdrop", backdrop.id, before, backdrop);
    return saved;
  });
  import_electron2.ipcMain.handle(CHANNELS.backdropList, async () => backdrops.list());
  import_electron2.ipcMain.handle(CHANNELS.backdropGetById, async (_event, id) => backdrops.getById(id));
  import_electron2.ipcMain.handle(CHANNELS.backdropRemove, async (_event, id, actionId) => {
    const before = await nullable(backdrops.getById(id));
    const calibration = await nullable(backdrops.getCalibration(id));
    const cleanup = await nullable(backdrops.getCleanup(id));
    const removed = await backdrops.remove(id);
    if (removed.ok) {
      await history.record(actionId ?? null, "backdrop", id, before, null);
      await history.record(actionId ?? null, "calibration", id, calibration, null);
      await history.record(actionId ?? null, "cleanup", id, cleanup, null);
    }
    return removed;
  });
  import_electron2.ipcMain.handle(CHANNELS.calibrationSave, async (_event, calibration, actionId) => {
    const before = await nullable(backdrops.getCalibration(calibration.backdropId));
    const saved = await backdrops.saveCalibration(calibration);
    if (saved.ok) await history.record(actionId ?? null, "calibration", calibration.backdropId, before, calibration);
    return saved;
  });
  import_electron2.ipcMain.handle(CHANNELS.calibrationGet, async (_event, id) => backdrops.getCalibration(id));
  import_electron2.ipcMain.handle(CHANNELS.cleanupSave, async (_event, cleanup, actionId) => {
    const before = await nullable(backdrops.getCleanup(cleanup.backdropId));
    const saved = await backdrops.saveCleanup(cleanup);
    if (saved.ok) await history.record(actionId ?? null, "cleanup", cleanup.backdropId, before, cleanup);
    return saved;
  });
  import_electron2.ipcMain.handle(CHANNELS.cleanupGet, async (_event, id) => backdrops.getCleanup(id));
  import_electron2.ipcMain.handle(CHANNELS.cleanupRemove, async (_event, id, actionId) => {
    const before = await nullable(backdrops.getCleanup(id));
    const removed = await backdrops.removeCleanup(id);
    if (removed.ok) await history.record(actionId ?? null, "cleanup", id, before, null);
    return removed;
  });
  import_electron2.ipcMain.handle(CHANNELS.treeList, async () => tree.list());
  import_electron2.ipcMain.handle(CHANNELS.treeGetById, async (_event, id) => tree.getById(id));
  import_electron2.ipcMain.handle(CHANNELS.treeSave, async (_event, node, actionId) => {
    const before = await nullable(tree.getById(node.id));
    const saved = await tree.save(node);
    if (saved.ok) await history.record(actionId ?? null, "tree", node.id, before, node);
    return saved;
  });
  import_electron2.ipcMain.handle(CHANNELS.objectList, async () => objects.list());
  import_electron2.ipcMain.handle(CHANNELS.objectListByNode, async (_event, nodeId) => objects.listByNode(nodeId));
  import_electron2.ipcMain.handle(CHANNELS.objectGetById, async (_event, id) => objects.getById(id));
  import_electron2.ipcMain.handle(CHANNELS.objectSave, async (_event, object, actionId) => {
    const before = await nullable(objects.getById(object.id));
    const saved = await objects.save(object);
    if (saved.ok) await history.record(actionId ?? null, "object", object.id, before, object);
    return saved;
  });
  import_electron2.ipcMain.handle(CHANNELS.objectSaveMany, async (_event, list, actionId) => {
    const before = /* @__PURE__ */ new Map();
    for (const object of list) before.set(object.id, await nullable(objects.getById(object.id)));
    const saved = await objects.saveMany(list);
    if (saved.ok) {
      for (const object of list) {
        await history.record(actionId ?? null, "object", object.id, before.get(object.id) ?? null, object);
      }
    }
    return saved;
  });
  import_electron2.ipcMain.handle(CHANNELS.maintenanceList, async () => maintenance.list());
  import_electron2.ipcMain.handle(
    CHANNELS.maintenanceListByObject,
    async (_event, objectId2) => maintenance.listByObject(objectId2)
  );
  import_electron2.ipcMain.handle(CHANNELS.maintenanceSave, async (_event, event, actionId) => {
    const before = await findMaintenance(maintenance, event.id);
    const saved = await maintenance.save(event);
    if (saved.ok) await history.record(actionId ?? null, "maintenance", event.id, before, event);
    return saved;
  });
  import_electron2.ipcMain.handle(
    CHANNELS.maintenanceSaveMany,
    async (_event, list, actionId) => {
      const saved = await maintenance.saveMany(list);
      if (saved.ok) {
        for (const event of list) {
          await history.record(actionId ?? null, "maintenance", event.id, null, event);
        }
      }
      return saved;
    }
  );
  import_electron2.ipcMain.handle(CHANNELS.regulationList, async () => regulations.listRegulations());
  import_electron2.ipcMain.handle(CHANNELS.regulationListVersions, async () => regulations.listVersions());
  import_electron2.ipcMain.handle(CHANNELS.regulationListDocuments, async () => regulations.listDocuments());
  import_electron2.ipcMain.handle(CHANNELS.regulationListTemplates, async () => regulations.listTemplates());
  import_electron2.ipcMain.handle(CHANNELS.regulationSave, async (_event, value2) => regulations.saveRegulation(value2));
  import_electron2.ipcMain.handle(
    CHANNELS.regulationSaveVersions,
    async (_event, list) => regulations.saveVersions(list)
  );
  import_electron2.ipcMain.handle(
    CHANNELS.regulationSaveDocument,
    async (_event, value2) => regulations.saveDocument(value2)
  );
  import_electron2.ipcMain.handle(
    CHANNELS.regulationSaveTemplate,
    async (_event, value2) => regulations.saveTemplate(value2)
  );
  import_electron2.ipcMain.handle(CHANNELS.settingsGet, async () => settings.get());
  import_electron2.ipcMain.handle(CHANNELS.settingsSave, async (_event, value2, actionId) => {
    const before = await nullable(settings.get());
    const saved = await settings.save(value2);
    if (saved.ok) await history.record(actionId ?? null, "settings", "settings", before, value2);
    return saved;
  });
  import_electron2.ipcMain.handle(CHANNELS.usersList, async () => users.list());
  import_electron2.ipcMain.handle(CHANNELS.usersRemove, async (_event, id) => users.remove(id));
  const audit = createAuditRepository();
  import_electron2.ipcMain.handle(CHANNELS.auditList, async () => audit.list());
  import_electron2.ipcMain.handle(CHANNELS.auditAppend, async (_event, entry) => audit.append(entry));
  import_electron2.ipcMain.handle(CHANNELS.auditPrune, async (_event, olderThan) => audit.prune(olderThan));
  import_electron2.ipcMain.handle(CHANNELS.usersResetAll, async () => {
    const from = usersFile();
    try {
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/gu, "-");
      await (0, import_promises6.rename)(from, `${from}.\u0441\u043D\u044F\u0442\u043E-${stamp}`);
      return ok(void 0);
    } catch (error) {
      const code = error.code;
      if (code === "ENOENT") return ok(void 0);
      return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0431\u0440\u0430\u0442\u044C \u0443\u0447\u0451\u0442\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438.", describeUnknown(error));
    }
  });
  import_electron2.ipcMain.handle(CHANNELS.usersGetById, async (_event, id) => users.getById(id));
  import_electron2.ipcMain.handle(CHANNELS.usersFindByLogin, async (_event, login) => users.findByLogin(login));
  import_electron2.ipcMain.handle(CHANNELS.usersSave, async (_event, user) => users.save(user));
  import_electron2.ipcMain.handle(CHANNELS.passwordHash, async (_event, password) => hasher.hash(password));
  import_electron2.ipcMain.handle(CHANNELS.passwordVerify, async (_event, password, digest) => hasher.verify(password, digest));
  const signingKeys = createSigningKeyService();
  import_electron2.ipcMain.handle(CHANNELS.signingKeyCreate, async (_event, password, generation) => signingKeys.create(password, generation));
  import_electron2.ipcMain.handle(CHANNELS.signingKeyRekey, async (_event, key, oldPassword, newPassword, generation) => signingKeys.rekey(key, oldPassword, newPassword, generation));
  import_electron2.ipcMain.handle(CHANNELS.signingKeySign, async (_event, key, password, contentHash) => signingKeys.sign(key, password, contentHash));
  import_electron2.ipcMain.handle(CHANNELS.signingKeyVerify, async (_event, signature, contentHash) => signingKeys.verify(signature, contentHash));
  import_electron2.ipcMain.handle(CHANNELS.contentSha256, async (_event, text) => hasher.sha256Hex(text));
  import_electron2.ipcMain.handle(CHANNELS.roomList, async () => rooms.list());
  import_electron2.ipcMain.handle(CHANNELS.roomListByLevel, async (_event, levelId) => rooms.listByLevel(levelId));
  import_electron2.ipcMain.handle(CHANNELS.roomGetById, async (_event, id) => rooms.getById(id));
  import_electron2.ipcMain.handle(CHANNELS.roomSave, async (_event, room, actionId) => {
    const before = await nullable(rooms.getById(room.id));
    const saved = await rooms.save(room);
    if (saved.ok) await history.record(actionId ?? null, "room", room.id, before, room);
    return saved;
  });
}
async function nullable(promise) {
  const result = await promise;
  return result.ok ? result.value : null;
}
async function findMaintenance(repository, id) {
  const list = await repository.list();
  if (!list.ok) return null;
  return list.value.find((event) => event.id === id) ?? null;
}
async function exportJournal(request) {
  try {
    if (request.format === "print") {
      const printWindow = await createPrintWindow(request.html);
      await new Promise((resolve) => {
        printWindow.webContents.print({ silent: false, printBackground: true }, () => {
          printWindow.close();
          resolve();
        });
      });
      return ok({ savedPath: null });
    }
    const extension = request.format === "excel" ? "xlsx" : request.format === "word" ? "doc" : "pdf";
    const label = request.format === "excel" ? "Excel" : request.format === "word" ? "Word" : "PDF";
    const parent = import_electron2.BrowserWindow.getFocusedWindow();
    const options = {
      title: `\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0432 ${label}`,
      defaultPath: `${(0, import_node_path4.basename)(request.suggestedName, ".json")}.${extension}`,
      filters: [{ name: label, extensions: [extension] }]
    };
    const picked = parent === null ? await import_electron2.dialog.showSaveDialog(options) : await import_electron2.dialog.showSaveDialog(parent, options);
    if (picked.canceled || picked.filePath === void 0) return ok({ savedPath: null });
    if (request.format === "excel") {
      await (0, import_promises6.writeFile)(picked.filePath, createXlsx(request.sheets));
    } else if (request.format === "word") {
      await (0, import_promises6.writeFile)(picked.filePath, request.wordHtml ?? request.html, "utf8");
    } else {
      const printWindow = await createPrintWindow(request.html);
      const bytes = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: "A4", landscape: request.landscape ?? true });
      printWindow.close();
      await (0, import_promises6.writeFile)(picked.filePath, bytes);
    }
    return ok({ savedPath: picked.filePath });
  } catch (e) {
    return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.", describeUnknown(e));
  }
}
async function createPrintWindow(html) {
  const window = new import_electron2.BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return window;
}
async function openStoredDocument(hash) {
  try {
    const path = await storedFilePath(hash);
    if (path === null) return err("FILE_NOT_FOUND", "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435.");
    const error = await import_electron2.shell.openPath(path);
    return error === "" ? ok(void 0) : err("FILE_READ_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.", error);
  } catch (e) {
    return err("FILE_READ_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.", describeUnknown(e));
  }
}
async function saveStoredDocument(hash, fileName) {
  try {
    const path = await storedFilePath(hash);
    if (path === null) return err("FILE_NOT_FOUND", "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435.");
    const parent = import_electron2.BrowserWindow.getFocusedWindow();
    const picked = parent === null ? await import_electron2.dialog.showSaveDialog({ title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u043E\u043F\u0438\u044E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", defaultPath: fileName }) : await import_electron2.dialog.showSaveDialog(parent, { title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u043E\u043F\u0438\u044E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", defaultPath: fileName });
    if (picked.canceled || picked.filePath === void 0) return ok({ savedPath: null });
    await (0, import_promises6.copyFile)(path, picked.filePath);
    return ok({ savedPath: picked.filePath });
  } catch (e) {
    return err("FILE_WRITE_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u043E\u043F\u0438\u044E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430.", describeUnknown(e));
  }
}
async function pickAndReadFile(title, filters) {
  const window = import_electron2.BrowserWindow.getFocusedWindow();
  const options = { title, properties: ["openFile"], filters: [...filters] };
  const picked = window === null ? await import_electron2.dialog.showOpenDialog(options) : await import_electron2.dialog.showOpenDialog(window, options);
  if (picked.canceled) return ok(null);
  const path = picked.filePaths[0];
  if (path === void 0) return ok(null);
  try {
    const buffer = await (0, import_promises6.readFile)(path);
    return ok({ fileName: (0, import_node_path4.basename)(path), bytes: new Uint8Array(buffer) });
  } catch (e) {
    return err("FILE_READ_FAILED", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0444\u0430\u0439\u043B.", describeUnknown(e));
  }
}

// ../../../../Projects/izh-sppz/packages/core/src/object-tree/tree-rules.ts
var NODE_KIND_RULES = [
  {
    kind: "organization",
    title: "\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F",
    allowedParents: [],
    planKind: "none",
    hasElevation: false,
    hasBuildingProfile: false,
    hint: "\u041F\u0440\u0435\u0434\u043F\u0440\u0438\u044F\u0442\u0438\u0435 \u0438\u043B\u0438 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F. \u041A\u043E\u0440\u0435\u043D\u044C \u0434\u0435\u0440\u0435\u0432\u0430."
  },
  {
    kind: "shop",
    title: "\u0426\u0435\u0445",
    allowedParents: ["organization"],
    planKind: "none",
    hasElevation: false,
    hasBuildingProfile: false,
    hint: "\u0413\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u0437\u0434\u0430\u043D\u0438\u0439. \u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D: \u0437\u0434\u0430\u043D\u0438\u0435 \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u0432\u0435\u0441\u0442\u0438 \u043F\u0440\u044F\u043C\u043E \u0432 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438."
  },
  {
    kind: "building",
    title: "\u0417\u0434\u0430\u043D\u0438\u0435",
    allowedParents: ["organization", "shop"],
    planKind: "general",
    hasElevation: false,
    hasBuildingProfile: true,
    hint: "\u0417\u0434\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435. \u0415\u0433\u043E \u0440\u0430\u0431\u043E\u0447\u0430\u044F \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u2014 \u0433\u0435\u043D\u043F\u043B\u0430\u043D \u043E\u0431\u044A\u0435\u043A\u0442\u0430: \u0433\u0438\u0434\u0440\u0430\u043D\u0442\u044B, \u043D\u0430\u0440\u0443\u0436\u043D\u044B\u0435 \u043B\u0435\u0441\u0442\u043D\u0438\u0446\u044B, \u043C\u0435\u0441\u0442\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0442\u0435\u0445\u043D\u0438\u043A\u0438."
  },
  {
    kind: "level",
    title: "\u042D\u0442\u0430\u0436 (\u043E\u0442\u043C\u0435\u0442\u043A\u0430)",
    allowedParents: ["building"],
    planKind: "floor",
    hasElevation: true,
    hasBuildingProfile: false,
    hint: "\u042D\u0442\u0430\u0436 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u0442\u043A\u0430 \u0441\u043E \u0441\u0432\u043E\u0438\u043C \u043F\u043E\u044D\u0442\u0430\u0436\u043D\u044B\u043C \u043F\u043B\u0430\u043D\u043E\u043C \u0438 \u0436\u0443\u0440\u043D\u0430\u043B\u043E\u043C \u0441\u0438\u0441\u0442\u0435\u043C \u0437\u0430\u0449\u0438\u0442\u044B \u044D\u0442\u0430\u0436\u0430."
  },
  {
    kind: "storage",
    title: "\u0421\u043A\u043B\u0430\u0434",
    allowedParents: ["building"],
    planKind: "storage",
    hasElevation: false,
    hasBuildingProfile: false,
    hint: "\u0417\u0430\u043F\u0430\u0441\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435, \u0441\u043D\u044F\u0442\u043E\u0435 \u043D\u0430 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0443, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0447\u0438\u0441\u043B\u044F\u0449\u0435\u0435\u0441\u044F \u0437\u0430 \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0442\u0435\u0445\u043D\u0438\u043A\u043E\u0439: \u0437\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043A\u043B\u0430\u0434 \u0441 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435\u043C \u043C\u0430\u0448\u0438\u043D\u044B."
  }
];
function ruleFor(kind) {
  const found = NODE_KIND_RULES.find((rule) => rule.kind === kind);
  if (found === void 0) throw new Error(`\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0432\u0438\u0434 \u0443\u0437\u043B\u0430: ${kind}`);
  return found;
}
function canContain(parentKind, childKind) {
  return ruleFor(childKind).allowedParents.includes(parentKind);
}

// ../../../../Projects/izh-sppz/packages/core/src/object-tree/tree-shape.ts
function pathToNode(nodes, id) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path = [];
  let current = byId.get(id);
  while (current !== void 0 && path.length <= nodes.length) {
    path.unshift(current);
    current = current.parentId === null ? void 0 : byId.get(current.parentId);
  }
  return path;
}

// ../../../../Projects/izh-sppz/packages/core/src/objects/element-families.ts
var ELEMENT_FAMILIES = [
  {
    parent: "extinguisher",
    members: [
      "extinguisher-water",
      "extinguisher-foam",
      "extinguisher-emulsion",
      "extinguisher-powder",
      "extinguisher-co2",
      "extinguisher-halon",
      "extinguisher-bantl"
    ]
  },
  {
    parent: "fire-detector",
    members: [
      "smoke-detector",
      "heat-detector",
      "flame-detector",
      "combined-detector",
      "gas-detector",
      "aspiration-detector"
    ]
  },
  {
    parent: "sounder",
    members: ["sounder-audible", "sounder-speech", "sounder-light", "sounder-combined"]
  },
  {
    parent: "fire-suppression-system",
    members: [
      "aup-sprinkler",
      "aup-drencher",
      "aup-sprinkler-drencher",
      "aup-mist",
      "aup-foam",
      "aup-gas",
      "aup-powder",
      "aup-aerosol",
      "aup-combined",
      "aup-robotic",
      "sprinkler",
      "powder-module",
      "gas-module"
    ]
  },
  {
    parent: "autonomous-suppression",
    members: [
      "suppression-powder",
      "suppression-gas",
      "suppression-aerosol",
      "suppression-water",
      "suppression-mist"
    ]
  },
  {
    parent: "smoke-valve",
    members: ["damper-fire", "damper-smoke", "damper-dual", "damper-pressure"]
  },
  {
    parent: "smoke-fan",
    members: ["fan-exhaust", "fan-supply"]
  },
  {
    parent: "self-rescuer",
    members: ["self-rescuer-filter", "self-rescuer-isolating"]
  },
  {
    parent: "water-reservoir",
    members: ["water-pond", "water-tank", "water-natural"]
  },
  {
    parent: "outdoor-cabinet",
    members: [
      "fire-board-a",
      "fire-board-v",
      "fire-board-e",
      "fire-board-sh",
      "fire-board-mobile",
      "outdoor-cabinet-box"
    ]
  }
];
var FIRE_DETECTOR_TYPES = ELEMENT_FAMILIES.find((family) => family.parent === "fire-detector")?.members ?? [];

// ../../../../Projects/izh-sppz/packages/core/src/rules/npa-requirements.ts
var SPZ_BASE_TYPES = [
  "smoke-detector",
  "heat-detector",
  "flame-detector",
  "fire-detector",
  "manual-call-point",
  "control-panel",
  "sounder",
  "powder-module",
  "gas-module",
  "fire-suppression-system",
  "smoke-valve",
  "smoke-fan",
  "sprinkler",
  "pump-station"
];
var SPZ_SYSTEM_TYPES = [.../* @__PURE__ */ new Set([
  ...SPZ_BASE_TYPES,
  ...ELEMENT_FAMILIES.filter((family) => SPZ_BASE_TYPES.includes(family.parent)).flatMap((family) => family.members)
])];

// ../../../../Projects/izh-sppz/packages/core/src/rules/suppression-rules.ts
var BY_PASSPORT = "\u0432\u0438\u0434 \u0440\u0430\u0431\u043E\u0442 \u0438 \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u043D\u043E\u0441\u0442\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u044E\u0442\u0441\u044F \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u043E\u043C \u0438\u0437\u0434\u0435\u043B\u0438\u044F \u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0435\u0439";
var MPP_OSMOTR = {
  activityCode: "module-osmotr",
  title: "\u0415\u0436\u0435\u043A\u0432\u0430\u0440\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0441\u043C\u043E\u0442\u0440 \u043C\u043E\u0434\u0443\u043B\u044F",
  periodicityMonths: 3,
  checklist: [
    { text: "\u0426\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u043C\u0435\u043C\u0431\u0440\u0430\u043D\u044B, \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0432\u0430\u044E\u0449\u0435\u0439 \u043D\u0430\u0441\u0430\u0434\u043E\u043A-\u0440\u0430\u0441\u043F\u044B\u043B\u0438\u0442\u0435\u043B\u044C", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041D\u0430\u043B\u0438\u0447\u0438\u0435 \u0437\u0430\u0437\u0435\u043C\u043B\u0435\u043D\u0438\u044F \u043C\u043E\u0434\u0443\u043B\u044F", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041A\u043E\u0440\u043F\u0443\u0441 \u0431\u0435\u0437 \u0442\u0440\u0435\u0449\u0438\u043D, \u043F\u0440\u043E\u043A\u043E\u043B\u043E\u0432 \u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u043E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435 \u0432\u043D\u0435\u0441\u0435\u043D\u0430 \u043D\u0430 \u043A\u043E\u0440\u043F\u0443\u0441 \u0438 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: `\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u041C\u041F\u041F \xAB\u0422\u0443\u043D\u0433\u0443\u0441\xBB, \u043F\u043F. 7.1 \u0438 7.5 \u2014 1 \u0440\u0430\u0437 \u0432 \u043A\u0432\u0430\u0440\u0442\u0430\u043B \u0432\u043D\u0435\u0448\u043D\u0438\u043C \u043E\u0441\u043C\u043E\u0442\u0440\u043E\u043C; ${BY_PASSPORT}`,
  needsVerification: true
};
var MPP_PUSK = {
  activityCode: "module-pusk",
  title: "\u041E\u0441\u043C\u043E\u0442\u0440 \u0443\u0437\u043B\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430",
  periodicityMonths: 3,
  checklist: [
    { text: "\u041D\u0430\u0434\u0451\u0436\u043D\u043E\u0441\u0442\u044C \u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F \u0443\u0437\u043B\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u043D\u0430 \u043C\u043E\u0434\u0443\u043B\u0435", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041D\u0430\u0434\u0451\u0436\u043D\u043E\u0441\u0442\u044C \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043E\u0432 \u044D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0439", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043F\u044B\u043B\u0438, \u0433\u0440\u044F\u0437\u0438 \u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u043D\u0430 \u043A\u043E\u0440\u043F\u0443\u0441\u0435 \u0438 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430\u0445", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: `\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u041C\u041F\u041F \xAB\u0422\u0443\u043D\u0433\u0443\u0441\xBB, \u043F. 7.2 \u2014 \u043E\u0441\u043C\u043E\u0442\u0440 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0433\u043E \u0443\u0437\u043B\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430; ${BY_PASSPORT}`,
  needsVerification: true
};
var MGP_MESYAC = {
  activityCode: "module-osmotr",
  title: "\u0415\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u044B\u0439 \u043E\u0441\u043C\u043E\u0442\u0440 (\u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 1)",
  periodicityMonths: 1,
  checklist: [
    { text: "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 \u0441\u043E\u0441\u0442\u0430\u0432\u043D\u044B\u0445 \u0447\u0430\u0441\u0442\u0435\u0439 \u043C\u043E\u0434\u0443\u043B\u044F", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041D\u0430\u043B\u0438\u0447\u0438\u0435 \u043F\u043B\u043E\u043C\u0431", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041D\u0430\u043B\u0438\u0447\u0438\u0435 \u0447\u0435\u043A\u0438 \u043D\u0430 \u0440\u0443\u0447\u043D\u043E\u043C \u043F\u0443\u0441\u043A\u0435", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u043C\u043E\u043D\u0442\u0430\u0436\u043D\u044B\u0445 \u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0439", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u043E \u043C\u0430\u043D\u043E\u043C\u0435\u0442\u0440\u0443 \u0432 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "pressure-mpa" }
  ],
  ndReference: `\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u041C\u0413\u041F \xAB\u0410\u0422\u0410\u041A\u0410\xBB, \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 1 \u2014 \u0435\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E; ${BY_PASSPORT}`,
  needsVerification: true
};
var MGP_KVARTAL = {
  activityCode: "module-kvartal",
  title: "\u0415\u0436\u0435\u043A\u0432\u0430\u0440\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 (\u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 2)",
  periodicityMonths: 3,
  checklist: [
    { text: "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B \u0440\u0430\u0431\u043E\u0442\u044B \u0435\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E\u0433\u043E \u043E\u0441\u043C\u043E\u0442\u0440\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0426\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u044D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0446\u0435\u043F\u0435\u0439 \u043F\u0438\u0442\u0430\u043D\u0438\u044F \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" }
  ],
  ndReference: `\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u041C\u0413\u041F \xAB\u0410\u0422\u0410\u041A\u0410\xBB, \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 2 \u2014 \u0435\u0436\u0435\u043A\u0432\u0430\u0440\u0442\u0430\u043B\u044C\u043D\u043E; ${BY_PASSPORT}`,
  needsVerification: true
};
var MGP_GOD = {
  activityCode: "module-god",
  title: "\u0415\u0436\u0435\u0433\u043E\u0434\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 (\u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 3)",
  periodicityMonths: 12,
  checklist: [
    { text: "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B \u0440\u0430\u0431\u043E\u0442\u044B \u0435\u0436\u0435\u043A\u0432\u0430\u0440\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041C\u0435\u0442\u0440\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043F\u043E\u0432\u0435\u0440\u043A\u0430 \u043C\u0430\u043D\u043E\u043C\u0435\u0442\u0440\u0430", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0426\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u044D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u0446\u0435\u043F\u0438 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043C\u0430\u0433\u043D\u0438\u0442\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0421\u043E\u043F\u0440\u043E\u0442\u0438\u0432\u043B\u0435\u043D\u0438\u0435 \u0437\u0430\u0437\u0435\u043C\u043B\u044F\u044E\u0449\u0435\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0432 \u043D\u043E\u0440\u043C\u0435", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "ground-resistance-ohm" },
    { text: "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D \u0441\u0440\u043E\u043A \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u044F \u0431\u0430\u043B\u043B\u043E\u043D\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" }
  ],
  ndReference: `\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u041C\u0413\u041F \xAB\u0410\u0422\u0410\u041A\u0410\xBB, \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 3 \u2014 \u0435\u0436\u0435\u0433\u043E\u0434\u043D\u043E; ${BY_PASSPORT}`,
  needsVerification: true
};
var MGP_PYAT_LET = {
  activityCode: "module-massa",
  title: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u043C\u0430\u0441\u0441\u044B \u041E\u0422\u0412 (\u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 4)",
  periodicityMonths: 60,
  checklist: [
    { text: "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B \u0440\u0430\u0431\u043E\u0442\u044B \u0435\u0436\u0435\u0433\u043E\u0434\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041C\u0430\u0441\u0441\u0430 \u0413\u041E\u0422\u0412 \u0432\u0437\u0432\u0435\u0448\u0435\u043D\u0430 \u0438 \u0441\u0432\u0435\u0440\u0435\u043D\u0430 \u0441 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u043D\u043E\u0439", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "agent-mass-kg" },
    { text: "\u041F\u043E\u0442\u0435\u0440\u044F \u043C\u0430\u0441\u0441\u044B \u043D\u0435 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0443\u044E \u043F\u043E \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0443", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "mass-loss-percent" }
  ],
  ndReference: `\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u041C\u0413\u041F \xAB\u0410\u0422\u0410\u041A\u0410\xBB, \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u2116 4 \u2014 \u0440\u0430\u0437 \u0432 5 \u043B\u0435\u0442, \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u0438 \u043C\u0430\u0441\u0441\u044B \u0413\u041E\u0422\u0412; ${BY_PASSPORT}`,
  needsVerification: true,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var GOA_OSMOTR = {
  activityCode: "module-osmotr",
  title: "\u041F\u043E\u043B\u0443\u0433\u043E\u0434\u043E\u0432\u043E\u0439 \u043E\u0441\u043C\u043E\u0442\u0440 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u0430",
  periodicityMonths: 6,
  checklist: [
    { text: "\u0426\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0426\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u044D\u0436\u0435\u043A\u0442\u043E\u0440\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u043B\u043E\u0442\u043D\u043E\u0441\u0442\u044C \u0437\u0430\u0442\u044F\u0436\u043A\u0438 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F \u043A\u043E\u0440\u043F\u0443\u0441\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044B\u0439 \u0441\u0440\u043E\u043A \u0441\u043B\u0443\u0436\u0431\u044B \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u043D\u0435 \u0438\u0441\u0442\u0451\u043A", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" }
  ],
  ndReference: `\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u0413\u041E\u0410\u041F \xAB\u041F\u0438\u0440\u043E\u0441\u0442\u0440\u0430\u0436\xBB, \u043F\u043F. 6.1 \u0438 6.2 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 \u0434\u0432\u0443\u0445 \u0440\u0430\u0437 \u0432 \u0433\u043E\u0434 \u0432\u043D\u0435\u0448\u043D\u0438\u043C \u043E\u0441\u043C\u043E\u0442\u0440\u043E\u043C; ${BY_PASSPORT}`,
  needsVerification: true
};
var MUPTV_OSMOTR = {
  activityCode: "module-osmotr",
  title: "\u0415\u0436\u0435\u043A\u0432\u0430\u0440\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0441\u043C\u043E\u0442\u0440 \u043C\u043E\u0434\u0443\u043B\u044F",
  periodicityMonths: 3,
  checklist: [
    { text: "\u0412\u0438\u0434\u0438\u043C\u044B\u0445 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u0439 \u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u043D\u0435\u0442", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u043E\u0434\u0442\u0435\u043A\u0430\u043D\u0438\u0439 \u0432\u043E\u0434\u044B \u043D\u0435\u0442", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0426\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u043C\u0435\u043C\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u043A\u043B\u0430\u043F\u0430\u043D\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435 \u043C\u043E\u0434\u0443\u043B\u044F \u043D\u0430\u0434\u0451\u0436\u043D\u043E", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: `\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u041C\u0423\u041F\u0422\u0412 \xAB\u0413\u0430\u0440\u0430\u043D\u0442\xBB, \u043F\u043F. 7.1\u20137.2 \u2014 1 \u0440\u0430\u0437 \u0432 \u043A\u0432\u0430\u0440\u0442\u0430\u043B \u0432\u043D\u0435\u0448\u043D\u0438\u043C \u043E\u0441\u043C\u043E\u0442\u0440\u043E\u043C; ${BY_PASSPORT}`,
  needsVerification: true
};
var MODULE_SROK = {
  activityCode: "module-srok",
  title: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0441\u0440\u043E\u043A\u0430 \u0441\u043B\u0443\u0436\u0431\u044B \u0438 \u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u044F",
  periodicityMonths: 12,
  checklist: [
    { text: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044B\u0439 \u0441\u0440\u043E\u043A \u0441\u043B\u0443\u0436\u0431\u044B \u043F\u043E \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0443 \u043D\u0435 \u0438\u0441\u0442\u0451\u043A", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0421\u0440\u043E\u043A \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u044F \u043D\u0435 \u043D\u0430\u0441\u0442\u0443\u043F\u0438\u043B", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041E\u0442\u043C\u0435\u0442\u043A\u0438 \u0432\u043D\u0435\u0441\u0435\u043D\u044B \u0432 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u0438\u0437\u0434\u0435\u043B\u0438\u044F \u0438 \u0436\u0443\u0440\u043D\u0430\u043B", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: `\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043C\u043E\u0434\u0443\u043B\u044C\u043D\u044B\u0445 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043E\u043A \u2014 \u0441\u0440\u043E\u043A \u0441\u043B\u0443\u0436\u0431\u044B \u0438\u0441\u0447\u0438\u0441\u043B\u044F\u0435\u0442\u0441\u044F \u043E\u0442 \u043F\u0440\u0438\u0451\u043C\u043A\u0438 \u041E\u0422\u041A; ${BY_PASSPORT}`,
  needsVerification: true,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var SUPPRESSION_RULES = {
  "suppression-powder": [MPP_OSMOTR, MPP_PUSK, MODULE_SROK],
  "suppression-gas": [MGP_MESYAC, MGP_KVARTAL, MGP_GOD, MGP_PYAT_LET],
  "suppression-aerosol": [GOA_OSMOTR, MODULE_SROK],
  "suppression-water": [MUPTV_OSMOTR, MODULE_SROK],
  "suppression-mist": [MUPTV_OSMOTR, MODULE_SROK]
};

// ../../../../Projects/izh-sppz/packages/core/src/rules/rule-package.ts
var OSMOTR_IZVESHCHATEL = {
  activityCode: "osmotr",
  title: "\u041E\u0441\u043C\u043E\u0442\u0440",
  periodicityMonths: 6,
  checklist: [
    "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u0437\u0430\u0433\u0440\u044F\u0437\u043D\u0451\u043D, \u043D\u0435 \u043E\u043A\u0440\u0430\u0448\u0435\u043D, \u043D\u0435 \u0437\u0430\u043A\u0440\u044B\u0442 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u043C\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430\u043C\u0438",
    "\u041A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435 \u043D\u0430\u0434\u0451\u0436\u043D\u043E, \u0438\u043D\u0434\u0438\u043A\u0430\u0446\u0438\u044F \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u0430"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59638-2021, \u043F. 6.4.2, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1, \u0441\u0442\u0440\u043E\u043A\u0430 1 \u2014 \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var KONTROL_IZVESHCHATEL = {
  activityCode: "kontrol",
  title: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
  periodicityMonths: 12,
  checklist: [
    "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u043D\u0430 \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0435 \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435",
    "\u0421\u0438\u0433\u043D\u0430\u043B \u0434\u043E\u0445\u043E\u0434\u0438\u0442 \u0434\u043E \u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u043F\u0440\u0438\u0451\u043C\u043D\u043E-\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u043E\u0433\u043E"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59638-2021, \u043F. 6.4.2, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1, \u0441\u0442\u0440\u043E\u043A\u0430 1 \u2014 \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var OSMOTR_PPKP = {
  activityCode: "osmotr",
  title: "\u041E\u0441\u043C\u043E\u0442\u0440",
  periodicityMonths: 1,
  checklist: ["\u0418\u043D\u0434\u0438\u043A\u0430\u0446\u0438\u044F \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u0430, \u043D\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043E \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u0438", "\u041A\u043E\u0440\u043F\u0443\u0441 \u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0431\u0435\u0437 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59638-2021, \u043F. 6.4.2, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1, \u0441\u0442\u0440\u043E\u043A\u0430 2 \u2014 \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var KONTROL_PPKP = {
  activityCode: "kontrol",
  title: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
  periodicityMonths: 3,
  checklist: ["\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0438\u043D\u0434\u0438\u043A\u0430\u0446\u0438\u0438 \u043F\u043E \u0432\u0441\u0435\u043C \u0448\u043B\u0435\u0439\u0444\u0430\u043C", "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u043D\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u043F\u0438\u0442\u0430\u043D\u0438\u0435"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59638-2021, \u043F. 6.4.2, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1, \u0441\u0442\u0440\u043E\u043A\u0430 2 \u2014 \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var KOMPLEKS_PPKP = {
  activityCode: "kompleks",
  title: "\u041A\u043E\u043C\u043F\u043B\u0435\u043A\u0441\u043D\u044B\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C",
  periodicityMonths: 12,
  checklist: [
    "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0432\u0441\u0435\u0445 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432",
    "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0441 \u0421\u041E\u0423\u042D \u0438 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u043C\u0438",
    "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59638-2021, \u043F. 6.4.2, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1, \u0441\u0442\u0440\u043E\u043A\u0430 5 \u2014 \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 15 \u043C\u0435\u0441\u044F\u0446\u0435\u0432 \u043C\u0435\u0436\u0434\u0443 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F\u043C\u0438, \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var OBSLUZHIVANIE_OPOVESHCHATEL = {
  activityCode: "obsluzhivanie",
  title: "\u041E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435",
  periodicityMonths: 3,
  checklist: ["\u041E\u043F\u043E\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0434\u0430\u0451\u0442 \u0441\u0438\u0433\u043D\u0430\u043B \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0435", "\u041A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435 \u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u044B"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59639-2021, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1, \u043F. 1 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 3 \u043C\u0435\u0441\u044F\u0446\u0430, \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var RABOTOSPOSOBNOST_SOUE = {
  activityCode: "rabotosposobnost",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0421\u041E\u0423\u042D",
  periodicityMonths: 6,
  checklist: ["\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0437\u0432\u0443\u043A\u043E\u0432\u043E\u0433\u043E \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0443\u0431\u044A\u0435\u043A\u0442\u0438\u0432\u043D\u043E \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u0435\u043D", "\u041E\u043F\u043E\u0432\u0435\u0449\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0445\u043E\u0434\u0438\u0442 \u043F\u043E \u0432\u0441\u0435\u043C \u0437\u043E\u043D\u0430\u043C"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59639-2021, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1, \u043F. 3 \u2014 \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 7 \u043C\u0435\u0441\u044F\u0446\u0435\u0432 \u043C\u0435\u0436\u0434\u0443 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430\u043C\u0438, \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var RABOTOSPOSOBNOST_AUP = {
  activityCode: "rabotosposobnost",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438",
  periodicityMonths: 6,
  checklist: ["\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432 \u0440\u0443\u0447\u043D\u043E\u043C/\u0434\u0438\u0441\u0442\u0430\u043D\u0446\u0438\u043E\u043D\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435", "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435, \u0431\u0435\u0437 \u0432\u044B\u043F\u0443\u0441\u043A\u0430 \u041E\u0422\u0412"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59636-2021, \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u0413/\u0414/\u0415 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 6 \u043C\u0435\u0441\u044F\u0446\u0435\u0432, \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var KIP_AUP = {
  activityCode: "kip",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u041A\u0418\u041F",
  periodicityMonths: 12,
  checklist: ["\u041C\u0435\u0442\u0440\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u043E-\u0438\u0437\u043C\u0435\u0440\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u043F\u0440\u0438\u0431\u043E\u0440\u043E\u0432"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59636-2021, \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u0413/\u0414/\u0415 \u2014 \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var OSMOTR_PK = {
  activityCode: "osmotr",
  title: "\u041E\u0441\u043C\u043E\u0442\u0440",
  periodicityMonths: 1,
  checklist: [
    "\u0428\u043A\u0430\u0444 \u0437\u0430\u043A\u0440\u044B\u0442, \u043F\u043B\u043E\u043C\u0431\u0430 \u043D\u0430 \u043C\u0435\u0441\u0442\u0435",
    "\u041A\u043B\u0430\u043F\u0430\u043D \u043D\u0435 \u043F\u043E\u0434\u0442\u0435\u043A\u0430\u0435\u0442, \u043C\u0430\u0445\u043E\u0432\u0438\u043A \u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E",
    "\u0420\u0443\u043A\u0430\u0432 \u043F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u0451\u043D, \u0441\u043A\u0430\u0442\u0430\u043D, \u0431\u0435\u0437 \u0432\u0438\u0434\u0438\u043C\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59643-2021, \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0410 \u2014 \u0435\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E, \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442",
  needsVerification: true
};
var ISPYTANIE_PK = {
  activityCode: "ispytanie",
  title: "\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u043A\u043B\u0430\u043F\u0430\u043D\u0430 \u043D\u0430 \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C",
  periodicityMonths: 6,
  checklist: ["\u041A\u043B\u0430\u043F\u0430\u043D \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0438 \u0437\u0430\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0431\u0435\u0437 \u0437\u0430\u0435\u0434\u0430\u043D\u0438\u0439", "\u0423\u0442\u0435\u0447\u0435\u043A \u0432 \u0437\u0430\u0442\u0432\u043E\u0440\u0435 \u043D\u0435\u0442"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59643-2021, \u043F. 7.1.1.2 \u2014 1 \u0440\u0430\u0437 \u0432 \u043F\u043E\u043B\u0433\u043E\u0434\u0430, \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u0435 \u0413\u041E\u0421\u0422",
  needsVerification: true
};
var PEREKATKA_RUKAVA = {
  activityCode: "perekatka",
  title: "\u041F\u0435\u0440\u0435\u043A\u0430\u0442\u043A\u0430 \u0440\u0443\u043A\u0430\u0432\u0430 \u043D\u0430 \u043D\u043E\u0432\u0443\u044E \u0441\u043A\u0430\u0442\u043A\u0443",
  periodicityMonths: 12,
  checklist: ["\u0420\u0443\u043A\u0430\u0432 \u043F\u0435\u0440\u0435\u043A\u0430\u0442\u0430\u043D \u043D\u0430 \u043D\u043E\u0432\u0443\u044E \u0441\u043A\u043B\u0430\u0434\u043A\u0443", "\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u043E\u0441\u043C\u043E\u0442\u0440 \u0440\u0443\u043A\u0430\u0432\u0430 \u043D\u0430 \u0440\u0430\u0437\u0440\u044B\u0432\u044B \u0438 \u043F\u043E\u0442\u0451\u0440\u0442\u043E\u0441\u0442\u0438"],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 50 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 \u0433\u043E\u0434, \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E",
  needsVerification: true
};
var LOKALNY_OSMOTR_OGNETUSHITEL = {
  activityCode: "lokalny-kvartalny-osmotr",
  title: "\u0415\u0436\u0435\u043A\u0432\u0430\u0440\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0441\u043C\u043E\u0442\u0440 \u043F\u043E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u043C\u0443 \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442\u0443",
  periodicityMonths: 3,
  checklist: [
    { text: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u043D\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435, \u0445\u043E\u0440\u043E\u0448\u043E \u0432\u0438\u0434\u0435\u043D \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u0438 \u0435\u0433\u043E \u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u044D\u0432\u0430\u043A\u0443\u0430\u0446\u0438\u0438", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041A\u043E\u0440\u043F\u0443\u0441 \u0431\u0435\u0437 \u0432\u0438\u0434\u0438\u043C\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 \u0438 \u0441\u043B\u0435\u0434\u043E\u0432 \u043A\u043E\u0440\u0440\u043E\u0437\u0438\u0438", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041C\u0430\u0440\u043A\u0438\u0440\u043E\u0432\u043A\u0430 \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u0447\u0438\u0442\u0430\u0435\u043C\u044B", severity: "\u043D\u0435\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u041F\u043B\u043E\u043C\u0431\u0430 \u0438 \u043F\u0440\u0435\u0434\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043D\u0435 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u044B", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0428\u043B\u0430\u043D\u0433, \u043D\u0430\u0441\u0430\u0434\u043E\u043A \u0438\u043B\u0438 \u0440\u0430\u0441\u0442\u0440\u0443\u0431 \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u044B", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u043C \u0441\u0435\u043A\u0442\u043E\u0440\u0435", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "pressure-sector" },
    { text: "\u0421\u0440\u043E\u043A\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438, \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438, \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0438 \u0441\u043B\u0443\u0436\u0431\u044B \u043D\u0435 \u0438\u0441\u0442\u0435\u043A\u043B\u0438", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" }
  ],
  ndReference: "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0430\u043A\u0442 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u2014 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F, \u0435\u0441\u043B\u0438 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0435\u043C \u043E\u0431\u044A\u0435\u043A\u0442\u0430",
  needsVerification: false,
  optIn: true
};
var EZHEGODNAYA_PROVERKA_OGNETUSHITEL = {
  activityCode: "ezhegodnaya-proverka",
  title: "\u0415\u0436\u0435\u0433\u043E\u0434\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430",
  periodicityMonths: 12,
  checklist: [
    { text: "\u041A\u043E\u0440\u043F\u0443\u0441, \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0435, \u0443\u0437\u043B\u044B \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0438 \u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F \u043D\u0435 \u0438\u043C\u0435\u044E\u0442 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0418\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F, \u043C\u0430\u0440\u043A\u0438\u0440\u043E\u0432\u043A\u0430, \u043F\u043B\u043E\u043C\u0431\u0430 \u0438 \u043F\u0440\u0435\u0434\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u044B", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u041C\u0430\u043D\u043E\u043C\u0435\u0442\u0440/\u0438\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0438\u0441\u043F\u0440\u0430\u0432\u0435\u043D, \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0443", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "pressure-mpa" },
    { text: "\u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043C\u0430\u0441\u0441\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u043D\u044B\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u043C", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "full-mass-kg" },
    { text: "\u0428\u043B\u0430\u043D\u0433, \u043D\u0430\u0441\u0430\u0434\u043E\u043A/\u0440\u0430\u0441\u0442\u0440\u0443\u0431 \u0438 \u0437\u0430\u043F\u043E\u0440\u043D\u043E-\u043F\u0443\u0441\u043A\u043E\u0432\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u044B", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041A\u0440\u043E\u043D\u0448\u0442\u0435\u0439\u043D, \u0448\u043A\u0430\u0444, \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u043A\u0430 \u0438\u043B\u0438 \u0445\u043E\u0434\u043E\u0432\u0430\u044F \u0447\u0430\u0441\u0442\u044C \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u044B", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0423\u0442\u0435\u0447\u043A\u0430 \u041E\u0422\u0412 \u0438\u043B\u0438 \u0432\u044B\u0442\u0435\u0441\u043D\u044F\u044E\u0449\u0435\u0433\u043E \u0433\u0430\u0437\u0430 \u043D\u0435 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0443\u044E", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "leak-percent" }
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u043F\u043F. 5.1.1, 5.1.7 \u0438 6.2 \u2014 \u0435\u0436\u0435\u0433\u043E\u0434\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0438 \u0443\u0442\u0435\u0447\u043A\u0438",
  needsVerification: false
};
var POLUGODOVAYA_PROVERKA_OGNETUSHITEL = {
  activityCode: "polugodovaya-proverka",
  title: "\u041F\u043E\u043B\u0443\u0433\u043E\u0434\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0440\u0438 \u043D\u0435\u0431\u043B\u0430\u0433\u043E\u043F\u0440\u0438\u044F\u0442\u043D\u044B\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445",
  // Норматив называет срок прямо — «не реже 1 раза в 6 месяцев». Раньше здесь
  // стоял null, и работа висела без срока, хотя число в самом пункте есть.
  periodicityMonths: 6,
  checklist: EZHEGODNAYA_PROVERKA_OGNETUSHITEL.checklist,
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u043F. 5.1.7 \u2014 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0410 \u0438\u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0435 \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043D\u0435\u0431\u043B\u0430\u0433\u043E\u043F\u0440\u0438\u044F\u0442\u043D\u044B\u0445 \u0444\u0430\u043A\u0442\u043E\u0440\u043E\u0432: \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 6 \u043C\u0435\u0441\u044F\u0446\u0435\u0432",
  needsVerification: false,
  optIn: true
};
var PYATILETNEE_OSVIDETELSTVOVANIE = {
  activityCode: "pyatiletnee-osvidetelstvovanie",
  title: "\u041F\u044F\u0442\u0438\u043B\u0435\u0442\u043D\u0435\u0435 \u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0435",
  periodicityMonths: 60,
  checklist: [
    { text: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u0440\u0430\u0437\u0440\u044F\u0436\u0435\u043D, \u041E\u0422\u0412 \u0441\u043E\u0431\u0440\u0430\u043D\u043E, \u043A\u043E\u0440\u043F\u0443\u0441 \u043E\u0447\u0438\u0449\u0435\u043D", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u044B \u043D\u0430\u0440\u0443\u0436\u043D\u044B\u0439 \u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u043E\u0441\u043C\u043E\u0442\u0440\u044B \u043A\u043E\u0440\u043F\u0443\u0441\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041A\u043E\u0440\u0440\u043E\u0437\u0438\u044F, \u0432\u043C\u044F\u0442\u0438\u043D\u044B, \u0432\u0437\u0434\u0443\u0442\u0438\u044F \u0438 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0433\u043E \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u044F \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0423\u043F\u043B\u043E\u0442\u043D\u0435\u043D\u0438\u044F, \u0417\u041F\u0423, \u0444\u0438\u043B\u044C\u0442\u0440\u044B, \u043F\u0440\u0438\u0431\u043E\u0440\u044B \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0438 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0433\u0430\u0437\u0430 \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u044B", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041A\u043E\u0440\u043F\u0443\u0441, \u0448\u043B\u0430\u043D\u0433 \u0438 \u0437\u0430\u043F\u043E\u0440\u043D\u044B\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0432\u044B\u0434\u0435\u0440\u0436\u0430\u043B\u0438 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", measurementCode: "test-pressure-mpa" },
    { text: "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F, \u043E\u0442\u043C\u0435\u0442\u043A\u0430 \u0432 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0435 \u0438 \u0441\u0435\u0440\u0432\u0438\u0441\u043D\u0430\u044F \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0430", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u043F\u043F. 5.1.9 \u0438 5.1.11.2 \u2014 \u0440\u0430\u0437 \u0432 5 \u043B\u0435\u0442 \u043E\u0441\u043C\u043E\u0442\u0440 \u0438 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u043D\u0430 \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C/\u0433\u0435\u0440\u043C\u0435\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u044C",
  needsVerification: false,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var PROVERKA_OTV_VODA = {
  activityCode: "proverka-otv-voda",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u0432\u043E\u0434\u043D\u043E\u0433\u043E/\u043F\u0435\u043D\u043D\u043E\u0433\u043E \u041E\u0422\u0412",
  periodicityMonths: 12,
  checklist: ["\u041C\u0430\u0441\u0441\u0430 \u0438 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0437\u0430\u0440\u044F\u0434\u0430 \u0432 \u043D\u043E\u0440\u043C\u0435", "\u041F\u043B\u043E\u043C\u0431\u0430 \u0438 \u0431\u0438\u0440\u043A\u0430 \u043D\u0435 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1 \u043F. 5.1.11.1 \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u0438 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 \u0433\u043E\u0434, \u043A\u0440\u043E\u043C\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u043D\u044B\u0445 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439",
  needsVerification: false,
  // Прежнее имя работы — см. проверку порошка. Пенные огнетушители в старых
  // записях помечались проверкой порошка: работа была общая, а имя у неё —
  // от самого частого заряда.
  historyCodes: ["proverka-otv-voda", "proverka-otv", "proverka-poroshka"]
};
var PEREZARYADKA_VODA = {
  activityCode: "perezaryadka",
  title: "\u041F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430",
  periodicityMonths: 12,
  checklist: ["\u0417\u0430\u0440\u044F\u0434 \u0437\u0430\u043C\u0435\u043D\u0451\u043D", "\u041F\u043B\u043E\u043C\u0431\u0430 \u0438 \u0431\u0438\u0440\u043A\u0430 \u043E \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1 \u043F. 5.1.11.1 \u2014 1 \u0440\u0430\u0437 \u0432 \u0433\u043E\u0434, \u0435\u0441\u043B\u0438 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435",
  needsVerification: false,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var PROVERKA_OTV_POROSHOK = {
  activityCode: "proverka-poroshka",
  title: "\u0412\u044B\u0431\u043E\u0440\u043E\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E\u0440\u043E\u0448\u043A\u0430",
  periodicityMonths: 12,
  checklist: ["\u0412\u044B\u0431\u043E\u0440\u043E\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043C\u0430\u0441\u0441\u044B \u0438 \u0442\u0435\u043A\u0443\u0447\u0435\u0441\u0442\u0438 \u043F\u043E\u0440\u043E\u0448\u043A\u0430", "\u041F\u043B\u043E\u043C\u0431\u0430 \u0438 \u0431\u0438\u0440\u043A\u0430 \u043D\u0435 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u043F. 5.1.7 \u2014 \u0435\u0436\u0435\u0433\u043E\u0434\u043D\u043E, \u043F\u0440\u0438 5 \u0438 \u0431\u043E\u043B\u0435\u0435 \u043F\u043E\u0440\u043E\u0448\u043A\u043E\u0432\u044B\u0445 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044F\u0445 \u0432\u044B\u0431\u043E\u0440\u043A\u0430 \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 3%",
  needsVerification: false,
  // Прежнее имя работы: до разделения по виду заряда проверка ОТВ была одна.
  // Без этой строки записанные тогда проверки не нашлись бы, и срок считался
  // бы от постановки на учёт — «норма» там, где на деле просрочка.
  historyCodes: ["proverka-poroshka", "proverka-otv"]
};
var PEREZARYADKA_POROSHOK = {
  activityCode: "perezaryadka",
  title: "\u041F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430",
  periodicityMonths: 60,
  checklist: ["\u0417\u0430\u0440\u044F\u0434 \u0437\u0430\u043C\u0435\u043D\u0451\u043D", "\u041F\u043B\u043E\u043C\u0431\u0430 \u0438 \u0431\u0438\u0440\u043A\u0430 \u043E \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1 \u043F. 5.1.11.1 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 5 \u043B\u0435\u0442",
  needsVerification: false,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var PROVERKA_OTV_CO2 = {
  activityCode: "vzveshivanie",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u041E\u0422\u0412 \u0432\u0437\u0432\u0435\u0448\u0438\u0432\u0430\u043D\u0438\u0435\u043C",
  periodicityMonths: 12,
  checklist: ["\u041C\u0430\u0441\u0441\u0430 \u0431\u0430\u043B\u043B\u043E\u043D\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0443"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u043F\u043F. 5.1.7 \u0438 6.2 \u2014 \u0435\u0436\u0435\u0433\u043E\u0434\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0443\u0442\u0435\u0447\u043A\u0438 \u0432\u0437\u0432\u0435\u0448\u0438\u0432\u0430\u043D\u0438\u0435\u043C",
  needsVerification: false,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435",
  // Прежнее имя работы — см. проверку порошка.
  historyCodes: ["vzveshivanie", "proverka-otv"]
};
var PEREZARYADKA_CO2 = {
  activityCode: "perezaryadka",
  title: "\u041F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430",
  periodicityMonths: 60,
  checklist: ["\u0417\u0430\u0440\u044F\u0434 \u0437\u0430\u043C\u0435\u043D\u0451\u043D", "\u041F\u043B\u043E\u043C\u0431\u0430 \u0438 \u0431\u0438\u0440\u043A\u0430 \u043E \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u0442\u0430\u0431\u043B\u0438\u0446\u0430 1 \u043F. 5.1.11.1 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 5 \u043B\u0435\u0442",
  needsVerification: false,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var GIDROISPYTANIE_CO2 = {
  activityCode: "gidroispytanie",
  title: "\u0413\u0438\u0434\u0440\u0430\u0432\u043B\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u043A\u043E\u0440\u043F\u0443\u0441\u0430",
  periodicityMonths: 60,
  checklist: ["\u041A\u043E\u0440\u043F\u0443\u0441 \u0432\u044B\u0434\u0435\u0440\u0436\u0430\u043B \u0438\u0441\u043F\u044B\u0442\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435", "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439"],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59641-2021, \u043F\u043F. 5.1.9 \u0438 5.1.11.2 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 5 \u043B\u0435\u0442",
  needsVerification: false,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var KONTROL_BONTEL = {
  activityCode: "vizualny-kontrol",
  title: "\u0412\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F",
  // Ежемесячно по решению заказчика от 23.08.2026. Паспорт срока не называет —
  // «контролировать в эксплуатации», — но работы без срока в программе не
  // бывает: без даты индикатор молчит, и пропуск замечать нечем.
  periodicityMonths: 1,
  checklist: ["\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u0438\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0440\u0430\u0431\u043E\u0447\u0435\u043C\u0443 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0443, \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u043C\u0443 \u043D\u0430 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435"],
  ndReference: "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 (\u043F\u0430\u0441\u043F\u043E\u0440\u0442) \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044F \u041E\u0412\u042D BONTEL: \u0432 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u043E \u0438\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0443",
  needsVerification: true
};
var PEREZARYADKA_BONTEL = {
  activityCode: "perezaryadka",
  title: "\u041F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430 \u0438 \u043F\u0435\u0440\u0435\u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0435 \u0431\u0430\u043B\u043B\u043E\u043D\u0430",
  periodicityMonths: 120,
  checklist: [
    "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0430\u0449\u0438\u0439 \u0441\u043E\u0441\u0442\u0430\u0432 BONTEL \u0437\u0430\u043C\u0435\u043D\u0451\u043D",
    "\u0411\u0430\u043B\u043B\u043E\u043D \u043F\u0440\u043E\u0448\u0451\u043B \u043F\u0435\u0440\u0435\u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0435",
    "\u0414\u0430\u0442\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0443\u043A\u0430\u0437\u0430\u043D\u0430 \u043D\u0430 \u043C\u0430\u0440\u043A\u0438\u0440\u043E\u0432\u043A\u0435"
  ],
  ndReference: "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 (\u043F\u0430\u0441\u043F\u043E\u0440\u0442) \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044F \u041E\u0412\u042D BONTEL: \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430 \u0438 \u043F\u0435\u0440\u0435\u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0435 \u0431\u0430\u043B\u043B\u043E\u043D\u0430 \u2014 1 \u0440\u0430\u0437 \u0432 10 \u043B\u0435\u0442",
  needsVerification: true,
  baselineKind: "\u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
};
var VODOOTDACHA_NARUZHNOE = {
  activityCode: "vodootdacha",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430 \u0432\u043E\u0434\u043E\u043E\u0442\u0434\u0430\u0447\u0443",
  periodicityMonths: 6,
  checklist: ["\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438 \u0440\u0430\u0441\u0445\u043E\u0434 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u044B \u0438 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u044B", "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u044B\u043C\u0438 \u0434\u0430\u043D\u043D\u044B\u043C\u0438"],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 48 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 2 \u0440\u0430\u0437 \u0432 \u0433\u043E\u0434, \u0432\u0435\u0441\u043D\u043E\u0439 \u0438 \u043E\u0441\u0435\u043D\u044C\u044E, \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E",
  needsVerification: true
};
var PROVERKA_VODOISTOCHNIKA = {
  activityCode: "proverka-vodoistochnika",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432\u043E\u0434\u043E\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430",
  periodicityMonths: 6,
  needsAct: true,
  checklist: [
    { text: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0432\u043E\u0434\u043E\u0451\u043C / \u0440\u0435\u0437\u0435\u0440\u0432\u0443\u0430\u0440 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u043C \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0438", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0439 \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0430\u0441 \u0432\u043E\u0434\u044B", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0430 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u0437\u0430\u0431\u043E\u0440\u0430 \u0432\u043E\u0434\u044B \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u043C\u0438 \u0430\u0432\u0442\u043E\u043C\u043E\u0431\u0438\u043B\u044F\u043C\u0438 \u0438\u043B\u0438 \u043C\u043E\u0442\u043E\u043F\u043E\u043C\u043F\u0430\u043C\u0438", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0434\u043B\u044F \u043E\u0442\u0431\u043E\u0440\u0430 \u0432\u043E\u0434\u044B \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u0440\u0438\u0451\u043C\u043D\u044B\u0439 \u043A\u043E\u043B\u043E\u0434\u0435\u0446 \u0438\u0441\u043F\u0440\u0430\u0432\u0435\u043D \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u2014 \u043F\u0440\u0438 \u0435\u0433\u043E \u043D\u0430\u043B\u0438\u0447\u0438\u0438", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439 \u043F\u043E\u0434\u044A\u0435\u0437\u0434 \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0442\u0435\u0445\u043D\u0438\u043A\u0438 \u043A \u043C\u0435\u0441\u0442\u0443 \u0437\u0430\u0431\u043E\u0440\u0430 \u0432\u043E\u0434\u044B", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u043B\u043E\u0449\u0430\u0434\u043A\u0430 / \u043F\u0438\u0440\u0441 \u0434\u043B\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0442\u0435\u0445\u043D\u0438\u043A\u0438 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043E\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043B\u044F\u0442\u044C \u0437\u0430\u0431\u043E\u0440 \u0432\u043E\u0434\u044B \u2014 \u0435\u0441\u043B\u0438 \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u044B", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0423\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043A \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0443 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0433\u043E \u0432\u043E\u0434\u043E\u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u044F \u0438\u043C\u0435\u0435\u0442\u0441\u044F", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0423\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u0432\u0438\u0434\u0438\u043C \u0438 \u0447\u0438\u0442\u0430\u0435\u043C", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0420\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0434\u043E \u0432\u043E\u0434\u043E\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u0443\u043A\u0430\u0437\u0430\u043D\u043E \u0438 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C\u0443 \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044E", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0430 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F \u0432\u043E\u0434\u043E\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u0434\u043B\u044F \u0446\u0435\u043B\u0435\u0439 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0421\u0435\u0437\u043E\u043D\u043D\u044B\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043D\u0435 \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043F\u043E\u0434\u044A\u0435\u0437\u0434\u0443 \u0438 \u0437\u0430\u0431\u043E\u0440\u0443 \u0432\u043E\u0434\u044B", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" }
  ],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 48 \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u043E\u0432 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0433\u043E \u0432\u043E\u0434\u043E\u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u044F \u043D\u0435 \u0440\u0435\u0436\u0435 2 \u0440\u0430\u0437 \u0432 \u0433\u043E\u0434, \u0432\u0435\u0441\u043D\u043E\u0439 \u0438 \u043E\u0441\u0435\u043D\u044C\u044E, \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E",
  needsVerification: true
};
var OBSLEDOVANIE_LESTNITSA = {
  activityCode: "obsledovanie",
  title: "\u041E\u0431\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0446\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u0438 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438",
  periodicityMonths: 12,
  checklist: [
    "\u0426\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u0431\u0435\u0437 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u0439, \u043A\u043E\u0440\u0440\u043E\u0437\u0438\u0438 \u0438 \u0434\u0435\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0439",
    "\u041A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F \u043A \u0441\u0442\u0435\u043D\u0435 \u043D\u0430\u0434\u0451\u0436\u043D\u044B",
    "\u0421\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u0430\u043A\u0442 \u043F\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 53254-2009, \u043F. 6.1.4 \u2014 \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0430 \u0432 \u0433\u043E\u0434",
  needsVerification: true
};
var ISPYTANIE_LESTNITSA = {
  activityCode: "ispytanie",
  title: "\u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F",
  periodicityMonths: 60,
  checklist: ["\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u043E\u0439 \u043F\u043E \u043C\u0435\u0442\u043E\u0434\u0438\u043A\u0435", "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439"],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 17, \u043F\u043E\u0434\u043F. \xAB\u0431\xBB; \u0413\u041E\u0421\u0422 \u0420 53254-2009, \u043F. 6.1.4 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 5 \u043B\u0435\u0442",
  needsVerification: true,
  needsAct: true
};
var OBSLEDOVANIE_OGRAZHDENIYA = {
  activityCode: "obsledovanie",
  title: "\u041E\u0431\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0446\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u0438 \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F",
  periodicityMonths: 12,
  checklist: [
    "\u0421\u0442\u043E\u0439\u043A\u0438 \u0438 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F \u0446\u0435\u043B\u044B, \u0431\u0435\u0437 \u043A\u043E\u0440\u0440\u043E\u0437\u0438\u0438 \u0438 \u0434\u0435\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0439",
    "\u041A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435 \u043A \u043F\u0430\u0440\u0430\u043F\u0435\u0442\u0443 \u0438\u043B\u0438 \u043A\u0440\u043E\u0432\u043B\u0435 \u043D\u0430\u0434\u0451\u0436\u043D\u043E",
    "\u0412\u044B\u0441\u043E\u0442\u0430 \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0432\u044B\u0441\u043E\u0442\u0435 \u0437\u0434\u0430\u043D\u0438\u044F",
    "\u0421\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u0430\u043A\u0442 \u043F\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 53254-2009, \u043F. 6.1.4 \u2014 \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0430 \u0432 \u0433\u043E\u0434",
  needsVerification: true
};
var ISPYTANIE_OGRAZHDENIYA = {
  activityCode: "ispytanie",
  title: "\u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F",
  periodicityMonths: 60,
  checklist: ["\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u043E\u0439 \u043F\u043E \u043C\u0435\u0442\u043E\u0434\u0438\u043A\u0435", "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439"],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 17, \u043F\u043E\u0434\u043F. \xAB\u0431\xBB; \u0413\u041E\u0421\u0422 \u0420 53254-2009, \u043F. 6.1.4 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 5 \u043B\u0435\u0442",
  needsVerification: true,
  needsAct: true
};
var PROVERKA_SHCHITA = {
  activityCode: "komplektnost-shchita",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u0438 \u0449\u0438\u0442\u0430",
  periodicityMonths: 3,
  checklist: [
    { text: "\u0418\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C \u043D\u0430 \u0449\u0438\u0442\u0435 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u043F\u043E \u043D\u043E\u0440\u043C\u0435 \u0435\u0433\u043E \u0442\u0438\u043F\u0430", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0418\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C \u0438\u0441\u043F\u0440\u0430\u0432\u0435\u043D \u0438 \u043F\u0440\u0438\u0433\u043E\u0434\u0435\u043D \u043A \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044E", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u042F\u0449\u0438\u043A \u0441 \u043F\u0435\u0441\u043A\u043E\u043C \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D, \u043F\u0435\u0441\u043E\u043A \u0441\u0443\u0445\u043E\u0439 \u0438 \u0441\u044B\u043F\u0443\u0447\u0438\u0439", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0401\u043C\u043A\u043E\u0441\u0442\u044C \u0441 \u0432\u043E\u0434\u043E\u0439 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430; \u0437\u0438\u043C\u043E\u0439 \u043F\u0440\u0438\u043D\u044F\u0442\u044B \u043C\u0435\u0440\u044B \u043E\u0442 \u0437\u0430\u043C\u0435\u0440\u0437\u0430\u043D\u0438\u044F", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0429\u0438\u0442 \u043E\u043A\u0440\u0430\u0448\u0435\u043D, \u043E\u0431\u043E\u0437\u043D\u0430\u0447\u0435\u043D \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043F\u043E\u0434\u0445\u043E\u0434\u0430", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u0440\u0430\u0437\u0434\u0435\u043B XIX \u0438 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 6 \u2014 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 \u0449\u0438\u0442\u043E\u0432 \u0438 \u043D\u043E\u0440\u043C\u044B \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0430\u0446\u0438\u0438; \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u043D\u043E\u0441\u0442\u044C \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0435\u0442 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F",
  needsVerification: true,
  periodicityByOrganization: true
};
var RABOTOSPOSOBNOST_NASOSOV = {
  activityCode: "rabotosposobnost-nasosov",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u043D\u0430\u0441\u043E\u0441\u043E\u0432",
  periodicityMonths: 1,
  checklist: [
    { text: "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u043D\u0430\u0441\u043E\u0441 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0438 \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u043D\u0430 \u0440\u0435\u0436\u0438\u043C", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0439 \u043D\u0430\u0441\u043E\u0441 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0438 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0443", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0443\u0441\u043A \u043E\u0442 \u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0417\u0430\u0434\u0432\u0438\u0436\u043A\u0438 \u0438 \u043E\u0431\u0440\u0430\u0442\u043D\u044B\u0435 \u043A\u043B\u0430\u043F\u0430\u043D\u044B \u0438\u0441\u043F\u0440\u0430\u0432\u043D\u044B, \u043F\u043E\u0434\u0442\u0435\u043A\u0430\u043D\u0438\u0439 \u043D\u0435\u0442", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" },
    { text: "\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" }
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59636-2021 \u2014 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043E\u043A \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F; \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0430\u044F \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043D\u0430\u0441\u043E\u0441\u043E\u0432 \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0435\u0442\u0441\u044F \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442\u043E\u043C \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438",
  needsVerification: true,
  periodicityByOrganization: true
};
var PROVERKA_OGNEZASHCHITY = {
  activityCode: "proverka-ognezashchity",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u043D\u043E\u0433\u043E \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u044F",
  periodicityMonths: 12,
  needsAct: true,
  checklist: [
    { text: "\u041F\u043E\u043A\u0440\u044B\u0442\u0438\u0435 \u0441\u043F\u043B\u043E\u0448\u043D\u043E\u0435, \u0431\u0435\u0437 \u043E\u0442\u0441\u043B\u043E\u0435\u043D\u0438\u0439, \u0432\u0437\u0434\u0443\u0442\u0438\u0439 \u0438 \u0442\u0440\u0435\u0449\u0438\u043D", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 \u0438 \u0443\u0447\u0430\u0441\u0442\u043A\u043E\u0432 \u0431\u0435\u0437 \u043E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u044B \u043D\u0435 \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u043E", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0422\u043E\u043B\u0449\u0438\u043D\u0430 \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u044F \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 (\u0434\u043B\u044F \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0439 \u0438 \u043E\u0431\u043C\u0430\u0437\u043E\u043A)", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u0440\u043E\u043F\u0438\u0442\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u043B\u0430 \u043E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0435 \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u0430 \u043F\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u043C \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043E\u0431\u0440\u0430\u0437\u0446\u043E\u0432", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u0421\u0440\u043E\u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044F \u043D\u0435 \u0438\u0441\u0442\u0451\u043A", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u0430\u043A\u0442 (\u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B) \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u043D\u043E\u0439 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 13 \u2014 \u0432 \u0441\u0440\u043E\u043A\u0438 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044F, \u0430 \u043F\u0440\u0438 \u0438\u0445 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0438 \u043D\u0435 \u0440\u0435\u0436\u0435 1 \u0440\u0430\u0437\u0430 \u0432 \u0433\u043E\u0434 \u0441 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0430\u043A\u0442\u0430; \u0413\u041E\u0421\u0422 \u0420 53295-2009 \u0438 \u0413\u041E\u0421\u0422 \u0420 53292-2009 \u2014 \u043C\u0435\u0442\u043E\u0434\u044B \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F",
  needsVerification: true
};
var VOZOBNOVLENIE_OGNEZASHCHITY = {
  activityCode: "vozobnovlenie-ognezashchity",
  title: "\u0412\u043E\u0437\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u043D\u043E\u0439 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438",
  periodicityMonths: 60,
  optIn: true,
  needsAct: true,
  checklist: [
    { text: "\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0438 \u0443\u0442\u0440\u0430\u0442\u0438\u0432\u0448\u0438\u0435 \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u0430 \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u044B \u0437\u0430\u043D\u043E\u0432\u043E", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041F\u0440\u0438\u043C\u0435\u043D\u0451\u043D \u0441\u043E\u0441\u0442\u0430\u0432 \u0441 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u043C \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u043C \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F", severity: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" },
    { text: "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u0430\u043A\u0442 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0445 \u0440\u0430\u0431\u043E\u0442 \u043F\u043E \u043E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u0435", severity: "\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439" }
  ],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 13 \u2014 \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 \u043E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0445 \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0439; \u0441\u0440\u043E\u043A \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043E\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044F \u0438 \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0435\u0442\u0441\u044F \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0435\u0439",
  needsVerification: true,
  periodicityByOrganization: true
};
var TO_PDZ_MESYAC = {
  activityCode: "to-mesyachnoe",
  title: "\u0415\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E\u0435 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435",
  periodicityMonths: 1,
  checklist: [
    "\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u043E\u0441\u043C\u043E\u0442\u0440 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0432 \u043C\u0435\u0441\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",
    "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0449\u0438\u0445 \u0441\u0438\u0433\u043D\u0430\u043B\u043E\u0432 \u043D\u0430 \u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",
    "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0432 \u0440\u0443\u0447\u043D\u043E\u043C, \u043C\u0435\u0441\u0442\u043D\u043E\u043C \u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0430\u0445",
    "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043D\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043F\u0438\u0442\u0430\u043D\u0438\u0435"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 54101-2010, \u043F. 6.1; \u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 42 \u2014 \u0435\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E",
  needsVerification: true
};
var TO_PDZ_GOD = {
  activityCode: "to-godovoe",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F",
  periodicityMonths: 12,
  checklist: [
    "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u044B \u043F\u0440\u0438 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0433\u043E \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043F\u0438\u0442\u0430\u043D\u0438\u044F \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u043E\u0440\u043C\u0435",
    "\u041F\u0440\u0438 \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0437\u0430\u043C\u0435\u043D\u0435\u043D\u044B \u0430\u043A\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440\u043D\u044B\u0435 \u0431\u0430\u0442\u0430\u0440\u0435\u0438 \u0438 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 54101-2010, \u043F. 6.2 \u2014 \u0435\u0436\u0435\u0433\u043E\u0434\u043D\u043E\u0435 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435",
  needsVerification: true
};
var TO_DVER = {
  activityCode: "to-kvartal",
  title: "\u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E-\u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435",
  periodicityMonths: 3,
  checklist: [
    "\u0412\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u043F\u043E\u043B\u043E\u0442\u043D\u0430 \u0438 \u043A\u043E\u0440\u043E\u0431\u043A\u0438 \u043D\u0430 \u043C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0434\u0435\u0444\u0435\u043A\u0442\u044B \u0438 \u043A\u043E\u0440\u0440\u043E\u0437\u0438\u044E",
    "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u044B \u0437\u0430\u043C\u043A\u0430 \u0438 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \xAB\u0430\u043D\u0442\u0438\u043F\u0430\u043D\u0438\u043A\u0430\xBB",
    "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0435\u0442\u0435\u043B\u044C \u043F\u044F\u0442\u0438\u043A\u0440\u0430\u0442\u043D\u044B\u043C \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u043D\u0438\u0435\u043C-\u0437\u0430\u043A\u0440\u044B\u0432\u0430\u043D\u0438\u0435\u043C",
    "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0441\u0430\u043C\u043E\u0437\u0430\u043A\u0440\u044B\u0432\u0430\u043D\u0438\u044F \u0438 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0437\u0430\u043A\u0440\u044B\u0432\u0430\u043D\u0438\u044F \u043F\u043E\u043B\u043E\u0442\u0435\u043D",
    "\u0417\u0430\u0437\u043E\u0440\u044B \u043C\u0435\u0436\u0434\u0443 \u043F\u043E\u043B\u043E\u0442\u043D\u043E\u043C \u0438 \u043A\u043E\u0440\u043E\u0431\u043A\u043E\u0439 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044F",
    "\u0423\u043F\u043B\u043E\u0442\u043D\u0435\u043D\u0438\u044F \u0431\u0435\u0437 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439, \u043F\u0440\u0438\u043B\u0435\u0433\u0430\u044E\u0442 \u043F\u043B\u043E\u0442\u043D\u043E"
  ],
  ndReference: "\u0413\u041E\u0421\u0422 \u0420 59642-2021, \u043F. 4.1.6.3 \u2014 \u043D\u0435 \u0440\u0435\u0436\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0430 \u0432 \u043A\u0432\u0430\u0440\u0442\u0430\u043B",
  needsVerification: true
};
var PROVERKA_SIZ = {
  activityCode: "proverka",
  title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u043E\u0439 \u0437\u0430\u0449\u0438\u0442\u044B",
  periodicityMonths: 12,
  checklist: [
    "\u041C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 \u043D\u0435\u0442, \u0446\u0435\u043B\u043E\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0430",
    "\u0421\u0440\u043E\u043A \u0433\u043E\u0434\u043D\u043E\u0441\u0442\u0438 \u043D\u0435 \u0438\u0441\u0442\u0451\u043A"
  ],
  ndReference: "\u041F\u041F\u0420 \u0420\u0424 \u21161479, \u043F. 30 \u2014 1 \u0440\u0430\u0437 \u0432 \u0433\u043E\u0434",
  needsVerification: true
};
var RULE_PACKAGE = {
  "smoke-detector": [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  "heat-detector": [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  "flame-detector": [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  "manual-call-point": [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  "control-panel": [OSMOTR_PPKP, KONTROL_PPKP, KOMPLEKS_PPKP],
  sounder: [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  // Виды оповещателей обслуживают по одному регламенту: различается не срок, а
  // что именно смотрят при проверке, и это записано в чек-листе работ.
  "sounder-audible": [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  "sounder-speech": [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  "sounder-light": [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  "sounder-combined": [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  "powder-module": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  // Газовый модуль обслуживают по тому же ГОСТ Р 59636, что и порошковый:
  // раньше правил у него не было вовсе, и он показывался необслуживаемым.
  "gas-module": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  // Виды установок пожаротушения: базовый регламент один на все — проверка
  // работоспособности и метрологическая проверка КИП по ГОСТ Р 59636-2021.
  // Что различается между водяной и газовой, задаётся проектом и паспортом
  // изделия, и придумывать за них периодичность здесь нельзя.
  "aup-sprinkler": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-drencher": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-sprinkler-drencher": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-mist": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-foam": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-gas": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-powder": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-aerosol": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-combined": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  "aup-robotic": [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  // Автономная установка: базовый набор. Работы, зависящие от вида заряда,
  // подставляются в `activitiesForObject` по полю `suppressionKind` карточки —
  // как у огнетушителя состав зависит от ОТВ.
  // У общего вида работ нет намеренно: пока не выбрано, чем установка тушит,
  // назначать нечего — у порошкового модуля осматривают мембрану, у газового
  // взвешивают заряд, у водяного ищут подтекания.
  "autonomous-suppression": [],
  ...SUPPRESSION_RULES,
  "fire-hydrant-indoor": [OSMOTR_PK, ISPYTANIE_PK, PEREKATKA_RUKAVA],
  hydrant: [VODOOTDACHA_NARUZHNOE],
  "water-reservoir": [PROVERKA_VODOISTOCHNIKA],
  "water-tank": [PROVERKA_VODOISTOCHNIKA],
  "water-pond": [PROVERKA_VODOISTOCHNIKA],
  "water-natural": [PROVERKA_VODOISTOCHNIKA],
  "outdoor-ladder": [OBSLEDOVANIE_LESTNITSA, ISPYTANIE_LESTNITSA],
  "roof-fence": [OBSLEDOVANIE_OGRAZHDENIYA, ISPYTANIE_OGRAZHDENIYA],
  "pump-station": [RABOTOSPOSOBNOST_NASOSOV, KIP_AUP],
  fireproofing: [PROVERKA_OGNEZASHCHITY, VOZOBNOVLENIE_OGNEZASHCHITY],
  "outdoor-cabinet": [PROVERKA_SHCHITA],
  "fire-board-a": [PROVERKA_SHCHITA],
  "fire-board-v": [PROVERKA_SHCHITA],
  "fire-board-e": [PROVERKA_SHCHITA],
  "fire-board-sh": [PROVERKA_SHCHITA],
  "fire-board-mobile": [PROVERKA_SHCHITA],
  "outdoor-cabinet-box": [PROVERKA_SHCHITA],
  "extinguisher-water": [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_VODA, PEREZARYADKA_VODA, PYATILETNEE_OSVIDETELSTVOVANIE],
  "extinguisher-foam": [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_VODA, PEREZARYADKA_VODA, PYATILETNEE_OSVIDETELSTVOVANIE],
  "extinguisher-emulsion": [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_VODA, PEREZARYADKA_VODA, PYATILETNEE_OSVIDETELSTVOVANIE],
  "extinguisher-powder": [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_POROSHOK, PEREZARYADKA_POROSHOK, PYATILETNEE_OSVIDETELSTVOVANIE],
  "extinguisher-co2": [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_CO2, PEREZARYADKA_CO2, GIDROISPYTANIE_CO2],
  "extinguisher-halon": [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_CO2, PEREZARYADKA_CO2, PYATILETNEE_OSVIDETELSTVOVANIE],
  // BONTEL: пятилетнего освидетельствования здесь нет намеренно. Паспорт
  // изделия назначает перезарядку и переосвидетельствование баллона раз в
  // 10 лет одной работой, и типовой пятилетний срок ГОСТ к нему не
  // применяется. Держать оба значило бы требовать вскрывать огнетушитель
  // вдвое чаще, чем предписал изготовитель.
  "extinguisher-bantl": [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, KONTROL_BONTEL, PEREZARYADKA_BONTEL],
  "smoke-valve": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "damper-fire": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "damper-smoke": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "damper-dual": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "damper-pressure": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "smoke-fan": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "fan-exhaust": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "fan-supply": [TO_PDZ_MESYAC, TO_PDZ_GOD],
  "fire-door": [TO_DVER],
  "self-rescuer": [PROVERKA_SIZ],
  "self-rescuer-filter": [PROVERKA_SIZ],
  "self-rescuer-isolating": [PROVERKA_SIZ],
  // У генерического «Огнетушителя» типовых сроков ГОСТ нет намеренно:
  // периодичность перезарядки зависит от заряженного ОТВ (ГОСТ Р 59641-2021,
  // таблица 1: вода/пена — 1 год, порошок, CO₂ и хладон — 5 лет), и подставить
  // одно число для всех означало бы соврать для большинства. Нужен конкретный
  // подтип — extinguisher-water / -powder / -co2.
  //
  // Обязательное требование ППР РФ №1479, п. 60 к нему при этом относится и
  // подставляется в `activitiesFor`: вести учёт наличия, осмотров и сроков
  // перезарядки обязана организация независимо от того, каким ОТВ заряжен
  // огнетушитель. Ежегодная проверка технического состояния — тоже: она не
  // зависит от вида заряда.
  extinguisher: [EZHEGODNAYA_PROVERKA_OGNETUSHITEL, LOKALNY_OSMOTR_OGNETUSHITEL],
  "fire-detector": [],
  "combined-detector": [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  "gas-detector": [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  "aspiration-detector": [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  "fire-suppression-system": []
};

// ../../../../Projects/izh-sppz/packages/core/src/object-tree/node-checks.ts
function normalizeName(raw) {
  return raw.trim().replace(/\s+/g, " ");
}
function normalizeOptional(raw) {
  if (raw === null || raw === void 0) return null;
  const value2 = normalizeName(raw);
  return value2.length === 0 ? null : value2;
}
function checkName(raw) {
  const name = normalizeName(raw);
  if (name.length === 0) return err("INVALID_ARGUMENT", "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C.");
  if (name.length > 200) return err("INVALID_ARGUMENT", "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043B\u0438\u043D\u043D\u0435\u0435 200 \u0437\u043D\u0430\u043A\u043E\u0432.");
  return ok(name);
}
function findDuplicateSibling(nodes, parentId, kind, name, exceptId) {
  const lowered = name.toLocaleLowerCase("ru");
  return nodes.find(
    (node) => node.parentId === parentId && node.kind === kind && node.archivedAt === null && node.id !== exceptId && node.name.toLocaleLowerCase("ru") === lowered
  ) ?? null;
}
function nextSortOrder(nodes, parentId) {
  const orders = nodes.filter((node) => node.parentId === parentId).map((node) => node.sortOrder);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}
function checkBuildingProfile(kind, profile) {
  if (profile === null) return ok(null);
  if (!ruleFor(kind).hasBuildingProfile) {
    return err(
      "INVALID_ARGUMENT",
      `\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u044E\u0442\u0441\u044F \u0443 \u0437\u0434\u0430\u043D\u0438\u044F, \u0430 \u043D\u0435 \u0443 \u0443\u0437\u043B\u0430 \xAB${ruleFor(kind).title}\xBB.`
    );
  }
  return ok(profile);
}
function checkElevation(kind, elevationM) {
  if (elevationM === null) return ok(null);
  if (!ruleFor(kind).hasElevation) {
    return err("INVALID_ARGUMENT", `\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u044D\u0442\u0430\u0436\u0430, \u0430 \u043D\u0435 \u0434\u043B\u044F \xAB${ruleFor(kind).title}\xBB.`);
  }
  if (!Number.isFinite(elevationM)) return err("INVALID_ARGUMENT", "\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0447\u0438\u0441\u043B\u043E\u043C.");
  return ok(elevationM);
}

// ../../../../Projects/izh-sppz/packages/core/src/object-tree/create-node.ts
async function createOrganization(deps, input) {
  const name = checkName(input.name);
  if (!name.ok) return name;
  const all = await deps.tree.list();
  if (!all.ok) return all;
  const duplicate = findDuplicateSibling(all.value, null, "organization", name.value, null);
  if (duplicate !== null) {
    return err("INVALID_ARGUMENT", `\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F \xAB${name.value}\xBB \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0434\u0435\u043D\u0430.`);
  }
  const id = deps.ids.newId();
  const now = deps.clock.nowUtc();
  const node = {
    id,
    // Организация принадлежит сама себе: так у любого узла дерева признак
    // принадлежности заполнен, и выборки не нуждаются в особом случае для корня.
    siteId: id,
    parentId: null,
    kind: "organization",
    name: name.value,
    code: normalizeOptional(input.code),
    elevationM: null,
    note: normalizeOptional(input.note),
    building: null,
    sortOrder: nextSortOrder(all.value, null),
    inCommonJournal: true,
    objectsPinned: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1
  };
  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}
async function createChildNode(deps, input) {
  const name = checkName(input.name);
  if (!name.ok) return name;
  const elevation = checkElevation(input.kind, input.elevationM ?? null);
  if (!elevation.ok) return elevation;
  const profile = checkBuildingProfile(input.kind, input.building ?? null);
  if (!profile.ok) return profile;
  const parent = await deps.tree.getById(input.parentId);
  if (!parent.ok) return parent;
  if (parent.value.archivedAt !== null) {
    return err(
      "INVALID_ARGUMENT",
      `\u0423\u0437\u0435\u043B \xAB${parent.value.name}\xBB \u0432\u044B\u0432\u0435\u0434\u0435\u043D \u0438\u0437 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438, \u0432\u043D\u0443\u0442\u0440\u044C \u043D\u0435\u0433\u043E \u043D\u0435\u043B\u044C\u0437\u044F \u043D\u0438\u0447\u0435\u0433\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C.`
    );
  }
  if (!canContain(parent.value.kind, input.kind)) {
    return err(
      "INVALID_ARGUMENT",
      `\u0412\u043D\u0443\u0442\u0440\u044C \u0443\u0437\u043B\u0430 \xAB${ruleFor(parent.value.kind).title}\xBB \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E\u043C\u0435\u0441\u0442\u0438\u0442\u044C \xAB${ruleFor(input.kind).title}\xBB.`
    );
  }
  const all = await deps.tree.list();
  if (!all.ok) return all;
  const duplicate = findDuplicateSibling(all.value, parent.value.id, input.kind, name.value, null);
  if (duplicate !== null) {
    return err("INVALID_ARGUMENT", `\xAB${name.value}\xBB \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432\u043D\u0443\u0442\u0440\u0438 \xAB${parent.value.name}\xBB.`);
  }
  const now = deps.clock.nowUtc();
  const node = {
    id: deps.ids.newId(),
    siteId: parent.value.siteId,
    parentId: parent.value.id,
    kind: input.kind,
    name: name.value,
    code: normalizeOptional(input.code),
    elevationM: elevation.value,
    note: normalizeOptional(input.note),
    building: profile.value,
    sortOrder: nextSortOrder(all.value, parent.value.id),
    inCommonJournal: true,
    objectsPinned: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1
  };
  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}

// ../../../../Projects/izh-sppz/packages/core/src/object-tree/functional-classes.ts
var FUNCTIONAL_CLASS_TITLES = {
  "\u04241.1": "\u0434\u0435\u0442\u0441\u043A\u0438\u0435 \u0441\u0430\u0434\u044B, \u0434\u043E\u043C\u0430 \u043F\u0440\u0435\u0441\u0442\u0430\u0440\u0435\u043B\u044B\u0445, \u0431\u043E\u043B\u044C\u043D\u0438\u0446\u044B, \u0441\u043F\u0430\u043B\u044C\u043D\u044B\u0435 \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u0438\u043D\u0442\u0435\u0440\u043D\u0430\u0442\u043E\u0432",
  "\u04241.2": "\u0433\u043E\u0441\u0442\u0438\u043D\u0438\u0446\u044B, \u043E\u0431\u0449\u0435\u0436\u0438\u0442\u0438\u044F, \u0441\u043F\u0430\u043B\u044C\u043D\u044B\u0435 \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u0441\u0430\u043D\u0430\u0442\u043E\u0440\u0438\u0435\u0432 \u0438 \u043F\u0430\u043D\u0441\u0438\u043E\u043D\u0430\u0442\u043E\u0432",
  "\u04241.3": "\u043C\u043D\u043E\u0433\u043E\u043A\u0432\u0430\u0440\u0442\u0438\u0440\u043D\u044B\u0435 \u0436\u0438\u043B\u044B\u0435 \u0434\u043E\u043C\u0430",
  "\u04241.4": "\u043E\u0434\u043D\u043E\u043A\u0432\u0430\u0440\u0442\u0438\u0440\u043D\u044B\u0435 \u0436\u0438\u043B\u044B\u0435 \u0434\u043E\u043C\u0430, \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435",
  "\u04242.1": "\u0442\u0435\u0430\u0442\u0440\u044B, \u043A\u0438\u043D\u043E\u0442\u0435\u0430\u0442\u0440\u044B, \u043A\u043B\u0443\u0431\u044B, \u0441\u043F\u043E\u0440\u0442\u0438\u0432\u043D\u044B\u0435 \u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u044F \u0441 \u0442\u0440\u0438\u0431\u0443\u043D\u0430\u043C\u0438, \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0438",
  "\u04242.2": "\u043C\u0443\u0437\u0435\u0438, \u0432\u044B\u0441\u0442\u0430\u0432\u043A\u0438, \u0442\u0430\u043D\u0446\u0435\u0432\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u043B\u044B \u0432 \u0437\u0430\u043A\u0440\u044B\u0442\u044B\u0445 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u0445",
  "\u04242.3": "\u0442\u043E \u0436\u0435, \u0447\u0442\u043E \u04242.1, \u043D\u043E \u043D\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u043C \u0432\u043E\u0437\u0434\u0443\u0445\u0435",
  "\u04242.4": "\u0442\u043E \u0436\u0435, \u0447\u0442\u043E \u04242.2, \u043D\u043E \u043D\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u043C \u0432\u043E\u0437\u0434\u0443\u0445\u0435",
  "\u04243.1": "\u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0442\u043E\u0440\u0433\u043E\u0432\u043B\u0438",
  "\u04243.2": "\u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u043E\u0431\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0438\u0442\u0430\u043D\u0438\u044F",
  "\u04243.3": "\u0432\u043E\u043A\u0437\u0430\u043B\u044B",
  "\u04243.4": "\u043F\u043E\u043B\u0438\u043A\u043B\u0438\u043D\u0438\u043A\u0438 \u0438 \u0430\u043C\u0431\u0443\u043B\u0430\u0442\u043E\u0440\u0438\u0438",
  "\u04243.5": "\u0431\u044B\u0442\u043E\u0432\u043E\u0435 \u0438 \u043A\u043E\u043C\u043C\u0443\u043D\u0430\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435 \u0431\u0435\u0437 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u043E\u0433\u043E \u0447\u0438\u0441\u043B\u0430 \u043C\u0435\u0441\u0442",
  "\u04243.6": "\u0444\u0438\u0437\u043A\u0443\u043B\u044C\u0442\u0443\u0440\u043D\u043E-\u043E\u0437\u0434\u043E\u0440\u043E\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0441\u044B, \u0431\u044B\u0442\u043E\u0432\u044B\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F, \u0431\u0430\u043D\u0438",
  "\u04243.7": "\u043E\u0431\u044A\u0435\u043A\u0442\u044B \u0440\u0435\u043B\u0438\u0433\u0438\u043E\u0437\u043D\u043E\u0433\u043E \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F",
  "\u04244.1": "\u0448\u043A\u043E\u043B\u044B, \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0438 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u043D\u0438\u044F",
  "\u04244.2": "\u0432\u0443\u0437\u044B, \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u043D\u0438\u044F",
  "\u04244.3": "\u043E\u0440\u0433\u0430\u043D\u044B \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u044B\u0435 \u0438 \u043D\u0430\u0443\u0447\u043D\u044B\u0435 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438, \u0431\u0430\u043D\u043A\u0438, \u043E\u0444\u0438\u0441\u044B",
  "\u04244.4": "\u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0435 \u0434\u0435\u043F\u043E",
  "\u04245.1": "\u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0437\u0434\u0430\u043D\u0438\u044F \u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F, \u043B\u0430\u0431\u043E\u0440\u0430\u0442\u043E\u0440\u0438\u0438, \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0438\u0435",
  "\u04245.2": "\u0441\u043A\u043B\u0430\u0434\u044B, \u043A\u043D\u0438\u0433\u043E\u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430, \u0430\u0440\u0445\u0438\u0432\u044B, \u0441\u0442\u043E\u044F\u043D\u043A\u0438 \u0431\u0435\u0437 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u044F \u0438 \u0440\u0435\u043C\u043E\u043D\u0442\u0430",
  "\u04245.3": "\u0437\u0434\u0430\u043D\u0438\u044F \u0441\u0435\u043B\u044C\u0441\u043A\u043E\u0445\u043E\u0437\u044F\u0439\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F"
};
var FUNCTIONAL_CLASSES = Object.keys(FUNCTIONAL_CLASS_TITLES);

// ../../../../Projects/izh-sppz/packages/core/src/objects/element-catalog.ts
var FLOOR = ["floor", "storage"];
var GENERAL = ["general"];
var ELEMENT_CATALOG = [
  // Генплан объекта: то, что стоит на территории и вокруг здания.
  { typeCode: "hydrant", systemCode: "18", title: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0433\u0438\u0434\u0440\u0430\u043D\u0442", appliesTo: GENERAL, color: "#dc2626", mark: "\u041F\u0413" },
  { typeCode: "water-reservoir", systemCode: "18", title: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0432\u043E\u0434\u043E\u0451\u043C, \u0440\u0435\u0437\u0435\u0440\u0432\u0443\u0430\u0440", appliesTo: GENERAL, color: "#2563eb", mark: "\u041F\u0412" },
  // Резервуар закрыт и заполняется из водопровода, водоём открыт и зависит
  // от сезона: зимой к нему нужна прорубь и подъезд. В одной строке они
  // стояли только потому, что оба про запас воды.
  { typeCode: "water-tank", systemCode: "18", title: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0440\u0435\u0437\u0435\u0440\u0432\u0443\u0430\u0440", appliesTo: GENERAL, color: "#2563eb", mark: "\u041F\u0420", showInLibrary: false },
  { typeCode: "water-pond", systemCode: "18", title: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0432\u043E\u0434\u043E\u0451\u043C", appliesTo: GENERAL, color: "#2563eb", mark: "\u041F\u0412", showInLibrary: false },
  { typeCode: "water-natural", systemCode: "18", title: "\u0415\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0432\u043E\u0434\u043E\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A", appliesTo: GENERAL, color: "#2563eb", mark: "\u0415\u0412", showInLibrary: false },
  { typeCode: "fire-truck-connection", systemCode: "02.1", title: "\u041C\u0435\u0441\u0442\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0442\u0435\u0445\u043D\u0438\u043A\u0438", appliesTo: GENERAL, color: "#b91c1c", mark: "\u041F\u0422" },
  { typeCode: "outdoor-ladder", systemCode: "16", title: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F \u043F\u043E\u0436\u0430\u0440\u043D\u0430\u044F \u043B\u0435\u0441\u0442\u043D\u0438\u0446\u0430", appliesTo: GENERAL, color: "#475569", mark: "\u041F\u041B" },
  { typeCode: "roof-fence", systemCode: "17", title: "\u041E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u0435 \u043A\u0440\u043E\u0432\u043B\u0438", appliesTo: GENERAL, color: "#64748b", mark: "\u041E\u041A" },
  { typeCode: "outdoor-cabinet", systemCode: "01", title: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0449\u0438\u0442", appliesTo: GENERAL, color: "#dc2626", mark: "\u041F\u0429" },
  // Типы щитов по ППР РФ №1479, приложение 6: комплектация у них разная —
  // ЩП-В несёт бочку с водой и вёдра, ЩП-Е — диэлектрические перчатки и
  // коврик. Проверять комплектность «щита вообще» не по чему.
  { typeCode: "fire-board-a", systemCode: "01", title: "\u0429\u0438\u0442 \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0429\u041F-\u0410", appliesTo: GENERAL, color: "#dc2626", mark: "\u0429\u041F-\u0410", showInLibrary: false },
  { typeCode: "fire-board-v", systemCode: "01", title: "\u0429\u0438\u0442 \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0429\u041F-\u0412", appliesTo: GENERAL, color: "#dc2626", mark: "\u0429\u041F-\u0412", showInLibrary: false },
  { typeCode: "fire-board-e", systemCode: "01", title: "\u0429\u0438\u0442 \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0429\u041F-\u0415", appliesTo: GENERAL, color: "#dc2626", mark: "\u0429\u041F-\u0415", showInLibrary: false },
  { typeCode: "fire-board-sh", systemCode: "01", title: "\u0429\u0438\u0442 \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0429\u041F-\u0421\u0425", appliesTo: GENERAL, color: "#dc2626", mark: "\u0429\u041F-\u0421\u0425", showInLibrary: false },
  { typeCode: "fire-board-mobile", systemCode: "01", title: "\u0429\u0438\u0442 \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0434\u0432\u0438\u0436\u043D\u043E\u0439 \u0429\u041F\u041F", appliesTo: GENERAL, color: "#dc2626", mark: "\u0429\u041F\u041F", showInLibrary: false },
  { typeCode: "outdoor-cabinet-box", systemCode: "01", title: "\u0428\u043A\u0430\u0444 \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u043D\u0430\u0440\u0443\u0436\u043D\u044B\u0439", appliesTo: GENERAL, color: "#dc2626", mark: "\u0428\u041F\u041D", showInLibrary: false },
  { typeCode: "fire-post", systemCode: "09", title: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u043F\u043E\u0441\u0442", appliesTo: GENERAL, color: "#16a34a", mark: "\u041F\u0421", showInLibrary: false },
  { typeCode: "pump-station", systemCode: "02.2", title: "\u041D\u0430\u0441\u043E\u0441\u043D\u0430\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u044F", appliesTo: GENERAL, color: "#1d4ed8", mark: "\u041D\u0421" },
  // Поэтажный план и склад: системы защиты внутри здания.
  //
  // В библиотеке огнетушитель один. Подтипы выбираются в карточке и нужны
  // пакету правил: разные ОТВ имеют разные сроки и чек-листы.
  // Периодичность перезарядки различается на порядок в зависимости от заряда
  // (вода/пена — 1 год, порошок и CO₂ — 5 лет, ГОСТ Р 59641-2021, таблица 1
  // п. 5.1.11.1), поэтому у общего типа пакета правил нет — конкретный срок
  // можно назначить только зная заряд. Общий тип остаётся для случаев, когда
  // заряд неизвестен или не важен (например, при первом переносе журнала).
  { typeCode: "extinguisher", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u0413" },
  { typeCode: "extinguisher-water", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u0432\u043E\u0434\u043D\u044B\u0439", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u0412", showInLibrary: false },
  { typeCode: "extinguisher-foam", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u043F\u0435\u043D\u043D\u044B\u0439", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u0412\u041F", showInLibrary: false },
  { typeCode: "extinguisher-emulsion", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u0432\u043E\u0437\u0434\u0443\u0448\u043D\u043E-\u044D\u043C\u0443\u043B\u044C\u0441\u0438\u043E\u043D\u043D\u044B\u0439", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u0412\u042D", showInLibrary: false },
  { typeCode: "extinguisher-powder", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u043F\u043E\u0440\u043E\u0448\u043A\u043E\u0432\u044B\u0439", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u041F", showInLibrary: false },
  { typeCode: "extinguisher-co2", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u0443\u0433\u043B\u0435\u043A\u0438\u0441\u043B\u043E\u0442\u043D\u044B\u0439", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u0423", showInLibrary: false },
  { typeCode: "extinguisher-halon", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u0445\u043B\u0430\u0434\u043E\u043D\u043E\u0432\u044B\u0439", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u0425", showInLibrary: false },
  // Исторический внутренний код сохранён для совместимости с базой; правильное
  // название в интерфейсе — BONTEL, это подтип общей строки «Огнетушитель».
  { typeCode: "extinguisher-bantl", systemCode: "01", title: "\u041E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u044C BONTEL", appliesTo: FLOOR, color: "#dc2626", mark: "\u041E\u0412\u042D", showInLibrary: false },
  { typeCode: "fire-hydrant-indoor", systemCode: "02.1", title: "\u041F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u043A\u0440\u0430\u043D", appliesTo: FLOOR, color: "#ea580c", mark: "\u041F\u041A" },
  { typeCode: "fire-detector", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439", appliesTo: FLOOR, color: "#0891b2", mark: "\u0418\u041F" },
  // Добавлены к трём прежним видам: комбинированный совмещает дымовой и
  // тепловой каналы, газовый следит за угарным газом, аспирационный сам
  // забирает пробу воздуха трубками. Раньше комбинированные извещатели
  // приходилось записывать дымовыми, что неверно.
  { typeCode: "combined-detector", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u043A\u043E\u043C\u0431\u0438\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439", appliesTo: FLOOR, color: "#0891b2", mark: "\u0418\u041F\u041A", showInLibrary: false },
  { typeCode: "gas-detector", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0433\u0430\u0437\u043E\u0432\u044B\u0439", appliesTo: FLOOR, color: "#0891b2", mark: "\u0418\u041F\u0413", showInLibrary: false },
  { typeCode: "aspiration-detector", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0430\u0441\u043F\u0438\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439", appliesTo: FLOOR, color: "#0891b2", mark: "\u0418\u041F\u0410", showInLibrary: false },
  { typeCode: "smoke-detector", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0434\u044B\u043C\u043E\u0432\u043E\u0439", appliesTo: FLOOR, color: "#0891b2", mark: "\u0418\u041F\u0414", showInLibrary: false },
  { typeCode: "heat-detector", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439", appliesTo: FLOOR, color: "#0e7490", mark: "\u0418\u041F\u0422", showInLibrary: false },
  { typeCode: "flame-detector", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u043F\u043B\u0430\u043C\u0435\u043D\u0438", appliesTo: FLOOR, color: "#7c3aed", mark: "\u0418\u041F\u041F", showInLibrary: false },
  { typeCode: "manual-call-point", systemCode: "03.1", title: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u0440\u0443\u0447\u043D\u043E\u0439 \u0418\u041F\u0420", appliesTo: FLOOR, color: "#dc2626", mark: "\u0418\u041F\u0420" },
  { typeCode: "control-panel", systemCode: "03.2", title: "\u041F\u0440\u0438\u0431\u043E\u0440 \u043F\u0440\u0438\u0451\u043C\u043D\u043E-\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u044B\u0439 \u041F\u041F\u041A\u041F", appliesTo: FLOOR, color: "#1d4ed8", mark: "\u041F\u041F\u041A\u041F" },
  { typeCode: "sounder", systemCode: "04", title: "\u0421\u041E\u0423\u042D", appliesTo: FLOOR, color: "#16a34a", mark: "\u0421\u041E\u0423\u042D" },
  // Виды оповещателей по СП 3.13130.2009: звуковые, речевые и световые
  // работают по-разному и проверяются по-разному — у речевого слушают
  // разборчивость записи, у светового смотрят яркость и видимость
  // указателя. Одной строкой «СОУЭ» их не различить, а в журнале они и
  // должны различаться. В библиотеку по отдельности не выносятся: вид
  // уточняется в карточке, как заряд у огнетушителя.
  { typeCode: "sounder-audible", systemCode: "04", title: "\u0417\u0432\u0443\u043A\u043E\u0432\u043E\u0439 \u043E\u043F\u043E\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C (\u0421\u041E\u0423\u042D)", appliesTo: FLOOR, color: "#16a34a", mark: "\u0417\u041E", showInLibrary: false },
  { typeCode: "sounder-speech", systemCode: "04", title: "\u0420\u0435\u0447\u0435\u0432\u043E\u0439 \u043E\u043F\u043E\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C (\u0421\u041E\u0423\u042D)", appliesTo: FLOOR, color: "#16a34a", mark: "\u0420\u041E", showInLibrary: false },
  { typeCode: "sounder-light", systemCode: "04", title: "\u0421\u0432\u0435\u0442\u043E\u0432\u043E\u0439 \u043E\u043F\u043E\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C (\u0421\u041E\u0423\u042D)", appliesTo: FLOOR, color: "#16a34a", mark: "\u0421\u041E", showInLibrary: false },
  { typeCode: "sounder-combined", systemCode: "04", title: "\u0421\u0432\u0435\u0442\u043E-\u0437\u0432\u0443\u043A\u043E\u0432\u043E\u0439 \u043E\u043F\u043E\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C (\u0421\u041E\u0423\u042D)", appliesTo: FLOOR, color: "#16a34a", mark: "\u0421\u0417\u041E", showInLibrary: false },
  { typeCode: "smoke-valve", systemCode: "05", title: "\u041A\u043B\u0430\u043F\u0430\u043D \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0434\u044B\u043C\u043D\u044B\u0439", appliesTo: FLOOR, color: "#0f766e", mark: "\u041A\u041F" },
  // Виды противодымных клапанов по СП 7.13130.2013. Огнезадерживающий
  // стоит открытым и закрывается при пожаре, дымовой — наоборот; проверяют
  // их поэтому в разные стороны, и одной строкой «клапан» это не различить.
  { typeCode: "damper-fire", systemCode: "05", title: "\u041A\u043B\u0430\u043F\u0430\u043D \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u044B\u0439 \u043E\u0433\u043D\u0435\u0437\u0430\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0449\u0438\u0439", appliesTo: FLOOR, color: "#0f766e", mark: "\u041A\u041E\u0417", showInLibrary: false },
  { typeCode: "damper-smoke", systemCode: "05", title: "\u041A\u043B\u0430\u043F\u0430\u043D \u0434\u044B\u043C\u043E\u0432\u043E\u0439", appliesTo: FLOOR, color: "#0f766e", mark: "\u041A\u0414", showInLibrary: false },
  { typeCode: "damper-dual", systemCode: "05", title: "\u041A\u043B\u0430\u043F\u0430\u043D \u0434\u0432\u043E\u0439\u043D\u043E\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F", appliesTo: FLOOR, color: "#0f766e", mark: "\u041A\u0414\u0414", showInLibrary: false },
  { typeCode: "damper-pressure", systemCode: "05", title: "\u041A\u043B\u0430\u043F\u0430\u043D \u0438\u0437\u0431\u044B\u0442\u043E\u0447\u043D\u043E\u0433\u043E \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#0f766e", mark: "\u041A\u0418\u0414", showInLibrary: false },
  { typeCode: "smoke-fan", systemCode: "05", title: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440 \u0434\u044B\u043C\u043E\u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#0f766e", mark: "\u0412\u0414" },
  // Вентилятор дымоудаления вытягивает дым, вентилятор подпора нагнетает
  // воздух в лестничную клетку. Работа противоположная, и путать их в
  // журнале нельзя.
  { typeCode: "fan-exhaust", systemCode: "05", title: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440 \u0434\u044B\u043C\u043E\u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F (\u0432\u044B\u0442\u044F\u0436\u043D\u043E\u0439)", appliesTo: FLOOR, color: "#0f766e", mark: "\u0412\u0414", showInLibrary: false },
  { typeCode: "fan-supply", systemCode: "05", title: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440 \u043F\u043E\u0434\u043F\u043E\u0440\u0430 \u0432\u043E\u0437\u0434\u0443\u0445\u0430 (\u043F\u0440\u0438\u0442\u043E\u0447\u043D\u044B\u0439)", appliesTo: FLOOR, color: "#0f766e", mark: "\u0412\u041F", showInLibrary: false },
  { typeCode: "fire-suppression-system", systemCode: "06", title: "\u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422" },
  { typeCode: "sprinkler", systemCode: "06", title: "\u041E\u0440\u043E\u0441\u0438\u0442\u0435\u043B\u044C", appliesTo: FLOOR, color: "#2563eb", mark: "\u041E\u0420", showInLibrary: false },
  { typeCode: "powder-module", systemCode: "08", title: "\u041C\u043E\u0434\u0443\u043B\u044C \u043F\u043E\u0440\u043E\u0448\u043A\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#a16207", mark: "\u041C\u041F", showInLibrary: false },
  { typeCode: "gas-module", systemCode: "07", title: "\u041C\u043E\u0434\u0443\u043B\u044C \u0433\u0430\u0437\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u041C\u0413", showInLibrary: false },
  // Виды установок пожаротушения по СП 485.1311500.2020 (газовые и
  // порошковые), ГОСТ Р 50680 (водяные), ГОСТ Р 50800 (пенные) и
  // ГОСТ Р 59636-2021. В библиотеку по отдельности не выносятся: на плане
  // это одна строка «Система пожаротушения», а вид уточняется в карточке —
  // так же, как заряд у огнетушителя.
  { typeCode: "aup-sprinkler", systemCode: "06", title: "\u0421\u043F\u0440\u0438\u043D\u043A\u043B\u0435\u0440\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u043E\u0434\u044F\u043D\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-drencher", systemCode: "06", title: "\u0414\u0440\u0435\u043D\u0447\u0435\u0440\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u043E\u0434\u044F\u043D\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-sprinkler-drencher", systemCode: "06", title: "\u0421\u043F\u0440\u0438\u043D\u043A\u043B\u0435\u0440\u043D\u043E-\u0434\u0440\u0435\u043D\u0447\u0435\u0440\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-mist", systemCode: "06", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F \u0442\u043E\u043D\u043A\u043E\u0440\u0430\u0441\u043F\u044B\u043B\u0451\u043D\u043D\u043E\u0439 \u0432\u043E\u0434\u043E\u0439", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-foam", systemCode: "06", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-gas", systemCode: "06", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0433\u0430\u0437\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-powder", systemCode: "06", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0440\u043E\u0448\u043A\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-aerosol", systemCode: "06", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0430\u044D\u0440\u043E\u0437\u043E\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-combined", systemCode: "06", title: "\u041A\u043E\u043C\u0431\u0438\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  { typeCode: "aup-robotic", systemCode: "06", title: "\u0420\u043E\u0431\u043E\u0442\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#2563eb", mark: "\u0410\u0423\u041F\u0422", showInLibrary: false },
  // Автономная установка стоит отдельно от систем, работающих от ППКУ:
  // у неё нет прибора управления, она срабатывает сама и обслуживается сама.
  { typeCode: "autonomous-suppression", systemCode: "08", title: "\u041C\u043E\u0434\u0443\u043B\u044C\u043D\u0430\u044F \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#a16207", mark: "\u0410\u0423\u041F" },
  // Подвиды по огнетушащему веществу: у каждого свой порядок обслуживания по
  // паспорту изделия, и одним списком работ их не покрыть — как и огнетушители.
  { typeCode: "suppression-powder", systemCode: "08", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0440\u043E\u0448\u043A\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#a16207", mark: "\u0410\u0423\u041F", showInLibrary: false },
  { typeCode: "suppression-gas", systemCode: "08", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0433\u0430\u0437\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#a16207", mark: "\u0410\u0423\u041F", showInLibrary: false },
  { typeCode: "suppression-aerosol", systemCode: "08", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0430\u044D\u0440\u043E\u0437\u043E\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#a16207", mark: "\u0410\u0423\u041F", showInLibrary: false },
  { typeCode: "suppression-water", systemCode: "08", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u043E\u0434\u044F\u043D\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F", appliesTo: FLOOR, color: "#a16207", mark: "\u0410\u0423\u041F", showInLibrary: false },
  { typeCode: "suppression-mist", systemCode: "08", title: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0436\u0430\u0440\u043E\u0442\u0443\u0448\u0435\u043D\u0438\u044F \u0442\u043E\u043D\u043A\u043E\u0440\u0430\u0441\u043F\u044B\u043B\u0451\u043D\u043D\u043E\u0439 \u0432\u043E\u0434\u043E\u0439", appliesTo: FLOOR, color: "#a16207", mark: "\u0410\u0423\u041F", showInLibrary: false },
  { typeCode: "fire-door", systemCode: "15", title: "\u041F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u0430\u044F \u0434\u0432\u0435\u0440\u044C, \u043B\u044E\u043A, \u0448\u0442\u043E\u0440\u0430", appliesTo: FLOOR, color: "#7c2d12", mark: "\u041F\u0414" },
  // Огнезащитная обработка — не изделие, а состояние конструкции: её
  // наносят, она действует свой срок и по его истечении возобновляется.
  { typeCode: "fireproofing", systemCode: "15", title: "\u041E\u0433\u043D\u0435\u0437\u0430\u0449\u0438\u0442\u043D\u0430\u044F \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430", appliesTo: FLOOR, color: "#15803d", mark: "\u041E\u0417" },
  { typeCode: "exit", systemCode: "\u2014", title: "\u042D\u0432\u0430\u043A\u0443\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0432\u044B\u0445\u043E\u0434, \u043B\u0435\u0441\u0442\u043D\u0438\u0447\u043D\u0430\u044F \u043A\u043B\u0435\u0442\u043A\u0430", appliesTo: FLOOR, color: "#16a34a", mark: "\u042D\u0412", showInLibrary: false },
  { typeCode: "self-rescuer", systemCode: "26", title: "\u0421\u0430\u043C\u043E\u0441\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C, \u0421\u0418\u0417\u041E\u0414", appliesTo: FLOOR, color: "#9333ea", mark: "\u0421\u0418\u0417" },
  // Фильтрующий самоспасатель очищает наружный воздух и в дыму без
  // кислорода бесполезен; изолирующий несёт свой запас. Срок службы и
  // условия применения у них разные.
  { typeCode: "self-rescuer-filter", systemCode: "26", title: "\u0421\u0430\u043C\u043E\u0441\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C \u0444\u0438\u043B\u044C\u0442\u0440\u0443\u044E\u0449\u0438\u0439", appliesTo: FLOOR, color: "#9333ea", mark: "\u0421\u0418\u0417-\u0424", showInLibrary: false },
  { typeCode: "self-rescuer-isolating", systemCode: "26", title: "\u0421\u0430\u043C\u043E\u0441\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C \u0438\u0437\u043E\u043B\u0438\u0440\u0443\u044E\u0449\u0438\u0439", appliesTo: FLOOR, color: "#9333ea", mark: "\u0421\u0418\u0417-\u0418", showInLibrary: false },
  { typeCode: "evacuation-plan", systemCode: "09", title: "\u041F\u043B\u0430\u043D \u044D\u0432\u0430\u043A\u0443\u0430\u0446\u0438\u0438, \u0437\u043D\u0430\u043A \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438", appliesTo: FLOOR, color: "#059669", mark: "\u0417\u041D", showInLibrary: false }
];

// ../../../../Projects/izh-sppz/packages/core/src/objects/custom-element-registry.ts
var registered = [];
function customElementTypes() {
  return registered;
}
var PLACEMENT_TO_PLAN_KIND = {
  "\u0433\u0435\u043D\u043F\u043B\u0430\u043D": "general",
  "\u044D\u0442\u0430\u0436": "floor",
  "\u0441\u043A\u043B\u0430\u0434": "storage"
};
function planKindsOf(type) {
  return type.placements.map((placement) => PLACEMENT_TO_PLAN_KIND[placement]);
}

// ../../../../Projects/izh-sppz/packages/core/src/objects/element-title-registry.ts
var titles = {};
function elementTitleOverride(typeCode) {
  const value2 = titles[typeCode];
  if (value2 === void 0) return null;
  const trimmed = value2.trim();
  return trimmed === "" ? null : trimmed;
}

// ../../../../Projects/izh-sppz/packages/core/src/objects/element-lookup.ts
function asElementType(type) {
  return {
    typeCode: type.typeCode,
    // Кода системы по регламенту заказчика у своего вида нет: его присваивает
    // не пользователь, а нормативный перечень. Пустая строка честнее выдуманного.
    systemCode: "",
    title: type.title,
    appliesTo: planKindsOf(type),
    color: type.color,
    mark: type.mark
  };
}
function renamed(element) {
  const own = elementTitleOverride(element.typeCode);
  return own === null ? element : { ...element, title: own };
}
function elementByCode(typeCode) {
  const builtin = ELEMENT_CATALOG.find((item) => item.typeCode === typeCode);
  if (builtin !== void 0) return renamed(builtin);
  const own = customElementTypes().find((item) => item.typeCode === typeCode);
  return own === void 0 ? null : renamed(asElementType(own));
}

// ../../../../Projects/izh-sppz/packages/core/src/objects/custom-element-rules.ts
var ICON_MAX_BYTES = 128 * 1024;

// ../../../../Projects/izh-sppz/packages/core/src/objects/fire_extinguisher_reference_v1.json
var fire_extinguisher_reference_v1_default = {
  version: "1.0",
  generatedAt: "2026-08-22",
  description: "\u0426\u0435\u043D\u0442\u0440\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u0438\u043A \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 \u0418\u0416 \u0421\u041F\u041F\u0417. PDF \u043D\u0435 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E; \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0435 \u0430\u0434\u0440\u0435\u0441\u0430 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u0435\u0439. \u041A\u0430\u0436\u0434\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u043C: \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u044B \u043A\u043E\u0434 \u043E\u0442\u0432\u0435\u0442\u0430, \u0442\u0438\u043F \u0438 \u0440\u0430\u0437\u043C\u0435\u0440 \u043E\u0442\u0432\u0435\u0442\u0430.",
  manufacturers: [
    {
      manufacturerId: "bontel",
      manufacturerName: "BONTEL",
      officialSite: "https://bontel.ru",
      series: [
        {
          type: "\u041E\u0412\u042D",
          sizes: [
            "1",
            "2",
            "5",
            "10"
          ],
          brand: "BONTEL",
          serviceLifeYears: 20,
          passportUrl: "https://bontel.effinity-back.ru/uploads/product/12/%D0%A0%D0%AD_%D0%9F%D0%B5%D1%80%D0%B5%D0%B4%D0%B2%D0%B8%D0%B6%D0%BD%D1%8B%D0%B5_%D0%B8_%D0%BF%D0%B5%D1%80%D0%B5%D0%BD%D0%BE%D1%81%D0%BD%D1%8B%D0%B5_%D0%BE%D0%B3%D0%BD%D0%B5%D1%82%D1%83%D1%88%D0%B8%D1%82%D0%B5%D0%BB%D0%B8.pdf",
          passportSource: "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u043D\u044B\u0445 \u0438 \u043F\u0435\u0440\u0435\u0434\u0432\u0438\u0436\u043D\u044B\u0445 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 BONTEL, \u0441\u0441\u044B\u043B\u043A\u0430 \u0441 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0438\u0437\u0434\u0435\u043B\u0438\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 934 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F.",
          officialUrl: "https://bontel.ru/production/ognetushitel"
        },
        {
          type: "\u041E\u0412\u042D",
          sizes: [
            "25"
          ],
          brand: "BONTEL",
          serviceLifeYears: null,
          passportUrl: "https://bontel.effinity-back.ru/uploads/product/12/%D0%A0%D0%AD_%D0%9F%D0%B5%D1%80%D0%B5%D0%B4%D0%B2%D0%B8%D0%B6%D0%BD%D1%8B%D0%B5_%D0%B8_%D0%BF%D0%B5%D1%80%D0%B5%D0%BD%D0%BE%D1%81%D0%BD%D1%8B%D0%B5_%D0%BE%D0%B3%D0%BD%D0%B5%D1%82%D1%83%D1%88%D0%B8%D1%82%D0%B5%D0%BB%D0%B8.pdf",
          passportSource: "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u043D\u044B\u0445 \u0438 \u043F\u0435\u0440\u0435\u0434\u0432\u0438\u0436\u043D\u044B\u0445 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 BONTEL, \u0441\u0441\u044B\u043B\u043A\u0430 \u0441 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0438\u0437\u0434\u0435\u043B\u0438\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 934 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F.",
          officialUrl: "https://bontel.ru/production/ognetushitel"
        }
      ],
      documentHosts: [
        "bontel.effinity-back.ru"
      ]
    },
    {
      manufacturerId: "yarpozhinvest",
      manufacturerName: "\u042F\u0440\u043F\u043E\u0436\u0438\u043D\u0432\u0435\u0441\u0442",
      officialSite: "http://www.yarpojinvest.ru",
      series: [
        {
          type: "\u041E\u041F",
          sizes: [
            "0,5",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "12",
            "20",
            "25",
            "35",
            "40",
            "50",
            "70",
            "75",
            "100"
          ],
          brand: "\u042F\u0440\u043F\u043E\u0436\u0438\u043D\u0432\u0435\u0441\u0442",
          serviceLifeYears: 10,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "http://www.yarpojinvest.ru/products/OP/"
        },
        {
          type: "\u041E\u0423",
          sizes: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "10",
            "15",
            "20",
            "25",
            "40",
            "50",
            "55"
          ],
          brand: "\u042F\u0440\u043F\u043E\u0436\u0438\u043D\u0432\u0435\u0441\u0442",
          serviceLifeYears: 10,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "http://www.yarpojinvest.ru/products/OU/"
        },
        {
          type: "\u041E\u0412\u041F",
          sizes: [
            "6",
            "8",
            "10",
            "40",
            "50",
            "80"
          ],
          brand: "\u042F\u0440\u043F\u043E\u0436\u0438\u043D\u0432\u0435\u0441\u0442",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "http://www.yarpojinvest.ru/products/OVP/"
        },
        {
          type: "\u041E\u0412\u042D",
          sizes: [
            "4",
            "10"
          ],
          brand: "\u042F\u0440\u043F\u043E\u0436\u0438\u043D\u0432\u0435\u0441\u0442",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "http://www.yarpojinvest.ru/"
        }
      ]
    },
    {
      manufacturerId: "rusarsenal",
      manufacturerName: "\u041D\u041F\u041E \u0420\u0423\u0421\u0410\u0420\u0421\u0415\u041D\u0410\u041B",
      officialSite: "https://rusarsenal.ru",
      series: [
        {
          type: "\u041E\u041F",
          sizes: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "8",
            "10",
            "25",
            "35",
            "50",
            "70",
            "100"
          ],
          brand: "\u041D\u041F\u041E \u0420\u0423\u0421\u0410\u0420\u0421\u0415\u041D\u0410\u041B",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://rusarsenal.ru/catalog/fire-extinguishers/powder/"
        },
        {
          type: "\u041E\u0423",
          sizes: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "10",
            "15",
            "20",
            "25",
            "40",
            "50",
            "55"
          ],
          brand: "\u041D\u041F\u041E \u0420\u0423\u0421\u0410\u0420\u0421\u0415\u041D\u0410\u041B",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://rusarsenal.ru/catalog/fire-extinguishers/carbon-dioxide/"
        }
      ]
    },
    {
      manufacturerId: "pozhtekhnika",
      manufacturerName: "\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430",
      officialSite: "https://ptc01.ru",
      series: [
        {
          type: "\u041E\u041F",
          sizes: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "8",
            "10"
          ],
          brand: "\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430",
          serviceLifeYears: 10,
          passportUrl: "https://ptc01.ru/pdf/tech-spec-extinguishers.pdf",
          passportSource: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 \u0417\u0410\u041E \xAB\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430\xBB. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 304 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041E\u0431\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0430 \u043B\u0438\u043D\u0435\u0439\u043A\u0443, \u0430 \u043D\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: "https://ptc01.ru/production/ognetushiteli_poroshkovye_mig/"
        },
        {
          type: "\u041E\u0423",
          sizes: [
            "2",
            "3",
            "5",
            "7",
            "10",
            "20",
            "40",
            "55"
          ],
          brand: "\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430",
          serviceLifeYears: 10,
          passportUrl: "https://ptc01.ru/pdf/tech-spec-extinguishers.pdf",
          passportSource: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 \u0417\u0410\u041E \xAB\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430\xBB. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 304 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041E\u0431\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0430 \u043B\u0438\u043D\u0435\u0439\u043A\u0443, \u0430 \u043D\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: "https://ptc01.ru/production/"
        }
      ]
    },
    {
      manufacturerId: "iney",
      manufacturerName: "\u0418\u041D\u0415\u0419",
      officialSite: "https://ptc01.ru",
      series: [
        {
          type: "\u041E\u0423",
          sizes: [
            "2",
            "3",
            "5",
            "7"
          ],
          brand: "\u0418\u041D\u0415\u0419",
          serviceLifeYears: 15,
          passportUrl: "https://ptc01.ru/pdf/tech-spec-extinguishers.pdf",
          passportSource: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 \u0417\u0410\u041E \xAB\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430\xBB. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 304 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041E\u0431\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0430 \u043B\u0438\u043D\u0435\u0439\u043A\u0443, \u0430 \u043D\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: "https://ptc01.ru/production/khladonovye_ognetushiteli_iney/"
        }
      ]
    },
    {
      manufacturerId: "mig",
      manufacturerName: "\u041C\u0418\u0413",
      officialSite: "https://ptc01.ru",
      series: [
        {
          type: "\u041E\u041F",
          sizes: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "8",
            "10",
            "25",
            "35",
            "50",
            "70",
            "100"
          ],
          brand: "\u041C\u0418\u0413",
          serviceLifeYears: null,
          passportUrl: "https://ptc01.ru/pdf/tech-spec-extinguishers.pdf",
          passportSource: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 \u0417\u0410\u041E \xAB\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430\xBB. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 304 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041E\u0431\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0430 \u043B\u0438\u043D\u0435\u0439\u043A\u0443, \u0430 \u043D\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: "https://ptc01.ru/production/ognetushiteli_poroshkovye_mig/"
        },
        {
          type: "\u041E\u0423",
          sizes: [
            "2",
            "3",
            "5",
            "7",
            "10",
            "20",
            "40"
          ],
          brand: "\u041C\u0418\u0413",
          serviceLifeYears: null,
          passportUrl: "https://ptc01.ru/pdf/tech-spec-extinguishers.pdf",
          passportSource: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 \u0417\u0410\u041E \xAB\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430\xBB. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 304 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041E\u0431\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0430 \u043B\u0438\u043D\u0435\u0439\u043A\u0443, \u0430 \u043D\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: "https://ptc01.ru/production/"
        },
        {
          type: "\u041E\u0412\u041F",
          sizes: [
            "4",
            "6",
            "8",
            "10"
          ],
          brand: "\u041C\u0418\u0413",
          serviceLifeYears: null,
          passportUrl: "https://ptc01.ru/pdf/tech-spec-extinguishers.pdf",
          passportSource: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0433\u043D\u0435\u0442\u0443\u0448\u0438\u0442\u0435\u043B\u0435\u0439 \u0417\u0410\u041E \xAB\u041F\u043E\u0436\u0442\u0435\u0445\u043D\u0438\u043A\u0430\xBB. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E 30.08.2026: PDF, 304 \u041A\u0411.",
          passportRevision: null,
          notes: "\u041E\u0431\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0430 \u043B\u0438\u043D\u0435\u0439\u043A\u0443, \u0430 \u043D\u0435 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: "https://ptc01.ru/production/ognetushiteli_vozdushno_pennye_mig_s_ftorsoderzhashchim_zaryadom_zakachnye/"
        }
      ]
    },
    {
      manufacturerId: "rif",
      manufacturerName: "\u0420\u0418\u0424",
      officialSite: "https://rifgroup.ru",
      series: [
        {
          type: "\u041E\u0412\u042D",
          sizes: [
            "2",
            "4",
            "5"
          ],
          brand: "\u0420\u0418\u0424",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://rifgroup.ru/produktsiya/ognetushiteli/voem/"
        },
        {
          type: "\u041E\u041F",
          sizes: [
            "25",
            "35",
            "40"
          ],
          brand: "\u0420\u0418\u0424",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://rifgroup.ru/produktsiya/ognetushiteli/"
        }
      ]
    },
    {
      manufacturerId: "farro",
      manufacturerName: "\u041D\u041F\u041E \u0424\u0410\u0420\u0420\u041E",
      officialSite: "https://npo-farro.ru",
      series: [
        {
          type: "\u041E\u0412\u042D",
          sizes: [
            "2",
            "4",
            "5",
            "6",
            "8",
            "10"
          ],
          brand: "FARRO",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://npo-farro.ru/ognetushiteli-ove"
        }
      ]
    },
    {
      manufacturerId: "poznanotech",
      manufacturerName: "\u041F\u043E\u0436\u043D\u0430\u043D\u043E\u0442\u0435\u0445",
      officialSite: "https://poznanotech.ru",
      series: [
        {
          type: "\u041E\u0412\u042D",
          sizes: [
            "2",
            "4",
            "5",
            "6",
            "8",
            "10",
            "20",
            "25",
            "40",
            "50",
            "80",
            "100"
          ],
          brand: "\u041F\u043E\u0436\u043D\u0430\u043D\u043E\u0442\u0435\u0445",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://poznanotech.ru/"
        }
      ]
    },
    {
      manufacturerId: "bonus-vita",
      manufacturerName: "\u0411\u043E\u043D\u0443\u0441-\u0412\u0438\u0442\u0430",
      officialSite: "https://xn----7sbbfcqfo2cfcafdeligxl0qh.xn--p1ai",
      series: [
        {
          type: "\u041E\u041F",
          sizes: [
            "0,5",
            "2",
            "4",
            "6"
          ],
          brand: "\u0411\u043E\u043D\u0443\u0441-\u0412\u0438\u0442\u0430",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://xn----7sbbfcqfo2cfcafdeligxl0qh.xn--p1ai/catalog/Ognetushiteli-ABCE"
        },
        {
          type: "\u041E\u0423",
          sizes: [
            "2"
          ],
          brand: "\u0411\u043E\u043D\u0443\u0441-\u0412\u0438\u0442\u0430",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://xn----7sbbfcqfo2cfcafdeligxl0qh.xn--p1ai/catalog/Ognetushiteli-BCE"
        }
      ]
    },
    {
      manufacturerId: "melanti",
      manufacturerName: "\u041C\u0415\u041B\u0410\u041D\u0422\u0418",
      officialSite: "https://melanti.com",
      series: [
        {
          type: "\u041E\u041F",
          sizes: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "8",
            "10"
          ],
          brand: "\u041C\u0415\u041B\u0410\u041D\u0422\u0418",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://melanti.com/catalog/ognetushiteli/"
        },
        {
          type: "\u041E\u0423",
          sizes: [
            "2",
            "3",
            "5"
          ],
          brand: "\u041C\u0415\u041B\u0410\u041D\u0422\u0418",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442: \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u2014 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          passportRevision: null,
          notes: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0438\u0437\u0434\u0435\u043B\u0438\u044F; \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438.",
          officialUrl: "https://melanti.com/catalog/ognetushiteli-uglekislotnye/"
        }
      ]
    },
    {
      manufacturerId: "vesta",
      manufacturerName: "\u0412\u0435\u0441\u0442\u0430",
      officialSite: "",
      series: [
        {
          type: "\u041E\u041F",
          sizes: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "8",
            "10"
          ],
          brand: "\u0412\u0435\u0441\u0442\u0430",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0438\u0437\u0434\u0435\u043B\u0438\u044F \u043D\u0430\u0439\u0442\u0438 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C: \u0441\u0430\u0439\u0442 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044F \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D.",
          passportRevision: null,
          notes: "\u041D\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B, \u043D\u0438 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430: \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0439\u0442\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u043E \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C\u0443 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0443 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: null
        },
        {
          type: "\u041E\u0423",
          sizes: [
            "2",
            "3",
            "5"
          ],
          brand: "\u0412\u0435\u0441\u0442\u0430",
          serviceLifeYears: null,
          passportUrl: null,
          passportSource: "\u041E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0438\u0437\u0434\u0435\u043B\u0438\u044F \u043D\u0430\u0439\u0442\u0438 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C: \u0441\u0430\u0439\u0442 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044F \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D.",
          passportRevision: null,
          notes: "\u041D\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B, \u043D\u0438 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430: \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0439\u0442\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u043E \u0431\u0443\u043C\u0430\u0436\u043D\u043E\u043C\u0443 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0443 \u0438\u0437\u0434\u0435\u043B\u0438\u044F.",
          officialUrl: null
        }
      ]
    }
  ],
  linksCheckedOn: "2026-08-30"
};

// ../../../../Projects/izh-sppz/packages/core/src/objects/extinguisher-reference.ts
var REFERENCE = fire_extinguisher_reference_v1_default;
var MANUFACTURERS = REFERENCE.manufacturers;
var FLAT_MODELS = MANUFACTURERS.flatMap(
  (manufacturer) => manufacturer.series.flatMap((series) => series.sizes.map((size) => ({
    manufacturerId: manufacturer.manufacturerId,
    manufacturerName: manufacturer.manufacturerName,
    officialSite: manufacturer.officialSite,
    type: series.type,
    typeCode: typeCodeForMark(series.type),
    model: `${series.type}-${size} ${series.brand}`,
    charge: chargeOf(size),
    serviceLifeYears: series.serviceLifeYears,
    officialUrl: officialLink(series.officialUrl ?? null, manufacturer),
    passportUrl: officialLink(series.passportUrl, manufacturer),
    passportSource: series.passportSource,
    passportRevision: series.passportRevision,
    notes: series.notes
  })))
);
function officialLink(url, manufacturer) {
  if (url === null || manufacturer.officialSite === "") return null;
  try {
    const link = new URL(url);
    const official = new URL(manufacturer.officialSite);
    if (link.protocol !== "https:" && link.protocol !== "http:") return null;
    const allowed = link.hostname === official.hostname || (manufacturer.documentHosts ?? []).includes(link.hostname);
    return allowed ? link.href : null;
  } catch {
    return null;
  }
}
function chargeOf(size) {
  const value2 = Number(size.replace(",", "."));
  return Number.isFinite(value2) && value2 > 0 ? value2 : null;
}
function typeCodeForMark(type) {
  if (type === "\u041E\u041F") return "extinguisher-powder";
  if (type === "\u041E\u0423") return "extinguisher-co2";
  if (type === "\u041E\u0412\u041F") return "extinguisher-foam";
  if (type === "\u041E\u0412\u042D") return "extinguisher-bantl";
  if (type === "\u041E\u0412") return "extinguisher-water";
  return "extinguisher";
}

// ../../../../Projects/izh-sppz/packages/core/src/validation/problem.ts
function forbid(message, field) {
  return field === void 0 ? { severity: "\u0437\u0430\u043F\u0440\u0435\u0442", message } : { severity: "\u0437\u0430\u043F\u0440\u0435\u0442", message, field };
}
function warn(message, field) {
  return field === void 0 ? { severity: "\u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435", message } : { severity: "\u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435", message, field };
}
function blocking(problems) {
  return problems.filter((problem) => problem.severity === "\u0437\u0430\u043F\u0440\u0435\u0442");
}
function isCalendarDate(value2) {
  return typeof value2 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value2);
}
function isBefore(a, b) {
  return a < b;
}

// ../../../../Projects/izh-sppz/packages/core/src/validation/object-constraints.ts
function objectProblems(object, context) {
  return [
    ...lifecycleDates(object, context.today),
    ...extinguisherNumbers(object),
    ...systemLinks(object, context),
    ...placementLinks(object, context),
    ...placementAndRoom(object, context)
  ];
}
function lifecycleDates(object, today) {
  const problems = [];
  const made = object.extinguisherProfile?.manufacturedOn ?? null;
  const placed = object.commissionedOn ?? null;
  const recharged = object.extinguisherProfile?.lastRechargeOn ?? null;
  if (isCalendarDate(made) && isCalendarDate(placed) && isBefore(placed, made)) {
    problems.push(forbid(
      "\u0414\u0430\u0442\u0430 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0430 \u0443\u0447\u0451\u0442 \u0440\u0430\u043D\u044C\u0448\u0435 \u0434\u0430\u0442\u044B \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043E\u0431\u0435 \u0434\u0430\u0442\u044B: \u043E\u0442 \u043D\u0438\u0445 \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u0432\u0441\u0435 \u0441\u0440\u043E\u043A\u0438.",
      "commissionedOn"
    ));
  }
  if (isCalendarDate(made) && isCalendarDate(recharged) && isBefore(recharged, made)) {
    problems.push(forbid("\u0414\u0430\u0442\u0430 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0440\u0430\u043D\u044C\u0448\u0435 \u0434\u0430\u0442\u044B \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u044F.", "lastRechargeOn"));
  }
  if (isCalendarDate(made) && isBefore(today, made)) {
    problems.push(forbid("\u0414\u0430\u0442\u0430 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0432 \u0431\u0443\u0434\u0443\u0449\u0435\u043C.", "manufacturedOn"));
  }
  if (isCalendarDate(recharged) && isBefore(today, recharged)) {
    problems.push(forbid("\u0414\u0430\u0442\u0430 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0432 \u0431\u0443\u0434\u0443\u0449\u0435\u043C.", "lastRechargeOn"));
  }
  if (isCalendarDate(placed) && isBefore(today, placed)) {
    problems.push(warn(
      "\u0414\u0430\u0442\u0430 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0430 \u0443\u0447\u0451\u0442 \u0432 \u0431\u0443\u0434\u0443\u0449\u0435\u043C. \u0422\u0430\u043A \u0431\u044B\u0432\u0430\u0435\u0442 \u043F\u0440\u0438 \u043F\u043B\u0430\u043D\u043E\u0432\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435 \u2014 \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u044D\u0442\u043E \u043D\u0435 \u043E\u043F\u0435\u0447\u0430\u0442\u043A\u0430.",
      "commissionedOn"
    ));
  }
  const years = object.serviceLifeYears ?? null;
  if (years !== null && (!Number.isInteger(years) || years < 1 || years > 50)) {
    problems.push(forbid("\u0421\u0440\u043E\u043A \u0441\u043B\u0443\u0436\u0431\u044B \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0446\u0435\u043B\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C \u043B\u0435\u0442 \u043E\u0442 1 \u0434\u043E 50.", "serviceLifeYears"));
  }
  return problems;
}
function extinguisherNumbers(object) {
  const profile = object.extinguisherProfile;
  if (profile === null || profile === void 0) return [];
  const problems = [];
  const { pressureMinMpa: min, nominalPressureMpa: nominal, pressureMaxMpa: max } = profile;
  if (min !== null && max !== null && min > max) {
    problems.push(forbid("\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0433\u043E.", "pressureMinMpa"));
  }
  if (min !== null && nominal !== null && nominal < min) {
    problems.push(forbid("\u041D\u043E\u043C\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0435 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0438\u0436\u0435 \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E.", "nominalPressureMpa"));
  }
  if (max !== null && nominal !== null && nominal > max) {
    problems.push(forbid("\u041D\u043E\u043C\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0435 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432\u044B\u0448\u0435 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E.", "nominalPressureMpa"));
  }
  if (profile.tareMassKg !== null && profile.nominalFullMassKg !== null && profile.tareMassKg >= profile.nominalFullMassKg) {
    problems.push(forbid(
      "\u041C\u0430\u0441\u0441\u0430 \u043F\u0443\u0441\u0442\u043E\u0433\u043E \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 \u043F\u043E\u043B\u043D\u043E\u0439 \u043C\u0430\u0441\u0441\u044B. \u041F\u043E\u043B\u043D\u0430\u044F \u043C\u0430\u0441\u0441\u0430 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u0437\u0430\u0440\u044F\u0434.",
      "tareMassKg"
    ));
  }
  if (profile.temperatureMinC !== null && profile.temperatureMaxC !== null && profile.temperatureMinC >= profile.temperatureMaxC) {
    problems.push(forbid("\u041D\u0438\u0436\u043D\u044F\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u043D\u0438\u0436\u0435 \u0432\u0435\u0440\u0445\u043D\u0435\u0439.", "temperatureMinC"));
  }
  if (profile.nominalCharge !== null && profile.nominalCharge <= 0) {
    problems.push(forbid("\u041D\u043E\u043C\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u0440\u044F\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0443\u043B\u044F.", "nominalCharge"));
  }
  return problems;
}
function systemLinks(object, context) {
  const systemId = object.systemId ?? null;
  if (systemId === null) return [];
  const problems = [];
  if (systemId === object.id) {
    problems.push(forbid("\u042D\u043B\u0435\u043C\u0435\u043D\u0442 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u0445\u043E\u0434\u0438\u0442\u044C \u0441\u0430\u043C \u0432 \u0441\u0435\u0431\u044F.", "systemId"));
    return problems;
  }
  const head = context.objects.find((item) => item.id === systemId) ?? null;
  if (head === null) return problems;
  if ((head.systemId ?? null) !== null) {
    problems.push(forbid(
      "\u041F\u0440\u0438\u0431\u043E\u0440 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u0441\u0430\u043C \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0434\u0440\u0443\u0433\u0443\u044E \u0441\u0438\u0441\u0442\u0435\u043C\u0443. \u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u043A \u043F\u0440\u0438\u0431\u043E\u0440\u0443 \u043D\u0430\u043F\u0440\u044F\u043C\u0443\u044E.",
      "systemId"
    ));
  }
  const own = buildingOf(context.nodes, object.nodeId);
  const headBuilding = buildingOf(context.nodes, head.nodeId);
  if (own !== null && headBuilding !== null && own !== headBuilding) {
    problems.push(forbid(
      "\u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u0434\u0440\u0443\u0433\u043E\u043C \u0437\u0434\u0430\u043D\u0438\u0438, \u0447\u0435\u043C \u0435\u0451 \u043F\u0440\u0438\u0431\u043E\u0440.",
      "systemId"
    ));
  }
  return problems;
}
function placementLinks(object, context) {
  const placementId = object.placementId ?? null;
  if (placementId === null) return [];
  if (placementId === object.id) {
    return [forbid("\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043C \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0441\u0430\u043C\u043E\u0439 \u0441\u0435\u0431\u044F.", "placementId")];
  }
  const head = context.objects.find((item) => item.id === placementId) ?? null;
  if (head === null) return [];
  const problems = [];
  if ((head.placementId ?? null) !== null) {
    problems.push(forbid("\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043C \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0439.", "placementId"));
  }
  if (head.typeCode !== object.typeCode) {
    problems.push(forbid("\u0412 \u043E\u0434\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0438\u0434\u0430.", "placementId"));
  }
  return problems;
}
function placementAndRoom(object, context) {
  const problems = [];
  const roomId = object.roomId ?? null;
  if (roomId !== null && context.rooms !== void 0) {
    const room = context.rooms.find((item) => item.id === roomId) ?? null;
    if (room !== null && room.levelId !== object.nodeId) {
      problems.push(forbid("\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u043A \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u044D\u0442\u0430\u0436\u0443.", "roomId"));
    }
  }
  const regNumber = (object.regNumber ?? "").trim();
  if (regNumber !== "") {
    const building = buildingOf(context.nodes, object.nodeId);
    const twin = context.objects.find((item) => item.id !== object.id && item.archivedAt === null && item.typeCode === object.typeCode && (item.regNumber ?? "").trim() === regNumber && buildingOf(context.nodes, item.nodeId) === building);
    if (twin !== void 0) {
      problems.push(warn(`\u0423\u0447\u0451\u0442\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \xAB${regNumber}\xBB \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0443 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0442\u0430\u043A\u043E\u0433\u043E \u0436\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430 \u0432 \u044D\u0442\u043E\u043C \u0437\u0434\u0430\u043D\u0438\u0438.`, "regNumber"));
    }
  }
  return problems;
}
function buildingOf(nodes, nodeId) {
  return pathToNode(nodes, nodeId).find((node) => node.kind === "building")?.id ?? null;
}

// ../../../../Projects/izh-sppz/packages/core/src/objects/object-scenarios.ts
function clean(raw) {
  if (raw === null || raw === void 0) return null;
  const value2 = raw.trim().replace(/\s+/g, " ");
  return value2.length === 0 ? null : value2;
}
async function placeObject(deps, input) {
  const element = elementByCode(input.typeCode);
  if (element === null) return err("INVALID_ARGUMENT", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430.");
  const node = await deps.tree.getById(input.nodeId);
  if (!node.ok) return node;
  if (node.value.archivedAt !== null) {
    return err("INVALID_ARGUMENT", `\u0423\u0437\u0435\u043B \xAB${node.value.name}\xBB \u0432\u044B\u0432\u0435\u0434\u0435\u043D \u0438\u0437 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438.`);
  }
  const planKind = ruleFor(node.value.kind).planKind;
  if (planKind === "none") {
    return err("INVALID_ARGUMENT", "\u0423 \u044D\u0442\u043E\u0433\u043E \u0443\u0437\u043B\u0430 \u043D\u0435\u0442 \u0440\u0430\u0431\u043E\u0447\u0435\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0438: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u0434\u0430\u043D\u0438\u0435, \u044D\u0442\u0430\u0436 \u0438\u043B\u0438 \u0441\u043A\u043B\u0430\u0434.");
  }
  if (!element.appliesTo.includes(planKind)) {
    return err("INVALID_ARGUMENT", `\xAB${element.title}\xBB \u043D\u0430 \u044D\u0442\u043E\u0439 \u0440\u0430\u0431\u043E\u0447\u0435\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u043D\u0435 \u0440\u0430\u0437\u043C\u0435\u0449\u0430\u0435\u0442\u0441\u044F.`);
  }
  const now = deps.clock.nowUtc();
  const object = {
    id: deps.ids.newId(),
    siteId: node.value.siteId,
    nodeId: node.value.id,
    typeCode: element.typeCode,
    regNumber: clean(input.regNumber),
    model: clean(input.model),
    manufacturer: clean(input.manufacturer),
    serialNumber: null,
    commissionedOn: clean(input.commissionedOn),
    serviceLifeYears: input.serviceLifeYears ?? null,
    serviceLifeMonths: input.serviceLifeYears === void 0 ? input.serviceLifeMonths ?? null : null,
    responsible: clean(input.responsible),
    extinguisherProfile: input.extinguisherProfile ?? null,
    roomId: clean(input.roomId),
    // На складе координат нет по существу: важен состав, а не расположение.
    position: planKind === "storage" ? null : input.position,
    technicalState: "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E",
    note: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1
  };
  const forbidden = await checkConstraints(deps, object);
  if (forbidden !== null) return forbidden;
  const saved = await deps.objects.save(object);
  if (!saved.ok) return saved;
  return ok(object);
}
async function checkConstraints(deps, object) {
  const all = await deps.objects.list();
  if (!all.ok) return all;
  const nodes = await deps.tree.list();
  if (!nodes.ok) return nodes;
  const problems = blocking(objectProblems(object, {
    nodes: nodes.value,
    objects: all.value,
    today: deps.clock.nowUtc().slice(0, 10)
  }));
  return problems.length === 0 ? null : err("INVALID_ARGUMENT", problems.map((item) => item.message).join(" "));
}

// ../../../../Projects/izh-sppz/packages/core/src/objects/outdoor-equipment-reference.ts
var FENCE_HEIGHT_BY_BUILDING = [
  { upToM: 20, requiredM: 0.6 },
  { upToM: 30, requiredM: 0.8 },
  { upToM: 50, requiredM: 1 },
  { upToM: Number.POSITIVE_INFINITY, requiredM: 1.1 }
];

// ../../../../Projects/izh-sppz/packages/core/src/legal/agreement-text.ts
var AGREEMENT_TEXT = `
1. \u041E\u0431\u0449\u0438\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F

1.1. \u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0435 \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0437\u0430\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u043C\u0435\u0436\u0434\u0443 \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u0435\u043C \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0434\u043B\u044F \u042D\u0412\u041C
\xAB\u0418\u0416 \u0421\u041F\u041F\u0417 \u2014 \u0438\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u0436\u0443\u0440\u043D\u0430\u043B \u0441\u0438\u0441\u0442\u0435\u043C \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0437\u0430\u0449\u0438\u0442\u044B\xBB (\u0434\u0430\u043B\u0435\u0435 \u2014
\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430) \u0438 \u043B\u0438\u0446\u043E\u043C, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0449\u0438\u043C \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 (\u0434\u0430\u043B\u0435\u0435 \u2014 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C).

1.2. \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u043E\u043C \u043F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F (\u0441\u0442\u0430\u0442\u044C\u044F 428 \u0413\u0440\u0430\u0436\u0434\u0430\u043D\u0441\u043A\u043E\u0433\u043E
\u043A\u043E\u0434\u0435\u043A\u0441\u0430 \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438). \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430, \u0437\u0430\u043F\u0443\u0441\u043A \u0438 \u043B\u044E\u0431\u043E\u0435 \u0438\u043D\u043E\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435
\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043E\u0437\u043D\u0430\u0447\u0430\u044E\u0442 \u043F\u043E\u043B\u043D\u043E\u0435 \u0438 \u0431\u0435\u0437\u043E\u0433\u043E\u0432\u043E\u0440\u043E\u0447\u043D\u043E\u0435 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F.

1.3. \u0415\u0441\u043B\u0438 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u0435\u043D \u0441 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438 \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F, \u043E\u043D \u043E\u0431\u044F\u0437\u0430\u043D \u043F\u0440\u0435\u043A\u0440\u0430\u0442\u0438\u0442\u044C
\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0435\u0451.

2. \u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F

2.1. \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044C \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043F\u0440\u0430\u0432\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043D\u0430
\u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445 \u043F\u0440\u043E\u0441\u0442\u043E\u0439 (\u043D\u0435\u0438\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439) \u043B\u0438\u0446\u0435\u043D\u0437\u0438\u0438 \u0432 \u043E\u0431\u044A\u0451\u043C\u0435, \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E\u043C \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u043C
\u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435\u043C.

2.2. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043F\u0440\u0435\u0434\u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0430 \u0434\u043B\u044F \u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0443\u0447\u0451\u0442\u0430 \u0441\u0438\u0441\u0442\u0435\u043C \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0437\u0430\u0449\u0438\u0442\u044B,
\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u043E\u0431 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0438 \u0438 \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0436\u0443\u0440\u043D\u0430\u043B\u043E\u0432 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438.

2.3. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0432\u0441\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043E\u043C \u0443\u0447\u0451\u0442\u0430. \u041E\u043D\u0430 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F
\u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043E\u043C \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u044F \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438, \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043E\u043C \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F, \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043E\u043C
\u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u043A\u0438 \u0438 \u043D\u0435 \u043F\u043E\u0434\u043B\u0435\u0436\u0438\u0442 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0432 \u044D\u0442\u043E\u043C \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0435.

3. \u0427\u0442\u043E \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0434\u0435\u043B\u0430\u0435\u0442 \u0438 \u0447\u0435\u0433\u043E \u043D\u0435 \u0434\u0435\u043B\u0430\u0435\u0442

3.1. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442 \u0440\u0430\u0441\u0447\u0451\u0442\u044B \u0438 \u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0435\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0438\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043D\u0430
\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0438 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439, \u0432\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0445 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C.

3.2. \u041F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u044C, \u043F\u043E\u043B\u043D\u043E\u0442\u0430 \u0438 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432\u0432\u043E\u0434\u0438\u043C\u044B\u0445 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E
\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u044E\u0442\u0441\u044F \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u0432\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0445
\u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438.

3.3. \u041F\u0440\u0438\u0432\u043E\u0434\u0438\u043C\u044B\u0435 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B, \u0441\u0440\u043E\u043A\u0438, \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u043D\u043E\u0441\u0442\u044C
\u0440\u0430\u0431\u043E\u0442 \u0438 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043D\u043E\u0441\u044F\u0442 \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u044B\u0439 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440. \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u0443\u044E \u0441\u0438\u043B\u0443 \u0438\u043C\u0435\u044E\u0442
\u0441\u0430\u043C\u0438 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u043E\u0432\u044B\u0435 \u0430\u043A\u0442\u044B \u0432 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0439 \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u0438.

3.4. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u0435\u0442 \u0441\u043E\u0431\u043E\u0439:
\u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0438 \u0435\u0433\u043E \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435;
\u2014 \u0440\u0430\u0431\u043E\u0442\u044B, \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u043C\u044B\u0435 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F\u043C\u0438, \u0438\u043C\u0435\u044E\u0449\u0438\u043C\u0438 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u043B\u0438\u0446\u0435\u043D\u0437\u0438\u044E \u041C\u0427\u0421
  \u0420\u043E\u0441\u0441\u0438\u0438;
\u2014 \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u043D\u044B\u0445 \u043B\u0438\u0446;
\u2014 \u043F\u0435\u0440\u0432\u0438\u0447\u043D\u044B\u0435 \u0443\u0447\u0451\u0442\u043D\u044B\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B, \u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C.

4. \u041E\u0431\u044F\u0437\u0430\u043D\u043D\u043E\u0441\u0442\u0438 \u0438 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F

4.1. \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E \u0438 \u0432 \u043F\u043E\u043B\u043D\u043E\u043C \u043E\u0431\u044A\u0451\u043C\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u0437\u0430:
\u2014 \u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u043E\u0441\u0442\u044C, \u043F\u043E\u043B\u043D\u043E\u0442\u0443 \u0438 \u0441\u0432\u043E\u0435\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0432\u0432\u043E\u0434\u0438\u043C\u044B\u0445 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439;
\u2014 \u0441\u043E\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u0439 \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 \u043D\u0430 \u0441\u0432\u043E\u0438\u0445 \u043E\u0431\u044A\u0435\u043A\u0442\u0430\u0445;
\u2014 \u0441\u0432\u043E\u0435\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043E\u043A, \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439, \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0438 \u0438 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E
  \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F;
\u2014 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u0438 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432, \u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E
  \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438;
\u2014 \u043F\u0440\u0430\u0432\u043E\u043C\u0435\u0440\u043D\u043E\u0441\u0442\u044C \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445, \u0432\u043D\u043E\u0441\u0438\u043C\u044B\u0445 \u0438\u043C \u0432 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443;
\u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0445, \u0432\u043A\u043B\u044E\u0447\u0430\u044F \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0445 \u043A\u043E\u043F\u0438\u0439.

4.2. \u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0437\u0430 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u0435 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u0439 \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 \u043D\u0435\u0441\u0443\u0442 \u043B\u0438\u0446\u0430,
\u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u0435 \u0432 \u0441\u0442\u0430\u0442\u044C\u0435 38 \u0424\u0435\u0434\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u0430 \u043E\u0442 21.12.1994 \u2116 69-\u0424\u0417 \xAB\u041E \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439
\u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438\xBB. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043D\u0435 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442 \u044D\u0442\u0443 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u043D\u0430
\u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044F.

4.3. \u041F\u0440\u0435\u0442\u0435\u043D\u0437\u0438\u0438 \u043E\u0440\u0433\u0430\u043D\u043E\u0432 \u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0433\u043E \u043D\u0430\u0434\u0437\u043E\u0440\u0430, \u0438\u043D\u044B\u0445 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u044E\u0449\u0438\u0445
\u043E\u0440\u0433\u0430\u043D\u043E\u0432 \u0438 \u0442\u0440\u0435\u0442\u044C\u0438\u0445 \u043B\u0438\u0446, \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0435 \u0441 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435\u043C \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0437\u0430\u0449\u0438\u0442\u044B \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432
\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F, \u0441 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435\u043C \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E\u0441\u044F \u0438\u043C \u0443\u0447\u0451\u0442\u0430 \u0438 \u0441 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435\u043C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432,
\u0440\u0430\u0437\u0440\u0435\u0448\u0430\u044E\u0442\u0441\u044F \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E \u0438 \u0437\u0430 \u0441\u0432\u043E\u0439 \u0441\u0447\u0451\u0442.

5. \u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0439

5.1. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \xAB\u043A\u0430\u043A \u0435\u0441\u0442\u044C\xBB (as is). \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044C \u043D\u0435
\u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0431\u0435\u0441\u043F\u0435\u0440\u0435\u0431\u043E\u0439\u043D\u043E\u0439 \u0438 \u0431\u0435\u0437\u043E\u0448\u0438\u0431\u043E\u0447\u043D\u043E\u0439 \u0440\u0430\u0431\u043E\u0442\u044B \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B, \u0435\u0451 \u043F\u0440\u0438\u0433\u043E\u0434\u043D\u043E\u0441\u0442\u0438 \u0434\u043B\u044F
\u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0445 \u0446\u0435\u043B\u0435\u0439 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0438 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F\u043C \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.

5.2. \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442, \u0447\u0442\u043E \u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0435\u043C\u044B\u0435 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0431\u0443\u0434\u0443\u0442
\u043F\u0440\u0438\u043D\u044F\u0442\u044B \u043A\u0430\u043A\u0438\u043C\u0438-\u043B\u0438\u0431\u043E \u043E\u0440\u0433\u0430\u043D\u0430\u043C\u0438 \u0438\u043B\u0438 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F\u043C\u0438, \u0438 \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F
\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u0432\u0432\u0435\u0434\u0435\u043D\u044B \u043F\u043E\u0441\u043B\u0435 \u0435\u0451 \u0432\u044B\u043F\u0443\u0441\u043A\u0430.

6. \u041E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u0438

6.1. \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0435\u0441\u0451\u0442 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u0437\u0430 \u0443\u0431\u044B\u0442\u043A\u0438, \u0443\u043F\u0443\u0449\u0435\u043D\u043D\u0443\u044E \u0432\u044B\u0433\u043E\u0434\u0443, \u0432\u0440\u0435\u0434
\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u0443, \u0436\u0438\u0437\u043D\u0438 \u0438 \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044E, \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0435 \u0438 \u0438\u043D\u044B\u0435 \u0441\u0430\u043D\u043A\u0446\u0438\u0438, \u0432\u043E\u0437\u043D\u0438\u043A\u0448\u0438\u0435 \u0432 \u0441\u0432\u044F\u0437\u0438
\u0441 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u0438\u043B\u0438 \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u044C\u044E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B, \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435
\u0432\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u043E\u0448\u0438\u0431\u043E\u043A \u0432 \u0432\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0445 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F\u0445, \u0443\u0442\u0440\u0430\u0442\u044B \u0434\u0430\u043D\u043D\u044B\u0445,
\u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u0441\u0442\u043E\u043B\u043A\u043E\u0432\u0430\u043D\u0438\u044F \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u0440\u0430\u0441\u0447\u0451\u0442\u043E\u0432 \u0438 \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u044B\u0445 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439.

6.2. \u0421\u043E\u0432\u043E\u043A\u0443\u043F\u043D\u0430\u044F \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044F \u043F\u043E \u043B\u044E\u0431\u044B\u043C \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F\u043C
\u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u0443\u043C\u043C\u043E\u0439, \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0443\u043F\u043B\u0430\u0447\u0435\u043D\u043D\u043E\u0439 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C \u0437\u0430 \u043F\u0440\u0430\u0432\u043E
\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B, \u0430 \u043F\u0440\u0438 \u0431\u0435\u0437\u0432\u043E\u0437\u043C\u0435\u0437\u0434\u043D\u043E\u043C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0438 \u2014 \u043D\u0435 \u0432\u043E\u0437\u043D\u0438\u043A\u0430\u0435\u0442.

6.3. \u041E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0433\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0432 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0435\u043F\u0435\u043D\u0438,
\u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C\u043E\u0439 \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438, \u0438 \u043D\u0435 \u0440\u0430\u0441\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u043D\u0430
\u0441\u043B\u0443\u0447\u0430\u0438, \u043A\u043E\u0433\u0434\u0430 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u044F\u043C\u043E \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u043C.

7. \u0425\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0445

7.1. \u0414\u0430\u043D\u043D\u044B\u0435, \u0432\u0432\u043E\u0434\u0438\u043C\u044B\u0435 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C, \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043D\u0430 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0438 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.
\u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044C \u043A \u043D\u0438\u043C \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 \u0438 \u0438\u0445 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442.

7.2. \u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0445 \u043A\u043E\u043F\u0438\u0439 \u0434\u0430\u043D\u043D\u044B\u0445, \u0438\u0445 \u0441\u043E\u0445\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u044C \u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435
\u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C.

8. \u0418\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u0430

8.1. \u0418\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u0440\u0430\u0432\u043E \u043D\u0430 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044E.

8.2. \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u0437\u0430\u043F\u0440\u0435\u0449\u0430\u0435\u0442\u0441\u044F \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u044C, \u0434\u0435\u043A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C, \u0434\u0438\u0437\u0430\u0441\u0441\u0435\u043C\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C
\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443, \u0440\u0430\u0441\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u044F\u0442\u044C \u0435\u0451 \u043A\u043E\u043F\u0438\u0438, \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u0442\u044C \u043F\u0440\u0430\u0432\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F \u0442\u0440\u0435\u0442\u044C\u0438\u043C
\u043B\u0438\u0446\u0430\u043C, \u0437\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u0441\u043B\u0443\u0447\u0430\u0435\u0432, \u043F\u0440\u044F\u043C\u043E \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u043E\u043D\u043E\u043C.

9. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u0439

9.1. \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044C \u0432\u043F\u0440\u0430\u0432\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u044C \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435. \u041D\u043E\u0432\u0430\u044F \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u043F\u0440\u0435\u0434\u044A\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F
\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043F\u0440\u0438 \u0437\u0430\u043F\u0443\u0441\u043A\u0435 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F.

9.2. \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u043D\u043E\u0432\u043E\u0439 \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u0438 \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442
\u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435 \u0441 \u043D\u0435\u0439.

10. \u0417\u0430\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F

10.1. \u041A \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044E \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u0440\u0430\u0432\u043E \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438.

10.2. \u0421\u043F\u043E\u0440\u044B \u0440\u0430\u0437\u0440\u0435\u0448\u0430\u044E\u0442\u0441\u044F \u043F\u0443\u0442\u0451\u043C \u043F\u0435\u0440\u0435\u0433\u043E\u0432\u043E\u0440\u043E\u0432, \u0430 \u043F\u0440\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u044F \u2014 \u0432 \u0441\u0443\u0434\u0435
\u043F\u043E \u043C\u0435\u0441\u0442\u0443 \u043D\u0430\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044F, \u0435\u0441\u043B\u0438 \u0438\u043D\u043E\u0435 \u043D\u0435 \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E \u0438\u043C\u043F\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u043C\u0438
\u043D\u043E\u0440\u043C\u0430\u043C\u0438 \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430.

10.3. \u041D\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u0421\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F \u043D\u0435 \u0432\u043B\u0435\u0447\u0451\u0442
\u043D\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0445 \u0435\u0433\u043E \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0439.
`.trim();

// ../../../../Projects/izh-sppz/packages/core/src/legal/privacy-text.ts
var PRIVACY_TEXT = `
1. \u041A\u0442\u043E \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435

1.1. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \xAB\u0418\u0416 \u0421\u041F\u041F\u0417\xBB \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043D\u0430 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0438 \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F. \u0412\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0435 \u0432 \u043D\u0435\u0451
\u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043D\u0430 \u044D\u0442\u043E\u043C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0438 \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u044E\u0442\u0441\u044F \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044E
\u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B, \u0432 \u043E\u0431\u043B\u0430\u0447\u043D\u044B\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430 \u0438 \u0442\u0440\u0435\u0442\u044C\u0438\u043C \u043B\u0438\u0446\u0430\u043C.

1.2. \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u043C \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u0432 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0438 \u0441\u0442\u0430\u0442\u044C\u0438 3 \u0424\u0435\u0434\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u0430 \u043E\u0442
27.07.2006 \u2116 152-\u0424\u0417 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0449\u0430\u044F \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 (\u0434\u0430\u043B\u0435\u0435 \u2014
\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440). \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u0446\u0435\u043B\u0438 \u0438 \u0441\u043E\u0441\u0442\u0430\u0432 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438.

1.3. \u041F\u0440\u0430\u0432\u043E\u043E\u0431\u043B\u0430\u0434\u0430\u0442\u0435\u043B\u044C \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u043C \u0434\u0430\u043D\u043D\u044B\u043C \u043D\u0435 \u0438\u043C\u0435\u0435\u0442, \u0438\u0445 \u043D\u0435
\u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442, \u043D\u0435 \u0445\u0440\u0430\u043D\u0438\u0442 \u0438 \u043D\u0435 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442, \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u043C \u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u043C \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445
\u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F.

2. \u041A\u0430\u043A\u0438\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F

2.1. \u0412 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0435 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F:
\u2014 \u0444\u0430\u043C\u0438\u043B\u0438\u044F, \u0438\u043C\u044F, \u043E\u0442\u0447\u0435\u0441\u0442\u0432\u043E \u0440\u0430\u0431\u043E\u0442\u043D\u0438\u043A\u0430;
\u2014 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u0438 \u043C\u0435\u0441\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u044B;
\u2014 \u0438\u043C\u044F \u0443\u0447\u0451\u0442\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438 \u0434\u043B\u044F \u0432\u0445\u043E\u0434\u0430 \u0438 \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u043E\u0435 \u043F\u0440\u0435\u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0430\u0440\u043E\u043B\u044F;
\u2014 \u0430\u0434\u0440\u0435\u0441 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0439 \u043F\u043E\u0447\u0442\u044B, \u0435\u0441\u043B\u0438 \u043E\u043D \u0443\u043A\u0430\u0437\u0430\u043D;
\u2014 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043F\u0440\u043E\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0445 \u0440\u0430\u0431\u043E\u0442\u0430\u0445 \u0441 \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u0435\u043C \u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044F \u0438 \u0434\u0430\u0442\u044B;
\u2014 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043F\u0440\u043E\u0441\u0442\u043E\u0439 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0439 \u043F\u043E\u0434\u043F\u0438\u0441\u0438, \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u0437\u0430\u0432\u0435\u0440\u0435\u043D\u044B \u0437\u0430\u043F\u0438\u0441\u0438.

2.2. \u0421\u043F\u0435\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u0431\u0438\u043E\u043C\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435
\u0434\u0430\u043D\u043D\u044B\u0435 \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043E\u0439 \u043D\u0435 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F.

3. \u0426\u0435\u043B\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438

3.1. \u0412\u0435\u0434\u0435\u043D\u0438\u0435 \u0443\u0447\u0451\u0442\u0430 \u0441\u0438\u0441\u0442\u0435\u043C \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0437\u0430\u0449\u0438\u0442\u044B \u0438 \u0436\u0443\u0440\u043D\u0430\u043B\u043E\u0432 \u0438\u0445 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438.

3.2. \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043B\u0438\u0446\u0430, \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0432\u0448\u0435\u0433\u043E \u0440\u0430\u0431\u043E\u0442\u0443 \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u0432\u0448\u0435\u0433\u043E \u0437\u0430\u043F\u0438\u0441\u044C, \u2014 \u043A\u0430\u043A \u0442\u043E\u0433\u043E
\u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0436\u0443\u0440\u043D\u0430\u043B\u043E\u0432 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438.

3.3. \u0420\u0430\u0437\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F\u043C \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u043D\u043E\u043C\u043E\u0447\u0438\u0439 \u0440\u0430\u0431\u043E\u0442\u043D\u0438\u043A\u0430.

4. \u041F\u0440\u0430\u0432\u043E\u0432\u044B\u0435 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F

4.1. \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0432\u0435\u0434\u0451\u0442\u0441\u044F \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0438 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0433\u043E \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u044F (\u043F\u0443\u043D\u043A\u0442 1 \u0447\u0430\u0441\u0442\u0438 1
\u0441\u0442\u0430\u0442\u044C\u0438 6 152-\u0424\u0417), \u0430 \u0442\u0430\u043A\u0436\u0435 \u0432 \u0441\u0432\u044F\u0437\u0438 \u0441 \u0438\u0441\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435\u043C \u043E\u0431\u044F\u0437\u0430\u043D\u043D\u043E\u0441\u0442\u0435\u0439, \u0432\u043E\u0437\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u043D\u0430
\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u043E \u043F\u043E\u0436\u0430\u0440\u043D\u043E\u0439 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 \u0438 \u0442\u0440\u0443\u0434\u043E\u0432\u044B\u043C
\u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C.

4.2. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0441\u0442\u043E\u0439 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0439 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0432\u0435\u0434\u0451\u0442\u0441\u044F \u043F\u043E \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C \u0441\u0442\u0430\u0442\u0435\u0439 5, 6 \u0438
9 \u0424\u0435\u0434\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u0430 \u043E\u0442 06.04.2011 \u2116 63-\u0424\u0417 \xAB\u041E\u0431 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0439 \u043F\u043E\u0434\u043F\u0438\u0441\u0438\xBB.

5. \u041A\u0430\u043A\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441\u043E\u0432\u0435\u0440\u0448\u0430\u044E\u0442\u0441\u044F \u0441 \u0434\u0430\u043D\u043D\u044B\u043C\u0438

5.1. \u0421\u0431\u043E\u0440, \u0437\u0430\u043F\u0438\u0441\u044C, \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u044F, \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u0438\u0435, \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435, \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u0435 (\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435,
\u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435), \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u0435, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435, \u043E\u0431\u0435\u0437\u043B\u0438\u0447\u0438\u0432\u0430\u043D\u0438\u0435, \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435, \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u0438
\u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0435\u043D\u0438\u0435 \u2014 \u0432 \u043E\u0431\u044A\u0451\u043C\u0435, \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u043C \u0434\u043B\u044F \u0446\u0435\u043B\u0435\u0439, \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u0445 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 3.

5.2. \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0432\u0435\u0434\u0451\u0442\u0441\u044F \u0441\u043C\u0435\u0448\u0430\u043D\u043D\u044B\u043C \u0441\u043F\u043E\u0441\u043E\u0431\u043E\u043C: \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430\u043C\u0438
\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0438 \u0431\u0435\u0437 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u0438.

5.3. \u0422\u0440\u0430\u043D\u0441\u0433\u0440\u0430\u043D\u0438\u0447\u043D\u0430\u044F \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0435 \u043E\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043B\u044F\u0435\u0442\u0441\u044F.

6. \u0421\u0440\u043E\u043A \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438

6.1. \u041F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0441\u0440\u043E\u043A\u0430 \u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0443\u0447\u0451\u0442\u0430 \u0438 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F
\u0436\u0443\u0440\u043D\u0430\u043B\u043E\u0432 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438, \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u043C\u0438
\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438 \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430.

6.2. \u0417\u0430\u043F\u0438\u0441\u0438 \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0435 \u0443\u0434\u0430\u043B\u044F\u044E\u0442\u0441\u044F \u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0437\u0430\u0434\u043D\u0438\u043C \u0447\u0438\u0441\u043B\u043E\u043C:
\u044D\u0442\u043E\u0433\u043E \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0441\u0430\u043C \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0436\u0443\u0440\u043D\u0430\u043B\u043E\u0432. \u0423\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0440\u0430\u0431\u043E\u0442\u043D\u0438\u043A\u0430 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C
\u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430, \u043F\u0440\u0438 \u044D\u0442\u043E\u043C \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0440\u0430\u043D\u0435\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0445 \u0438\u043C \u0440\u0430\u0431\u043E\u0442\u0430\u0445 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u043A\u0430\u043A
\u0447\u0430\u0441\u0442\u044C \u0436\u0443\u0440\u043D\u0430\u043B\u0430.

7. \u041E\u0442\u0437\u044B\u0432 \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u044F

7.1. \u0421\u043E\u0433\u043B\u0430\u0441\u0438\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043E\u0442\u043E\u0437\u0432\u0430\u043D\u043E \u043F\u0438\u0441\u044C\u043C\u0435\u043D\u043D\u044B\u043C \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u043D\u0430 \u0438\u043C\u044F \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430.

7.2. \u041F\u043E\u0441\u043B\u0435 \u043E\u0442\u0437\u044B\u0432\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u043F\u0440\u0435\u043A\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F, \u0437\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439, \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435
\u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043E\u0431\u044F\u0437\u0430\u043D \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0432 \u0441\u0438\u043B\u0443 \u0437\u0430\u043A\u043E\u043D\u0430, \u2014 \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0436\u0443\u0440\u043D\u0430\u043B\u043E\u0432
\u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438.

8. \u041F\u0440\u0430\u0432\u0430 \u0441\u0443\u0431\u044A\u0435\u043A\u0442\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445

8.1. \u0420\u0430\u0431\u043E\u0442\u043D\u0438\u043A \u0432\u043F\u0440\u0430\u0432\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u044C \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435 \u0441\u0432\u043E\u0438\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445,
\u0442\u0440\u0435\u0431\u043E\u0432\u0430\u0442\u044C \u0438\u0445 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u044F, \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0438\u043B\u0438 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0435\u043D\u0438\u044F \u0432 \u0441\u043B\u0443\u0447\u0430\u044F\u0445, \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043D\u044B\u0445
\u0441\u0442\u0430\u0442\u044C\u0451\u0439 14 152-\u0424\u0417, \u0430 \u0442\u0430\u043A\u0436\u0435 \u043E\u0431\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u0432 \u0420\u043E\u0441\u043A\u043E\u043C\u043D\u0430\u0434\u0437\u043E\u0440\u0435 \u0438\u043B\u0438 \u0432
\u0441\u0443\u0434\u0435.

9. \u041E\u0431\u044F\u0437\u0430\u043D\u043D\u043E\u0441\u0442\u0438 \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430

9.1. \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043E\u0431\u044F\u0437\u0430\u043D \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442
\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430, \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043D\u0435\u043C\u0443, \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u0437\u0430 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044E
\u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u0432\u0435\u0441\u0442\u0438 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043E\u0431 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435.

9.2. \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F
\u0443\u043F\u043E\u043B\u043D\u043E\u043C\u043E\u0447\u0435\u043D\u043D\u043E\u0433\u043E \u043E\u0440\u0433\u0430\u043D\u0430 \u043F\u043E \u0437\u0430\u0449\u0438\u0442\u0435 \u043F\u0440\u0430\u0432 \u0441\u0443\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445.

10. \u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435

\u041D\u0430\u0436\u0438\u043C\u0430\u044F \xAB\u041F\u0440\u0438\u043D\u0438\u043C\u0430\u044E\xBB, \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442, \u0447\u0442\u043E \u043E\u0437\u043D\u0430\u043A\u043E\u043C\u043B\u0435\u043D \u0441 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u043C
\u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435\u043C, \u043F\u043E\u043D\u0438\u043C\u0430\u0435\u0442 \u0441\u043E\u0441\u0442\u0430\u0432 \u0438 \u0446\u0435\u043B\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0438 \u0434\u0430\u0451\u0442 \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435 \u043D\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u0441\u0432\u043E\u0438\u0445
\u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u0432 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u043C \u043E\u0431\u044A\u0451\u043C\u0435.
`.trim();

// ../../../../Projects/izh-sppz/packages/core/src/legal/legal-documents.ts
var LEGAL_VERSION = "2026-09-02";

// ../../../../Projects/izh-sppz/packages/core/src/validation/regulation-constraints.ts
var MAX_MONTHS = 50 * 12;

// Аудит_2026-09-06/ui-audit-main.ts
var output = process.argv[2];
if (!output || !output.includes("\u0410\u0443\u0434\u0438\u0442_2026-09-06")) throw Error("Dedicated audit directory required");
import_electron3.app.setPath("userData", (0, import_node_path5.join)(output, "isolated-ui-data-" + Date.now()));
import_electron3.app.disableHardwareAcceleration();
var pause = (ms) => new Promise((r) => setTimeout(r, ms));
var value = (r) => {
  if (!r.ok) throw Error(JSON.stringify(r));
  return r.value;
};
import_electron3.app.whenReady().then(async () => {
  try {
    await (0, import_promises7.mkdir)(output, { recursive: true });
    await ensureDataDirs();
    const tree = createTreeRepository(), objects = createObjectRepository();
    const deps = { tree, objects, clock: { nowUtc: () => (/* @__PURE__ */ new Date()).toISOString(), today: () => "2026-09-06" }, ids: { newId: () => crypto.randomUUID() } };
    const organization = value(await createOrganization(deps, { name: "\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u043E\u0431\u044A\u0435\u043A\u0442 \u2014 \u0430\u0443\u0434\u0438\u0442" }));
    const building = value(await createChildNode(deps, { parentId: organization.id, kind: "building", name: "\u041A\u043E\u0440\u043F\u0443\u0441 \u0410" }));
    const level = value(await createChildNode(deps, { parentId: building.id, kind: "level", name: "\u042D\u0442\u0430\u0436 1" }));
    const other = value(await createChildNode(deps, { parentId: organization.id, kind: "building", name: "\u041A\u043E\u0440\u043F\u0443\u0441 \u0411 \u2014 \u0434\u043E\u0441\u0442\u0443\u043F \u043D\u0435 \u0432\u044B\u0434\u0430\u043D" }));
    const sample = value(await placeObject(deps, { nodeId: level.id, typeCode: "extinguisher", position: null, regNumber: "\u041E\u0422-001", model: "\u041E\u041F-5", commissionedOn: "2026-09-01" }));
    const password = value(await createPasswordHasher().hash("Audit-Guest-267"));
    await createUserRepository().save({ id: crypto.randomUUID(), login: "audit-guest", fullName: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u0433\u043E\u0441\u0442\u044C", position: null, email: null, role: "\u0433\u043E\u0441\u0442\u044C", scope: [level.id], password, keyGeneration: 1, mustChangePassword: false, archivedAt: null, createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString(), rowVersion: 1, acceptedLegalVersion: LEGAL_VERSION, acceptedLegalAt: (/* @__PURE__ */ new Date()).toISOString() });
    registerIpcHandlers();
    const window = new import_electron3.BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false, preload: "C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/out/preload/index.js", contextIsolation: true, nodeIntegration: false } });
    const errors = [];
    window.webContents.on("console-message", (_e, l, m) => {
      if (l >= 2) errors.push(m);
    });
    await window.loadFile("C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/out/renderer/index.html");
    await pause(600);
    const beforeLogin = await window.webContents.executeJavaScript(`(async()=>{const r=await window.izh.objects.list(); const o=r.value[0]; const saved=await window.izh.objects.save({...o,note:'written before login by audit'});return {readAllowed:r.ok,count:r.value.length,writeAllowed:saved.ok};})()`);
    console.log("IPC_BEFORE_LOGIN", JSON.stringify(beforeLogin));
    await window.webContents.executeJavaScript(`(()=>{ const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const fields=[...document.querySelectorAll('input')]; const login=fields.find(e=>e.type==='text');const pass=fields.find(e=>e.type==='password');s.call(login,'audit-guest');login.dispatchEvent(new Event('input',{bubbles:true}));s.call(pass,'Audit-Guest-267');pass.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await pause(120);
    await window.webContents.executeJavaScript(`document.querySelector('form').requestSubmit()`);
    await pause(1e3);
    const guestText = await window.webContents.executeJavaScript("document.body.innerText");
    await window.webContents.executeJavaScript(`document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='+ \u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F')b.click()})`);
    await pause(150);
    await window.webContents.executeJavaScript(`(()=>{const input=document.querySelector('input[placeholder="\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041A\u043E\u043B\u044C\u0441\u043A\u0430\u044F \u0413\u041C\u041A"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'\u0421\u043E\u0437\u0434\u0430\u043D\u043E \u0433\u043E\u0441\u0442\u0435\u043C \u2014 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0441\u043A\u0438\u0439 \u0442\u0435\u0441\u0442');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await pause(150);
    await window.webContents.executeJavaScript(`document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='\u0421\u043E\u0437\u0434\u0430\u0442\u044C')b.click()})`);
    await pause(500);
    const afterCreate = await tree.list();
    const guestCreatedOrganization = afterCreate.ok && afterCreate.value.some((n) => n.name === "\u0421\u043E\u0437\u0434\u0430\u043D\u043E \u0433\u043E\u0441\u0442\u0435\u043C \u2014 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0441\u043A\u0438\u0439 \u0442\u0435\u0441\u0442");
    await window.webContents.executeJavaScript(`document.querySelectorAll('button.tree-label').forEach(b=>{if(b.textContent.includes('\u042D\u0442\u0430\u0436 1'))b.click()})`);
    await pause(650);
    await (0, import_promises7.writeFile)((0, import_node_path5.join)(output, "guest-ui-text.txt"), guestText);
    await (0, import_promises7.writeFile)((0, import_node_path5.join)(output, "current-app-guest.png"), (await window.webContents.capturePage()).toPNG());
    console.log("GUEST_SCREEN", guestText.slice(0, 1700));
    await (0, import_promises7.writeFile)((0, import_node_path5.join)(output, "ui-checks.json"), JSON.stringify({ beforeLogin, guestSeesUnassignedBuilding: guestText.includes("\u041A\u043E\u0440\u043F\u0443\u0441 \u0411"), guestCreatedOrganization, errors }, null, 2));
    if (process.argv.includes("--mockups")) {
    }
    window.destroy();
    import_electron3.app.quit();
  } catch (e) {
    console.error(e);
    import_electron3.app.exit(1);
  }
});
