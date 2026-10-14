// Requires the loopback synthetic catalog fixture and local production-mode app.
// Does not call or alter any hosted service.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {existsSync,mkdtempSync,mkdirSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
const app=process.env.ARTFOLIO_BROWSER_URL||"http://127.0.0.1:3101";
assert.equal(new URL(app).hostname,"127.0.0.1","state tests require a local application");
const output=process.env.ARTFOLIO_BROWSER_OUTPUT||mkdtempSync(path.join(tmpdir(),"artfolio-catalog-evidence-"));
mkdirSync(output,{recursive:true});
const chrome=["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
assert.ok(chrome);
const browser=spawn(chrome,["--headless=new","--remote-debugging-port=9236","--user-data-dir="+mkdtempSync(path.join(tmpdir(),"artfolio-catalog-browser-")),"--use-angle=swiftshader","--enable-unsafe-swiftshader","about:blank"],{windowsHide:true,stdio:"ignore"});
let socket,sequence=0;const pending=new Map(),exceptions=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){try{if(await fn())return;}catch{}await delay(200);}throw Error("Timeout: "+label);}
function send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function mode(value){await fetch("http://127.0.0.1:3102/fixture?mode="+value);}
async function api(route,status){const res=await fetch(app+route);assert.equal(res.status,status,route);return {response:res,body:await res.json()};}
async function navigate(route){await send("Page.navigate",{url:app+route});await until(()=>evaluate("document.readyState==='complete'"),route);}
async function screenshot(name){const shot=await send("Page.captureScreenshot",{captureBeyondViewport:false});writeFileSync(path.join(output,name+".png"),Buffer.from(shot.data,"base64"));}
try{
 await until(async()=>{try{return(await fetch("http://127.0.0.1:9236/json/version")).ok}catch{return false}},"CDP");
 const target=await(await fetch("http://127.0.0.1:9236/json/new?about:blank",{method:"PUT"})).json();
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener("open",r,{once:true}));
 socket.addEventListener("message",({data})=>{const e=JSON.parse(data);if(e.id){const p=pending.get(e.id);pending.delete(e.id);if(e.error)p?.reject(Error(e.error.message));else p?.resolve(e.result);}if(e.method==="Runtime.exceptionThrown")exceptions.push(e.params.exceptionDetails.text);});
 await send("Runtime.enable");await send("Page.enable");await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await mode("legacy");assert.equal((await api("/api/artworks",200)).body.count,10);
 await mode("modern");const modern=(await api("/api/artworks",200)).body;assert.equal(modern.count,8);assert.equal(modern.schema,"publication");
 const sitemap=await fetch(app+"/sitemap.xml");assert.equal(sitemap.status,200);const xml=await sitemap.text();assert.ok(xml.includes("/artwork/luminous-veil"));assert.ok(!xml.includes("/artwork/the-curious-mr-bean"));
 for(const id of ["the-curious-mr-bean","sorcerer-supreme"])await api("/api/artworks/"+id,404);
 console.log("PASS production API: legacy compatibility, published visibility, draft/archive detail privacy");
 await mode("empty");assert.deepEqual((await api("/api/artworks",200)).body.data,[]);
 await navigate("/exhibition");await until(()=>evaluate("document.body.innerText.includes('No artworks are currently on view.')"),"genuine empty exhibition");
 assert.equal(await evaluate("document.querySelectorAll('canvas').length"),0,"empty exhibition avoids WebGL initialization");
 assert.equal(await evaluate("!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enter Exhibition'))"),false,"empty exhibition has no dead entry control");
 assert.equal(await evaluate("!!document.querySelector('[role=status] a[href=\"/\"]')"),true,"empty exhibition offers an exit");
 await screenshot("catalog-empty-mobile");console.log("PASS genuine empty exhibition has a separate state");
 await mode("failure");const failed=await api("/api/artworks",503);assert.equal(failed.response.headers.get("cache-control"),"no-store");await api("/api/artworks/luminous-veil",503);
 const fallbackSitemap=await fetch(app+"/sitemap.xml");assert.equal(fallbackSitemap.status,200);assert.ok((await fallbackSitemap.text()).includes("/exhibition"));
 await navigate("/artwork/luminous-veil");await until(()=>evaluate("document.querySelector('[role=alert]')?.textContent.includes('temporarily unavailable')"),"detail failure notice");assert.ok(!await evaluate("document.body.innerText.includes('404')"));await screenshot("catalog-detail-error-mobile");
 await navigate("/saved");await until(()=>evaluate("!!document.querySelector('[role=alert]')"),"saved failure notice");assert.ok(!await evaluate("document.body.innerText.includes('No masterpieces archived yet.')"));
 await evaluate("localStorage.setItem('artfolio_favorites',JSON.stringify(['luminous-veil']))");await mode("legacy");
 await evaluate("document.querySelector('[role=alert] a').click()");await until(()=>evaluate("document.querySelectorAll('article').length===1"),"retry reload restores saved artwork");
 assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('artfolio_favorites'))"),["luminous-veil"]);
 assert.equal(await evaluate("performance.getEntriesByType('navigation')[0].type"),"reload");
 console.log("PASS failure is 503, detail is not false 404, saved choices survive and retry reload works");
 await mode("failure");await navigate("/exhibition");await until(()=>evaluate("document.querySelector('[role=alert]')?.textContent.includes('temporarily unavailable')"),"exhibition failure");await screenshot("catalog-exhibition-error-mobile");
 assert.equal(await evaluate("document.querySelectorAll('canvas').length"),0,"failed exhibition avoids WebGL initialization");
 assert.equal(await evaluate("!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enter Exhibition'))"),false,"failed exhibition has no dead entry control");
 await mode("legacy");await evaluate("document.querySelector('[role=alert] button').click()");await until(()=>evaluate("!document.querySelector('[role=alert]')"),"exhibition retry success");
 console.log("PASS exhibition failure and retry are distinct from empty");
 assert.deepEqual(exceptions,[],"uncaught browser exceptions");
 console.log("Expected failed requests were injected; uncaught browser exceptions: 0");
}finally{await mode("legacy");if(socket?.readyState===WebSocket.OPEN)await Promise.race([send("Browser.close").catch(()=>{}),delay(2000)]);socket?.close();browser.kill();}
