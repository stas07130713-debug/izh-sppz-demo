import fs from 'node:fs';
const root='C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9/fixes-work/';
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n')));}
function replace(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,100));return s.replace(a,b);}
edit('packages/contracts/src/access.ts',s=>replace(s,'export interface UserAccount {',`export interface UserAccount {
  /** Публичный признак: закрытый ключ в окно не передаётся. */
  readonly hasSigningKey?: boolean;
  /** Доверенные прежние открытые ключи сохраняются при смене/сбросе пароля. */
  readonly signingPublicKeys?: readonly string[];`));
edit('packages/contracts/src/signature.ts',s=>replace(replace(s,'export interface SimpleSignature {', 'export interface SimpleSignature {\n  readonly formatVersion?: 2;'), 'export type SignatureCheck =', "export type SignatureCheck =\n  | { readonly verdict: 'устаревшая подпись — авторство не подтверждено' }\n  | { readonly verdict: 'ключ автора не подтверждён' }"));
edit('packages/core/src/access/save-user.ts',s=>replace(s,'    ...patch,',`    ...patch,
    signingPublicKeys: [...new Set([
      ...(current.signingPublicKeys ?? []),
      ...(current.signingKey == null ? [] : [current.signingKey.publicKey]),
      ...(patch.signingKey == null ? [] : [patch.signingKey.publicKey]),
    ])],`));
