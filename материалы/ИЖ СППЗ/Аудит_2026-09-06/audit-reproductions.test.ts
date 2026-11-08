// Аудиторские воспроизведения. Успех теста означает подтверждение дефекта.
// Все файловые операции направлены только в новый временный каталог.
import { beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const fixture = vi.hoisted(() => ({ dir: '' }));
vi.mock('C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/storage-paths.ts', () => ({
  dataDir: () => fixture.dir,
  filesDir: () => join(fixture.dir, 'files'),
  objectsFile: () => join(fixture.dir, 'objects.json'),
  maintenanceFile: () => join(fixture.dir, 'maintenance.json'),
  treeFile: () => join(fixture.dir, 'tree.json'),
  roomsFile: () => join(fixture.dir, 'rooms.json'),
  backdropsFile: () => join(fixture.dir, 'backdrops.json'),
  settingsFile: () => join(fixture.dir, 'settings.json'),
  ensureDataDirs: () => mkdir(join(fixture.dir, 'files'), { recursive: true }),
}));
import { createMaintenanceRepository } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/maintenance-repository.ts';
import { createObjectRepository } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/object-repository.ts';
import { createHistoryAdapters } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/history-adapters.ts';
import { CommandHistory } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/command-history.ts';
import { createFileStore } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/file-store.ts';
import { todayIso } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/renderer/src/today.ts';
import { signSimple, checkSignature } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/core/src/access/simple-signature.ts';
import { signedJournalContent } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/core/src/access/signed-content.ts';
import { createPasswordHasher } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/password-hasher.ts';
import { createSigningKeyService } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/signing-keys.ts';
import { derivedRank } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/core/src/extinguishers/derived-rank.ts';
beforeEach(async () => { fixture.dir = await mkdtemp(join(tmpdir(), 'izh-independent-audit-')); });
const event = (id = 'check-1') => ({ id, siteId: 'site-1', objectId: 'object-1', activityCode: 'inspect', performedOn: '2026-09-06', result: 'исправен', createdAt: '2026-09-06T00:00:00Z', checklist: [], note: 'original' });

it('R1: same journal ID silently replaces original content', async () => {
 const repo = createMaintenanceRepository();
 expect((await repo.save(event() as never)).ok).toBe(true);
 expect((await repo.save({ ...event(), note: 'changed' } as never)).ok).toBe(true);
 const result = await repo.list();
 expect(result.ok && result.value[0].note).toBe('changed');
});
it('R2: malformed journal record disappears after next valid save', async () => {
 await writeFile(join(fixture.dir, 'maintenance.json'), JSON.stringify({ events: [event(), { ...event('damaged'), performedOn: null }] }));
 const repo = createMaintenanceRepository();
 await repo.save(event('new') as never);
 const disk = JSON.parse(await readFile(join(fixture.dir, 'maintenance.json'), 'utf8'));
 expect(disk.events.map((e: {id:string})=>e.id)).toEqual(['check-1', 'new']);
});
it('R3: Undo adapter overwrites corrupted object collection', async () => {
 await writeFile(join(fixture.dir, 'objects.json'), '{"objects":[{"id":"lost"');
 const adapter = createHistoryAdapters().find(a=>a.kind==='object')!;
 expect((await adapter.put({id:'restored'})).ok).toBe(true);
 expect(JSON.parse(await readFile(join(fixture.dir, 'objects.json'), 'utf8')).objects).toEqual([{id:'restored'}]);
});
it('R4: Undo creation deletes equipment that already has journal entries', async () => {
 const adapters=createHistoryAdapters(); const history=new CommandHistory(adapters);
 const a=await history.begin('create object'); if(!a.ok) throw Error('begin');
 const object={id:'object-1'}; await adapters.find(a=>a.kind==='object')!.put(object);
 await history.record(a.value.id,'object',object.id,null,object); await history.commit(a.value.id);
 await createMaintenanceRepository().save(event() as never);
 expect((await history.undoLast()).ok).toBe(true);
 const objects=await createObjectRepository().list(); const events=await createMaintenanceRepository().list();
 expect(objects.ok && objects.value.length).toBe(0); expect(events.ok && events.value.length).toBe(1);
});
it('R5: extension path traversal writes outside files directory', async () => {
 const store=createFileStore();
 const result=await store.put(new TextEncoder().encode('harmless audit fixture'), '../../escaped.txt');
 expect(result.ok).toBe(true);
 expect(await readFile(join(fixture.dir,'files','escaped.txt'),'utf8').catch(()=> 'not-here')).toBe('harmless audit fixture');
 const result2=await store.put(new TextEncoder().encode('second harmless fixture'), '../../../escaped.txt');
 expect(result2.ok).toBe(true);
 expect(await readFile(join(fixture.dir,'escaped.txt'),'utf8')).toBe('second harmless fixture');
});
it('R6: create then modify within command loses null before-state', async () => {
 const adapter=createHistoryAdapters().find(a=>a.kind==='object')!;
 const history=new CommandHistory([adapter]); const a=await history.begin('create+edit');if(!a.ok)throw Error('begin');
 await adapter.put({id:'o',v:2});
 await history.record(a.value.id,'object','o',null,{id:'o',v:1});
 await history.record(a.value.id,'object','o',{id:'o',v:1},{id:'o',v:2});
 await history.commit(a.value.id);await history.undoLast();
 const obj=await adapter.get('o'); expect(obj.ok && obj.value).toEqual({id:'o',v:1});
});
it('R7: failed Undo removes command from in-memory Undo stack', async () => {
 const history=new CommandHistory([{kind:'object',get:async()=>({ok:true,value:null}),put:async()=>({ok:false,error:{code:'FILE_WRITE_FAILED',message:'injected disk failure'}}),remove:async()=>({ok:true,value:undefined})}] as never);
 const a=await history.begin('edit');if(!a.ok)throw Error('begin');
 await history.record(a.value.id,'object','o',{id:'o',v:1},{id:'o',v:2});await history.commit(a.value.id);
 expect((await history.undoLast()).ok).toBe(false);
 const state=await history.getState();expect(state.ok&&state.value.canUndo).toBe(false);
});
it('R8: overlapping saves lose equipment records / return file errors', async () => {
 const repo=createObjectRepository();
 const results=await Promise.all(Array.from({length:12},(_,i)=>repo.save({id:'parallel-'+i} as never)));
 const read=await repo.list();
 const count=read.ok?read.value.length:-1;
 console.log('CONCURRENT_SAVES',JSON.stringify({requested:12,ok:results.filter(r=>r.ok).length,count}));
 expect(count).toBeLessThan(12);
});
it('R9: Moscow calendar day is yesterday before 03:00', () => {
 vi.useFakeTimers();
 try { vi.setSystemTime(new Date('2026-09-06T00:30:00+03:00')); expect(todayIso()).toBe('2026-09-05'); }
 finally { vi.useRealTimers(); }
});
it('R10: signer identity can change and crypto signature still verifies; key removal also verifies', async () => {
 const hasher=createPasswordHasher();const keys=createSigningKeyService();
 const password='Audit-fixture-Only-267';const digest=await hasher.hash(password);const key=await keys.create(password,1);
 if(!digest.ok||!key.ok)throw Error('fixture');
 const user={id:'real-author',fullName:'Тестовый автор',position:null,role:'администратор',archivedAt:null,password:digest.value,mustChangePassword:false,keyGeneration:1,signingKey:key.value};
 const signed=await signSimple(hasher,{user:user as never,password,content:'audit content',kind:'запись журнала',at:'2026-09-06T00:00:00Z',keys});
 if(!signed.ok)throw Error('sign');
 const forged={...signed.value,signerId:'other-author',signerName:'Другой человек'};
 const checked=await checkSignature(hasher,forged,'audit content',keys);
 expect(checked.ok&&checked.value.verdict).toBe('подпись верна');
 const stripped=await checkSignature(hasher,{...forged,key:null},'audit content',keys);
 expect(stripped.ok&&stripped.value.verdict).toBe('подпись верна');
});
it('R11: replacing checklist attachments does not change signed content', () => {
 const original={...event(),checklist:[{item:'Проверка',result:'выполнено',defect:null,attachments:[{hash:'original-hash',fileName:'original.pdf'}]}]};
 const modified={...original,checklist:[{...original.checklist[0],attachments:[{hash:'replacement-hash',fileName:'replacement.pdf'}]}]};
 expect(signedJournalContent(original as never)).toBe(signedJournalContent(modified as never));
});
it('R12: generic OVE rank does not reproduce published BONTEL model ranks', () => {
 // Official BONTEL passport P5-full.pdf: OVE-2 = 2A 55B; OVE-10 = 4A 144B.
 expect(derivedRank('ОВЭ',2)).toBeNull();
 const ten=derivedRank('ОВЭ',10);expect(ten?.a).toBe(3);expect(ten?.b).toBe(70);
});
