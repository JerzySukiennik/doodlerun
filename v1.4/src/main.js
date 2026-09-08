// DoodleRun — boot sequence, the screen router and the window.doodlerun hook.

import { COPY, SCREENS, MUSIC, RUN } from './config.js';
import { SLOTS } from './config.slots.js';
import * as store from './state/assets.js';
import { injectScreenStyles, el } from './ui/screens.css.js';
import { createMenu } from './ui/menu.js';
import { createBoard } from './ui/board.js';
import { createRooms } from './ui/rooms.js';
import { createSession } from './net/session.js';
import { createSong } from './audio/song.js';

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
let studioModule = null;
let runModule = null;

let current = null;
let currentSlot = null;
let editor = null;
let run = null;
let transitioning = false;
let landSlot = null;
let runSeed = 1;
let queued = null;
let rooms = null;
let session = null;
let roomState = null;
let peerHeroes = new Map();
let unwatchLive = null;
let pendingRestart = 0;
let roomCheckpoint = 0;
let studio = null;
let studioTrack = null;
let lastSongRate = 0;
const song = createSong();

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

function roomView() {
  if (!session || !roomState || !roomState.code) return null;
  return {
    code: roomState.code,
    me: roomState.me,
    host: roomState.host,
    isHost: roomState.isHost,
    players: roomState.players,
    slots: roomState.slots,
    missing: session.missingSlots(),
    heroless: session.playersWithoutHero(),
    noPart: session.playersWithoutPart(),
  };
}

function nickOf(playerId) {
  const player = (roomState && roomState.players ? roomState.players : []).find((p) => p.id === playerId);
  return player ? player.nick : '…';
}

function ensureSession() {
  if (session) return session;
  session = createSession({
    onState: (next) => {
      roomState = next;
      if (board) board.setRoom(roomView());
      if (run && next.phase === 'run') applyPeerHeroes();
    },
    onAsset: (payload) => {
      store.setBitmap(payload.slotId, payload.bitmap, []);
      if (payload.rig) store.setRig(payload.slotId, payload.rig);
      if (payload.sound) store.setSound(payload.slotId, payload.sound);
      store.setStatus(payload.slotId, 'ready');
    },
    onHero: (payload) => {
      peerHeroes.set(payload.playerId, {
        width: payload.bitmap.width,
        height: payload.bitmap.height,
        bitmap: payload.bitmap,
        rig: payload.rig,
        tempo: 1,
      });
      if (run) run.setPeerHero(payload.playerId, peerHeroes.get(payload.playerId));
    },
    onRun: (event) => handleRunEvent(event),
    onMusic: (payload) => {
      if (!payload.sound) {
        store.resetAsset(payload.trackId);
        song.clearTrack(payload.trackId);
        if (board) board.refresh(null);
        return;
      }
      store.setSound(payload.trackId, payload.sound);
      store.setStatus(payload.trackId, 'ready');
      song.setTrack(payload.trackId, payload.sound.blob);
      if (board) board.refresh(null);
    },
    onKicked: () => {
      roomState = null;
      peerHeroes = new Map();
      if (board) board.setRoom(null);
      go('menu');
    },
  });
  return session;
}

function applyPeerHeroes() {
  if (!run) return;
  peerHeroes.forEach((asset, id) => run.setPeerHero(id, asset));
}

function watchPeers() {
  if (unwatchLive) unwatchLive();
  unwatchLive = session.watchLive((value) => {
    if (!run) return;
    const peers = {};
    const names = {};
    Object.keys(value).forEach((id) => {
      if (id === session.me) return;
      peers[id] = value[id];
      names[id] = nickOf(id);
    });
    run.setPeers(peers, names);
  });
}

function handleRunEvent(event) {
  if (!event) return;
  if (event.kind === 'start' || event.kind === 'restart') {
    runSeed = event.seed || runSeed;
    roomCheckpoint = event.checkpoint || 0;
    if (current === 'run' && run) {
      run.setCheckpoint(roomCheckpoint);
      run.restart();
    } else {
      go('run');
    }
    return;
  }
  if (event.kind === 'stop') {
    if (current === 'run') go('board');
    return;
  }
  if (event.kind === 'death' && run) {
    run.remoteDeath({ nick: nickOf(event.by), cause: event.cause });
    scheduleRestart();
  }
}

// The host is the one who bumps the generation, so a death restarts the room
// exactly once no matter how many clients saw it.
function scheduleRestart() {
  if (!session || !roomState || !roomState.isHost) return;
  if (pendingRestart) return;
  pendingRestart = window.setTimeout(() => {
    pendingRestart = 0;
    session.restartRun(run ? run.checkpoint : 0);
  }, 2200);
}

function makeStudio(trackId) {
  const asset = store.getAsset(trackId);
  return studioModule.createStudio({
    trackId,
    song,
    blob: asset.sound ? asset.sound.blob : null,
    onTake: (id, blob) => {
      if (!blob) {
        store.resetAsset(id);
        song.clearTrack(id);
        if (session && roomState && roomState.code) session.publishMusic(id, null);
        return;
      }
      const sound = { blob, url: URL.createObjectURL(blob), durationMs: Math.round(MUSIC.loopMs), mimeType: blob.type };
      store.setSound(id, sound);
      store.setStatus(id, 'ready');
      song.setTrack(id, blob);
      if (session && roomState && roomState.code) session.publishMusic(id, sound);
    },
    onExit: () => go('board'),
  });
}

