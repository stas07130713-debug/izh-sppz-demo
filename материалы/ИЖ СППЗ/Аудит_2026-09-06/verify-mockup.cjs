const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
const root='C:/Users/Svyt0/.codex/visualizations/2026/09/05/01a0739f-8a0e-7583-b985-a75c6582cab9';
const output='C:/Users/Svyt0/OneDrive/Рабочий стол/КЛОУД/ИЖ СППЗ/Аудит_2026-09-06';
app.setPath('userData',path.join(output,'mockup-render-data'));app.disableHardwareAcceleration();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const win=new BrowserWindow({show:false,width:1024,height:900,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:true}});
 const errors=[];win.webContents.on('console-message',(_e,l,m)=>{if(l>=2&&!m.includes('Security Warning'))errors.push(m)});
 await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<meta charset="utf-8"><style>body{margin:0}</style>'+fs.readFileSync(path.join(root,'izh-design-directions.html'),'utf8')));
 const results=[];
 for(const width of [1024,736,360]){
  win.setSize(width,1200);await pause(100);
  for(const design of ['engineering','dispatch','document']){
   await win.webContents.executeJavaScript(`(()=>{const r=document.getElementById('izh-design');r.__auditMock.state.design='${design}';r.__auditMock.state.view='${design==='document'?'journal':'plan'}';r.__auditMock.render();})()`);await pause(140);
   const dimensions=await win.webContents.executeJavaScript(`({width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.getElementById('izh-design').getBoundingClientRect().height,selected:document.querySelector('[data-view][aria-selected=true]').textContent})`);
   results.push({width,design,...dimensions});
   if(width===1024 || (width===360&&design==='engineering')){
    win.webContents.invalidate();await pause(200);fs.writeFileSync(path.join(output,'design-'+design+'-'+width+'.png'),(await win.webContents.capturePage({x:0,y:0,width,height:Math.ceil(dimensions.height)})).toPNG());
   }
  }
 }
 await win.webContents.executeJavaScript(`document.querySelector('[data-view="journal"]').click();document.querySelector('[data-row="1"]').click();`);
 const selected=await win.webContents.executeJavaScript(`document.getElementById('ij-card-number').textContent`);
 await win.webContents.executeJavaScript(`document.getElementById('ij-card-check').click()`);
 const checklist=await win.webContents.executeJavaScript(`!document.querySelector('[data-panel="checklist"]').hidden`);
 fs.writeFileSync(path.join(output,'mockup-checks.json'),JSON.stringify({results,selected,checklist,errors},null,2));win.destroy();app.quit();
}catch(e){fs.writeFileSync(path.join(output,'mockup-error.txt'),String(e));app.exit(1)}});
