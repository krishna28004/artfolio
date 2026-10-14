// Production-mode Chrome interaction check. Start the app and set
// ARTFOLIO_BROWSER_URL when it is not listening on localhost:3000.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const chrome = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
assert.ok(chrome, "Chrome or Edge is required for the homepage browser check");
const appUrl = process.env.ARTFOLIO_BROWSER_URL || "http://localhost:3000";
const profile = mkdtempSync(path.join(tmpdir(), "artfolio-home-browser-"));
const browser = spawn(chrome, ["--headless=new", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=9227", `--user-data-dir=${profile}`, "about:blank"],
{ windowsHide: true, stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pending = new Map();
const errors = [];
let socket;
let sequence = 0;
async function until(fn, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const result = await fn(); if (result) return result; } catch { /* page loading */ }
    await delay(200);
  }
  throw new Error(`Timed out: ${label}`);
}
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  assert.ok(point, `Missing ${selector}`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}

try {
  await until(async () => (await fetch("http://127.0.0.1:9227/json/version")).ok, "Chrome CDP endpoint");
  const target = await (await fetch("http://127.0.0.1:9227/json/new?about:blank", { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const task = pending.get(event.id);
      pending.delete(event.id);
      if (event.error) task?.reject(new Error(event.error.message));
      else task?.resolve(event.result);
    }
    if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails.text);
    if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error")
      errors.push(event.params.args.map((arg) => arg.value || arg.description).join(" "));
  });
  await send("Runtime.enable");
  await send("Page.enable");
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900, mobile: false },
    { name: "tablet", width: 820, height: 1180, mobile: false },
    { name: "mobile-portrait", width: 390, height: 844, mobile: true },
    { name: "mobile-landscape", width: 844, height: 390, mobile: true },
  ]) {
    await send("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1 });
    await send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 1 });
    await send("Emulation.setEmulatedMedia", { features: viewport.mobile ? [
      { name: "hover", value: "none" }, { name: "pointer", value: "coarse" },
    ] : [] });
    await send("Page.navigate", { url: appUrl });
    await until(() => evaluate("!!document.querySelector('.home-feature-item')"), `${viewport.name} homepage hydration`);
    await delay(900);
    const state = await evaluate(`(() => {
      const title = document.querySelector('h1');
      const carousel = document.querySelector('.carousel-card');
      const dock = document.querySelector('.home-feature-dock');
      const portrait = document.querySelector('.artist-portrait img');
      const galleryToggle = document.querySelector('#gallery button[aria-controls="selected-works-grid"]');
      const galleryGrid = document.querySelector('#selected-works-grid');
      const rect = (node) => { const r = node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
      return { links:[...dock.querySelectorAll('a')].map(a=>[a.textContent.trim(),a.getAttribute('href')]),
        cards:document.querySelectorAll('.carousel-card').length,
        overflow:document.documentElement.scrollWidth > innerWidth + 2,
        title:rect(title), carousel:rect(carousel), dock:rect(dock), portrait:rect(portrait),
        photoSrc:portrait.getAttribute('src'), naturalWidth:portrait.naturalWidth, naturalHeight:portrait.naturalHeight,
        galleryExpanded:galleryToggle.getAttribute('aria-expanded'), galleryHidden:galleryGrid.hidden,
        itemRects:[...dock.querySelectorAll('a')].map(rect) };
    })()`);
    assert.deepEqual(state.links, [["Exhibition", "/exhibition"], ["Learnings", "/learning"],
      ["Commission", "/commission"], ["About", "/#about"]]);
    assert.equal(state.cards, 20, `${viewport.name} original and inert clone cards`);
    assert.equal(state.galleryExpanded, "false", `${viewport.name} selected works start collapsed`);
    assert.equal(state.galleryHidden, true, `${viewport.name} artworks stay hidden until toggled`);
    assert.equal(state.overflow, false, `${viewport.name} horizontal overflow`);
    assert.ok(state.dock.right <= viewport.width + 2);
    assert.ok(state.portrait.left >= 0 && state.portrait.right <= viewport.width,
      `${viewport.name} artist image stays in the viewport`);
    assert.ok(state.naturalWidth > 0 && state.naturalHeight > 0, `${viewport.name} artist photograph loads`);
    assert.ok(state.photoSrc.includes("illustratedme.png"), `${viewport.name} uses the requested illustrated artist image`);
    assert.ok(state.itemRects.every((item) => item.right - item.left >= 44 && item.bottom - item.top >= 44),
      `${viewport.name} feature links have touch-friendly targets: ${JSON.stringify(state.itemRects)}`);
    assert.ok(state.itemRects.every((item, index, items) => index === 0 || item.left >= items[index - 1].right - 1),
      `${viewport.name} feature links remain in a horizontal row`);
    if (viewport.width >= 1024) {
      assert.ok(state.title.left < state.portrait.left, "desktop copy sits to the left of the portrait");
      assert.ok(state.title.right <= state.portrait.left + 16, "desktop headline does not overlap the portrait");
    }
    const screenshot = await send("Page.captureScreenshot", { captureBeyondViewport: true });
    const output = path.join(profile, `homepage-${viewport.name}.png`);
    writeFileSync(output, Buffer.from(screenshot.data, "base64"));
    console.log(`${viewport.name}: horizontal feature dock, artist portrait, carousel and responsive layout passed; screenshot ${output}`);
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setEmulatedMedia", { features: [] });
  await send("Page.navigate", { url: appUrl });
  await until(() => evaluate("!!document.querySelector('.carousel-card')"), "animated desktop carousel");
  await delay(900);
  await click('#gallery button[aria-controls="selected-works-grid"]');
  await until(() => evaluate("document.querySelector('#gallery button[aria-controls=selected-works-grid]')?.getAttribute('aria-expanded') === 'true'"),
    "Selected Works expands");
  assert.ok(await evaluate("document.querySelectorAll('#selected-works-grid article').length") > 0,
    "expanding Selected Works renders artwork cards");
  await click('#gallery button[aria-controls="selected-works-grid"]');
  await until(() => evaluate("document.querySelector('#selected-works-grid')?.hidden === true"), "Selected Works collapses");
  await click('#top a[href="/#gallery"]');
  await until(() => evaluate("location.hash === '#gallery'"), "Explore collection points to Selected Works");
  await send("Page.navigate", { url: appUrl });
  await until(() => evaluate("!!document.querySelector('.carousel-card')"), "homepage after collection navigation");
  await delay(500);
  const before = await evaluate("document.querySelector('.carousel-card')?.parentElement?.style.transform");
  await delay(350);
  const after = await evaluate("document.querySelector('.carousel-card')?.parentElement?.style.transform");
  assert.notEqual(after, before, "artwork strip should advance continuously");
  await evaluate(`document.querySelector('.carousel-card').dispatchEvent(new MouseEvent('mouseover', {bubbles:true}))`);
  const hoverStart = await evaluate("document.querySelector('.carousel-card')?.parentElement?.style.transform");
  await delay(350);
  const hoverEnd = await evaluate("document.querySelector('.carousel-card')?.parentElement?.style.transform");
  assert.notEqual(hoverEnd, hoverStart, "hovering artwork must not pause or reset the moving strip");
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.carousel-card img')).transitionDuration`), "0.25s",
    "artwork hover scale uses a quiet 250ms transition");
  await click('button[aria-label="Pause carousel"]');
  await delay(100);
  const pausedAt = await evaluate("document.querySelector('.carousel-card')?.parentElement?.style.transform");
  await delay(350);
  assert.equal(await evaluate("document.querySelector('.carousel-card')?.parentElement?.style.transform"), pausedAt,
    "pause control should freeze the strip");
  await click('button[aria-label="Play carousel"]');
  await delay(350);
  assert.notEqual(await evaluate("document.querySelector('.carousel-card')?.parentElement?.style.transform"), pausedAt,
    "play control should resume the strip");

  const dockPoint = await evaluate(`(() => { const r = document.querySelector('.home-feature-item').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send("Page.bringToFront");
  await evaluate(`window.__lastPointer = null; document.addEventListener('pointermove', event => { window.__lastPointer = {type:event.pointerType, target:event.target?.className, x:event.clientX, y:event.clientY}; }, true)`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...dockPoint });
  await evaluate(`document.querySelector('.home-feature-dock').dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerType:'mouse', clientX:${dockPoint.x}, clientY:${dockPoint.y}}))`);
  await delay(350);
  const dockScale = await evaluate(`document.querySelector('.home-feature-item').style.getPropertyValue('--dock-scale')`);
  const pointerInfo = await evaluate("window.__lastPointer");
  assert.ok(Number(dockScale) > 1, `dock icon should magnify near the pointer (${dockScale}; ${JSON.stringify(pointerInfo)})`);
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('.home-feature-label')).opacity`) !== "0",
    "feature names stay discoverable");

  await click('button[aria-label="Open Menu"]');
  await until(() => evaluate("document.querySelector('#site-menu-panel')?.getAttribute('aria-hidden') === 'false'"), "site menu opens");
  await until(() => evaluate("document.activeElement?.getAttribute('aria-label') === 'Close menu'"), "menu receives focus");
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', shiftKey:true, bubbles:true}))");
  assert.equal(await evaluate("document.activeElement === document.querySelector('#site-menu-panel a[href^=mailto]')"), true,
    "Shift+Tab wraps to the last menu link");
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', bubbles:true}))");
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label')"), "Close menu",
    "Tab wraps to the close control");
  const menuSizes = await evaluate(`Array.from(document.querySelectorAll('#site-menu-panel nav a'), a => getComputedStyle(a).fontSize)`);
  assert.equal(new Set(menuSizes).size, 1, "Studio Login must use the same menu type size");
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await until(() => evaluate("document.querySelector('#site-menu-panel')?.getAttribute('aria-hidden') === 'true'"), "Escape closes menu");
  await evaluate(`document.querySelector('.home-feature-item').focus()`);
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('.home-feature-item')).outlineStyle`) !== "none",
    "feature links expose keyboard focus");
  console.log("desktop motion, pause/play, dock magnification, uniform menu and Escape passed");

  const destinationStatus = await evaluate(`Promise.all(['/exhibition','/learning','/commission','/saved','/artwork/luminous-veil']
    .map(async route => [route,(await fetch(route)).status]))`);
  assert.ok(destinationStatus.every(([, status]) => status === 200),
    `Existing destination route failed: ${JSON.stringify(destinationStatus)}`);
  assert.equal(await evaluate("!!document.querySelector('#gallery') && !!document.querySelector('#about')"), true);
  await click('.home-feature-dock a[href="/#about"]');
  await until(() => evaluate("location.hash === '#about'"), "About shortcut navigation");
  await send("Page.navigate", { url: appUrl });
  await until(() => evaluate(`!!document.querySelector('.home-feature-dock a[href="/learning"]')`), "feature dock");
  await click('.home-feature-dock a[href="/commission"]');
  await until(() => evaluate("location.pathname === '/commission'"), "Commission dock navigation");
  console.log("feature dock About, Commission and all destination routes passed");

  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url: appUrl });
  await until(() => evaluate("document.querySelectorAll('.carousel-card').length === 10"), "reduced-motion static carousel");
  assert.equal(await evaluate(`!!document.querySelector('button[aria-label="Pause carousel"]')`), false);
  console.log("reduced motion: static scrollable original artworks, no animation clones");
  await evaluate("localStorage.removeItem('artfolio_favorites')");
  await send("Page.navigate", { url: appUrl });
  await until(() => evaluate("!!document.querySelector('#gallery button[aria-controls=selected-works-grid]')"), "collection toggle");
  await click('#gallery button[aria-controls="selected-works-grid"]');
  await until(() => evaluate("!!document.querySelector('#selected-works-grid article button[aria-label^=Add]')"), "favorite control");
  await evaluate("document.querySelector('#selected-works-grid article button[aria-label^=Add]').click()");
  await until(() => evaluate("document.querySelector('header a[href=\"/saved\"] span:last-child')?.textContent === '1'"), "saved count updates in same tab");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('artfolio_favorites')).length"), 1);
  await send("Page.navigate", { url: `${appUrl}/saved` });
  await until(() => evaluate("document.querySelectorAll('main article, .grid article').length === 1"), "saved artwork survives navigation");
  await evaluate("document.querySelector('article button[aria-label^=Remove]').click()");
  await until(() => evaluate("document.querySelector('header a[href=\"/saved\"] span:last-child')?.textContent === 'Saved'"), "saved count clears in same tab");
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('artfolio_favorites'))"), []);
  console.log("favorites: same-tab count, persisted artwork, and removal passed");
  assert.deepEqual(errors, [], `Browser runtime/console errors: ${errors.join(" | ")}`);
  console.log("Browser console/runtime errors: 0");
} finally {
  socket?.close();
  browser.kill();
}
// Windows Chrome can keep the CDP WebSocket alive after the page is closed.
setTimeout(() => process.exit(0), 500);
