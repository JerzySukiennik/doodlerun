// DoodleRun — the singleton asset store: bitmaps, ops, rigs, sounds, status and thumbnails.

import { SLOTS, SLOT_BY_ID } from '../config.slots.js';

const THUMB = { normal: { w: 96, h: 96 }, backdrop: { w: 192, h: 60 } };

const listeners = new Set();
const assets = new Map();

function emptyRecord(slot) {
  return {
    slotId: slot.id,
    owner: null,
    status: 'empty',
    width: slot.width,
    height: slot.height,
    bitmap: null,
    ops: [],
    rig: { behaviour: slot.defaultBehaviour, points: {} },
    sound: { blob: null, url: null, durationMs: 0, mimeType: '' },
    thumbnail: null,
    updatedAt: 0,
  };
}

for (const slot of SLOTS) assets.set(slot.id, emptyRecord(slot));

function notify(slotId) {
  const asset = assets.get(slotId);
  for (const listener of Array.from(listeners)) listener(slotId, asset);
}

function thumbBox(slot) {
  return slot.category === 'backdrop' ? THUMB.backdrop : THUMB.normal;
}

function copyImageData(src) {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

export function makeThumbnail(imageData, maxW, maxH) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(maxW / imageData.width, maxH / imageData.height);
  canvas.width = Math.max(1, Math.round(imageData.width * scale));
  canvas.height = Math.max(1, Math.round(imageData.height * scale));
  const source = document.createElement('canvas');
  source.width = imageData.width;
  source.height = imageData.height;
  source.getContext('2d').putImageData(imageData, 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function getAsset(slotId) {
  return assets.get(slotId) || null;
}

export function listAssets() {
  return SLOTS.map((slot) => assets.get(slot.id));
}

export function setBitmap(slotId, imageData, ops) {
  const asset = assets.get(slotId);
  const slot = SLOT_BY_ID[slotId];
  if (!asset || !slot || !imageData) return;
  asset.bitmap = copyImageData(imageData);
  asset.ops = Array.isArray(ops) ? ops.slice() : [];
  const box = thumbBox(slot);
  asset.thumbnail = makeThumbnail(asset.bitmap, box.w, box.h);
  if (asset.ops.length > 0 && asset.status !== 'working') asset.status = 'working';
  asset.updatedAt = performance.now();
  notify(slotId);
}

export function setRig(slotId, rig) {
  const asset = assets.get(slotId);
  const slot = SLOT_BY_ID[slotId];
  if (!asset || !slot || !rig) return;
  const behaviour = slot.behaviours.includes(rig.behaviour) ? rig.behaviour : slot.defaultBehaviour;
  const points = {};
  const source = rig.points || {};
  for (const role of Object.keys(source)) {
    const point = source[role];
    if (!point) continue;
    const x = clampNumber(point.x, 0, slot.width - 1);
    const y = clampNumber(point.y, 0, slot.height - 1);
    if (x === null || y === null) continue;
    points[role] = { x, y };
  }
  asset.rig = { behaviour, points };
  if (asset.status === 'ready') asset.status = 'working';
  asset.updatedAt = performance.now();
  notify(slotId);
}

export function setSound(slotId, sound) {
  const asset = assets.get(slotId);
  if (!asset) return;
  if (asset.sound.url && asset.sound.url !== (sound && sound.url)) URL.revokeObjectURL(asset.sound.url);
  asset.sound = {
    blob: (sound && sound.blob) || null,
    url: (sound && sound.url) || null,
    durationMs: (sound && sound.durationMs) || 0,
    mimeType: (sound && sound.mimeType) || '',
  };
  asset.updatedAt = performance.now();
  notify(slotId);
}

export function setStatus(slotId, status) {
  const asset = assets.get(slotId);
  if (!asset) return;
  if (status !== 'empty' && status !== 'working' && status !== 'ready') return;
  asset.status = status;
  asset.updatedAt = performance.now();
  notify(slotId);
}

export function resetAsset(slotId) {
  const asset = assets.get(slotId);
  const slot = SLOT_BY_ID[slotId];
  if (!asset || !slot) return;
  if (asset.sound.url) URL.revokeObjectURL(asset.sound.url);
  assets.set(slotId, emptyRecord(slot));
  notify(slotId);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function summary() {
  let ready = 0;
  let working = 0;
  let empty = 0;
  for (const asset of assets.values()) {
    if (asset.status === 'ready') ready += 1;
    else if (asset.status === 'working') working += 1;
    else empty += 1;
  }
  return { total: SLOTS.length, ready, working, empty };
}
