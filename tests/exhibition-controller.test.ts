import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import ts from "typescript";
import * as collision from "@/components/exhibition/physics/collision";
import * as touch from "@/components/exhibition/touch/touch-controller";
import * as pointerLock from "@/components/exhibition/controllers/pointer-lock-manager";
import * as bounds from "@/features/artwork/utils/exhibition-validation";

// Execute the actual TSX controller with React effects and a real Three camera.
// Only the renderer hooks and artwork catalog are substituted: no WebGL in JSDOM.
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
let frame: (state: { camera: THREE.PerspectiveCamera }, delta: number) => void;
const camera = new THREE.PerspectiveCamera();
let canvas: HTMLCanvasElement;
const state = {
  camera,
  gl: { get domElement() { return canvas; } },
  events: { compute: () => {} },
  get: () => state,
  setEvents: (events: object) => Object.assign(state.events, events),
};
const fiber = {
  useThree: (select?: (value: typeof state) => unknown) => select ? select(state) : state,
  useFrame: (callback: typeof frame) => { frame = callback; },
};
const mocks: Record<string, unknown> = {
  "@react-three/fiber": fiber,
  "./GalleryScene": { ARTWORKS: [] },
  "./physics/collision": collision,
  "./touch/touch-controller": touch,
  "./controllers/pointer-lock-manager": pointerLock,
  "@/features/artwork/utils/exhibition-validation": bounds,
};
const source = readFileSync("src/components/exhibition/Controls.tsx", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const controllerModule = { exports: {} as Record<string, unknown> };
runInNewContext(`(function(require,module,exports){${compiled}\n})`, {
  process, performance,
  get window() { return globalThis.window; },
  get document() { return globalThis.document; },
})(
  (id: string) => mocks[id] ?? require(id), controllerModule, controllerModule.exports,
);
const Controls = controllerModule.exports.Controls as React.ComponentType<Record<string, unknown>>;
const mobileModule = { exports: {} as Record<string, unknown> };
const mobileCode = ts.transpileModule(readFileSync("src/components/exhibition/MobileControls.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
runInNewContext(`(function(require,module,exports){${mobileCode}\n})`, {
  get window() { return globalThis.window; }, get document() { return globalThis.document; },
})((id: string) => mocks[id] ?? require(id), mobileModule, mobileModule.exports);
const MobileControls = mobileModule.exports.MobileControls as React.ComponentType<Record<string, unknown>>;
const movement = controllerModule.exports.movementState as Record<string, boolean>;
const walkTo = controllerModule.exports.walkToTarget as { active: boolean; x: number; z: number };
let root: ReturnType<typeof createRoot>;
let dom: InstanceType<typeof JSDOM>;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

beforeEach(() => {
  dom = new JSDOM("<div id='root'></div><canvas></canvas>");
  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(dom.window.navigator, "maxTouchPoints", { value: 0, configurable: true });
  dom.window.matchMedia = (query: string) => ({ matches: query.includes("pointer: fine") } as MediaQueryList);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  canvas = document.querySelector("canvas")!;
  camera.position.set(0, 1.65, 27);
  camera.quaternion.identity();
  root = createRoot(document.getElementById("root")!);
  touch.resetAllTouchInput();
  for (const key of Object.keys(movement)) movement[key] = false;
  walkTo.active = false;
});
afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [key, descriptor] of [["window", originalWindow], ["document", originalDocument], ["navigator", originalNavigator]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
async function render(props: Record<string, unknown> = {}) {
  await act(async () => root.render(React.createElement(Controls, {
    initialPosition: [0, 1.65, 27], prefersReducedMotion: true, ...props,
  })));
}
function tick(count = 1, delta = 1 / 60) {
  for (let i = 0; i < count; i++) frame({ camera }, delta);
}
function key(type: string, code: string) {
  window.dispatchEvent(new window.KeyboardEvent(type, { code }));
}

test("parent rerender with equivalent spawn preserves collision-resolved position and input", async () => {
  await render();
  key("keydown", "KeyS");
  tick(180);
  assert.ok(camera.position.z > 29.4 && camera.position.z <= 29.501);
  const before = camera.position.clone();
  await render(); // GalleryScene supplies a fresh tuple on focus/modal/lock renders.
  assert.ok(camera.position.distanceTo(before) < 1e-9, `Reset from ${before.z} to ${camera.position.z}`);
  assert.ok(Math.abs(camera.position.z - 27) > 2.4);
  key("keyup", "KeyS");
  key("keydown", "KeyW");
  tick(30);
  assert.ok(camera.position.z < before.z - 1);
});

test("actual artwork focus callback rerender preserves position and viewing direction", async () => {
  let focusChanges = 0;
  const art = { id: "wall-art", position: [-7.85, 1.65, 24] };
  function Parent() {
    const [, setFocused] = React.useState<unknown>(null);
    return React.createElement(Controls, {
      initialPosition: [0, 1.65, 27], artworks: [art], prefersReducedMotion: true,
      onFocusArtwork: (value: unknown) => { focusChanges++; setFocused(value); },
    });
  }
  await act(async () => root.render(React.createElement(Parent)));
  camera.position.set(-6, 1.65, 24);
  camera.rotation.set(0, Math.PI / 2, 0);
  const before = camera.position.clone();
  const orientation = camera.quaternion.clone();
  await act(async () => tick());
  assert.equal(focusChanges, 1);
  assert.ok(camera.position.distanceTo(before) < 1e-9);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(0, 1.65, 27)) > 6);
  assert.deepEqual(camera.quaternion.toArray(), orientation.toArray());
});

test("modal round trip freezes pose, clears held keys and touch look, and resumes from the same position", async () => {
  await render();
  key("keydown", "KeyW"); tick(60);
  const before = camera.position.clone();
  const orientation = camera.quaternion.clone();
  await render({ isModalOpen: true });
  touch.touchMovementState.y = 1; touch.touchLookState.deltaYaw = 0.4;
  tick(60);
  assert.ok(camera.position.distanceTo(before) < 1e-9);
  assert.deepEqual(camera.quaternion.toArray(), orientation.toArray());
  await render({ isModalOpen: false }); tick(60);
  assert.ok(camera.position.distanceTo(before) < 1e-9, "Held key must not resume after modal close");
  assert.ok(Math.abs(camera.position.z - 27) > 3);
  key("keydown", "KeyW"); tick(30);
  assert.ok(camera.position.z < before.z - 1);
});

for (const event of ["blur", "visibilitychange", "pointerlockchange"]) {
  test(`${event} stops velocity, keyboard, touch and walk-to without changing pose`, async () => {
    await render(); key("keydown", "KeyW"); tick(30);
    walkTo.active = true; walkTo.x = 0; walkTo.z = 20;
    touch.touchMovementState.y = 1;
    const before = camera.position.clone();
    if (event === "blur") window.dispatchEvent(new window.Event(event));
    else {
      if (event === "visibilitychange") Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new window.Event(event));
    }
    tick(60);
    assert.equal(walkTo.active, false);
    assert.equal(touch.touchMovementState.y, 0);
    assert.ok(camera.position.distanceTo(before) < 1e-9);
  });
}

test("controller replacement restores visit pose instead of spawning again", async () => {
  const pose = { current: null };
  await render({ playerPoseRef: pose, key: "first" });
  key("keydown", "KeyW"); touch.touchLookState.deltaYaw = 0.2; tick(45);
  const before = camera.position.clone(); const orientation = camera.quaternion.clone();
  await render({ playerPoseRef: pose, key: "replacement" });
  assert.ok(camera.position.distanceTo(before) < 1e-9);
  assert.ok(Math.abs(camera.position.z - 27) > 2);
  assert.deepEqual(camera.quaternion.toArray(), orientation.toArray());
});

test("invalid input, orientation, position and frame times recover at last valid position", async () => {
  await render(); key("keydown", "KeyW"); tick(60);
  key("keyup", "KeyW"); tick(60);
  const before = camera.position.clone(); const orientation = camera.quaternion.clone();
  camera.position.x = NaN; camera.quaternion.x = Infinity;
  touch.touchMovementState.x = Infinity; touch.touchLookState.deltaYaw = NaN;
  walkTo.active = true; walkTo.x = NaN;
  tick(1, NaN); tick(1, -1);
  assert.ok(camera.position.distanceTo(before) < 1e-9);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(0, 1.65, 27)) > 3);
  assert.deepEqual(camera.quaternion.toArray(), orientation.toArray());
  key("keydown", "KeyW"); tick(1, 1000);
  assert.ok(camera.position.distanceTo(before) < 0.18, "Resume delta must not produce a giant step");
  assert.ok(camera.position.toArray().every(Number.isFinite));
});

