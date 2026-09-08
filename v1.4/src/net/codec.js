// DoodleRun — turning a drawing into something small enough to send, and back again.

import { NET, EDITOR } from '../config.js';

function scratch(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function encodeBitmap(imageData) {
  if (!imageData) return null;
  const canvas = scratch(imageData.width, imageData.height);
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  const url = canvas.toDataURL('image/png');
  return url.slice(url.indexOf(',') + 1);
}

export function decodeBitmap(png, width, height) {
  return new Promise((resolve) => {
    if (!png) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = scratch(width, height);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      resolve(ctx.getImageData(0, 0, width, height));
    };
    image.onerror = () => resolve(null);
    image.src = 'data:image/png;base64,' + png;
  });
}

export function packRig(rig) {
  if (!rig || typeof rig !== 'object') return null;
  const points = {};
  const source = rig.points || {};
  Object.keys(source).forEach((role) => {
    const point = source[role];
    if (!point) return;
    points[role] = { x: Math.round(point.x), y: Math.round(point.y) };
  });
  return { behaviour: rig.behaviour || 'idle', points };
}

export function unpackRig(rig, fallbackBehaviour) {
  if (!rig || typeof rig !== 'object') return { behaviour: fallbackBehaviour || 'idle', points: {} };
  return { behaviour: rig.behaviour || fallbackBehaviour || 'idle', points: rig.points || {} };
}

// Sounds ride the same wire as the drawings, so an oversized take is dropped
// here rather than wedging a whole room's write.
export async function encodeSound(sound, limit) {
  if (!sound || !sound.blob) return null;
  if (sound.blob.size > (limit || NET.maxAssetBytes)) return null;
  const buffer = await sound.blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return { data: window.btoa(binary), mimeType: sound.mimeType || 'audio/webm', durationMs: sound.durationMs || 0 };
}

export function decodeSound(packed) {
  if (!packed || !packed.data) return null;
  const binary = window.atob(packed.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: packed.mimeType || 'audio/webm' });
  return { blob, url: URL.createObjectURL(blob), durationMs: packed.durationMs || 0, mimeType: blob.type };
}

export function bitmapBytes(png) {
  return png ? Math.ceil((png.length * 3) / 4) : 0;
}

export function isDrawn(imageData) {
  if (!imageData) return false;
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > EDITOR.alphaThreshold) return true;
  }
  return false;
}
