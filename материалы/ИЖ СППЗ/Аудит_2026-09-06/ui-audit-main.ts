import { app, BrowserWindow } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registerIpcHandlers } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/ipc';
import { createTreeRepository } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/tree-repository';
import { createObjectRepository } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/object-repository';
import { createUserRepository } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/user-repository';
import { createPasswordHasher } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/password-hasher';
import { ensureDataDirs } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/src/main/storage-paths';
import { createOrganization, createChildNode, placeObject, LEGAL_VERSION } from 'C:/Users/Svyt0/Projects/izh-sppz/packages/core/src/index';
const output=process.argv[2];
if(!output || !output.includes('Аудит_2026-09-06')) throw Error('Dedicated audit directory required');
app.setPath('userData',join(output,'isolated-ui-data-'+Date.now()));
app.disableHardwareAcceleration();
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const value=(r:any)=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value};
app.whenReady().then(async()=>{
 try {
 await mkdir(output,{recursive:true});await ensureDataDirs();
 const tree=createTreeRepository(),objects=createObjectRepository();
 const deps={tree,objects,clock:{nowUtc:()=>new Date().toISOString(),today:()=> '2026-09-06'},ids:{newId:()=>crypto.randomUUID()}};
 const organization=value(await createOrganization(deps,{name:'Демонстрационный объект — аудит'}));
 const building=value(await createChildNode(deps,{parentId:organization.id,kind:'building',name:'Корпус А'}));
 const level=value(await createChildNode(deps,{parentId:building.id,kind:'level',name:'Этаж 1'}));
 const other=value(await createChildNode(deps,{parentId:organization.id,kind:'building',name:'Корпус Б — доступ не выдан'}));
 const sample=value(await placeObject(deps,{nodeId:level.id,typeCode:'extinguisher',position:null,regNumber:'ОТ-001',model:'ОП-5',commissionedOn:'2026-09-01'}));
 const password=value(await createPasswordHasher().hash('Audit-Guest-267'));
 await createUserRepository().save({id:crypto.randomUUID(),login:'audit-guest',fullName:'Тестовый гость',position:null,email:null,role:'гость',scope:[level.id],password,keyGeneration:1,mustChangePassword:false,archivedAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),rowVersion:1,acceptedLegalVersion:LEGAL_VERSION,acceptedLegalAt:new Date().toISOString()});
 registerIpcHandlers();
 const window=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true,backgroundThrottling:false,preload:'C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/out/preload/index.js',contextIsolation:true,nodeIntegration:false}});
 const errors:string[]=[];window.webContents.on('console-message',(_e,l,m)=>{if(l>=2)errors.push(m)});
 await window.loadFile('C:/Users/Svyt0/Projects/izh-sppz/packages/desktop/out/renderer/index.html');await pause(600);
 const beforeLogin=await window.webContents.executeJavaScript(`(async()=>{const r=await window.izh.objects.list(); const o=r.value[0]; const saved=await window.izh.objects.save({...o,note:'written before login by audit'});return {readAllowed:r.ok,count:r.value.length,writeAllowed:saved.ok};})()`);
 console.log('IPC_BEFORE_LOGIN',JSON.stringify(beforeLogin));
 await window.webContents.executeJavaScript(`(()=>{ const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const fields=[...document.querySelectorAll('input')]; const login=fields.find(e=>e.type==='text');const pass=fields.find(e=>e.type==='password');s.call(login,'audit-guest');login.dispatchEvent(new Event('input',{bubbles:true}));s.call(pass,'Audit-Guest-267');pass.dispatchEvent(new Event('input',{bubbles:true})); })()`);
 await pause(120);await window.webContents.executeJavaScript(`document.querySelector('form').requestSubmit()`);await pause(1000);
 const guestText=await window.webContents.executeJavaScript('document.body.innerText');
 await window.webContents.executeJavaScript(`document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='+ Организация')b.click()})`);await pause(150);
 await window.webContents.executeJavaScript(`(()=>{const input=document.querySelector('input[placeholder="Например: Кольская ГМК"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Создано гостем — аудиторский тест');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(150);
 await window.webContents.executeJavaScript(`document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='Создать')b.click()})`);await pause(500);
 const afterCreate=await tree.list();
 const guestCreatedOrganization=afterCreate.ok&&afterCreate.value.some(n=>n.name==='Создано гостем — аудиторский тест');
 await window.webContents.executeJavaScript(`document.querySelectorAll('button.tree-label').forEach(b=>{if(b.textContent.includes('Этаж 1'))b.click()})`);await pause(650);
 await writeFile(join(output,'guest-ui-text.txt'),guestText);
 await writeFile(join(output,'current-app-guest.png'),(await window.webContents.capturePage()).toPNG());
 console.log('GUEST_SCREEN',guestText.slice(0,1700));
 await writeFile(join(output,'ui-checks.json'),JSON.stringify({beforeLogin,guestSeesUnassignedBuilding:guestText.includes('Корпус Б'),guestCreatedOrganization,errors},null,2));
 if(process.argv.includes('--mockups')){
   // Mockup verification is performed by a separate optional runner.
 }
 window.destroy();app.quit();
 }catch(e){console.error(e);app.exit(1)}
});
