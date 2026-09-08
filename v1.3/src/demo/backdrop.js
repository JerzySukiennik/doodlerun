// DoodleRun — the animated demo world that runs behind the menu.

import { BACKDROP, MESH, SHELL, EDITOR } from '../config.js';
import { createMesh, markOccupancy, makeTexture, drawMesh } from '../rig/mesh.js';
import { poseAt, applyPose } from '../rig/motion.js';

const ANIMATED = ['walker', 'flyer', 'jumper', 'charger', 'crawler', 'guard', 'coin', 'shield', 'hero'];
const CREATURE_ORDER = ['walker', 'flyer', 'jumper', 'charger', 'crawler', 'guard'];
const BASELINE = { walker: 87, jumper: 89, charger: 90, guard: 92, hero: 91, crawler: 77 };
const PHASE = [0, 0.83, 1.61, 0.37, 2.14, 1.19];
const PLATFORMS = [
  { at: 0.10, tiles: 3, lift: 2.5 },
  { at: 0.44, tiles: 2, lift: 3.4 },
  { at: 0.74, tiles: 3, lift: 2.1 },
];
const SPIKES = [
  { at: 0.29, tiles: 2 },
  { at: 0.61, tiles: 1 },
  { at: 0.87, tiles: 2 },
];
const LOOT = [
  { slotId: 'coin', platform: 0, phase: 0 },
  { slotId: 'shield', platform: 1, phase: 0.6 },
  { slotId: 'coin', platform: 2, phase: 1.35 },
];

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function wrap(value, span) {
  const m = value % span;
  return m < 0 ? m + span : m;
}

function bottomColor(imageData) {
  if (!imageData || !imageData.data) return null;
  const { width, height, data } = imageData;
  const from = Math.max(0, height - 6);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = from; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      if (data[o + 3] <= EDITOR.alphaThreshold) continue;
      r += data[o];
      g += data[o + 1];
      b += data[o + 2];
      n += 1;
    }
  }
  if (n === 0) return null;
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