test("concurrent analog joystick and touch-look move and rotate through the existing pipeline", async () => {
  await render(); touch.touchMovementState.y = 0.25;
  touch.touchLookState.deltaYaw = 0.3; touch.touchLookState.deltaPitch = 0.1;
  const orientation = camera.quaternion.clone(); tick(60);
  const distance = camera.position.distanceTo(new THREE.Vector3(0, 1.65, 27));
  assert.ok(distance > 0.7 && distance < 0.95, `Partial joystick displacement: ${distance}`);
  assert.ok(camera.quaternion.angleTo(orientation) > 0.25);
  assert.equal(touch.touchLookState.deltaYaw, 0); assert.equal(touch.touchLookState.deltaPitch, 0);
});

test("desktop arrows, sprint and diagonal input keep predictable speeds", async () => {
  async function distance(codes: string[]) {
    await render({ key: codes.join("-") });
    for (const code of codes) key("keydown", code);
    tick(60);
    return camera.position.distanceTo(new THREE.Vector3(0, 1.65, 27));
  }
  const straight = await distance(["ArrowUp"]);
  const diagonal = await distance(["KeyW", "KeyD"]);
  const sprint = await distance(["KeyW", "ShiftLeft"]);
  assert.ok(straight > 3 && straight < 3.5);
  assert.ok(Math.abs(diagonal - straight) < 1e-8);
  assert.ok(Math.abs(sprint / straight - 5.8 / 3.5) < 1e-8);
});

