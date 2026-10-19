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
    await send("Page.navigate", { url: `${appUrl}/commission?browser=${viewport.name}` });
    await until(() => evaluate(`location.search.includes(${JSON.stringify(`browser=${viewport.name}`)}) && !!document.querySelector('#commission-auth-email, #patron-name')`), `${viewport.name} commission state`);
    const page = await evaluate(`({ heading:document.querySelector('h1')?.textContent,
      overflow:document.documentElement.scrollWidth > innerWidth + 2,
      hasCodeRequest:document.body.textContent.includes('Send verification code'),
      hasEmail:!!document.querySelector('#commission-auth-email'),
      hasPassword:!!document.querySelector('#commission-auth-password'),
      hasPatron:!!document.querySelector('#patron-name'),
      hasSignup:document.body.textContent.includes('Create account') })`);
    assert.match(page.heading, /Commission a Piece/);
    assert.equal(page.overflow, false, `${viewport.name} horizontal overflow`);
    assert.equal(page.hasEmail && page.hasCodeRequest, true, `${viewport.name} offers email code verification`);
    assert.equal(page.hasPassword || page.hasSignup, false, `${viewport.name} does not require a password or account form`);
    assert.equal(page.hasPatron, false, `${viewport.name} does not expose the request form to guests`);
    assert.equal(await evaluate("document.querySelector('#commission-auth-email')?.required"), true);
    await evaluate("window.scrollTo(0, 0)");
    const screenshot = await send("Page.captureScreenshot", { captureBeyondViewport: true });
    const output = path.join(profile, `commission-${viewport.name}.png`);
    writeFileSync(output, Buffer.from(screenshot.data, "base64"));
    console.log(`${viewport.name}: email-code entry and responsive width passed; screenshot ${output}`);
  }
  if (await evaluate("document.body.innerText.includes('The studio has paused new requests')")) {
    const intake = await fetch(`${appUrl}/api/commission`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(intake.status, 503, "paused intake is enforced server-side");
  }
  assert.deepEqual(errors, [], `Browser console/runtime errors: ${errors.join(" | ")}`);
  console.log("Browser console/runtime errors: 0");
} finally {
  socket?.close();
  browser.kill();
}