export function createBackdrop(options) {
  const canvas = options && options.canvas ? options.canvas : null;
  if (!canvas) throw new Error('createBackdrop needs a canvas');
  const ctx = canvas.getContext('2d', { alpha: true });

  const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const sprites = new Map();
  const statics = new Map();

  let cols = MESH.cols;
  let rows = MESH.rows;
  let fellBack = false;
  let running = false;
  let frame = 0;
  let last = 0;
  let time = 0;
  let fpsValue = 0;
  let windowFrames = 0;
  let windowTime = 0;
  let sinceStart = 0;
  let view = null;

  function reduced() {
    return !!(query && query.matches);
  }

  function layout() {
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = w;
    canvas.height = h;
    const bandTop = Math.round(h * BACKDROP.bandTop);
    const groundY = Math.round(h * BACKDROP.groundLine);
    const bandBottom = Math.round(h * BACKDROP.bandBottom);
    const air = Math.max(40, groundY - bandTop);
    const scale = clamp(air / 200, 0.7, 1.6);
    view = {
      w,
      h,
      bandTop,
      groundY,
      bandBottom,
      air,
      scale,
      tile: 64 * scale,
      propTrack: Math.max(w + 640, 1800),
      creatureTrack: Math.max(BACKDROP.creatureCount * BACKDROP.spawnGapPx, w + 2 * BACKDROP.spawnGapPx),
    };
  }

  function buildSprite(asset) {
    const mesh = createMesh(asset.width, asset.height, cols, rows);
    markOccupancy(mesh, asset.bitmap, EDITOR.alphaThreshold);
    return {
      width: asset.width,
      height: asset.height,
      bitmap: asset.bitmap,
      texture: makeTexture(asset.bitmap),
      mesh,
      rig: asset.rig,
      tempo: Number.isFinite(asset.tempo) ? asset.tempo : 1,
      sizeScale: Math.max(asset.width, asset.height) / 96,
    };
  }

  function setAssets(map) {
    sprites.clear();
    statics.clear();
    if (!map || typeof map.forEach !== 'function') return;
    map.forEach((asset, slotId) => {
      if (!asset || !asset.bitmap) return;
      if (ANIMATED.indexOf(slotId) === -1) {
        statics.set(slotId, {
          texture: makeTexture(asset.bitmap),
          width: asset.width,
          height: asset.height,
          soil: bottomColor(asset.bitmap),
        });
        return;
      }
      sprites.set(slotId, buildSprite(asset));
    });
    if (!running) draw(0);
  }

  function dropToFallback() {
    fellBack = true;
    cols = MESH.fallbackCols;
    rows = MESH.fallbackRows;
    sprites.forEach((sprite) => {
      const mesh = createMesh(sprite.width, sprite.height, cols, rows);
      markOccupancy(mesh, sprite.bitmap, EDITOR.alphaThreshold);
      sprite.mesh = mesh;
    });
    console.info(`DoodleRun: backdrop mesh dropped to ${cols}×${rows} after ${Math.round(fpsValue)} fps.`);
  }

  function drawStatic(slotId, x, y, w, h) {
    const entry = statics.get(slotId);
    if (!entry) return;
    ctx.drawImage(entry.texture, x, y, w, h);
  }

  function drawGround() {
    const entry = statics.get('ground');
    if (!entry) return;
    const tile = view.tile;
    const offset = wrap(time * BACKDROP.groundSpeed, tile);
    const subsoil = view.groundY + tile;
    if (entry.soil && subsoil < view.bandBottom) {
      ctx.fillStyle = entry.soil;
      ctx.fillRect(0, subsoil - 1, view.w, view.bandBottom - subsoil + 1);
    }
    for (let x = -offset; x < view.w + tile; x += tile) {
      ctx.drawImage(entry.texture, x, view.groundY, tile, tile);
    }
  }

  function propX(at) {
    return wrap(at * view.propTrack - time * BACKDROP.groundSpeed, view.propTrack) - 220;
  }

  function drawProps() {
    const tile = view.tile;
    for (let i = 0; i < SPIKES.length; i += 1) {
      const spec = SPIKES[i];
      const x = propX(spec.at);
      if (x > view.w + 8 || x + spec.tiles * tile < -8) continue;
      for (let n = 0; n < spec.tiles; n += 1) {
        drawStatic('spikes', x + n * tile, view.groundY - tile, tile, tile);
      }
    }
    for (let i = 0; i < PLATFORMS.length; i += 1) {
      const spec = PLATFORMS[i];
      const x = propX(spec.at);
      if (x > view.w + 8 || x + spec.tiles * tile < -8) continue;
      const y = view.groundY - spec.lift * tile;
      for (let n = 0; n < spec.tiles; n += 1) {
        drawStatic('platform', x + n * tile, y, tile, tile);
      }
    }
  }

  function drawSprite(slotId, x, top, phase, flipY) {
    const sprite = sprites.get(slotId);
    if (!sprite) return;
    const width = sprite.width * view.scale;
    if (x + width < -12 || x > view.w + 12) return;
    const pose = poseAt(sprite.rig.behaviour, time + phase, sprite.tempo);
    const visible = applyPose(sprite.mesh, sprite.rig, pose, sprite.sizeScale);
    if (!visible) return;
    ctx.save();
    ctx.translate(x, top);
    ctx.scale(view.scale, view.scale);
    if (flipY) {
      ctx.translate(0, sprite.height);
      ctx.scale(1, -1);
    }
    drawMesh(ctx, sprite.texture, sprite.mesh);
    ctx.restore();
  }

  function drawLoot() {
    const tile = view.tile;
    for (let i = 0; i < LOOT.length; i += 1) {
      const spec = LOOT[i];
      const plat = PLATFORMS[spec.platform];
      const x = propX(plat.at) + (plat.tiles * tile - tile) / 2;
      const top = view.groundY - plat.lift * tile - tile * 1.05;
      drawSprite(spec.slotId, x, top, spec.phase, false);
    }
  }

  function drawCreatures() {
    const track = view.creatureTrack;
    const gap = track / BACKDROP.creatureCount;
    for (let i = 0; i < BACKDROP.creatureCount; i += 1) {
      const slotId = CREATURE_ORDER[i % CREATURE_ORDER.length];
      const x = wrap(i * gap - time * BACKDROP.groundSpeed, track) - 160;
      if (slotId === 'crawler') {
        const plat = PLATFORMS[1];
        const ceiling = view.groundY - plat.lift * view.tile + view.tile;
        drawSprite(slotId, propX(plat.at), ceiling, PHASE[i], true);
        continue;
      }
      if (slotId === 'flyer') {
        drawSprite(slotId, x, view.groundY - view.air * 0.86, PHASE[i], false);
        continue;
      }
      drawSprite(slotId, x, view.groundY - (BASELINE[slotId] || 92) * view.scale, PHASE[i], false);
    }
  }

  function drawHero() {
    drawSprite('hero', view.w * 0.25, view.groundY - BASELINE.hero * view.scale, 0.5, false);
  }

  function draw() {
    if (!view) layout();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.fillStyle = SHELL.color.paper;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    drawStatic('sky', 0, 0, view.w, view.h);
    drawGround();
    drawProps();
    drawLoot();
    drawCreatures();
    drawHero();
    ctx.restore();
  }

  function measure(dt) {
    const instant = dt > 0 ? 1 / dt : 0;
    fpsValue = fpsValue > 0 ? fpsValue * 0.9 + instant * 0.1 : instant;
    windowFrames += 1;
    windowTime += dt;
    sinceStart += dt;
    if (windowFrames < MESH.fpsWindow) return;
    const average = windowTime > 0 ? windowFrames / windowTime : 0;
    windowFrames = 0;
    windowTime = 0;
    if (!fellBack && sinceStart > 1 && average > 0 && average < MESH.minFps) dropToFallback();
  }

  function tick(now) {
    if (!running) return;
    const dt = last === 0 ? 1 / 60 : clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    time += dt;
    draw();
    measure(dt);
    frame = window.requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    if (!view) layout();
    if (reduced()) {
      draw();
      return;
    }
    running = true;
    last = 0;
    frame = window.requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  function resize() {
    layout();
    if (!running) draw();
  }

  layout();
  draw();

  return {
    start,
    stop,
    setRunning(value) {
      if (value) start();
      else stop();
    },
    isRunning() {
      return running;
    },
    setAssets,
    resize,
    get fps() {
      return fpsValue;
    },
    get meshResolution() {
      return cols;
    },
    get time() {
      return time;
    },
  };
}
