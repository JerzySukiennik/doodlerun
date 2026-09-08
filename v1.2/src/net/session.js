// DoodleRun — one room: who is in it, who owns which slot, and the shared fate of a run.

import { NET } from '../config.js';
import { SLOTS, SLOT_BY_ID } from '../config.slots.js';
import { createDriver, makeCode, isCode, localId, localNick, saveNick } from './driver.js';
import { encodeBitmap, decodeBitmap, packRig, unpackRig, encodeSound, decodeSound } from './codec.js';

const SHARED = SLOTS.filter((slot) => slot.shared).map((slot) => slot.id);

function nowMs() {
  return Date.now();
}

export function createSession(options) {
  const onState = (options && options.onState) || (() => {});
  const onAsset = (options && options.onAsset) || (() => {});
  const onHero = (options && options.onHero) || (() => {});
  const onRun = (options && options.onRun) || (() => {});
  const onKicked = (options && options.onKicked) || (() => {});

  const me = localId();
  let driver = null;
  let code = null;
  let beat = 0;
  let watchers = [];
  let live = { players: {}, slots: {}, meta: null };
  let lastLive = 0;
  let leaving = false;

  function room(path) {
    return path ? `rooms/${code}/${path}` : `rooms/${code}`;
  }

  function state() {
    const players = live.players || {};
    const ids = Object.keys(players);
    const meta = live.meta || {};
    return {
      code,
      me,
      host: meta.host || null,
      isHost: meta.host === me,
      phase: meta.phase || 'lobby',
      seed: meta.seed || 1,
      generation: meta.generation || 0,
      players: ids.map((id) => Object.assign({ id }, players[id])),
      slots: live.slots || {},
      connected: !!code,
    };
  }

  function emit() {
    onState(state());
  }

  function stopWatchers() {
    watchers.forEach((off) => {
      try {
        off();
      } catch (error) {
        // A watcher torn down twice is not worth a crash.
      }
    });
    watchers = [];
  }

  async function heartbeat() {
    if (!code || leaving) return;
    try {
      await driver.update(room(`players/${me}`), { beat: nowMs() });
    } catch (error) {
      // A dropped beat resolves itself on the next tick.
    }
  }

  // A player whose heartbeat went quiet frees their slots for someone else,
  // which is the whole point of claiming a slot rather than owning it.
  async function reapStale() {
    const meta = live.meta || {};
    if (meta.host !== me) return;
    const players = live.players || {};
    const slots = live.slots || {};
    const cutoff = nowMs() - NET.staleMs;
    const updates = {};
    Object.keys(players).forEach((id) => {
      if (id === me) return;
      const player = players[id] || {};
      if ((player.beat || 0) > cutoff) return;
      updates[`players/${id}`] = null;
      Object.keys(slots).forEach((slotId) => {
        const slot = slots[slotId] || {};
        if (slot.owner === id && !slot.done) updates[`slots/${slotId}`] = null;
      });
    });
    if (Object.keys(updates).length === 0) return;
    try {
      await driver.update(room(''), updates);
    } catch (error) {
      // Another client may have reaped first.
    }
  }

  async function watchRoom() {
    stopWatchers();
    watchers.push(driver.watch(room('meta'), (value) => {
      const before = live.meta;
      live.meta = value || {};
      const wasRunning = !!before && before.phase === 'run';
      if (value && before && wasRunning && value.phase === 'run' && value.generation !== before.generation) {
        onRun({ kind: 'restart', seed: value.seed, generation: value.generation });
      }
      if (value && value.phase === 'run' && (!before || before.phase !== 'run')) {
        onRun({ kind: 'start', seed: value.seed, generation: value.generation || 0 });
      }
      if (value && value.phase === 'lobby' && before && before.phase === 'run') {
        onRun({ kind: 'stop' });
      }
      emit();
    }));

    watchers.push(driver.watch(room('players'), (value) => {
      live.players = value || {};
      if (code && !leaving && !live.players[me]) {
        onKicked();
        return;
      }
      emit();
      reapStale();
    }));

    watchers.push(driver.watch(room('slots'), (value) => {
      live.slots = value || {};
      emit();
    }));

    watchers.push(driver.watchChildren(room('assets'), {
      added: (slotId, value) => deliverAsset(slotId, value),
      changed: (slotId, value) => deliverAsset(slotId, value),
    }));

    watchers.push(driver.watchChildren(room('heroes'), {
      added: (playerId, value) => deliverHero(playerId, value),
      changed: (playerId, value) => deliverHero(playerId, value),
    }));

    watchers.push(driver.watch(room('death'), (value) => {
      if (!value || value.by === me) return;
      onRun({ kind: 'death', by: value.by, cause: value.cause, generation: value.generation });
    }));
  }

  async function deliverAsset(slotId, value) {
    if (!value || value.by === me) return;
    const slot = SLOT_BY_ID[slotId];
    if (!slot) return;
    const bitmap = await decodeBitmap(value.png, slot.width, slot.height);
    if (!bitmap) return;
    onAsset({
      slotId,
      bitmap,
      rig: unpackRig(value.rig, slot.defaultBehaviour),
      sound: value.sound ? decodeSound(value.sound) : null,
      by: value.by,
    });
  }

  async function deliverHero(playerId, value) {
    if (!value || playerId === me) return;
    const slot = SLOT_BY_ID.hero;
    const bitmap = await decodeBitmap(value.png, slot.width, slot.height);
    if (!bitmap) return;
    onHero({ playerId, bitmap, rig: unpackRig(value.rig, slot.defaultBehaviour) });
  }

  async function enter(nextCode, nick, asHost) {
    code = nextCode;
    saveNick(nick);
    const player = { nick: nick.slice(0, 16), beat: nowMs(), joined: nowMs(), ready: false };
    await driver.set(room(`players/${me}`), player);
    await driver.clearOnDisconnect(room(`players/${me}`));
    if (asHost) {
      await driver.set(room('meta'), {
        host: me,
        phase: 'lobby',
        seed: (Math.floor(Math.random() * 1e9) + 1),
        generation: 0,
        created: nowMs(),
        open: true,
      });
    }
    await driver.update(`lobbies/${code}`, {
      code,
      nick: nick.slice(0, 16),
      updated: nowMs(),
      phase: asHost ? 'lobby' : (live.meta && live.meta.phase) || 'lobby',
    });
    await watchRoom();
    beat = window.setInterval(() => {
      heartbeat();
      if ((live.meta || {}).host === me) driver.update(`lobbies/${code}`, { updated: nowMs(), players: Object.keys(live.players || {}).length });
    }, NET.beatMs);
    emit();
  }

  return {
    get me() {
      return me;
    },
    get nick() {
      return localNick();
    },
    get state() {
      return state();
    },

    async connect() {
      if (!driver) driver = await createDriver();
      return true;
    },

    async listRooms(handler) {
      await this.connect();
      return driver.watch('lobbies', (value) => {
        const rows = [];
        const cutoff = nowMs() - NET.lobbyTtlMs;
        Object.keys(value || {}).forEach((key) => {
          const row = value[key];
          if (!row || !isCode(key)) return;
          if ((row.updated || 0) < cutoff) return;
          rows.push({ code: key, nick: row.nick || '', players: row.players || 1, phase: row.phase || 'lobby' });
        });
        rows.sort((a, b) => (b.updated || 0) - (a.updated || 0));
        handler(rows);
      });
    },

    async host(nick) {
      await this.connect();
      let next = makeCode();
      for (let i = 0; i < 6; i += 1) {
        const taken = await driver.get(`rooms/${next}/meta`);
        if (!taken) break;
        next = makeCode();
      }
      await enter(next, nick, true);
      return next;
    },

    async join(nextCode, nick) {
      await this.connect();
      if (!isCode(nextCode)) throw new Error('bad code');
      const meta = await driver.get(`rooms/${nextCode}/meta`);
      if (!meta) throw new Error('no room');
      const players = await driver.get(`rooms/${nextCode}/players`);
      if (players && Object.keys(players).length >= NET.maxPlayers) throw new Error('full');
      await enter(nextCode, nick, false);
      const assets = await driver.get(`rooms/${nextCode}/assets`);
      Object.keys(assets || {}).forEach((slotId) => deliverAsset(slotId, assets[slotId]));
      const heroes = await driver.get(`rooms/${nextCode}/heroes`);
      Object.keys(heroes || {}).forEach((playerId) => deliverHero(playerId, heroes[playerId]));
      return nextCode;
    },

    async leave() {
      if (!code) return;
      leaving = true;
      if (beat) window.clearInterval(beat);
      beat = 0;
      stopWatchers();
      const wasHost = (live.meta || {}).host === me;
      const updates = { [`players/${me}`]: null };
      Object.keys(live.slots || {}).forEach((slotId) => {
        const slot = live.slots[slotId] || {};
        if (slot.owner === me && !slot.done) updates[`slots/${slotId}`] = null;
      });
      try {
        await driver.cancelOnDisconnect(room(`players/${me}`));
        await driver.update(room(''), updates);
        const rest = Object.keys(live.players || {}).filter((id) => id !== me);
        if (wasHost && rest.length > 0) await driver.update(room('meta'), { host: rest[0] });
        if (rest.length === 0) {
          await driver.remove(room(''));
          await driver.remove(`lobbies/${code}`);
        }
      } catch (error) {
        // Leaving is best effort: the heartbeat reaper cleans up either way.
      }
      code = null;
      live = { players: {}, slots: {}, meta: null };
      leaving = false;
      emit();
    },

    // First click wins. The transaction is the whole reason two players never
    // end up drawing the same slot.
    async claimSlot(slotId) {
      if (!code) return false;
      const res = await driver.transaction(room(`slots/${slotId}`), (current) => {
        if (current && current.owner && current.owner !== me) return undefined;
        return { owner: me, done: current ? !!current.done : false, at: nowMs() };
      });
      return res.committed && res.value && res.value.owner === me;
    },

    async releaseSlot(slotId) {
      if (!code) return;
      const slot = (live.slots || {})[slotId];
      if (!slot || slot.owner !== me || slot.done) return;
      await driver.remove(room(`slots/${slotId}`));
    },

    async publishAsset(slotId, imageData, rig, sound) {
      if (!code) return;
      const png = encodeBitmap(imageData);
      if (!png) return;
      const payload = { png, rig: packRig(rig), by: me, at: nowMs() };
      const packedSound = await encodeSound(sound);
      if (packedSound) payload.sound = packedSound;
      if (slotId === 'hero') {
        await driver.set(room(`heroes/${me}`), payload);
        await driver.update(room(`players/${me}`), { hero: true });
        return;
      }
      await driver.set(room(`assets/${slotId}`), payload);
      await driver.update(room(`slots/${slotId}`), { owner: me, done: true, at: nowMs() });
    },

    async setReady(ready) {
      if (!code) return;
      await driver.update(room(`players/${me}`), { ready: !!ready });
    },

    async kick(playerId) {
      if (!code || (live.meta || {}).host !== me || playerId === me) return;
      const updates = { [`players/${playerId}`]: null };
      Object.keys(live.slots || {}).forEach((slotId) => {
        const slot = live.slots[slotId] || {};
        if (slot.owner === playerId && !slot.done) updates[`slots/${slotId}`] = null;
      });
      updates[`heroes/${playerId}`] = null;
      await driver.update(room(''), updates);
    },

    missingSlots() {
      const slots = live.slots || {};
      return SHARED.filter((slotId) => !(slots[slotId] && slots[slotId].done));
    },

    playersWithoutHero() {
      const players = live.players || {};
      return Object.keys(players).filter((id) => !players[id].hero);
    },

    async startRun() {
      if (!code || (live.meta || {}).host !== me) return;
      await driver.remove(room('death'));
      await driver.update(room('meta'), { phase: 'run', generation: ((live.meta || {}).generation || 0) + 1 });
      await driver.update(`lobbies/${code}`, { phase: 'run', updated: nowMs() });
    },

    async backToLobby() {
      if (!code || (live.meta || {}).host !== me) return;
      await driver.update(room('meta'), { phase: 'lobby' });
      await driver.update(`lobbies/${code}`, { phase: 'lobby', updated: nowMs() });
    },

    async publishLive(x, y, metres, stateName) {
      if (!code) return;
      const gap = 1000 / NET.liveHz;
      const t = nowMs();
      if (t - lastLive < gap) return;
      lastLive = t;
      await driver.set(room(`live/${me}`), { x: Math.round(x), y: Math.round(y), m: Math.round(metres), s: stateName, t });
    },

    watchLive(handler) {
      if (!code) return () => {};
      return driver.watch(room('live'), (value) => handler(value || {}));
    },

    // Every client judges its own collisions, so a death is announced, never
    // adjudicated. One death restarts the whole room.
    async reportDeath(cause, metres) {
      if (!code) return;
      const generation = (live.meta || {}).generation || 0;
      await driver.set(room('death'), { by: me, cause, m: Math.round(metres), generation, at: nowMs() });
    },

    async restartRun() {
      if (!code || (live.meta || {}).host !== me) return;
      await driver.remove(room('death'));
      await driver.remove(room('live'));
      await driver.update(room('meta'), { generation: ((live.meta || {}).generation || 0) + 1 });
    },
  };
}
