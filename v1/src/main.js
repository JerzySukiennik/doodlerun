// DoodleRun — boot sequence, the screen router and the window.doodlerun hook.

import { COPY, SCREENS } from './config.js';
import { SLOTS } from './config.slots.js';
import * as store from './state/assets.js';
import { injectScreenStyles, el } from './ui/screens.css.js';
import { createMenu } from './ui/menu.js';
import { createBoard } from './ui/board.js';

const backdropStub = {
  start() {},
  stop() {},
  setRunning() {},
  isRunning() { return false; },
  setAssets() {},
  resize() {},
  get fps() { return 0; },
  get meshResolution() { return 0; },
};

let menu = null;
let board = null;
let backdrop = backdropStub;
let demo = new Map();
let demoModule = null;
let editorModule = null;
let runModule = null;
let mask = null;

let current = null;
let currentSlot = null;
let editor = null;
let run = null;
let transitioning = false;
let landSlot = null;
let runSeed = 1;
let queued = null;

async function loadOptional(path, name) {
  try {
    return await import(path);
  } catch (error) {
    console.warn(`DoodleRun: optional module not loaded yet — ${name}`);
    return null;
  }
}

function createFallbackEditor(config) {
  const root = el('section', 'dr-screen dr-editor dr-fallback');
  root.setAttribute('aria-label', COPY.app.editorLoading);
  el('h2', null, root, COPY.app.editorLoading);
  el('p', null, root, COPY.app.editorLoadingNote);

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (config.onExit) config.onExit();
    }
  }

  return {
    root,
    show() {
      document.body.appendChild(root);
      void root.offsetHeight;
      root.classList.add('is-on');
      window.addEventListener('keydown', onKeyDown);
      return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
    },
    hide() {
      root.classList.remove('is-on');
      window.removeEventListener('keydown', onKeyDown);
      return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      if (root.isConnected) root.remove();
    },
  };
}

// A slot the player left empty runs on my scribble instead, which is what the
// board promises in its footer. Rig and sound ride along with the bitmap.
function runAssets() {
  const map = new Map();
  SLOTS.forEach((slot) => {
    const asset = store.getAsset(slot.id);
    const fallback = demo.get(slot.id);
    const bitmap = asset && asset.bitmap ? asset.bitmap : (fallback ? fallback.bitmap : null);
    if (!bitmap) return;
    const own = !!(asset && asset.bitmap);
    const rig = own && asset.rig && Object.keys(asset.rig.points).length > 0
      ? asset.rig
      : (fallback && fallback.rig ? fallback.rig : (asset ? asset.rig : null));
    map.set(slot.id, {
      width: bitmap.width,
      height: bitmap.height,
      bitmap,
      rig: rig || { behaviour: slot.defaultBehaviour, points: {} },
      tempo: slot.tempo,
      sound: asset && asset.sound && asset.sound.url ? asset.sound : null,
    });
  });
  return map;
}

function makeEditor(slotId) {
  const config = {
    slotId,
    onDone: () => { landSlot = slotId; go('board'); },
    onExit: () => go('board'),
  };
  if (editorModule && editorModule.createEditor) return editorModule.createEditor(config);
  return createFallbackEditor(config);
}

// A screen request that arrives mid-transition is remembered rather than dropped:
// swallowing it silently makes the app look dead when a transition runs long.
async function go(name, slotId) {
  if (transitioning) {
    queued = { name, slotId };
    return;
  }
  transitioning = true;
  if (current === 'editor' && editor) { await editor.hide(); editor.dispose(); editor = null; }
  else if (current === 'run' && run) { await run.hide(); run.dispose(); run = null; }
  else if (current === 'menu') await menu.hide();
  else if (current === 'board') await board.hide();
  current = name;
  currentSlot = slotId || null;
  backdrop.setRunning(name === 'menu');
  if (mask) mask.classList.toggle('is-off', name !== 'menu');
  if (name === 'editor') {
    editor = makeEditor(slotId);
    await editor.show();
  } else if (name === 'run') {
    if (runModule && runModule.createRun) {
      run = runModule.createRun({
        assets: runAssets(),
        seed: runSeed,
        onExit: () => go('board'),
      });
      await run.show();
    } else {
      current = 'board';
      board.refresh(null);
      await board.show();
    }
  } else if (name === 'board') {
    const land = landSlot;
    landSlot = null;
    board.refresh(land);
    await board.show();
  } else {
    await menu.show();
  }
  transitioning = false;
  if (queued) {
    const next = queued;
    queued = null;
    if (next.name !== current || next.slotId !== currentSlot) await go(next.name, next.slotId);
  }
}

function loadDemoSet() {
  if (!demo || demo.size === 0) return;
  demo.forEach((asset, slotId) => {
    if (!asset || !asset.bitmap) return;
    const source = demoModule && demoModule.DEMO ? demoModule.DEMO[slotId] : null;
    store.setBitmap(slotId, asset.bitmap, source && source.ops ? source.ops : []);
    if (asset.rig) store.setRig(slotId, asset.rig);
  });
}

function newSet() {
  SLOTS.forEach((slot) => store.resetAsset(slot.id));
}

function applyOverlayCopy() {
  const overlay = document.querySelector('.dr-desktop-only');
  if (!overlay) return;
  const heading = overlay.querySelector('h2');
  const note = overlay.querySelector('p');
  if (heading) heading.textContent = COPY.app.desktopTitle;
  if (note) note.textContent = COPY.app.desktopNote;
}

async function boot() {
  injectScreenStyles();
  applyOverlayCopy();
  document.title = COPY.app.name;
  mask = document.getElementById('dr-demo-mask');

  demoModule = await loadOptional('./demo/doodles.js', 'src/demo/doodles.js');
  const backdropModule = await loadOptional('./demo/backdrop.js', 'src/demo/backdrop.js');
  editorModule = await loadOptional('./ui/editor.js', 'src/ui/editor.js');
  runModule = await loadOptional('./run/engine.js', 'src/run/engine.js');

  demo = demoModule && demoModule.renderAllDemoAssets ? demoModule.renderAllDemoAssets() : new Map();

  const canvas = document.getElementById('backdrop');
  if (backdropModule && backdropModule.createBackdrop && canvas) {
    backdrop = backdropModule.createBackdrop({ canvas });
    backdrop.setAssets(demo);
    backdrop.start();
  }

  menu = createMenu({
    onPlay: (which) => {
      if (which === 'new') newSet();
      go('board');
    },
    onContinue: () => go('board'),
    onDemo: () => {
      loadDemoSet();
      go('board');
    },
  });
  menu.setDemoReady(demo.size > 0);

  board = createBoard({
    onOpen: (slotId) => go('editor', slotId),
    onBack: () => go('menu'),
    onStart: () => { runSeed = (Date.now() >>> 4) || 1; go('run'); },
  });

  window.addEventListener('resize', () => backdrop.resize());
  document.addEventListener('visibilitychange', () => {
    backdrop.setRunning(current === 'menu' && !document.hidden);
  });

  await go('menu');

  window.doodlerun = {
    go,
    store,
    backdrop,
    demo,
    get screen() { return current; },
    get slotId() { return currentSlot; },
    get editor() { return editor; },
    get run() { return run; },
    get board() { return board; },
    get menu() { return menu; },
  };
}

boot();
