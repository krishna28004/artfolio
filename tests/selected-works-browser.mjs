import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const phase=process.argv[2]||'after', app=process.env.ARTFOLIO_BROWSER_URL||'http://127.0.0.1:3101';
const output=process.env.ARTFOLIO_BROWSER_OUTPUT||mkdtempSync(path.join(tmpdir(),'artfolio-selected-evidence-'));mkdirSync(output,{recursive:true});
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome);
const browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=9235','--user-data-dir='+mkdtempSync(path.join(tmpdir(),'artfolio-selected-')),'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));const pending=new Map(),errors=[];let socket,sequence=0;
async function until(fn,label){for(let i=0;i<200;i++){try{if(await fn())return;}catch{}await delay(200);}throw Error('Timeout: '+label);}
function send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function key(key,code,keyCode){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:keyCode,text:key==='Enter'?'\r':key===' '?' ':undefined});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode});}
async function click(selector){const q='document.querySelector('+JSON.stringify(selector)+')';await evaluate(q+".scrollIntoView({block:'center',behavior:'instant'})");const p=await evaluate('(()=>{const r='+q+'.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
const viewports=[
{name:'360-portrait',width:360,height:800,mobile:true},
{name:'390-portrait',width:390,height:844,mobile:true},
{name:'430-portrait',width:430,height:932,mobile:true},
{name:'768-tablet',width:768,height:1024,mobile:true},
{name:'1024-desktop',width:1024,height:768,mobile:false},
{name:'1720-desktop',width:1720,height:1000,mobile:false},
{name:'844-landscape',width:844,height:390,mobile:true}];
const results=[];
try{
await until(async()=>{try{return(await fetch('http://127.0.0.1:9235/json/version')).ok}catch{return false}},'CDP');
const target=await(await fetch('http://127.0.0.1:9235/json/new?about:blank',{method:'PUT'})).json();socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
socket.addEventListener('message',({data})=>{const e=JSON.parse(data);if(e.id){const p=pending.get(e.id);pending.delete(e.id);if(e.error)p?.reject(Error(e.error.message));else p?.resolve(e.result);}if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.text);if(e.method==='Runtime.consoleAPICalled'&&e.params.type==='error')errors.push(e.params.args.map(a=>a.value||a.description).join(' '));});
socket.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('CDP closed'));pending.clear();});
await send('Page.enable');await send('Runtime.enable');
for(const viewport of viewports){
await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});await send('Emulation.setTouchEmulationEnabled',{enabled:viewport.mobile,maxTouchPoints:5});await send('Emulation.setEmulatedMedia',{features:[]});await send('Page.navigate',{url:app});
await until(()=>evaluate("document.querySelector('#gallery button') && document.querySelectorAll('.carousel-card').length===20"),'populated homepage');
await evaluate('document.fonts.ready');await delay(1000);await evaluate("window.scrollTo({top:document.querySelector('#gallery').getBoundingClientRect().top+scrollY-90,behavior:'instant'})");if(phase==='after')await until(()=>evaluate("[...document.querySelectorAll('.selected-works-art img')].filter(i=>i.parentElement.getClientRects().length>0).every(i=>i.complete&&i.naturalWidth>0)"),'visible illustrations loaded');
const rects=await evaluate("(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};const title=document.querySelector('.selected-works-title')||document.querySelector('#gallery button > span > span');const stage=document.querySelector('.selected-works-stage')||document.querySelector('#gallery');const over=document.querySelector('.selected-works-overline');const sub=document.querySelector('#gallery button > span:last-child');const about=document.querySelector('#about');const children=[...about.firstElementChild.firstElementChild.children].map(rect);const s=rect(stage);return{viewport:innerWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,title:rect(title),stage:s,overline:over&&rect(over),subtitle:rect(sub),about:rect(about),nextContentGap:Math.min(...children.map(r=>r.y))-s.bottom,pausedControls:document.querySelectorAll('button[aria-label=\"Pause carousel\"]').length,toggles:document.querySelectorAll('#gallery button[aria-controls=\"selected-works-grid\"]').length,count:document.querySelector('#gallery button').textContent,illustrations:[...document.querySelectorAll('.selected-works-art img')].filter(i=>i.parentElement.getClientRects().length>0).map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.getAttribute('src')}))}})()");
assert.equal(rects.overflow,false,viewport.name+' no overflow');assert.equal(rects.toggles,1);assert.equal(rects.pausedControls,1);
if(phase==='after'){
assert.ok(Math.abs(rects.title.x+rects.title.width/2-viewport.width/2)<=0.6,viewport.name+' heading centered');
assert.ok(Math.abs(rects.subtitle.x+rects.subtitle.width/2-viewport.width/2)<=0.6,viewport.name+' subtitle centered');
assert.ok(Math.abs(rects.overline.x+rects.overline.width/2-viewport.width/2)<=0.6,viewport.name+' overline centered');
assert.ok(rects.nextContentGap<=81,viewport.name+' no unused gap');
assert.ok(rects.illustrations.length>=2&&rects.illustrations.every(i=>i.loaded),viewport.name+' illustration assets load');
assert.ok(rects.count.includes('10 artworks'),'actual count');
assert.ok(await evaluate("[...document.querySelectorAll('.selected-works-art')].every(n=>getComputedStyle(n).pointerEvents==='none'&&n.getAttribute('aria-hidden')==='true')"),'decorative art noninteractive');
}
await evaluate("window.scrollTo({top:document.querySelector('#gallery').getBoundingClientRect().top+scrollY-90,behavior:'instant'})");await delay(150);
const shot=await send('Page.captureScreenshot',{captureBeyondViewport:false});writeFileSync(path.join(output,phase+'-'+viewport.name+'.png'),Buffer.from(shot.data,'base64'));
if(phase==='after'){
const s='#gallery button[aria-controls="selected-works-grid"]';await click(s);await until(()=>evaluate("document.querySelector('#selected-works-grid').hidden===false"),'grid expanded');assert.equal(await evaluate("document.querySelectorAll('#selected-works-grid article').length"),10,'artwork grid');assert.equal(await evaluate("document.querySelector('.selected-works-stage').getBoundingClientRect().height"),rects.stage.height,'grid expansion preserves stage height');await click(s);await until(()=>evaluate("document.querySelector('#selected-works-grid').hidden"),'grid collapsed');assert.equal(await evaluate("document.querySelector('#selected-works-grid').inert"),true,'collapsed inert');
}
results.push({name:viewport.name,...rects});console.log(viewport.name+': '+JSON.stringify({centerError:rects.title.x+rects.title.width/2-viewport.width/2,overflow:rects.overflow,stageHeight:rects.stage.height,nextContentGap:rects.nextContentGap}));
}
if(phase==='after'){
await send('Emulation.setDeviceMetricsOverride',{width:1720,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:app});await until(()=>evaluate("document.readyState==='complete'&&document.querySelectorAll('.carousel-card').length===20"),'desktop reload');await delay(500);
const transform=()=>evaluate("document.querySelector('.carousel-card').parentElement.style.transform");const start=await transform();await delay(350);assert.notEqual(await transform(),start,'carousel animates');await click('button[aria-label="Pause carousel"]');await delay(100);const paused=await transform();await delay(350);assert.equal(await transform(),paused,'pauses');await click('button[aria-label="Play carousel"]');await delay(350);assert.notEqual(await transform(),paused,'resumes');
await send('Page.bringToFront');await key('Tab','Tab',9);assert.equal(await evaluate("document.activeElement===document.querySelector('#gallery button')"),true);assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#gallery button')).outlineStyle"),'none','visible focus');await key('Enter','Enter',13);await until(()=>evaluate("document.querySelector('#gallery button').getAttribute('aria-expanded')==='true'"),'Enter opens');await key(' ','Space',32);await until(()=>evaluate("document.querySelector('#gallery button').getAttribute('aria-expanded')==='false'"),'Space closes');assert.equal(await evaluate("document.activeElement===document.querySelector('#gallery button')"),true,'focus retained');
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await until(()=>evaluate("document.querySelectorAll('.carousel-card').length===10"),'reduced motion');assert.equal(await evaluate('!!document.querySelector(\'button[aria-label="Pause carousel"]\')'),false);const reduced=await transform();await delay(350);assert.equal(await transform(),reduced,'reduced motion static');console.log('Motion, pause/resume, keyboard toggle, focus and reduced motion passed.');
}
assert.deepEqual(errors,[],'console/runtime errors');writeFileSync(path.join(output,phase+'-metrics.json'),JSON.stringify(results,null,2));console.log('Console/runtime errors: 0');
}finally{if(socket?.readyState===WebSocket.OPEN)await Promise.race([send('Browser.close').catch(()=>{}),delay(2000)]);socket?.close();browser.kill();}
