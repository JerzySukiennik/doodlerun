// DoodleRun — deformation mesh: grid, cosine-falloff pulls, affine triangle blitting.

import { MESH } from '../config.js';

export function createMesh(width, height, cols = MESH.cols, rows = MESH.rows) {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const count = (c + 1) * (r + 1);
  const rest = new Float32Array(count * 2);
  const pos = new Float32Array(count * 2);

  for (let j = 0; j <= r; j += 1) {
    for (let i = 0; i <= c; i += 1) {
      const k = j * (c + 1) + i;
      rest[2 * k] = (i * width) / c;
      rest[2 * k + 1] = (j * height) / r;
    }
  }
  pos.set(rest);

  return {
    width,
    height,
    cols: c,
    rows: r,
    rest,
    pos,
    occupied: new Uint8Array(c * r).fill(1),
  };
}

export function resetMesh(mesh) {
  mesh.pos.set(mesh.rest);
  return mesh;
}

export function markOccupancy(mesh, imageData, alphaThreshold = 8) {
  const { cols, rows } = mesh;
  const occupied = mesh.occupied;
  occupied.fill(0);
  if (!imageData || !imageData.data) {
    occupied.fill(1);
    return mesh;
  }

  const iw = imageData.width;
  const ih = imageData.height;
  const data = imageData.data;
  const raw = new Uint8Array(cols * rows);

  for (let j = 0; j < rows; j += 1) {
    const y0 = Math.max(0, Math.floor((j * ih) / rows));
    const y1 = Math.min(ih, Math.ceil(((j + 1) * ih) / rows));
    for (let i = 0; i < cols; i += 1) {
      const x0 = Math.max(0, Math.floor((i * iw) / cols));
      const x1 = Math.min(iw, Math.ceil(((i + 1) * iw) / cols));
      let hit = 0;
      for (let y = y0; y < y1 && !hit; y += 1) {
        const row = y * iw;
        for (let x = x0; x < x1; x += 1) {
          if (data[(row + x) * 4 + 3] > alphaThreshold) {
            hit = 1;
            break;
          }
        }
      }
      raw[j * cols + i] = hit;
    }
  }

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (!raw[j * cols + i]) continue;
      for (let dj = -1; dj <= 1; dj += 1) {
        const nj = j + dj;
        if (nj < 0 || nj >= rows) continue;
        for (let di = -1; di <= 1; di += 1) {
          const ni = i + di;
          if (ni < 0 || ni >= cols) continue;
          occupied[nj * cols + ni] = 1;
        }
      }
    }
  }

  return mesh;
}

export function pullPoint(mesh, cx, cy, radius, dx, dy) {
  if (!(radius > 0)) return mesh;
  if (dx === 0 && dy === 0) return mesh;
  const rest = mesh.rest;
  const pos = mesh.pos;
  const n = rest.length / 2;
  const inv = Math.PI / radius;
  const r2 = radius * radius;

  for (let k = 0; k < n; k += 1) {
    const ex = rest[2 * k] - cx;
    const ey = rest[2 * k + 1] - cy;
    const dd = ex * ex + ey * ey;
    if (dd >= r2) continue;
    const w = 0.5 * (1 + Math.cos(inv * Math.sqrt(dd)));
    pos[2 * k] += w * dx;
    pos[2 * k + 1] += w * dy;
  }
  return mesh;
}

export function translateAll(mesh, dx, dy) {
  if (dx === 0 && dy === 0) return mesh;
  const pos = mesh.pos;
  for (let k = 0; k < pos.length; k += 2) {
    pos[k] += dx;
    pos[k + 1] += dy;
  }
  return mesh;
}

export function scaleXAbout(mesh, axisX, factor) {
  if (!Number.isFinite(factor) || Math.abs(factor) < 0.02) return false;
  const pos = mesh.pos;
  for (let k = 0; k < pos.length; k += 2) {
    pos[k] = axisX + (pos[k] - axisX) * factor;
  }
  return true;
}

