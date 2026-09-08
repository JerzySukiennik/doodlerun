// DoodleRun — keeping a world between sessions: the browser remembers the last one, a file carries it anywhere.

import { SLOTS, SLOT_BY_ID } from '../config.slots.js';
import { encodeBitmap, decodeBitmap, packRig, unpackRig, encodeSound, decodeSound } from '../net/codec.js';
import * as store from './assets.js';

const KEY = 'dr.set';
const VERSION = 1;

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch (error) {
    return null;
  }
}

export function hasSave() {
  const raw = readRaw();
  return !!raw && raw.length > 2;
}

export function savedAt() {
  try {
    const parsed = JSON.parse(readRaw() || 'null');
    return parsed && parsed.savedAt ? parsed.savedAt : 0;
  } catch (error) {
    return 0;
  }
}

export function savedCount() {
  try {
    const parsed = JSON.parse(readRaw() || 'null');
    return parsed && parsed.slots ? Object.keys(parsed.slots).length : 0;
  } catch (error) {
    return 0;
  }
}

export async function serialise() {
  const slots = {};
  for (let i = 0; i < SLOTS.length; i += 1) {
    const slot = SLOTS[i];
    const asset = store.getAsset(slot.id);
    if (!asset) continue;
    const entry = {};
    if (asset.bitmap) entry.png = encodeBitmap(asset.bitmap);
    if (asset.rig && Object.keys(asset.rig.points).length > 0) entry.rig = packRig(asset.rig);
    if (asset.sound && asset.sound.blob) {
      const packed = await encodeSound(asset.sound, 400000);
      if (packed) entry.sound = packed;
    }
    if (entry.png || entry.sound) slots[slot.id] = entry;
  }
  return { v: VERSION, savedAt: Date.now(), slots };
}

export async function save() {
  const payload = await serialise();
  const text = JSON.stringify(payload);
  try {
    window.localStorage.setItem(KEY, text);
    return { ok: true, bytes: text.length };
  } catch (error) {
    // A full quota is not worth a crash: the world stays in memory for this session.
    return { ok: false, bytes: text.length };
  }
}

export function clear() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (error) {
    // Nothing to remove.
  }
}

// `onlyEmpty` is how a saved world is carried into a room: it fills what nobody
// has claimed and never paints over somebody else's work.
export async function apply(payload, options) {
  const opts = options || {};
  if (!payload || !payload.slots) return [];
  const applied = [];
  const ids = Object.keys(payload.slots);
  for (let i = 0; i < ids.length; i += 1) {
    const slotId = ids[i];
    const slot = SLOT_BY_ID[slotId];
    const entry = payload.slots[slotId];
    if (!slot || !entry) continue;
    if (opts.onlyEmpty) {
      const current = store.getAsset(slotId);
      const taken = current && (current.bitmap || (current.sound && current.sound.url));
      if (taken) continue;
      if (opts.skip && opts.skip.indexOf(slotId) !== -1) continue;
    }
    if (entry.png) {
      const bitmap = await decodeBitmap(entry.png, slot.width, slot.height);
      if (bitmap) {
        store.setBitmap(slotId, bitmap, []);
        store.setRig(slotId, unpackRig(entry.rig, slot.defaultBehaviour));
        store.setStatus(slotId, 'ready');
      }
    }
    if (entry.sound) {
      const sound = decodeSound(entry.sound);
      if (sound) {
        store.setSound(slotId, sound);
        store.setStatus(slotId, 'ready');
      }
    }
    applied.push(slotId);
  }
  return applied;
}

export async function load(options) {
  const raw = readRaw();
  if (!raw) return [];
  try {
    return await apply(JSON.parse(raw), options);
  } catch (error) {
    return [];
  }
}

export function readSaved() {
  try {
    return JSON.parse(readRaw() || 'null');
  } catch (error) {
    return null;
  }
}

export async function exportFile(name) {
  const payload = await serialise();
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name || 'doodlerun-world'}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return Object.keys(payload.slots).length;
}

export function importFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (!payload || !payload.slots) {
          resolve(null);
          return;
        }
        const applied = await apply(payload);
        resolve(applied);
      } catch (error) {
        resolve(null);
      }
      input.remove();
    });
    document.body.appendChild(input);
    input.style.display = 'none';
    input.click();
  });
}