test("pointer-lock denial from explicit canvas click leaves controls and camera usable", async () => {
  let requests = 0;
  Object.defineProperty(document, "pointerLockElement", { value: null, configurable: true });
  canvas.requestPointerLock = () => { requests++; return Promise.reject(new Error("A user gesture is required")); };
  await render(); key("keydown", "KeyW"); tick(30);
  const before = camera.position.clone();
  await act(async () => canvas.dispatchEvent(new window.Event("click")));
  assert.equal(requests, 1, "Exercise actual denial, not the touch-device early return");
  assert.ok(camera.position.distanceTo(before) < 1e-9);
  tick(30); assert.ok(camera.position.z < before.z - 1);
  assert.equal(pointerLock.isPointerLockPending(), false);
});

test("mobile DOM pointers move and look independently; cancellation, blur and modal reset sprint and pose", async () => {
  async function renderMobile(isModalOpen = false) {
    await act(async () => root.render(React.createElement(React.Fragment, null,
      React.createElement(Controls, { initialPosition: [0, 1.65, 27], prefersReducedMotion: true, isModalOpen }),
      React.createElement(MobileControls, { forceShowControls: true, isModalOpen }),
    )));
  }
  function pointer(element: Element, type: string, id: number, x: number, y: number) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: id, clientX: x, clientY: y });
    element.dispatchEvent(event);
  }
  await renderMobile();
  const joystick = document.querySelector('[aria-label="Movement Virtual Joystick"]') as HTMLElement;
  const look = document.querySelector('[aria-hidden="true"]') as HTMLElement;
  for (const element of [joystick, look]) {
    element.setPointerCapture = () => {};
    element.releasePointerCapture = () => {};
  }
  joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 112, height: 112 } as DOMRect);
  await act(async () => {
    pointer(joystick, "pointerdown", 1, 56, 6);
    pointer(look, "pointerdown", 2, 200, 200);
    pointer(look, "pointermove", 2, 230, 190);
  });
  assert.equal(touch.touchMovementState.y, 1);
  assert.ok(touch.touchLookState.deltaYaw > 0.1);
  tick(30);
  assert.ok(camera.position.z < 25.7);
  assert.ok(camera.rotation.y < -0.1);
  await act(async () => pointer(look, "pointercancel", 2, 230, 190));
  assert.equal(touch.touchMovementState.y, 1, "Look cancellation must not cancel the other pointer");
  await act(async () => pointer(joystick, "pointercancel", 1, 56, 6));
  assert.equal(touch.touchMovementState.y, 0);
  await act(async () => (document.querySelector('[aria-label="Enable Sprint Mode"]') as HTMLElement).click());
  assert.equal(touch.touchMovementState.sprint, true);
  await act(async () => window.dispatchEvent(new window.Event("blur")));
  assert.equal(touch.touchMovementState.sprint, false);
  assert.ok(document.querySelector('[aria-label="Enable Sprint Mode"]'));
  const before = camera.position.clone();
  await renderMobile(true); tick(30);
  await renderMobile(false); tick(30);
  assert.ok(camera.position.distanceTo(before) < 1e-9);
  assert.ok(document.querySelector('[aria-label="Enable Sprint Mode"]'));
});