edit('packages/core/src/access/simple-signature.ts',s=>{
 s=replace(s,'  const hash = await hasher.sha256Hex(input.content);',`  const identity = {
    formatVersion: 2 as const,
    signerId: user.id, signerName: user.fullName, signerPosition: user.position,
    signerRole: user.role, signedAt: input.at, kind: input.kind,
    keyGeneration: user.keyGeneration, basis: input.basis?.trim() || null,
  };
  const hash = await hasher.sha256Hex(signatureEnvelope(identity, input.content));`);
 s=replace(s,'  let keySignature = null;',"  if (input.keys === undefined || user.signingKey == null) return err('FORBIDDEN', 'Для подписи нужен личный ключ. Смените пароль в личном кабинете.');\n  let keySignature = null;");
 s=replace(s,'  return ok({\n    signerId:', '  return ok({\n    formatVersion: 2,\n    signerId:');
 s=replace(s,'  keys?: SigningKeyService,\n)', '  keys?: SigningKeyService,\n  trustedPublicKeys?: readonly string[],\n)');
 s=replace(s,'  const hash = await hasher.sha256Hex(content);',`  if (signature.formatVersion !== 2) return ok({ verdict: 'устаревшая подпись — авторство не подтверждено' });
  if (signature.key == null || keys === undefined) return ok({ verdict: 'подпись не сходится' });
  const hash = await hasher.sha256Hex(signatureEnvelope(signature, content));`);
 s=replace(s,"  return ok({ verdict: 'подпись верна' });", "  if (trustedPublicKeys === undefined || !trustedPublicKeys.includes(signature.key.publicKey)) return ok({ verdict: 'ключ автора не подтверждён' });\n  return ok({ verdict: 'подпись верна' });");
 s+=`\nfunction signatureEnvelope(signature: Pick<SimpleSignature, 'formatVersion' | 'signerId' | 'signerName' | 'signerPosition' | 'signerRole' | 'signedAt' | 'kind' | 'keyGeneration' | 'basis'>, content: string): string {
  return JSON.stringify({ version: signature.formatVersion, signerId: signature.signerId,
    signerName: signature.signerName, signerPosition: signature.signerPosition, signerRole: signature.signerRole,
    signedAt: signature.signedAt, kind: signature.kind, keyGeneration: signature.keyGeneration,
    basis: signature.basis, content });
}
`;
 return s;
});
edit('packages/core/src/access/signed-content.ts',s=>{
 // Сохраняем прежний способ отдельно: ранее подписанные записи не переписываются.
 s=s.replace('export function signedJournalContent(event: MaintenanceEvent): string {','export function legacySignedJournalContent(event: MaintenanceEvent): string {');
 s+=`\n/** Версия 2: однозначный JSON вместо строк с разделителями; вложения включены полностью. */
export function signedJournalContent(event: MaintenanceEvent): string {
  return canonical({
    version: 2, objectId: event.objectId, activityCode: event.activityCode, performedOn: event.performedOn,
    result: event.result, defect: event.defect ?? null, executor: event.executor ?? null,
    executorDetails: event.executorDetails ?? null, externalEvidence: event.externalEvidence ?? null,
    inspectionAct: event.inspectionAct ?? null, checklist: event.checklist,
    measurements: event.measurements ?? [], note: event.note ?? null,
  });
}
function canonical(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object') return '{' + Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined)
    .map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
`;
 return s;
});
const names=['signIn','createUser','changePassword','resetPassword','updateUser','updateOwnProfile','acceptLegal','setUserArchived','deleteUser','hasAnyUser','signSimple'];
const ui='packages/desktop/src/renderer/src/';
function walk(p){for(const e of fs.readdirSync(root+p,{withFileTypes:true})){const f=p+e.name;if(e.isDirectory())walk(f+'/');else if(/\.tsx?$/.test(f)&&!f.includes('account-client')&&!f.includes('.test.'))edit(f,s=>{
 const moved=[];
 s=s.replace(/import \{([^}]+)\} from '@izh\/core';/g,(full,items)=>{
   const keep=items.split(',').map(x=>x.trim()).filter(Boolean).filter(x=>{if(names.includes(x)){moved.push(x);return false}return true;});
   return keep.length ? `import { ${keep.join(', ')} } from '@izh/core';` : '';
 });
 if(moved.length)s=`import { ${moved.join(', ')} } from '${p===ui?'./':'../'}account-client';\n`+s;
 return s;
});}}
walk(ui);
edit(ui+'use-session.ts',s=>replace(s,'signOut: useCallback(() => setUser(null), []),',"signOut: useCallback(() => { void window.izh.account.logout(); setUser(null); setUsers([]); }, []),"));
edit(ui+'components/ChecklistScreen.tsx',s=>s.replace('(props.performer.signingKey ?? null) !== null','props.performer.hasSigningKey === true'));
edit(ui+'components/UnifiedChecklistModal.tsx',s=>{
 const a=s.indexOf('        <button\n          type="button"\n          className={props.canSign ? undefined');
 const b=s.indexOf('        </button>',a);
 if(a<0||b<0)throw Error('Unsigned button not found');
 return s.slice(0,a)+`        {!props.canSign && <p className="muted">Для внесения проверки нужны права и личный ключ подписи. Проверьте учётную запись.</p>}\n`+s.slice(b+17);
});
edit('packages/desktop/src/main/channels.ts',s=>replace(s,'export const CHANNELS = {',`export const CHANNELS = {
  accountExists: 'account:exists', accountAction: 'account:action', accountLogout: 'account:logout',
  accountRemove: 'account:remove', accountSign: 'account:sign', accountVerify: 'account:verify',`));
edit('packages/desktop/src/preload/index.ts',s=>replace(s,'const bridge = {',`const bridge = {
  account: {
    exists: () => ipcRenderer.invoke(CHANNELS.accountExists),
    action: (request: unknown) => ipcRenderer.invoke(CHANNELS.accountAction, request),
    logout: () => ipcRenderer.invoke(CHANNELS.accountLogout),
    remove: (id: string) => ipcRenderer.invoke(CHANNELS.accountRemove, id),
    sign: (input: unknown) => ipcRenderer.invoke(CHANNELS.accountSign, input),
    verify: (event: unknown) => ipcRenderer.invoke(CHANNELS.accountVerify, event),
  },`));
edit(ui+'bridge.d.ts',s=>"import type { AccountApi } from '../../account-api';\n"+replace(s,'export interface IzhBridge {','export interface IzhBridge {\n  readonly account: AccountApi;'));
console.log('Account bridge and versioned signatures applied');
