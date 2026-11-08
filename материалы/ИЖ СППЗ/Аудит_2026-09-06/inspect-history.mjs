import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root='C:/Users/Svyt0/.claude/projects';
const out=path.dirname(fileURLToPath(import.meta.url));
const sessions=[];
for(const dir of fs.readdirSync(root)) {
 for(const name of fs.readdirSync(path.join(root,dir)).filter(n=>n.endsWith('.jsonl'))) {
  const rows=fs.readFileSync(path.join(root,dir,name),'utf8').split('\n').filter(Boolean).flatMap(l=>{try{return [JSON.parse(l)]}catch{return []}});
  const cwd=[...new Set(rows.map(r=>r.cwd).filter(Boolean))];
  const user=rows.filter(r=>r.type==='user').map(r=>({date:r.timestamp,text:typeof r.message?.content==='string'?r.message.content:(r.message?.content??[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')})).filter(r=>r.text && !r.text.startsWith('<local-command') && !r.text.startsWith('<command-'));
  const relevant=cwd.some(c=>/izh-sppz|ИЖ СППЗ/i.test(c)) || user.some(r=>/ИЖ СППЗ|izh-sppz/.test(r.text));
  if(!relevant) continue;
  const assistant=rows.filter(r=>r.type==='assistant'&&r.message?.stop_reason==='end_turn').map(r=>({date:r.timestamp,text:(r.message.content??[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')})).filter(r=>r.text);
  sessions.push({file:path.join(root,dir,name),cwd,user,assistant});
 }
}
fs.writeFileSync(path.join(out,'claude-project-history.json'),JSON.stringify(sessions,null,2));
fs.writeFileSync(path.join(out,'claude-user-requests.txt'),sessions.flatMap(s=>['SESSION '+path.basename(s.file)+' '+s.cwd.join(' | '),...s.user.map(u=>u.date+'\n'+u.text)]).join('\n\n'));
console.log(JSON.stringify(sessions.map(s=>({file:path.basename(s.file),cwd:s.cwd,requests:s.user.length,replies:s.assistant.length,first:s.user[0]?.date,last:s.user.at(-1)?.date})),null,2));
