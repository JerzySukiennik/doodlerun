// DoodleRun — the drawing surface: tools, mirror, pixel cells, screen rendering and op replay.
import { EDITOR, SHELL } from '../config.js';

const CELL = EDITOR.pixelCell;
const CHECKER = 12;

function shellColor(name, fallback) {
  if (SHELL && typeof SHELL[name] === 'string') return SHELL[name];
  if (SHELL && SHELL.colors && typeof SHELL.colors[name] === 'string') return SHELL.colors[name];
  return fallback;
}

const INK = shellColor('ink', '#000000');
const PAPER = shellColor('paper', '#FFFFFF');
const HATCH = shellColor('hatch', '#E2E0DB');
const EDGE = shellColor('edge', '#C9C6C0');

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function context2d(canvas, readFrequently) {
  return canvas.getContext('2d', readFrequently ? { willReadFrequently: true } : undefined);
}

function clampIndex(value, max) {
  if (!(value >= 0)) return 0;
  if (value > max) return max;
  return value;
}

function cellIndex(value, limit) {
  return clampIndex(Math.floor(value / CELL), limit - 1);
}

function snapToCellCentre(value, limit) {
  return cellIndex(value, limit) * CELL + CELL / 2;
}

function cellColumns(width) {
  return Math.max(1, Math.ceil(width / CELL));
}

function cellRows(height) {
  return Math.max(1, Math.ceil(height / CELL));
}

function hexToRgb(hex) {
  let value = typeof hex === 'string' ? hex.trim() : '';
  if (value.charAt(0) === '#') value = value.slice(1);
  if (value.length === 3) {
    value = value.charAt(0) + value.charAt(0) + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2);
  }
  const n = parseInt(value, 16);
  if (value.length !== 6 || Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r, g, b) {
  const v = ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
  return '#' + v.toString(16).padStart(6, '0');
}

function beginPaint(ctx, op) {
  ctx.save();
  ctx.globalCompositeOperation = op.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = op.tool === 'eraser' ? INK : op.color;
  ctx.strokeStyle = op.tool === 'eraser' ? INK : op.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.1, op.size);
}

function endPaint(ctx) {
  ctx.restore();
}

function paintCell(ctx, op, cx, cy) {
  const x = cx * CELL;
  const y = cy * CELL;
  if (op.tool === 'eraser') ctx.clearRect(x, y, CELL, CELL);
  else ctx.fillRect(x, y, CELL, CELL);
}

function paintCellLine(ctx, op, x0, y0, x1, y1, cols, rows) {
  let cx = cellIndex(x0, cols);
  let cy = cellIndex(y0, rows);
  const tx = cellIndex(x1, cols);
  const ty = cellIndex(y1, rows);
  const dx = Math.abs(tx - cx);
  const dy = -Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1;
  const sy = cy < ty ? 1 : -1;
  let err = dx + dy;
  let guard = 0;
  const limit = (cols + rows) * 4 + 8;
  for (;;) {
    paintCell(ctx, op, cx, cy);
    if (cx === tx && cy === ty) break;
    if (++guard > limit) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; cx += sx; }
    if (e2 <= dx) { err += dx; cy += sy; }
  }
}

function paintDot(ctx, op, x, y, width, height) {
  if (op.pixel) {
    paintCell(ctx, op, cellIndex(x, cellColumns(width)), cellIndex(y, cellRows(height)));
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.05, op.size / 2), 0, Math.PI * 2);
  ctx.fill();
}

