// DoodleRun — alpha coverage measurement, the hole mask and the 100% gate.
import { EDITOR, SHELL } from '../config.js';

function shellColor(name, fallback) {
  if (SHELL && typeof SHELL[name] === 'string') return SHELL[name];
  if (SHELL && SHELL.colors && typeof SHELL.colors[name] === 'string') return SHELL.colors[name];
  return fallback;
}

function hexToRgb(hex) {
  let value = typeof hex === 'string' ? hex.trim() : '';
  if (value.charAt(0) === '#') value = value.slice(1);
  if (value.length === 3) {
    value = value.charAt(0) + value.charAt(0) + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2);
  }
  const n = parseInt(value, 16);
  if (value.length !== 6 || Number.isNaN(n)) return { r: 229, g: 35, b: 27 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function measureCoverage(imageData, alphaThreshold = EDITOR.alphaThreshold) {
  if (!imageData || !imageData.data) return { filled: 0, empty: 0, total: 0, ratio: 0 };
  const data = imageData.data;
  const total = imageData.width * imageData.height;
  let filled = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > alphaThreshold) filled += 1;
  }
  const empty = total - filled;
  return { filled, empty, total, ratio: total === 0 ? 0 : filled / total };
}

export function holeMask(imageData, alphaThreshold = EDITOR.alphaThreshold) {
  if (!imageData || !imageData.data) return null;
  const width = imageData.width;
  const height = imageData.height;
  const out = new ImageData(width, height);
  const src = imageData.data;
  const dst = out.data;
  const alert = hexToRgb(shellColor('alert', '#E5231B'));
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] <= alphaThreshold) {
      dst[i] = alert.r;
      dst[i + 1] = alert.g;
      dst[i + 2] = alert.b;
      dst[i + 3] = 140;
    }
  }
  return out;
}

export function passesGate(slot, imageData) {
  if (!slot || !slot.requiresFullCoverage) return true;
  if (!imageData || !imageData.data) return false;
  return measureCoverage(imageData).empty === 0;
}
