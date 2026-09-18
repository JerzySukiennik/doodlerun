// DoodleRun — looping animation preview: owns the rig rAF loop, texture cache and fps counter.

import { MESH, PREVIEW, EDITOR } from '../config.js';
import { createMesh, markOccupancy, drawMesh, makeTexture, resetMesh } from './mesh.js';
import { poseAt, applyPose } from './motion.js';
import { missingRoleLabels, isRigComplete } from './roles.js';

const GROUNDED = { walk: true, jump: true, idle: true };
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const INK = '#000000';
const PAPER = '#FFFFFF';
const MUTE = '#8E8B85';

export function createPreview({ mount, size = PREVIEW.size, scale = PREVIEW.scale }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dr-preview-canvas';
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  if (mount) mount.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let asset = { width: 96, height: 96, bitmap: null, rig: { behaviour: 'none', points: {} }, tempo: 1 };
  let mesh = createMesh(96, 96, MESH.cols, MESH.rows);
  let texture = null;
  let cols = MESH.cols;
  let rows = MESH.rows;
  let downgraded = false;

  let running = false;
  let raf = 0;
  let lastTs = 0;
  let clock = 0;
  let debug = false;
  let disposed = false;

  const dts = [];
  let dtSum = 0;
  let elapsedSinceStart = 0;
  let renderMs = 0;

  function rebuildMesh() {
    mesh = createMesh(asset.width, asset.height, cols, rows);
    if (asset.bitmap) markOccupancy(mesh, asset.bitmap, EDITOR.alphaThreshold);
  }

  function rebuildTexture() {
    texture = asset.bitmap ? makeTexture(asset.bitmap) : null;
    if (asset.bitmap) markOccupancy(mesh, asset.bitmap, EDITOR.alphaThreshold);
    else mesh.occupied.fill(1);
  }

  function fitScale() {
    const pad = 16;
    const maxW = (size - pad) / asset.width;
    const maxH = (size - pad) / asset.height;
    return Math.max(0.25, Math.min(scale, maxW, maxH));
  }

  function centerText(text, y, colour) {
    ctx.save();
    ctx.fillStyle = colour;
    ctx.font = `700 10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, y);
    ctx.restore();
  }

  function drawGround(behaviour, tempo) {
    if (!PREVIEW.groundLine || !GROUNDED[behaviour]) return;
    const y = size - 24;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.fillRect(0, y, size, 3);
    if (behaviour === 'walk') {
      const spacing = 24;
      let offset = (-60 * tempo * clock) % spacing;
      if (offset > 0) offset -= spacing;
      for (let x = offset; x < size; x += spacing) {
        ctx.fillRect(Math.round(x), y + 6, 10, 2);
      }
    }
    ctx.restore();
  }

  function drawMarkers(ox, oy, eff) {
    const points = asset.rig && asset.rig.points ? asset.rig.points : {};
    const names = Object.keys(points);
    ctx.save();
    for (let i = 0; i < names.length; i += 1) {
      const p = points[names[i]];
      const x = ox + p.x * eff;
      const y = oy + p.y * eff;
      ctx.fillStyle = PAPER;
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 5, y - 5, 10, 2);
      ctx.fillRect(x - 5, y + 3, 10, 2);
      ctx.fillRect(x - 5, y - 5, 2, 10);
      ctx.fillRect(x + 3, y - 5, 2, 10);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.restore();
  }

  function render() {
    if (disposed) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, size, size);

    const rig = asset.rig || { behaviour: 'none', points: {} };
    const behaviour = rig.behaviour || 'none';
    const tempo = Number.isFinite(asset.tempo) && asset.tempo > 0 ? asset.tempo : 1;

    drawGround(behaviour, tempo);

    if (!texture) {
      centerText('NOTHING DRAWN YET', size / 2, MUTE);
      return;
    }

    const eff = fitScale();
    const drawW = asset.width * eff;
    const drawH = asset.height * eff;
    const ox = (size - drawW) / 2;
    const grounded = PREVIEW.groundLine && GROUNDED[behaviour];
    let oy = grounded ? size - 24 - drawH : (size - drawH) / 2;
    if (oy < 6) oy = 6;

    const complete = isRigComplete(rig);
    let visible = true;

    if (complete && behaviour !== 'none') {
      const sizeScale = Math.max(asset.width, asset.height) / 96;
      const pose = poseAt(behaviour, clock, tempo);
      visible = applyPose(mesh, rig, pose, sizeScale);
    } else {
      resetMesh(mesh);
    }

    if (visible) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(eff, eff);
      drawMesh(ctx, texture, mesh, debug);
      ctx.restore();
    }

    if (debug) drawMarkers(ox, oy, eff);

    if (!complete && behaviour !== 'none') {
      const labels = missingRoleLabels(rig);
      if (labels.length) centerText(`Place: ${labels.join(', ')}`, size - 10, MUTE);
    }
  }

  function pushFrame(dt) {
    dts.push(dt);
    dtSum += dt;
    while (dts.length > MESH.fpsWindow) dtSum -= dts.shift();
  }

  function currentFps() {
    if (dts.length < 4 || dtSum <= 0) return 0;
    return dts.length / dtSum;
  }

  function maybeDowngrade() {
    if (downgraded || elapsedSinceStart < 2) return;
    if (dts.length < Math.min(MESH.fpsWindow, 60)) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (currentFps() >= MESH.minFps) return;
    if (renderMs < 1000 / 120) return;
    downgraded = true;
    cols = MESH.fallbackCols;
    rows = MESH.fallbackRows;
    rebuildMesh();
  }

  function frame(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;
    clock += dt;
    elapsedSinceStart += dt;
    pushFrame(dt);
    maybeDowngrade();
    const started = performance.now();
    render();
    renderMs = renderMs * 0.9 + (performance.now() - started) * 0.1;
    raf = requestAnimationFrame(frame);
  }

  return {
    canvas,

    setAsset(next) {
      const src = next || {};
      asset = {
        width: Number.isFinite(src.width) && src.width > 0 ? src.width : 96,
        height: Number.isFinite(src.height) && src.height > 0 ? src.height : 96,
        bitmap: src.bitmap || null,
        rig: src.rig || { behaviour: 'none', points: {} },
        tempo: Number.isFinite(src.tempo) && src.tempo > 0 ? src.tempo : 1,
      };
      rebuildMesh();
      rebuildTexture();
      render();
    },

    setBitmap(imageData) {
      asset.bitmap = imageData || null;
      rebuildTexture();
      render();
    },

    setRig(rig) {
      asset.rig = rig || { behaviour: 'none', points: {} };
      render();
    },

    setTempo(tempo) {
      asset.tempo = Number.isFinite(tempo) && tempo > 0 ? tempo : 1;
      render();
    },

    setDebug(on) {
      debug = !!on;
      render();
    },

    start() {
      if (running || disposed) return;
      running = true;
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    },

    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTs = 0;
    },

    isRunning() {
      return running;
    },

    render,

    get fps() {
      return currentFps();
    },

    get time() {
      return clock;
    },

    setTime(seconds) {
      clock = Number.isFinite(seconds) ? seconds : 0;
      render();
    },

    get meshResolution() {
      return cols;
    },

    dispose() {
      this.stop();
      disposed = true;
      texture = null;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
