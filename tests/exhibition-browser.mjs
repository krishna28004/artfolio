// Real Chrome/CDP regression checks. Start `npm run dev` first, then run this file.
// No application debug API or additional browser package is required.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const browserPath = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
assert.ok(browserPath, "Set CHROME_PATH to an installed Chromium browser");
const port = 9225;
const profile = mkdtempSync(path.join(tmpdir(), "artfolio-movement-browser-"));
const browser = spawn(browserPath, [
  "--headless=new", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank",
], { windowsHide: true, stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
const requests = new Map();
let nextId = 0;
const exceptions = [];
const consoleErrors = [];
async function until(check, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await check();
    if (result) return result;
    await sleep(200);
  }
  if (socket?.readyState === WebSocket.OPEN) {
    console.log("Browser diagnostics", JSON.stringify({ exceptions, consoleErrors }));
    console.log("Timeout diagnostics", await pose(), await evaluate("({ focused:document.activeElement?.tagName, text:document.body.innerText.slice(-1500), visible:document.visibilityState })"));
    const screenshot = await send("Page.captureScreenshot");
    const screenshotPath = path.join(profile, "failure.png");
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot:", screenshotPath);
  }
  throw new Error(`Timed out: ${label}`);
}
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    requests.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
const inspect = `(() => {
  for (const root of window.__movementRoots || []) {
    // Software WebGL can be very slow: lower test-only raster resolution,
    // preserving the actual camera, renderer, frame loop and collision code.
    const store = root.current.stateNode?.containerInfo;
    if (store?.getState) {
      const state = store.getState();
      if (state.viewport.dpr !== 0.35) state.setDpr(0.35);
    }
    const stack = [root.current];
    while (stack.length) {
      const fiber = stack.pop();
      if (!fiber) continue;
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.memoizedProps?.playerPoseRef && Array.isArray(fiber.memoizedProps.artworks) && typeof fiber.memoizedProps.isModalOpen === 'boolean') {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current;
          if (value?.isCamera) {
            window.__movementCamera = value;
            window.__movementProps = fiber.memoizedProps;
            return { position: value.position.toArray(), quaternion: value.quaternion.toArray(), modal: fiber.memoizedProps.isModalOpen };
          }
        }
      }
    }
  }
  return null;
})()`;
async function pose() { return evaluate(inspect); }
async function key(code, down) {
  const key = code === "Escape" ? "Escape" : code.replace("Key", "").toLowerCase();
  const virtualKey = code === "Escape" ? 27 : code.startsWith("Shift") ? 16 : key.toUpperCase().charCodeAt(0);
  await send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, key, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
}
async function hold(codes, check, label) {
  for (const code of codes) await key(code, true);
  try { return await until(check, label, 45000); }
  finally { for (const code of codes) await key(code, false); }
}
async function click(selector) {
  const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x:r.x+r.width/2,y:r.y+r.height/2 }; })()`);
  assert.ok(point, `Missing control: ${selector}`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}
try {
  await until(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
  }, "Chrome debugging endpoint");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const request = requests.get(data.id);
      requests.delete(data.id);
      if (data.error) request.reject(new Error(data.error.message)); else request.resolve(data.result);
    }
    if (data.method === "Runtime.exceptionThrown") exceptions.push(data.params.exceptionDetails.text);
    if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") {
      consoleErrors.push(data.params.args.map((arg) => arg.value || arg.description || "").join(" "));
    }
  });
  socket.addEventListener("close", () => {
    for (const request of requests.values()) request.reject(new Error("Browser connection closed"));
    requests.clear();
  });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    // Headless Chrome has no physical mouse. Emulate its desktop media query
    // only while touch emulation is off; never fake API results or lock state.
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const media = nativeMatchMedia(query);
      if (query === '(hover: hover) and (pointer: fine)' && navigator.maxTouchPoints === 0) {
        Object.defineProperty(media, 'matches', { value: true });
      }
      return media;
    };
    window.__movementRoots = new Set();
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, renderers: new Map(),
      inject(renderer) { const id=this.renderers.size+1; this.renderers.set(id,renderer); return id; },
      onCommitFiberRoot(id,root) { window.__movementRoots.add(root); },
      onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}
    };
  ` });
  await send("Page.navigate", { url: `${process.env.EXHIBITION_URL || "http://localhost:3000"}/exhibition` });
  await until(pose, "live R3F controller", 90000);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Enter Exhibition'))?.click()`);
  const initial = await pose();
  assert.deepEqual(initial.position, [0, 1.65, 27]);
  if (process.argv.includes("--desktop-lifecycle")) {
    await until(async () => evaluate("!!document.querySelector('[aria-label=\"Click to look around with mouse\"]')"), "explicit mouse-look control");
    await click('[aria-label="Click to look around with mouse"]');
    await sleep(1500);
    const locked = await evaluate("document.pointerLockElement === document.querySelector('canvas')");
    assert.deepEqual((await pose()).position, initial.position);
    if (locked) {
      await key("Escape", true); await key("Escape", false);
      await until(async () => evaluate("!document.pointerLockElement"), "native Escape unlock");
      await click('[aria-label="Click to look around with mouse"]');
      await until(async () => evaluate("document.pointerLockElement === document.querySelector('canvas')"), "explicit click-to-resume lock");
      assert.deepEqual((await pose()).position, initial.position);
      await key("Escape", true); await key("Escape", false);
      console.log("PASS native granted pointer lock, Escape, click-to-resume and pose preservation");
    } else {
      console.log("UNVERIFIED native granted pointer lock: headless browser did not grant the request");
    }
    await evaluate("window.__deniedLockRequests=0; HTMLCanvasElement.prototype.requestPointerLock = () => { window.__deniedLockRequests++; return Promise.reject(new DOMException('A user gesture is required','NotAllowedError')); }");
    await click('[aria-label="Click to look around with mouse"]'); await sleep(300);
    assert.equal(await evaluate("window.__deniedLockRequests"), 1);
    assert.deepEqual((await pose()).position, initial.position);
    console.log("PASS actual pointer-lock denial request without crash or position change");
    await evaluate("window.dispatchEvent(new Event('blur')); __movementCamera.position.set(-7.1,1.65,29.1); __movementCamera.rotation.set(0,0,0)");
    await hold(["KeyA", "KeyS"], async () => {
      const p = await pose(); return p.position[0] <= -7.49 && p.position[2] >= 29.49;
    }, "corner contact");
    const corner = await pose();
    assert.ok(corner.position[0] >= -7.501 && corner.position[2] <= 29.501);
    await hold(["KeyD", "KeyW"], async () => {
      const p = await pose(); return p.position[0] > -6.8 && p.position[2] < 28.8;
    }, "corner retreat");
    console.log("PASS native corner contact and retreat");
    await evaluate("window.dispatchEvent(new Event('blur')); __movementCamera.position.set(4,1.65,28); __movementCamera.rotation.set(0,0,0)");
    await hold(["KeyS", "ShiftLeft"], async () => (await pose()).position[2] >= 29.49, "sprint toward wall");
    assert.ok((await pose()).position[2] <= 29.501);
    console.log("PASS native sprint wall collision");
    for (const [name, axis, limit] of [["west", 0, -7.5], ["east", 0, 9.5], ["north", 2, -35.5]]) {
      await evaluate(`(() => {
        window.dispatchEvent(new Event('blur'));
        const art=__movementProps.artworks.find(a=>${name === "west" ? "a.position[0]<-7 && a.position[2]>18" : name === "east" ? "a.position[0]>9 && a.position[0]<10" : "a.position[2]<-35"});
        const yaw=art.rotation[1];
        __movementCamera.position.set(art.position[0]+Math.sin(yaw)*1.5,1.65,art.position[2]+Math.cos(yaw)*1.5);
        __movementCamera.lookAt(...art.position);
      })()`);
      await hold(["KeyW"], async () => Math.abs((await pose()).position[axis] - limit) < 0.01, `${name} artwork wall approach`);
      const contact = await pose();
      assert.ok(Math.hypot(contact.position[0], contact.position[2] - 27) > 6);
      await sleep(300);
      assert.ok(Math.abs((await pose()).position[axis] - limit) < 0.01);
      console.log(`PASS native ${name} artwork approach without spawn reset`);
    }
    await evaluate("window.dispatchEvent(new Event('blur')); __movementCamera.position.set(4,1.65,10); __movementCamera.rotation.set(0,0,0)");
    await key("KeyW", true);
    const background = await send("Target.createTarget", { url: "about:blank" });
    await send("Target.activateTarget", { targetId: background.targetId });
    await sleep(500);
    const paused = await pose();
    await send("Target.activateTarget", { targetId: target.id }); await sleep(500);
    assert.deepEqual((await pose()).position, paused.position);
    await key("KeyW", false);
    await send("Target.closeTarget", { targetId: background.targetId });
    console.log("PASS native tab return clears held movement");
  } else {
  const wall = await hold(["KeyS"], async () => { const p = await pose(); return p.position[2] >= 29.49 && p; }, "head-on wall contact");
  assert.ok(wall.position[2] <= 29.501);
  await sleep(500);
  assert.ok((await pose()).position[2] > 29.49, "Wall contact must never reset to spawn");
  const slide = await hold(["KeyS", "KeyD"], async () => { const p = await pose(); return p.position[0] > 2 && p; }, "diagonal wall slide");
  assert.ok(slide.position[2] > 29.49 && slide.position[2] <= 29.501);
  await hold(["KeyW"], async () => (await pose()).position[2] < 28.2, "retreat from wall");
  console.log("PASS desktop wall contact, diagonal sliding, no spawn reset, retreat");

  // Controlled fixture start; subsequent traversal uses trusted browser input.
  await evaluate("window.dispatchEvent(new Event('blur')); __movementCamera.position.set(0,1.65,20); __movementCamera.rotation.set(0,0,0)");
  await hold(["KeyW", "ShiftLeft"], async () => (await pose()).position[2] < 16, "entrance doorway sprint traversal");
  console.log("PASS doorway traversal and sprint");
  await evaluate(`(() => { window.dispatchEvent(new Event('blur')); const art=__movementProps.artworks.find(a=>a.position[0]<-7 && a.position[2]>18); if(!art) throw Error('No west entrance artwork'); __movementCamera.position.set(art.position[0]+1.5,1.65,art.position[2]); __movementCamera.lookAt(...art.position); })()`);
  await sleep(500);
  const beforeModal = await pose();
  await key("KeyE", true); await key("KeyE", false);
  await until(async () => (await pose())?.modal, "artwork modal");
  await key("KeyW", true); await sleep(500); await key("KeyW", false);
  const duringModal = await pose();
  assert.deepEqual(duringModal.position, beforeModal.position);
  assert.deepEqual(duringModal.quaternion, beforeModal.quaternion);
  await key("Escape", true); await key("Escape", false);
  await until(async () => !(await pose())?.modal, "modal dismissal");
  const afterModal = await pose();
  assert.deepEqual(afterModal.position, beforeModal.position);
  assert.deepEqual(afterModal.quaternion, beforeModal.quaternion);
  console.log("PASS artwork focus and modal position/orientation preservation");

  await evaluate("window.__deniedLockRequests=0; HTMLCanvasElement.prototype.requestPointerLock = () => { window.__deniedLockRequests++; return Promise.reject(new DOMException('A user gesture is required','NotAllowedError')); }");
  await click('[aria-label="Click to look around with mouse"]'); await sleep(300);
  assert.equal(await evaluate("window.__deniedLockRequests"), 1);
  assert.ok(await pose(), "Pointer-lock denial must not unmount/crash controller");
  console.log("PASS nonfatal pointer-lock denial");

  if ((await pose()).modal) { await key("Escape", true); await key("Escape", false); }
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.reload");
  await until(pose, "mobile controller after reload");
  await until(async () => evaluate("!!document.querySelector('[aria-label=\"Movement Virtual Joystick\"]')"), "mobile joystick");
  async function bounds(selector) {
    return evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x:r.x,y:r.y,width:r.width,height:r.height }; })()`);
  }
  async function touchInput(type, points) { await send("Input.dispatchTouchEvent", { type, touchPoints: points }); }
  const joystick = await bounds('[aria-label="Movement Virtual Joystick"]');
  const look = await bounds('[aria-hidden="true"]');
  assert.ok(joystick && look && joystick.x >= 0 && joystick.y >= 0);
  const movingTouch = { id: 1, x: joystick.x + joystick.width / 2, y: joystick.y + joystick.height / 2 - 45 };
  const lookingTouch = { id: 2, x: look.x + look.width / 2, y: look.y + look.height / 2 };
  const mobileBefore = await pose();
  await touchInput("touchStart", [movingTouch, lookingTouch]);
  await touchInput("touchMove", [movingTouch, { ...lookingTouch, x: lookingTouch.x + 35, y: lookingTouch.y - 15 }]);
  try {
    await until(async () => {
      const p = await pose();
      return Math.hypot(p.position[0] - mobileBefore.position[0], p.position[2] - mobileBefore.position[2]) > 0.5;
    }, "simultaneous real mobile movement and look", 45000);
  } finally { await touchInput("touchEnd", []); }
  const mobileAfter = await pose();
  assert.notDeepEqual(mobileAfter.quaternion, mobileBefore.quaternion);
  console.log("PASS mobile portrait native multitouch joystick plus look");
  await evaluate(`(() => { window.dispatchEvent(new Event('blur')); const art=__movementProps.artworks.find(a=>a.position[0]<-7 && a.position[2]>18); __movementCamera.position.set(art.position[0]+1.5,1.65,art.position[2]); __movementCamera.lookAt(...art.position); })()`);
  await sleep(800);
  await until(async () => evaluate("!!document.querySelector('[aria-label=\"Inspect Focused Artwork\"]')"), "mobile inspect control");
  await click('[aria-label="Enable Sprint Mode"]');
  const mobileModalBefore = await pose();
  await click('[aria-label="Inspect Focused Artwork"]');
  await until(async () => (await pose()).modal, "mobile artwork modal");
  const mobileModalOpen = await pose();
  assert.deepEqual(mobileModalOpen.position, mobileModalBefore.position);
  assert.deepEqual(mobileModalOpen.quaternion, mobileModalBefore.quaternion);
  await sleep(500);
  assert.deepEqual((await pose()).position, mobileModalOpen.position);
  await key("Escape", true); await key("Escape", false);
  await until(async () => !(await pose()).modal, "mobile modal close");
  const mobileModalAfter = await pose();
  assert.deepEqual(mobileModalAfter.position, mobileModalOpen.position);
  assert.deepEqual(mobileModalAfter.quaternion, mobileModalOpen.quaternion);
  assert.ok(await evaluate("!!document.querySelector('[aria-label=\"Enable Sprint Mode\"]')"));
  console.log("PASS mobile modal pose preservation and sprint reset");
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  const landscapeBefore = await pose();
  await sleep(300);
  const landscapeJoystick = await bounds('[aria-label="Movement Virtual Joystick"]');
  const landscapeLook = await bounds('[aria-hidden="true"]');
  assert.ok(landscapeJoystick.y >= 0 && landscapeJoystick.y + landscapeJoystick.height <= 390);
  assert.ok(landscapeLook.height > 0);
  assert.deepEqual((await pose()).position, landscapeBefore.position);
  console.log("PASS landscape control bounds and resize pose preservation");
  const otherTab = await send("Target.createTarget", { url: "about:blank" });
  await send("Target.activateTarget", { targetId: otherTab.targetId });
  await sleep(500);
  const backgroundPose = await pose();
  await send("Target.activateTarget", { targetId: target.id });
  await sleep(500);
  assert.deepEqual((await pose()).position, backgroundPose.position);
  await send("Target.closeTarget", { targetId: otherTab.targetId });
  console.log("PASS tab switch/return preserves stopped position");
  }
  assert.equal(exceptions.length, 0, `Uncaught browser exceptions: ${exceptions.join('; ')}`);
  console.log(JSON.stringify({ consoleErrors, desktopFinalPose: await pose(), profile }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await Promise.race([send("Browser.close").catch(() => {}), sleep(2000)]);
  }
  socket?.close();
  browser.kill();
}
