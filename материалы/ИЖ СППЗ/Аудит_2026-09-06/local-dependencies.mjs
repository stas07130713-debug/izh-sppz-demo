import fs from 'node:fs';
import path from 'node:path';
const work='C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9/fixes-work';
const original='C:/Users/Svyt0/Projects/izh-sppz/node_modules';
const destination=path.join(work,'node_modules');
if(!fs.lstatSync(destination).isSymbolicLink()) throw Error('Expected the task-owned junction');
fs.unlinkSync(destination);
fs.mkdirSync(destination);
for(const e of fs.readdirSync(original,{withFileTypes:true})) {
 if(e.name==='@izh') continue;
 if(e.isDirectory()) fs.symlinkSync(path.join(original,e.name),path.join(destination,e.name),'junction');
 else fs.copyFileSync(path.join(original,e.name),path.join(destination,e.name));
}
fs.mkdirSync(path.join(destination,'@izh'));
for(const p of fs.readdirSync(path.join(work,'packages'))) {
 const dir=path.join(work,'packages',p);
 const file=path.join(dir,'package.json');
 if(fs.existsSync(file)) { const name=JSON.parse(fs.readFileSync(file,'utf8')).name;
   if(name.startsWith('@izh/'))fs.symlinkSync(dir,path.join(destination,name),'junction');
 }
}
console.log('Workspace dependencies point to the edited packages');
