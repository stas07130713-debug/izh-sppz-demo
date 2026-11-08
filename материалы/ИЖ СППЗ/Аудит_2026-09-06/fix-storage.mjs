import fs from 'node:fs';
const root='C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9/fixes-work/';
const main='packages/desktop/src/main/';
function edit(file,fn){const p=root+file; fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n')));}
function replace(s,a,b){if(!s.includes(a))throw Error('Not found: '+a.slice(0,100));return s.replace(a,b);}
edit(main+'json-store.ts',s=>{
 s="import { randomUUID } from 'node:crypto';\n"+s;
 s=replace(s,"if (text.trim() === '') return ok([]);","if (text.trim() === '') return err('FILE_CORRUPTED', `Пустой файл данных не был изменён: ${path}`);");
 s=replace(s,"if (text.trim() === '') return ok(null);","if (text.trim() === '') return err('FILE_CORRUPTED', `Пустой файл данных не был изменён: ${path}`);");
 s=replace(s,'if (value === undefined) return ok([]);',"if (value === undefined) return err('FILE_CORRUPTED', `В файле отсутствует коллекция ${key}: ${path}`);");
 s=s.replaceAll("typeof parsed !== 'object')", "typeof parsed !== 'object' || Array.isArray(parsed))");
 s=replace(s,"const temporary = `${path}.tmp`;","const temporary = `${path}.${randomUUID()}.tmp`;");
 return s;
});
edit(main+'file-store.ts',s=>{
 s=replace(s,'  try {\n    const names',"  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/u.test(hash)) return null;\n  try {\n    const names");
 s=replace(s,'      try {\n        await ensureDataDirs();',"      if (!(bytes instanceof Uint8Array) || bytes.byteLength > 100 * 1024 * 1024) return err('INVALID_ARGUMENT', 'Недопустимый файл или размер больше 100 МБ.');\n      if (typeof extension !== 'string' || !/^[a-zA-Z0-9]{1,12}$/u.test(extension)) return err('INVALID_ARGUMENT', 'Недопустимое расширение файла.');\n      extension = extension.toLowerCase();\n      try {\n        await ensureDataDirs();");
 s=replace(s,'        return ok(new Uint8Array(buffer));',"        if (sha256Hex(buffer) !== hash) return err('FILE_CORRUPTED', 'Содержимое файла не совпадает с его отпечатком.');\n        return ok(new Uint8Array(buffer));");
 return s;
});
edit(main+'maintenance-repository.ts',s=>{
 s="import { isDeepStrictEqual } from 'node:util';\n"+s;
 s=s.replace("import { ok }", "import { err, ok }");
 s=replace(s,'  return {\n    ...(event as MaintenanceEvent),',"  if (event.checklist !== undefined && !Array.isArray(event.checklist)) return null;\n  const answers = (event.checklist ?? []).map(normalizeChecklistAnswer);\n  if (answers.some(answer => answer === null)) return null;\n  return {\n    ...(event as MaintenanceEvent),");
 s=replace(s,"  return ok(\n    raw.value.map(normalizeEvent).filter((event): event is MaintenanceEvent => event !== null),\n  );", "  const events = raw.value.map(normalizeEvent);\n  const invalid = events.findIndex(event => event === null);\n  if (invalid !== -1) return err('FILE_CORRUPTED', `Повреждена запись журнала № ${invalid + 1}. Исходный файл сохранён без изменений.`);\n  return ok(events as MaintenanceEvent[]);");
 const start=s.indexOf('    async save(event)');
 s=s.slice(0,start)+`    async save(event): Promise<Result<void>> {
      return appendEvents([event]);
    },
    async saveMany(newEvents): Promise<Result<void>> {
      return appendEvents(newEvents);
    },
  };
}

async function appendEvents(incoming: readonly MaintenanceEvent[]): Promise<Result<void>> {
  const current = await readEvents();
  if (!current.ok) return current;
  const known = new Map(current.value.map(event => [event.id, event]));
  for (const raw of incoming) {
    const event = normalizeEvent(raw);
    if (event === null) return err('INVALID_ARGUMENT', 'Некорректная запись журнала.');
    const previous = known.get(event.id);
    if (previous !== undefined && !isDeepStrictEqual(previous, event)) {
      return err('CONFLICT', 'Запись журнала с этим ID уже существует. Внесите новую исправляющую запись.');
    }
    known.set(event.id, event);
  }
  return writeJsonAtomically(maintenanceFile(), { events: [...known.values()] });
}
`;
 return s;
});
// Явные границы операций в исходниках. Охватываем всю read-modify-write,
// в том числе независимые экземпляры репозиториев.
for(const file of fs.readdirSync(root+main).filter(f=>f.endsWith('-repository.ts'))){
 edit(main+file,s=>{
  s="import { withDataWrite } from './data-write.js';\n"+s;
  const pattern=/^(    async (?:save\w*|remove\w*|append|prune)\([^\n]*\)\s*:\s*Promise<[^\n]+>\s*\{\n)([\s\S]*?)(^    \},)/gm;
  let count=0;
  s=s.replace(pattern,(_m,a,body,z)=>{count++;return a+'      return withDataWrite(async () => {\n'+body+'      });\n'+z;});
  if(!count) throw Error('No writes wrapped '+file);
  return s;
 });
}
edit(main+'history-adapters.ts',s=>{
 s=s.replace("import { readFile, unlink, writeFile } from 'node:fs/promises';", "import { readJsonRecord as safeRead, readJsonCollection, writeJsonAtomically } from './json-store.js';\nimport { withDataWrite } from './data-write.js';");
 s=s.replace('  ensureDataDirs,\n','');
 const a=s.indexOf('async function readJsonRecord('),b=s.indexOf('async function readBackdropState()',a);
 s=s.slice(0,a)+`async function readJsonRecord(path: string, fallback: unknown): Promise<Record<string, unknown>> {
  const result = await safeRead(path);
  if (!result.ok) throw new Error(result.error.message);
  return result.value ?? asRecord(fallback);
}

async function writeJsonRecord(path: string, value: unknown): Promise<void> {
  const result = await writeJsonAtomically(path, value);
  if (!result.ok) throw new Error(result.error.message);
}

`+s.slice(b);
 s=replace(s,'      } catch {\n        return ok(DEFAULT_APP_SETTINGS);',"      } catch (e) {\n        return err('FILE_READ_FAILED', 'Не удалось прочитать настройки для истории.', describeUnknown(e));");
 s=replace(s,'        await unlinkIfExists(settingsFile());', '        await readJsonRecord(settingsFile(), DEFAULT_APP_SETTINGS);\n        await writeJsonRecord(settingsFile(), DEFAULT_APP_SETTINGS);');
 s=replace(s,'function readArray(value: unknown): unknown[] {\n  return Array.isArray(value) ? value : [];\n}',"function readArray(value: unknown): unknown[] {\n  if (!Array.isArray(value)) throw new Error('Повреждена коллекция данных. Отмена остановлена.');\n  return value;\n}");
 s=s.slice(0,s.indexOf('async function unlinkIfExists'));
 s=replace(s,'    async remove(id) {\n      try {\n        const state = await readJsonRecord(pathFactory()',`    async remove(id) {
      try {
        const refs = await referenceGuard(kind, id);
        if (!refs.ok) return refs;
        const state = await readJsonRecord(pathFactory()`);
 s+=`\nasync function referenceGuard(kind: HistoryEntityKind, id: string) {
  const sources = kind === 'object' ? [[maintenanceFile(), 'events', 'objectId'], [objectsFile(), 'objects', 'parentObjectId']]
    : kind === 'tree' ? [[treeFile(), 'nodes', 'parentId'], [objectsFile(), 'objects', 'nodeId'], [roomsFile(), 'rooms', 'levelId']]
    : kind === 'room' ? [[objectsFile(), 'objects', 'roomId']] : [];
  for (const [path, key, field] of sources) {
    if (path === undefined || key === undefined || field === undefined) continue;
    const records = await readJsonCollection(path, key);
    if (!records.ok) return records;
    if (records.value.some(record => fieldValue(record, field) === id)) {
      return err('CONFLICT', 'Отмена невозможна: на запись уже ссылаются другие данные или журнал.');
    }
  }
  return ok(undefined);
}
`;
 s=s.replace(/^(    async (?:put|remove)\([^\n]*\) \{\n)([\s\S]*?)(^    \},)/gm,(_m,a,b,z)=>a+'      return withDataWrite(async () => {\n'+b+'      });\n'+z);
 return s;
});
edit(main+'command-history.ts',s=>{
 s="import { withDataWrite } from './data-write.js';\nimport { isDeepStrictEqual } from 'node:util';\n"+s;
 s=s.replace('before: previous?.before ?? cloneValue(before)', 'before: previous === undefined ? cloneValue(before) : previous.before');
 s=replace(s,'    this.active.delete(actionId);\n    return ok(this.state());\n  }\n\n  async undoLast',`    const action = this.active.get(actionId);
    if (action !== undefined && action.changes.length > 0) {
      const reverted = await this.apply(action, 'undo');
      if (!reverted.ok) return reverted;
    }
    this.active.delete(actionId);
    return ok(this.state());
  }

  async undoLast`);
 s=s.replace('const action = this.undo.pop();','const action = this.undo.at(-1);').replace('const action = this.redo.pop();','const action = this.redo.at(-1);');
 s=s.replace("    this.redo.push(action);", "    this.undo.pop();\n    this.redo.push(action);");
 s=replace(s,"    const applied = await this.apply(action, 'redo');\n    if (!applied.ok) return applied;\n    this.undo.push(action);", "    const applied = await this.apply(action, 'redo');\n    if (!applied.ok) return applied;\n    this.redo.pop();\n    this.undo.push(action);");
 const a=s.indexOf('    for (const change of changes) {'),b=s.indexOf('    return ok(undefined);',a);
 s=s.slice(0,a)+`    const applied: { adapter: HistoryAdapter; id: string; previous: unknown | null }[] = [];
    // До первой записи проверяем все исходные состояния: нельзя затереть
    // последующую правку или превратить ошибку чтения в пустую коллекцию.
    for (const change of changes) {
      const adapter = this.adapters.get(change.kind);
      if (adapter === undefined) return err('INTERNAL', 'Нет адаптера истории.');
      const current = await adapter.get(change.id);
      if (!current.ok) return current;
      const expected = direction === 'undo' ? change.after : change.before;
      if (!isDeepStrictEqual(current.value, expected)) return err('CONFLICT', 'Данные изменились после этой команды. Отмена остановлена.');
    }
    for (const change of changes) {
      const adapter = this.adapters.get(change.kind)!;
      const value = direction === 'undo' ? change.before : change.after;
      const previous = direction === 'undo' ? change.after : change.before;
      const result = value === null ? await adapter.remove(change.id) : await adapter.put(value);
      if (!result.ok) {
        for (const done of applied.reverse()) {
          const restored = done.previous === null ? await done.adapter.remove(done.id) : await done.adapter.put(done.previous);
          if (!restored.ok) return err('FILE_WRITE_FAILED', 'Не удалось полностью восстановить отменяемую команду. Требуется восстановление из резервной копии.');
        }
        return result;
      }
      applied.push({ adapter, id: change.id, previous });
    }
`+s.slice(b);
 // Очередь охватывает команду целиком; вызовы репозиториев внутри реентерабельны.
 s=s.replace(/^(  async (?:begin|record|commit|cancel|undoLast|redoLast)\([^\n]*\): Promise<[^\n]+> \{\n)([\s\S]*?)(^  \})/gm,(_m,a,b,z)=>a+'    return withDataWrite(async () => {\n'+b+'    });\n'+z);
 return s;
});
console.log('Storage and Undo changes applied');
