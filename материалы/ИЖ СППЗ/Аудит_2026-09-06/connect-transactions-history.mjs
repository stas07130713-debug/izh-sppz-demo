import fs from 'node:fs';
const root='C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9/fixes-work/';
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n')));}
const main='packages/desktop/src/main/';
edit(main+'json-store.ts',s=>"import { rememberBeforeWrite } from './data-transaction.js';\n"+s.replace('  try {\n    const handle = await open(temporary', '  try {\n    await rememberBeforeWrite(path);\n    const handle = await open(temporary'));
edit(main+'secure-ipc.ts',s=>{
 s="import { withDataTransaction } from './data-transaction.js';\nimport { dataDir } from './storage-paths.js';\nimport { withAuthor, listChanges } from './change-recorder.js';\n"+s;
 s=s.replace('        const result = await callback(event, ...args);',`        const execute = () => callback(event, ...args);
        const result = user === null ? await execute() : await withAuthor(user, () => channel.startsWith('account:') ? execute() : withDataTransaction(dataDir(), execute));`);
 s=s.replace('  return { handle };',`  handle(CHANNELS.changesList, async event => {
    const user = await sessions.current(event.sender.id);
    return user === null ? err('FORBIDDEN', 'Войдите в учётную запись.') : listChanges(user);
  });
  return { handle };`);
 return s;
});
edit(main+'ipc-access.ts',s=>s.replace("  'settings:get',", "  'changes:list', 'settings:get',"));
edit(main+'channels.ts',s=>s.replace('export const CHANNELS = {',"export const CHANNELS = {\n  changesList: 'changes:list',"));
edit(main+'index.ts',s=>"import { recoverDataTransaction } from './data-transaction.js';\n"+s.replace("import { ensureDataDirs }", "import { dataDir, ensureDataDirs }").replace('  await ensureDataDirs();','  await ensureDataDirs();\n  await recoverDataTransaction(dataDir());'));
edit(main+'command-history.ts',s=>{
 s="import { appendChange, currentAuthor } from './change-recorder.js';\nimport { authorize } from './ipc-access.js';\n"+s;
 s=s.replace('interface StoredAction {','interface StoredAction {\n  readonly authorId?: string;');
 s=s.replace('    const id = crypto.randomUUID();', "    if (this.active.size > 0) return err('CONFLICT', 'Дождитесь завершения текущей команды.');\n    const id = crypto.randomUUID();");
 s=s.replace("this.active.set(id, { id, label:", "this.active.set(id, { id, authorId: currentAuthor()?.id, label:");
 s=s.replace("    if (actionId === null || sameValue(before, after)) return;", "    await appendChange(kind, id, before, after, actionId === null ? 'Изменение данных' : this.active.get(actionId)?.label ?? 'Изменение данных');\n    if (actionId === null || sameValue(before, after)) return;");
 s=s.replace("    if (action === undefined) return;", "    if (action === undefined) return;\n    if (currentAuthor() !== undefined && action.authorId !== currentAuthor()?.id) throw new Error('Чужая команда.');");
 s=s.replace("    const changes = direction === 'undo' ?",`    const actor = currentAuthor();
    if (actor !== undefined && actor.role !== 'администратор' && action.authorId !== actor.id) return err('FORBIDDEN', 'Это команда другого пользователя.');
    const changes = direction === 'undo' ?`);
 s=s.replace('    for (const change of changes) {\n      const adapter',`    for (const change of changes) {
      if (actor !== undefined) {
        for (const value of [change.before, change.after]) {
          if (value === null) continue;
          const permission = await authorize(change.kind + ':save', [value], actor);
          if (!permission.ok) return permission;
        }
      }
      const adapter`);
 s=s.replace('      applied.push({ adapter, id: change.id, previous });','      await appendChange(change.kind, change.id, previous, value, `${direction === \'undo\' ? \'Отмена\' : \'Повтор\'}: ${action.label}`);\n      applied.push({ adapter, id: change.id, previous });');
 return s;
});
edit('packages/desktop/src/preload/index.ts',s=>s.replace('const bridge = {', 'const bridge = {\n  changes: { list: () => ipcRenderer.invoke(CHANNELS.changesList) },'));
edit('packages/desktop/src/renderer/src/bridge.d.ts',s=>"import type { ChangeLogEntry } from '@izh/contracts';\n"+s.replace('export interface IzhBridge {','export interface IzhBridge {\n  changes: { list(): Promise<Result<readonly ChangeLogEntry[]>> };'));
console.log('Transactions and persistent change history connected');
