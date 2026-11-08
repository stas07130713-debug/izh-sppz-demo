import fs from 'node:fs';
const root='C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9/fixes-work/';
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n')));}
edit('packages/desktop/src/main/ipc.ts',s=>{
 s="import { createSecureIpc } from './secure-ipc.js';\n"+s.replace('dialog, ipcMain, shell','dialog, shell');
 s=s.replace('export function registerIpcHandlers(): void {','export function registerIpcHandlers(rendererUrl?: string): void {\n  const ipc = createSecureIpc(rendererUrl);');
 return s.replaceAll('ipcMain.handle(', 'ipc.handle(');
});
edit('packages/desktop/src/main/index.ts',s=>s.replace('  window.webContents.setWindowOpenHandler',"  window.webContents.on('will-navigate', event => event.preventDefault());\n  window.webContents.on('will-attach-webview', event => event.preventDefault());\n  window.webContents.setWindowOpenHandler"));
edit('packages/desktop/src/renderer/index.html',s=>s.replace('<head>','<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'self\' ws://127.0.0.1:5173; worker-src \'self\' blob:; object-src \'none\'; base-uri \'none\'; frame-src \'none\';" />'));
edit('packages/desktop/src/renderer/src/App.tsx',s=>s.replace('    void refreshList();\n    void window.izh.dataDir()', '    if (session.user === null) { setBackdrops([]); setSelectedId(null); return; }\n    setMessage(null);\n    void refreshList();\n    void window.izh.dataDir()').replace('  }, [refreshList]);','  }, [refreshList, session.user?.id]);'));
// Подпись отображается после настоящей проверки, а не наличия поля signature.
edit('packages/desktop/src/renderer/src/components/journal-signature.tsx',s=>{
 s="import { useEffect, useState } from 'react';\n"+s;
 const a=s.indexOf('  const signature = event.signature');
 s=s.slice(0,a)+`  return <VerifiedSignature event={event} />;
}

function VerifiedSignature({ event }: { readonly event: MaintenanceEvent }): React.JSX.Element {
  const [verdict, setVerdict] = useState('проверка подписи…');
  useEffect(() => {
    let current = true;
    setVerdict('проверка подписи…');
    void window.izh.account.verify(event).then(result => {
      if (current) setVerdict(result.ok ? result.value.verdict : 'проверка недоступна');
    }).catch(() => { if (current) setVerdict('проверка недоступна'); });
    return () => { current = false; };
  }, [event]);
  const signature = event.signature ?? null;
  if (signature === null) return <span className="muted">без подписи</span>;
  const good = verdict === 'подпись верна';
  return <span className={good ? 'journal-signed' : 'muted'} title={verdict}>
    {good ? '✔ ' : '⚠ '}{signature.signerName}
    <span className="small"> · {formatDateRu(signature.signedAt.slice(0, 10))} · {verdict}</span>
  </span>;
}
`;
 return s;
});
console.log('Security connected');
