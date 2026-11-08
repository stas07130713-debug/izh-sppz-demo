import fs from 'node:fs';
import ts from 'file:///C:/Users/Svyt0/Projects/izh-sppz/node_modules/typescript/lib/typescript.js';
const root='C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9/fixes-work/';
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n')));}
edit('packages/desktop/src/main/ipc-access.ts',s=>s.replace("const denied = () => err(", "const denied = (): Result<never> => err("));
edit('packages/desktop/src/main/backdrop-repository.ts',s=>{
 s=s.replace("import { readFile, writeFile } from 'node:fs/promises';", "import { readJsonRecord, writeJsonAtomically } from './json-store.js';").replace('backdropsFile, ensureDataDirs','backdropsFile');
 const a=s.indexOf('async function readState()'),b=s.indexOf('export function createBackdropRepository',a);
 return s.slice(0,a)+`async function readState(): Promise<StoredState> {
  const stored = await readJsonRecord(backdropsFile());
  if (!stored.ok) throw new Error(stored.error.message);
  if (stored.value === null) return EMPTY_STATE;
  const parsed = stored.value;
  if (!Array.isArray(parsed.backdrops) || !Array.isArray(parsed.calibrations ?? []) || !Array.isArray(parsed.cleanups ?? [])) throw new Error('Повреждён файл подложек.');
  return {
    backdrops: (parsed.backdrops as PlanBackdrop[]).map(backdrop => ({ ...backdrop, nodeId: backdrop.nodeId ?? null })),
    calibrations: (parsed.calibrations ?? []) as PlanCalibration[], cleanups: (parsed.cleanups ?? []) as BackdropCleanup[],
  };
}
async function writeState(state: StoredState): Promise<void> {
  const saved = await writeJsonAtomically(backdropsFile(), state);
  if (!saved.ok) throw new Error(saved.error.message);
}

`+s.slice(b);
});
edit('packages/desktop/src/renderer/src/today.ts',()=>`import { useSyncExternalStore } from 'react';

/** Даты обслуживания — календарные даты рабочей зоны Windows, а не дата UTC. */
export function todayIso(): string {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function subscribe(changed: () => void): () => void {
  const timer = setInterval(changed, 30_000);
  window.addEventListener('focus', changed);
  document.addEventListener('visibilitychange', changed);
  return () => { clearInterval(timer); window.removeEventListener('focus', changed); document.removeEventListener('visibilitychange', changed); };
}
/** Открытые окна пересчитывают сроки после полуночи и возвращения фокуса. */
export function useTodayIso(): string { return useSyncExternalStore(subscribe, todayIso, todayIso); }
`);
const components='packages/desktop/src/renderer/src/components/';
for(const file of fs.readdirSync(root+components).filter(f=>f.endsWith('.tsx'))){
 edit(components+file,s=>{
  if(!s.includes('todayIso()'))return s;
  const ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX), edits=[];
  for(const node of ast.statements){
   if(!ts.isFunctionDeclaration(node)||!node.body||!node.name||! /^[A-Z]/.test(node.name.text))continue;
   if(!node.body.getText(ast).includes('todayIso()'))continue;
   edits.push({a:node.body.getStart(ast)+1,b:node.body.getStart(ast)+1,text:'\n  const calendarDay = useTodayIso();'});
   function visit(n){
    if(ts.isCallExpression(n)&&n.expression.getText(ast)==='todayIso')edits.push({a:n.getStart(ast),b:n.end,text:'calendarDay'});
    if(ts.isCallExpression(n)&&['useMemo','useCallback'].includes(n.expression.getText(ast))&&n.arguments[0]?.getText(ast).includes('todayIso()')){
      const deps=n.arguments[1];if(deps&&ts.isArrayLiteralExpression(deps))edits.push({a:deps.end-1,b:deps.end-1,text:deps.elements.length?', calendarDay':'calendarDay'});
    }
    ts.forEachChild(n,visit);
   }visit(node.body);
  }
  if(!edits.length)return s;
  for(const e of edits.sort((a,b)=>b.a-a.a))s=s.slice(0,e.a)+e.text+s.slice(e.b);
  return s.replace("import { todayIso } from '../today';",`import { ${s.includes('todayIso()')?'todayIso, ':''}useTodayIso } from '../today';`);
 });
}
for(const file of ['JournalPanel.tsx','RequestBuilder.tsx'])edit(components+file,s=>s.replaceAll('Word (.docx)','Word (.doc)'));
console.log('Calendar, backdrop storage, type compatibility applied');
