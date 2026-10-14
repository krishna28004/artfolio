// Run with the local app already listening on port 3000. Uses installed Chrome
// and CDP, so no browser package or production credentials are required.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const chrome = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
assert.ok(chrome, "An installed Chrome or Edge browser is required");
const appUrl = process.env.ARTFOLIO_BROWSER_URL || "http://localhost:3000";
const profile = mkdtempSync(path.join(tmpdir(), "artfolio-commission-browser-"));
const port = 9226;
const browser = spawn(chrome, ["--headless=new", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
{ windowsHide: true, stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];
const requests = new Map();
let socket;
let id = 0;
async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    try { const result = await fn(); if (result) return result; } catch { /* loading */ }
    await delay(200);
  }
  throw new Error(`Timed out: ${label}`);
}
function send(method, params = {}) {
  const requestId = ++id;
  return new Promise((resolve, reject) => {
    requests.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  assert.ok(point, `Missing ${selector}`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}
try {
  await until(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok, "browser endpoint");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const pending = requests.get(event.id);
      requests.delete(event.id);
      if (event.error) pending?.reject(new Error(event.error.message));
      else pending?.resolve(event.result);
    }
    if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails.text);
    if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error") {
      errors.push(event.params.args.map((argument) => argument.value || argument.description).join(" "));
    }
  });
  await send("Runtime.enable");
  await send("Page.enable");
  for (const viewport of [{ name: "desktop", width: 1440, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true }]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
    });
    await send("Page.navigate", { url: `${appUrl}/commission` });
    await until(() => evaluate("!!document.querySelector('#patron-name, [role=status]')"), `${viewport.name} commission state`);
    const page = await evaluate(`({ heading:document.querySelector('h1')?.textContent,
      overflow:document.documentElement.scrollWidth > innerWidth + 2,
      hasPrivacyNotice:document.body.innerText.includes('References are stored privately'),
      hasSubmit:!!document.querySelector('button[type=submit]'),
      paused:document.querySelector('[role=status]')?.textContent?.includes('Requests are paused') || false })`);
    assert.match(page.heading, /Commission a Piece/);
    assert.equal(page.overflow, false, `${viewport.name} horizontal overflow`);
    if (page.paused) {
      assert.equal(page.hasSubmit, false, `${viewport.name} paused intake has no submit control`);
      assert.equal(await evaluate("!!document.querySelector('#patron-name')"), false);
    } else {
      assert.equal(page.hasPrivacyNotice, true);
      assert.equal(page.hasSubmit, true);
    }
    if (viewport.name === "desktop" && !page.paused) {
      await click("button[type=submit]");
      await until(() => evaluate("document.body.innerText.includes('Name must be at least 2 characters')"), "inline validation");
      assert.equal(await evaluate("!!document.querySelector('#patron-name')"), true);
    }
    const screenshot = await send("Page.captureScreenshot", { captureBeyondViewport: true });
    const output = path.join(profile, `commission-${viewport.name}.png`);
    writeFileSync(output, Buffer.from(screenshot.data, "base64"));
    console.log(`${viewport.name}: ${page.paused ? 'paused intake' : 'form'} and responsive width passed; screenshot ${output}`);
  }
  if (await evaluate("document.querySelector('[role=status]')?.textContent?.includes('Requests are paused') || false")) {
    const intake = await fetch(`${appUrl}/api/commission`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(intake.status, 503, "paused intake is enforced server-side");
  }
  assert.deepEqual(errors, [], `Browser console/runtime errors: ${errors.join(" | ")}`);
  console.log("Browser console/runtime errors: 0");
} finally {
  socket?.close();
  browser.kill();
}
