// DoodleRun — the Realtime Database wrapper: the only file that knows Firebase exists.

import { NET } from '../config.js';

let ready = null;

async function connect() {
  if (ready) return ready;
  ready = (async () => {
    const appMod = await import(/* @vite-ignore */ NET.sdk);
    const dbMod = await import(/* @vite-ignore */ NET.sdkDb);
    const app = appMod.initializeApp(NET.config);
    const db = dbMod.getDatabase(app);
    return { app, db, api: dbMod };
  })();
  return ready;
}

export async function createDriver() {
  const { db, api } = await connect();

  function at(path) {
    return api.ref(db, path);
  }

  return {
    now() {
      return api.serverTimestamp();
    },
    async get(path) {
      const snap = await api.get(at(path));
      return snap.exists() ? snap.val() : null;
    },
    async set(path, value) {
      await api.set(at(path), value);
    },
    async update(path, value) {
      await api.update(at(path), value);
    },
    async remove(path) {
      await api.remove(at(path));
    },
    async push(path, value) {
      const node = api.push(at(path));
      await api.set(node, value);
      return node.key;
    },
    async transaction(path, fn) {
      const res = await api.runTransaction(at(path), fn);
      return { committed: res.committed, value: res.snapshot ? res.snapshot.val() : null };
    },
    watch(path, handler) {
      const node = at(path);
      const off = api.onValue(node, (snap) => handler(snap.exists() ? snap.val() : null));
      return () => off();
    },
    watchChildren(path, handlers) {
      const node = at(path);
      const offs = [];
      if (handlers.added) offs.push(api.onChildAdded(node, (s) => handlers.added(s.key, s.val())));
      if (handlers.changed) offs.push(api.onChildChanged(node, (s) => handlers.changed(s.key, s.val())));
      if (handlers.removed) offs.push(api.onChildRemoved(node, (s) => handlers.removed(s.key, s.val())));
      return () => offs.forEach((off) => off());
    },
    async clearOnDisconnect(path) {
      await api.onDisconnect(at(path)).remove();
    },
    async cancelOnDisconnect(path) {
      await api.onDisconnect(at(path)).cancel();
    },
    connectedPath: '.info/connected',
  };
}

export function makeCode() {
  let out = '';
  for (let i = 0; i < NET.codeLength; i += 1) {
    out += NET.codeAlphabet[Math.floor(Math.random() * NET.codeAlphabet.length)];
  }
  return out;
}

export function isCode(value) {
  if (typeof value !== 'string' || value.length !== NET.codeLength) return false;
  for (let i = 0; i < value.length; i += 1) {
    if (NET.codeAlphabet.indexOf(value[i]) === -1) return false;
  }
  return true;
}

// The identity is a local id, not an account: this game has no sign-in and the
// rules validate shapes rather than owners.
export function localId() {
  let id = null;
  try {
    id = window.localStorage.getItem('dr.id');
  } catch (error) {
    id = null;
  }
  if (id) return id;
  id = 'p' + Math.random().toString(36).slice(2, 10);
  try {
    window.localStorage.setItem('dr.id', id);
  } catch (error) {
    // A private window still plays, it just gets a new identity each visit.
  }
  return id;
}

export function localNick() {
  try {
    return window.localStorage.getItem('dr.nick') || '';
  } catch (error) {
    return '';
  }
}

export function saveNick(nick) {
  try {
    window.localStorage.setItem('dr.nick', nick);
  } catch (error) {
    // Nothing to do: the nick simply will not be remembered.
  }
}
