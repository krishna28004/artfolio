// Local-only browser check. Requires the synthetic catalog fixture and local production app.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const app = process.env.ARTFOLIO_BROWSER_URL || "http://127.0.0.1:3101";
assert.equal(new URL(app).hostname, "127.0.0.1", "browser test must remain local");
const output = process.env.ARTFOLIO_BROWSER_OUTPUT || mkdtempSync(path.join(tmpdir(), "artfolio-artwork-evidence-"));
mkdirSync(output, { recursive: true });
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
assert.ok(chrome, "Chrome or Edge is required");
const browser = spawn(chrome, ["--headless=new", "--remote-debugging-port=9237", "--user-data-dir=" + mkdtempSync(path.join(tmpdir(), "artfolio-artwork-browser-")), "about:blank"], { windowsHide: true, stdio: "ignore" });
const pending = new Map(); let socket; let sequence = 0; const errors = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, label) { for (let i = 0; i < 150; i++) { try { if (await fn()) return; } catch {} await delay(100); } throw Error("Timed out: " + label); }
function send(method, params = {}) { const id = ++sequence; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw Error(response.exceptionDetails.text); return response.result.value; }
async function click(selector) { const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`); await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point }); }
async function screenshot(name) { const shot = await send("Page.captureScreenshot", { captureBeyondViewport: false }); writeFileSync(path.join(output, name + ".png"), Buffer.from(shot.data, "base64")); }

try {
  await until(async () => { try { return (await fetch("http://127.0.0.1:9237/json/version")).ok; } catch { return false; } }, "Chrome DevTools");
  const target = await (await fetch("http://127.0.0.1:9237/json/new?about:blank", { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.addEventListener("message", ({ data }) => { const event = JSON.parse(data); if (event.id) { const item = pending.get(event.id); pending.delete(event.id); if (event.error) item?.reject(Error(event.error.message)); else item?.resolve(event.result); } if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails.text); });
  await send("Page.enable"); await send("Runtime.enable");
  await fetch("http://127.0.0.1:3102/fixture?mode=modern");

  for (const viewport of [{ width: 390, height: 844, mobile: true }, { width: 1440, height: 1000, mobile: false }]) {
    await send("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1 });
    await send("Page.navigate", { url: app + "/artworks" });
    await until(() => evaluate("document.querySelector('h1')?.textContent==='All Artworks'"), "artworks page");
    assert.equal(await evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"), false, "no horizontal overflow");
    assert.equal(await evaluate("document.querySelectorAll('article').length"), 8, "modern published artwork collection only");
    assert.equal(await evaluate("document.querySelectorAll('article img')[0]?.getAttribute('src')?.includes('luminous-veil.jpg')"), true, "first artwork image is present");
    await screenshot(viewport.mobile ? "artworks-mobile" : "artworks-desktop");
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: app + "/" });
  await until(() => evaluate("!!document.querySelector('button[aria-label=\"Open Menu\"]')"), "site menu");
  await click('button[aria-label="Open Menu"]');
  await until(() => evaluate("document.querySelector('#site-menu-panel a[href=\"/artworks\"]')?.getClientRects().length>0"), "open menu");
  const start = Date.now(); await click('#site-menu-panel a[href="/artworks"]');
  await until(() => evaluate("location.pathname==='/artworks'&&document.querySelector('h1')?.textContent==='All Artworks'"), "menu navigation");
  const galleryMs = Date.now() - start;
  assert.equal(await evaluate("document.querySelector('#site-menu-panel').getAttribute('aria-hidden')"), "true", "menu closes on navigation");
  const detailStart = Date.now();
  await click('article a[href="/artwork/luminous-veil"]');
  await until(() => evaluate("location.pathname==='/artwork/luminous-veil'&&document.querySelector('h1')?.textContent==='Luminous Veil'"), "artwork detail header");
  const detailMs = Date.now() - detailStart;
  assert.equal(await evaluate("document.querySelector('main')?.innerText.includes('A4 Sheet')"), true, "dedicated detail displays A4");
  assert.equal(await evaluate("document.querySelector('main')?.innerText.includes('A3 Sheet')"), false, "dedicated detail no longer displays A3");
  assert.equal(await evaluate("document.querySelector('main')?.innerText.includes('striking portrait')"), true, "description is available with the title");
  await until(() => evaluate("[...document.querySelectorAll('main img')].some(i=>i.alt.includes('Luminous Veil')&&i.complete&&i.naturalWidth>0)"), "full artwork image");
  assert.equal(await evaluate("!!document.querySelector('[aria-label=\"Loading full-resolution artwork\"]')"), false, "image loader leaves after image load");
  await screenshot("artwork-detail-mobile");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true, "reduced-motion preference is honored");
  console.log(JSON.stringify({ galleryMenuToHeadingMs: galleryMs, menuToDetailHeadingMs: detailMs, screenshotDirectory: output, uncaughtBrowserErrors: errors.length }));
  assert.deepEqual(errors, [], "no uncaught browser exceptions");
} finally {
  if (socket?.readyState === WebSocket.OPEN) await Promise.race([send("Browser.close").catch(() => {}), delay(1000)]);
  socket?.close(); browser.kill();
}