export function triangleTransform(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
  const ax1 = sx1 - sx0;
  const ay1 = sy1 - sy0;
  const ax2 = sx2 - sx0;
  const ay2 = sy2 - sy0;
  const du1 = dx1 - dx0;
  const dv1 = dy1 - dy0;
  const du2 = dx2 - dx0;
  const dv2 = dy2 - dy0;

  const det = ax1 * ay2 - ax2 * ay1;
  if (Math.abs(det) < 1e-6) return null;

  const a = (du1 * ay2 - du2 * ay1) / det;
  const c = (du2 * ax1 - du1 * ax2) / det;
  const b = (dv1 * ay2 - dv2 * ay1) / det;
  const d = (dv2 * ax1 - dv1 * ax2) / det;
  const e = dx0 - a * sx0 - c * sy0;
  const f = dy0 - b * sx0 - d * sy0;

  return [a, b, c, d, e, f];
}

export function makeTexture(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function blitTriangle(ctx, texture, rest, pos, k0, k1, k2, expand) {
  const x0 = rest[2 * k0];
  const y0 = rest[2 * k0 + 1];
  const x1 = rest[2 * k1];
  const y1 = rest[2 * k1 + 1];
  const x2 = rest[2 * k2];
  const y2 = rest[2 * k2 + 1];

  const u0 = pos[2 * k0];
  const v0 = pos[2 * k0 + 1];
  const u1 = pos[2 * k1];
  const v1 = pos[2 * k1 + 1];
  const u2 = pos[2 * k2];
  const v2 = pos[2 * k2 + 1];

  const m = triangleTransform(x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2);
  if (!m) return;

  const gx = (u0 + u1 + u2) / 3;
  const gy = (v0 + v1 + v2) / 3;

  let ex = u0 - gx;
  let ey = v0 - gy;
  let len = Math.hypot(ex, ey) || 1;
  const px0 = u0 + (ex / len) * expand;
  const py0 = v0 + (ey / len) * expand;

  ex = u1 - gx;
  ey = v1 - gy;
  len = Math.hypot(ex, ey) || 1;
  const px1 = u1 + (ex / len) * expand;
  const py1 = v1 + (ey / len) * expand;

  ex = u2 - gx;
  ey = v2 - gy;
  len = Math.hypot(ex, ey) || 1;
  const px2 = u2 + (ex / len) * expand;
  const py2 = v2 + (ey / len) * expand;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px0, py0);
  ctx.lineTo(px1, py1);
  ctx.lineTo(px2, py2);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(texture, 0, 0);
  ctx.restore();
}

export function drawMesh(ctx, texture, mesh, debug = false) {
  if (!texture) return;
  const { cols, rows, rest, pos, occupied } = mesh;
  const stride = cols + 1;
  const expand = MESH.clipExpand;

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (!occupied[j * cols + i]) continue;
      const tl = j * stride + i;
      const tr = tl + 1;
      const bl = tl + stride;
      const br = bl + 1;
      blitTriangle(ctx, texture, rest, pos, tl, tr, br, expand);
      blitTriangle(ctx, texture, rest, pos, tl, br, bl, expand);
    }
  }

  if (!debug) return;

  ctx.save();
  ctx.lineWidth = 1 / (ctx.getTransform ? Math.max(0.0001, Math.abs(ctx.getTransform().a)) : 1);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      const k = j * stride + i;
      if (i < cols) {
        ctx.moveTo(pos[2 * k], pos[2 * k + 1]);
        ctx.lineTo(pos[2 * (k + 1)], pos[2 * (k + 1) + 1]);
      }
      if (j < rows) {
        ctx.moveTo(pos[2 * k], pos[2 * k + 1]);
        ctx.lineTo(pos[2 * (k + stride)], pos[2 * (k + stride) + 1]);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}