test("accelerated controller movement stays within 2% across 30, 60 and 144 FPS", async () => {
  const distances: number[] = [];
  for (const fps of [30, 60, 144]) {
    await render({ key: `fps-${fps}` });
    key("keydown", "KeyW");
    tick(fps, 1 / fps);
    distances.push(27 - camera.position.z);
  }
  assert.ok(distances.every((distance) => distance > 3 && distance < 3.5));
  assert.ok((Math.max(...distances) - Math.min(...distances)) / distances[1] < 0.02);
});

test("unrelated UI rerenders preserve a held desktop movement key", async () => {
  await render(); key("keydown", "KeyW"); tick(30);
  const before = camera.position.clone();
  await render({ onPointerLockChange: () => {} }); tick(30);
  assert.ok(camera.position.z < before.z - 1.5);
  assert.ok(27 - camera.position.z > 3);
});

for (const fixture of [
  { name: "west entrance", artwork: [-7.85, 1.6, 24], start: [-6.35, 1.65, 24], axis: "x", limit: -7.5 },
  { name: "east main hall", artwork: [9.85, 1.6, 12], start: [8.35, 1.65, 12], axis: "x", limit: 9.5 },
  { name: "north sanctuary", artwork: [0, 1.8, -35.85], start: [0, 1.65, -34.35], axis: "z", limit: -35.5 },
] as const) {
  test(`approaching artwork on ${fixture.name} preserves wall boundary after focus rerender`, async () => {
    let focusChanges = 0;
    const art = { id: fixture.name, position: fixture.artwork };
    function Parent() {
      const [, setFocus] = React.useState<unknown>(null);
      return React.createElement(Controls, {
        initialPosition: [0, 1.65, 27], artworks: [art], prefersReducedMotion: true,
        onFocusArtwork: (value: unknown) => { focusChanges++; setFocus(value); },
      });
    }
    await act(async () => root.render(React.createElement(Parent)));
    camera.position.set(...fixture.start);
    camera.lookAt(...fixture.artwork);
    key("keydown", "KeyW");
    await act(async () => tick(90));
    assert.ok(focusChanges >= 1);
    assert.ok(Math.abs(camera.position[fixture.axis] - fixture.limit) < 1e-7);
    assert.ok(camera.position.distanceTo(new THREE.Vector3(0, 1.65, 27)) > 6);
    assert.ok(collision.isPositionWalkable({ x: camera.position.x, z: camera.position.z }, 0.35 - 1e-7));
    const contact = camera.position.clone();
    key("keyup", "KeyW"); key("keydown", "KeyS"); tick(30);
    assert.ok(camera.position.distanceTo(contact) > 1);
  });
}

