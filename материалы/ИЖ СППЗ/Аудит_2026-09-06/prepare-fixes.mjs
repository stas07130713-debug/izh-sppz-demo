import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const source = 'C:/Users/Svyt0/Projects/izh-sppz';
const base = 'C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9';
const work = path.join(base, 'fixes-work');
const backup = path.join(base, 'before-fixes');
if (fs.existsSync(work) || fs.existsSync(backup)) throw new Error('Snapshot already exists');
const excluded = new Set(['node_modules', '.git', 'out', 'release']);
for (const dest of [backup, work]) fs.cpSync(source, dest, {recursive:true, filter:p=>!excluded.has(path.basename(p))});
fs.symlinkSync(path.join(source, 'node_modules'), path.join(work, 'node_modules'), 'junction');
const manifest = {};
function walk(dir, prefix='') { for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
  const rel=path.join(prefix,e.name); const file=path.join(dir,e.name);
  if(e.isDirectory()) walk(file,rel);
  else if(e.isFile()) manifest[rel.replaceAll('\\','/')]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}}
walk(backup);
fs.writeFileSync(path.join(base,'before-fixes-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({work,backup,files:Object.keys(manifest).length}));