function makeEditor(slotId) {
  const config = {
    slotId,
    onDone: () => {
      landSlot = slotId;
      if (session && roomState && roomState.code) {
        const asset = store.getAsset(slotId);
        session.publishAsset(slotId, asset.bitmap, asset.rig, asset.sound);
      }
      go('board');
    },
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
  else if (current === 'studio' && studio) { await studio.hide(); studio.dispose(); studio = null; }
  else if (current === 'run' && run) {
    song.stop();
    if (unwatchLive) { unwatchLive(); unwatchLive = null; }
    await run.hide();
    run.dispose();
    run = null;
  }
  else if (current === 'menu') await menu.hide();
  else if (current === 'board') await board.hide();
  else if (current === 'rooms' && rooms) await rooms.hide();
  current = name;
  currentSlot = slotId || null;
  backdrop.setRunning(name === 'menu');
  if (name === 'editor') {
    editor = makeEditor(slotId);
    await editor.show();
  } else if (name === 'studio') {
    studioTrack = slotId;
    studio = makeStudio(slotId);
    await studio.show();
  } else if (name === 'run') {
    if (runModule && runModule.createRun) {
      const inRoom = !!(session && roomState && roomState.code);
      run = runModule.createRun({
        assets: runAssets(),
        seed: runSeed,
        multiplayer: inRoom,
        canRestart: !inRoom || roomState.isHost,
        onExit: () => {
          if (inRoom && roomState.isHost) session.backToLobby();
          go('board');
        },
        onDeath: inRoom ? (cause, metres) => {
          session.reportDeath(cause, metres);
          scheduleRestart();
        } : null,
        // The song leans on the throttle with the runner: same loop, faster.
        onTick: (x, y, metres, stateName) => {
          if (inRoom) session.publishLive(x, y, metres, stateName);
          const now = performance.now();
          if (now - lastSongRate < 250) return;
          lastSongRate = now;
          const pace = (RUN.speedStart + metres * RUN.speedPerMetre) / RUN.speedStart;
          song.setRate(1 + (Math.min(pace, RUN.speedMax / RUN.speedStart) - 1) * MUSIC.tempoFollow);
        },
        onRestartRequest: inRoom ? () => session.restartRun(run ? run.checkpoint : 0) : null,
      });
      if (inRoom) {
        run.setCheckpoint(roomCheckpoint);
        applyPeerHeroes();
        watchPeers();
      }
      song.setRate(1);
      song.setVolume(0.55);
      song.play();
      await run.show();
    } else {
      current = 'board';
      board.refresh(null);
      await board.show();
    }
  } else if (name === 'rooms') {
    await rooms.show();
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
  song.ids.forEach((id) => song.clearTrack(id));
}

function applyOverlayCopy() {
  const overlay = document.querySelector('.dr-desktop-only');
  if (!overlay) return;
  const heading = overlay.querySelector('h2');
  const note = overlay.querySelector('p');
  if (heading) heading.textContent = COPY.app.desktopTitle;
  if (note) note.textContent = COPY.app.desktopNote;
}

function sessionNick() {
  try {
    return window.localStorage.getItem('dr.nick') || '';
  } catch (error) {
    return '';
  }
}

async function boot() {
  injectScreenStyles();
  applyOverlayCopy();
  document.title = COPY.app.name;

  demoModule = await loadOptional('./demo/doodles.js', 'src/demo/doodles.js');
  const backdropModule = await loadOptional('./demo/backdrop.js', 'src/demo/backdrop.js');
  editorModule = await loadOptional('./ui/editor.js', 'src/ui/editor.js');
  studioModule = await loadOptional('./ui/studio.js', 'src/ui/studio.js');
  runModule = await loadOptional('./run/engine.js', 'src/run/engine.js');

  demo = demoModule && demoModule.renderAllDemoAssets ? demoModule.renderAllDemoAssets() : new Map();

  const canvas = document.getElementById('backdrop');
  if (backdropModule && backdropModule.createBackdrop && canvas) {
    backdrop = backdropModule.createBackdrop({ canvas });
    backdrop.setAssets(demo);
    backdrop.start();
  }

  rooms = createRooms({
    nick: sessionNick(),
    onBack: () => go('menu'),
    watchRooms: (handler) => ensureSession().listRooms(handler),
    onHost: async (nick) => {
      const s = ensureSession();
      await s.host(nick);
      newSet();
      await go('board');
    },
    onJoin: async (code, nick) => {
      const s = ensureSession();
      await s.join(code, nick);
      newSet();
      await go('board');
    },
  });

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
    onTogether: () => go('rooms'),
  });
  menu.setDemoReady(demo.size > 0);

  board = createBoard({
    onOpen: async (slotId) => {
      const slot = SLOTS.find((entry) => entry.id === slotId);
      if (session && roomState && roomState.code && slot && slot.shared) {
        if (!(await session.claimSlot(slotId))) return;
      }
      go(slot && slot.music ? 'studio' : 'editor', slotId);
    },
    onBack: () => {
      if (session && roomState && roomState.code) return;
      go('menu');
    },
    onStart: () => {
      if (session && roomState && roomState.code) {
        runSeed = roomState.seed || runSeed;
        session.startRun();
        return;
      }
      runSeed = (Date.now() >>> 4) || 1;
      go('run');
    },
    onKick: (playerId) => session && session.kick(playerId),
    onLeaveRoom: async () => {
      if (!session) return;
      await session.leave();
      roomState = null;
      peerHeroes = new Map();
      board.setRoom(null);
      go('menu');
    },
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
    get studio() { return studio; },
    song,
    get board() { return board; },
    get menu() { return menu; },
  };
}

boot();