function paintSegment(ctx, op, x0, y0, x1, y1, width, height) {
  if (op.pixel) {
    paintCellLine(ctx, op, x0, y0, x1, y1, cellColumns(width), cellRows(height));
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function paintStrokePart(ctx, op, index, width, height) {
  const points = op.points;
  if (index === 0) {
    paintDot(ctx, op, points[0][0], points[0][1], width, height);
    if (op.mirror) paintDot(ctx, op, width - points[0][0], points[0][1], width, height);
    return;
  }
  const a = points[index - 1];
  const b = points[index];
  paintSegment(ctx, op, a[0], a[1], b[0], b[1], width, height);
  if (op.mirror) paintSegment(ctx, op, width - a[0], a[1], width - b[0], b[1], width, height);
}

function paintStroke(ctx, op, width, height) {
  if (!op.points || op.points.length === 0) return;
  beginPaint(ctx, op);
  for (let i = 0; i < op.points.length; i += 1) paintStrokePart(ctx, op, i, width, height);
  endPaint(ctx);
}

function matches(data, offset, seed, tolerance) {
  const d = Math.abs(data[offset] - seed[0])
    + Math.abs(data[offset + 1] - seed[1])
    + Math.abs(data[offset + 2] - seed[2])
    + Math.abs(data[offset + 3] - seed[3]);
  return d <= tolerance;
}

function floodPixels(ctx, op, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const sx = clampIndex(Math.floor(op.x), width - 1);
  const sy = clampIndex(Math.floor(op.y), height - 1);
  const seedOffset = (sy * width + sx) * 4;
  const seed = [data[seedOffset], data[seedOffset + 1], data[seedOffset + 2], data[seedOffset + 3]];
  const rgb = hexToRgb(op.color);
  const tolerance = EDITOR.fillTolerance;
  const visited = new Uint8Array(width * height);
  const stack = [sx, sy];
  let painted = 0;
  while (stack.length > 0) {
    const y = stack.pop();
    let x = stack.pop();
    let index = y * width + x;
    if (visited[index] === 1) continue;
    if (!matches(data, index * 4, seed, tolerance)) continue;
    let left = x;
    while (left > 0 && visited[y * width + left - 1] === 0 && matches(data, (y * width + left - 1) * 4, seed, tolerance)) left -= 1;
    let right = x;
    while (right < width - 1 && visited[y * width + right + 1] === 0 && matches(data, (y * width + right + 1) * 4, seed, tolerance)) right += 1;
    for (x = left; x <= right; x += 1) {
      index = y * width + x;
      visited[index] = 1;
      const o = index * 4;
      data[o] = rgb.r;
      data[o + 1] = rgb.g;
      data[o + 2] = rgb.b;
      data[o + 3] = 255;
      painted += 1;
      if (y > 0) {
        const up = (y - 1) * width + x;
        if (visited[up] === 0 && matches(data, up * 4, seed, tolerance)) stack.push(x, y - 1);
      }
      if (y < height - 1) {
        const down = (y + 1) * width + x;
        if (visited[down] === 0 && matches(data, down * 4, seed, tolerance)) stack.push(x, y + 1);
      }
    }
  }
  if (painted > 0) ctx.putImageData(image, 0, 0);
}

function floodCells(ctx, op, width, height) {
  const cols = cellColumns(width);
  const rows = cellRows(height);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const sample = new Uint8ClampedArray(cols * rows * 4);
  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const px = clampIndex(Math.floor(cx * CELL + CELL / 2), width - 1);
      const py = clampIndex(Math.floor(cy * CELL + CELL / 2), height - 1);
      const src = (py * width + px) * 4;
      const dst = (cy * cols + cx) * 4;
      sample[dst] = data[src];
      sample[dst + 1] = data[src + 1];
      sample[dst + 2] = data[src + 2];
      sample[dst + 3] = data[src + 3];
    }
  }
  const sx = cellIndex(op.x, cols);
  const sy = cellIndex(op.y, rows);
  const seedOffset = (sy * cols + sx) * 4;
  const seed = [sample[seedOffset], sample[seedOffset + 1], sample[seedOffset + 2], sample[seedOffset + 3]];
  const tolerance = EDITOR.fillTolerance;
  const visited = new Uint8Array(cols * rows);
  const stack = [sx, sy];
  const hits = [];
  while (stack.length > 0) {
    const cy = stack.pop();
    const cx = stack.pop();
    const index = cy * cols + cx;
    if (visited[index] === 1) continue;
    if (!matches(sample, index * 4, seed, tolerance)) continue;
    visited[index] = 1;
    hits.push(cx, cy);
    if (cx > 0 && visited[index - 1] === 0) stack.push(cx - 1, cy);
    if (cx < cols - 1 && visited[index + 1] === 0) stack.push(cx + 1, cy);
    if (cy > 0 && visited[index - cols] === 0) stack.push(cx, cy - 1);
    if (cy < rows - 1 && visited[index + cols] === 0) stack.push(cx, cy + 1);
  }
  if (hits.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = op.color;
  for (let i = 0; i < hits.length; i += 2) ctx.fillRect(hits[i] * CELL, hits[i + 1] * CELL, CELL, CELL);
  ctx.restore();
}

function paintOp(ctx, op, width, height) {
  if (!op || !op.t) return;
  if (op.t === 'clear') {
    ctx.clearRect(0, 0, width, height);
    return;
  }
  if (op.t === 'stroke') {
    paintStroke(ctx, op, width, height);
    return;
  }
  if (op.t === 'fill') {
    if (op.pixel) floodCells(ctx, op, width, height);
    else floodPixels(ctx, op, width, height);
  }
}

export function renderOps(ops, width, height) {
  const canvas = makeCanvas(width, height);
  const ctx = context2d(canvas, true);
  const list = Array.isArray(ops) ? ops : [];
  for (let i = 0; i < list.length; i += 1) paintOp(ctx, list[i], width, height);
  return ctx.getImageData(0, 0, width, height);
}

function silhouette(imageData) {
  const canvas = makeCanvas(imageData.width, imageData.height);
  const ctx = context2d(canvas, false);
  const out = ctx.createImageData(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  const ink = hexToRgb(INK);
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] > EDITOR.alphaThreshold) {
      dst[i] = ink.r;
      dst[i + 1] = ink.g;
      dst[i + 2] = ink.b;
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function imageCanvas(imageData) {
  const canvas = makeCanvas(imageData.width, imageData.height);
  context2d(canvas, false).putImageData(imageData, 0, 0);
  return canvas;
}

export function createSurface({ width, height, scale, mount, onOp, onPointerMove }) {
  const emitOp = typeof onOp === 'function' ? onOp : () => {};
  const emitMove = typeof onPointerMove === 'function' ? onPointerMove : () => {};

  const canvas = makeCanvas(width * scale, height * scale);
  canvas.className = 'dr-canvas';
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
  canvas.style.touchAction = 'none';
  const ctx = context2d(canvas, false);
  ctx.imageSmoothingEnabled = false;

  const work = makeCanvas(width, height);
  const wctx = context2d(work, true);

  const settings = {
    tool: 'brush',
    color: EDITOR.defaultColor,
    size: EDITOR.brushSizes[EDITOR.defaultSizeIndex],
    sizeIndex: EDITOR.defaultSizeIndex,
    mirror: false,
    pixel: false,
  };

  let inputMode = 'draw';
  let rigHandler = null;
  let pickHandler = null;
  let ghostCanvas = null;
  let overlayCanvas = null;
  let markers = [];
  let checker = null;
  let dirty = true;
  let frame = 0;
  let disposed = false;
  let activeOp = null;
  let activePointer = null;

  if (mount) mount.appendChild(canvas);

  function buildChecker() {
    const tile = makeCanvas(CHECKER * 2, CHECKER * 2);
    const tctx = context2d(tile, false);
    tctx.fillStyle = PAPER;
    tctx.fillRect(0, 0, CHECKER * 2, CHECKER * 2);
    tctx.fillStyle = HATCH;
    tctx.fillRect(0, 0, CHECKER, CHECKER);
    tctx.fillRect(CHECKER, CHECKER, CHECKER, CHECKER);
    return ctx.createPattern(tile, 'repeat');
  }

  function markDirty() {
    dirty = true;
    if (frame !== 0 || disposed) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (dirty) render();
    });
  }

  function drawGhost() {
    if (!ghostCanvas) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
    ctx.globalAlpha = EDITOR.ghostAlpha;
    ctx.imageSmoothingEnabled = false;
    const w = ghostCanvas.width * scale;
    const h = ghostCanvas.height * scale;
    ctx.drawImage(ghostCanvas, 0, canvas.height - h, w, h);
    ctx.restore();
  }

  function drawPixelGrid() {
    const step = CELL * scale;
    if (!settings.pixel || step < 8) return;
    ctx.save();
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = step; x < canvas.width; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, canvas.height);
    }
    for (let y = step; y < canvas.height; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(canvas.width, Math.round(y) + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawMarkers() {
    if (markers.length === 0) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < markers.length; i += 1) {
      const m = markers[i];
      const x = m.x * scale;
      const y = m.y * scale;
      const half = m.selected ? 11 : 8;
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.fillRect(x - half, y - half, half * 2, half * 2);
      ctx.strokeRect(x - half, y - half, half * 2, half * 2);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 2, y - 2, 4, 4);
      if (m.label) {
        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.textBaseline = 'bottom';
        const text = String(m.label);
        const w = ctx.measureText(text).width + 8;
        const bx = x + 10;
        const by = y - 10;
        ctx.fillStyle = INK;
        ctx.fillRect(bx, by - 16, w, 16);
        ctx.fillStyle = PAPER;
        ctx.fillText(text, bx + 4, by - 2);
      }
    }
    ctx.restore();
  }

  function render() {
    dirty = false;
    if (!checker) checker = buildChecker();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (checker) {
      ctx.fillStyle = checker;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawGhost();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(work, 0, 0, canvas.width, canvas.height);
    if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
    drawPixelGrid();
    drawMarkers();
  }

  function toTarget(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    return { x, y };
  }

  function snapPoint(p) {
    if (!settings.pixel) return [p.x, p.y];
    return [snapToCellCentre(p.x, cellColumns(width)), snapToCellCentre(p.y, cellRows(height))];
  }

  function commitFill(p) {
    const op = {
      t: 'fill',
      x: clampIndex(Math.floor(p.x), width - 1),
      y: clampIndex(Math.floor(p.y), height - 1),
      color: settings.color,
      pixel: settings.pixel,
    };
    paintOp(wctx, op, width, height);
    markDirty();
    emitOp(op);
  }

  function commitPick(p) {
    const hex = pickColor(p.x, p.y);
    if (!hex) return;
    settings.color = hex;
    settings.tool = 'brush';
    if (pickHandler) pickHandler(hex);
  }

  function startStroke(p) {
    activeOp = {
      t: 'stroke',
      tool: settings.tool === 'eraser' ? 'eraser' : 'brush',
      color: settings.color,
      size: settings.size,
      mirror: settings.mirror,
      pixel: settings.pixel,
      points: [snapPoint(p)],
    };
    beginPaint(wctx, activeOp);
    paintStrokePart(wctx, activeOp, 0, width, height);
    endPaint(wctx);
    markDirty();
  }

  function extendStroke(p) {
    if (!activeOp) return;
    const point = snapPoint(p);
    const last = activeOp.points[activeOp.points.length - 1];
    if (point[0] === last[0] && point[1] === last[1]) return;
    activeOp.points.push(point);
    beginPaint(wctx, activeOp);
    paintStrokePart(wctx, activeOp, activeOp.points.length - 1, width, height);
    endPaint(wctx);
    markDirty();
  }

  function finishStroke() {
    if (!activeOp) return;
    const op = activeOp;
    activeOp = null;
    emitOp(op);
  }

  function onDown(event) {
    if (disposed || event.button !== 0) return;
    const p = toTarget(event);
    if (inputMode === 'rig') {
      if (rigHandler) rigHandler({ x: p.x, y: p.y });
      return;
    }
    if (settings.tool === 'fill') {
      commitFill(p);
      return;
    }
    if (settings.tool === 'picker') {
      commitPick(p);
      return;
    }
    activePointer = event.pointerId;
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    startStroke(p);
    event.preventDefault();
  }

  function onMove(event) {
    if (disposed) return;
    const p = toTarget(event);
    emitMove({ x: p.x, y: p.y, inside: p.x >= 0 && p.y >= 0 && p.x < width && p.y < height });
    if (activeOp && event.pointerId === activePointer) extendStroke(p);
  }

  function onUp(event) {
    if (disposed) return;
    if (activeOp && event.pointerId === activePointer) {
      extendStroke(toTarget(event));
      finishStroke();
    }
    activePointer = null;
    if (canvas.releasePointerCapture && event.pointerId !== undefined) {
      try { canvas.releasePointerCapture(event.pointerId); } catch (err) { activePointer = null; }
    }
  }

  function onLeave() {
    if (!disposed) emitMove({ x: 0, y: 0, inside: false });
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointerup', onUp);

  function pickColor(x, y) {
    const px = clampIndex(Math.floor(x), width - 1);
    const py = clampIndex(Math.floor(y), height - 1);
    const d = wctx.getImageData(px, py, 1, 1).data;
    if (d[3] <= EDITOR.alphaThreshold) return null;
    return toHex(d[0], d[1], d[2]);
  }

  markDirty();

  return {
    canvas,
    work,
    settings,
    setTool(tool) {
      settings.tool = tool;
      markDirty();
    },
    setColor(hex) {
      settings.color = hex;
    },
    setSizeIndex(i) {
      const index = clampIndex(Math.round(i), EDITOR.brushSizes.length - 1);
      settings.sizeIndex = index;
      settings.size = EDITOR.brushSizes[index];
    },
    setMirror(value) {
      settings.mirror = !!value;
      markDirty();
    },
    setPixel(value) {
      settings.pixel = !!value;
      markDirty();
    },
    setInputMode(mode) {
      inputMode = mode === 'rig' ? 'rig' : 'draw';
      if (inputMode === 'rig' && activeOp) finishStroke();
    },
    onRigClick(handler) {
      rigHandler = typeof handler === 'function' ? handler : null;
    },
    onPick(handler) {
      pickHandler = typeof handler === 'function' ? handler : null;
    },
    setGhost(imageData) {
      ghostCanvas = imageData ? silhouette(imageData) : null;
      markDirty();
    },
    setOverlay(imageData) {
      overlayCanvas = imageData ? imageCanvas(imageData) : null;
      markDirty();
    },
    setMarkers(list) {
      markers = Array.isArray(list) ? list.slice() : [];
      markDirty();
    },
    applyOp(op) {
      paintOp(wctx, op, width, height);
      markDirty();
    },
    getImageData() {
      return wctx.getImageData(0, 0, width, height);
    },
    putImageData(imageData) {
      wctx.clearRect(0, 0, width, height);
      if (imageData) wctx.putImageData(imageData, 0, 0);
      markDirty();
    },
    clear() {
      const op = { t: 'clear' };
      paintOp(wctx, op, width, height);
      markDirty();
      emitOp(op);
    },
    pickColor,
    render,
    dispose() {
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerup', onUp);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      ghostCanvas = null;
      overlayCanvas = null;
      markers = [];
      activeOp = null;
    },
  };
}