test("a pending pointer-lock request cannot capture the cursor after a modal opens", async () => {
  Object.defineProperty(document, "pointerLockElement", { value: null, writable: true, configurable: true });
  let exits = 0;
  document.exitPointerLock = () => {
    exits++;
    Object.defineProperty(document, "pointerLockElement", { value: null, writable: true, configurable: true });
    document.dispatchEvent(new window.Event("pointerlockchange"));
  };
  canvas.requestPointerLock = () => undefined;
  await render(); key("keydown", "KeyW"); tick(60);
  const before = camera.position.clone();
  canvas.dispatchEvent(new window.Event("click"));
  assert.equal(pointerLock.isPointerLockPending(), true);
  await render({ isModalOpen: true });
  Object.defineProperty(document, "pointerLockElement", { value: canvas, writable: true, configurable: true });
  document.dispatchEvent(new window.Event("pointerlockchange"));
  assert.equal(exits, 1, "Late lock must be released while artwork details are open");
  assert.equal(document.pointerLockElement, null);
  tick(60);
  assert.ok(camera.position.distanceTo(before) < 1e-9);
});

for (const mode of ["keyboard", "joystick"]) {
  test(`${mode} movement takes priority over a floor walk-to target`, async () => {
    await render();
    if (mode === "keyboard") key("keydown", "KeyS");
    else touch.touchMovementState.y = -1;
    walkTo.active = true; walkTo.x = 0; walkTo.z = 20;
    tick(90);
    assert.equal(walkTo.active, false);
    assert.ok(camera.position.z > 29.4 && camera.position.z <= 29.501, `Manual backward input was ignored: ${camera.position.z}`);
    assert.ok(Math.abs(camera.position.z - 27) > 2.4);
  });
}

test("desktop locked mouse-look clamps pitch, preserves position and restores raycasting on unlock", async () => {
  Object.defineProperty(document, "pointerLockElement", { value: null, writable: true, configurable: true });
  await render();
  const before = camera.position.clone();
  const oldCompute = state.events.compute;
  Object.defineProperty(document, "pointerLockElement", { value: canvas, writable: true, configurable: true });
  document.dispatchEvent(new window.Event("pointerlockchange"));
  document.dispatchEvent(new window.Event("pointerlockchange")); // Duplicate event must not replace the saved compute.
  const event = new window.MouseEvent("mousemove");
  Object.assign(event, { movementX: 80, movementY: 10000 });
  document.dispatchEvent(event);
  const lookEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  assert.ok(Math.abs(lookEuler.y + 0.16) < 1e-8);
  assert.ok(Math.abs(lookEuler.x + Math.PI / 4) < 1e-8);
  assert.ok(camera.position.distanceTo(before) < 1e-9);
  assert.ok(camera.quaternion.toArray().every(Number.isFinite));
  camera.updateMatrixWorld();
  const pointer = new THREE.Vector2(0.5, 0.5);
  const raycaster = new THREE.Raycaster();
  (state.events.compute as unknown as (event: object, state: object) => void)({}, {
    size: { width: 1280, height: 800 }, pointer, raycaster, camera,
  });
  assert.equal(pointer.x, 0); assert.equal(pointer.y, 0);
  assert.ok(raycaster.ray.origin.distanceTo(camera.position) < 1e-9);
  Object.defineProperty(document, "pointerLockElement", { value: null, writable: true, configurable: true });
  document.dispatchEvent(new window.Event("pointerlockchange"));
  assert.equal(state.events.compute, oldCompute);
  const orientation = camera.quaternion.toArray();
  await render(); tick(30);
  assert.deepEqual(camera.quaternion.toArray(), orientation);
  assert.ok(camera.position.distanceTo(before) < 1e-9);
});
