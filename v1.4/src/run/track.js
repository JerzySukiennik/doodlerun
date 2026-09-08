// DoodleRun — the endless track: a seeded generator that only ever emits sections the runner can clear.

import { RUN } from '../config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jumpReach(speed) {
  const air = (2 * RUN.jumpV) / RUN.gravity;
  return speed * air;
}

export function speedAt(metres) {
  const raw = RUN.speedStart + metres * RUN.speedPerMetre;
  return raw > RUN.speedMax ? RUN.speedMax : raw;
}

export function difficultyAt(metres) {
  const d = metres / 900;
  return d > 1 ? 1 : d;
}

export function createTrack(seed) {
  const tile = RUN.tile;
  const rand = mulberry32(seed || 1);
  const solids = [];
  const hazards = [];
  const entities = [];
  const pickups = [];

  let cursorTile = 0;
  let idSeed = 0;

  function nextId() {
    idSeed += 1;
    return idSeed;
  }

  function addGround(fromTile, tiles, kind, extra) {
    if (tiles <= 0) return;
    solids.push(Object.assign({
      id: nextId(),
      kind: kind || 'ground',
      x: fromTile * tile,
      y: 0,
      w: tiles * tile,
      h: tile * 3,
      tiles,
    }, extra || {}));
  }

  function addBlock(fromTile, tiles, lift, kind, extra) {
    solids.push(Object.assign({
      id: nextId(),
      kind,
      x: fromTile * tile,
      y: -lift * tile,
      w: tiles * tile,
      h: tile,
      tiles,
    }, extra || {}));
  }

  function addHazard(kind, fromTile, tiles, y, extra) {
    hazards.push(Object.assign({
      id: nextId(),
      kind,
      x: fromTile * tile,
      y,
      w: tiles * tile,
      h: tile,
      tiles,
    }, extra || {}));
  }

  function addPlatform(fromTile, tiles, lift) {
    solids.push({
      id: nextId(),
      kind: 'platform',
      x: fromTile * tile,
      y: -lift * tile,
      w: tiles * tile,
      h: tile,
      tiles,
    });
  }

  function addSpikes(fromTile, tiles) {
    hazards.push({
      id: nextId(),
      kind: 'spikes',
      x: fromTile * tile,
      y: -tile,
      w: tiles * tile,
      h: tile,
      tiles,
    });
  }

  function addCreature(slotId, xTile, y, mode) {
    entities.push({
      id: nextId(),
      slotId,
      mode,
      x: xTile * tile,
      y,
      homeX: xTile * tile,
      phase: rand() * 4,
      dir: -1,
      charging: false,
      alive: true,
    });
  }

  function addPickup(slotId, xTile, y) {
    pickups.push({
      id: nextId(),
      slotId,
      x: xTile * tile + tile * 0.5,
      y,
      phase: rand() * 3,
      taken: false,
    });
  }

  // A section is laid down as: solid run, optional feature, optional gap.
  // Every gap is measured against the jump the runner actually has at this speed,
  // so the track is generated hard but never impossible.
  function emitSection(metres) {
    const d = difficultyAt(metres);
    const speed = speedAt(metres);
    const reachTiles = jumpReach(speed) / tile;
    const runTiles = Math.max(4, Math.round(RUN.sectionTiles - d * 3 + rand() * 3));
    const start = cursorTile;
    addGround(start, runTiles);

    const groundTop = -tile;

    // One feature per section, drawn from whatever this stretch of track is long
    // enough and far enough along to hold. Weighted, not a chain of thresholds:
    // that is what left conveyors showing up once in five thousand metres.
    const menu = [
      { id: 'spikes', weight: 16, ok: runTiles >= 6 && metres > 30 },
      { id: 'platform', weight: 14, ok: runTiles >= 5 },
      { id: 'coins', weight: 13, ok: true },
      { id: 'lucky', weight: 11, ok: metres > 25 },
      { id: 'saw', weight: 13, ok: runTiles >= 6 && metres > 45 },
      { id: 'rock', weight: 9, ok: metres > 70 },
      { id: 'trampoline', weight: 9, ok: runTiles >= 5 && metres > 55 },
      { id: 'conveyor', weight: 9, ok: runTiles >= 6 && metres > 90 },
      { id: 'mover', weight: 12, ok: metres > 100 },
      { id: 'nothing', weight: 6, ok: true },
    ].filter((entry) => entry.ok);

    let total = 0;
    for (let i = 0; i < menu.length; i += 1) total += menu[i].weight;
    let pickRoll = rand() * total;
    let feature = menu[menu.length - 1].id;
    for (let i = 0; i < menu.length; i += 1) {
      if (pickRoll < menu[i].weight) { feature = menu[i].id; break; }
      pickRoll -= menu[i].weight;
    }

    if (feature === 'spikes') {
      const at = start + 2 + Math.floor(rand() * (runTiles - 4));
      addSpikes(at, 1 + (rand() < d * 0.5 ? 1 : 0));
    } else if (feature === 'saw') {
      const at = start + 2;
      const span = Math.min(runTiles - 3, 3 + Math.floor(rand() * 3));
      addHazard('saw', at, 1, groundTop, { range: span * tile, speed: 90 + rand() * 70, phase: rand() * 6 });
    } else if (feature === 'rock') {
      const at = start + 2 + Math.floor(rand() * Math.max(1, runTiles - 4));
      addHazard('rock', at, 1, -4.4 * tile, { state: 'hang', vy: 0, homeY: -4.4 * tile });
    } else if (feature === 'lucky') {
      const at = start + 1 + Math.floor(rand() * Math.max(1, runTiles - 3));
      addBlock(at, 1, 3, 'lucky', { used: false });
    } else if (feature === 'trampoline') {
      const at = start + 2 + Math.floor(rand() * Math.max(1, runTiles - 4));
      addGround(at, 1, 'trampoline');
    } else if (feature === 'conveyor') {
      addGround(start + 2, 2 + Math.floor(rand() * 2), 'conveyor', { dir: rand() < 0.55 ? 1 : -1 });
    } else if (feature === 'mover') {
      const lift = 3 + Math.round(rand() * 1.2);
      addBlock(start + 2, 2, lift, 'mover', {
        homeY: -lift * tile,
        range: (1 + rand() * 1.4) * tile,
        speed: 0.7 + rand() * 0.6,
        phase: rand() * 6,
      });
    } else if (feature === 'platform') {
      const lift = 3 + Math.round(rand() * 1.5);
      const tiles = 2 + Math.floor(rand() * 2);
      const at = start + 1 + Math.floor(rand() * Math.max(1, runTiles - tiles - 1));
      addPlatform(at, tiles, lift);
      if (rand() < 0.8) addPickup('coin', at + Math.floor(tiles / 2), -lift * tile - tile);
      if (metres > 120 && rand() < 0.3) {
        addCreature('crawler', at + Math.floor(tiles / 2), -lift * tile + tile + 32, 'ceiling');
      }
    } else if (feature === 'coins') {
      const count = 2 + Math.floor(rand() * 3);
      const at = start + 2;
      for (let i = 0; i < count && at + i < start + runTiles - 1; i += 1) {
        addPickup('coin', at + i, groundTop - tile * (0.4 + Math.sin(i) * 0.2));
      }
    }

    if (metres > 60 && rand() < 0.30 + d * 0.35) {
      const pool = ['walker', 'jumper', 'flyer', 'charger', 'guard'];
      const pick = pool[Math.floor(rand() * (d > 0.4 ? pool.length : 3))];
      const at = start + Math.max(2, Math.floor(runTiles * 0.6));
      if (pick === 'flyer') addCreature(pick, at, groundTop - tile * 2.2, 'fly');
      else if (pick === 'guard') addCreature(pick, at, groundTop, 'idle');
      else addCreature(pick, at, groundTop, pick === 'jumper' ? 'hop' : pick === 'charger' ? 'charge' : 'patrol');
    }

    if (rand() < 0.30 && metres > 90) {
      const powers = ['shield', 'magnet', 'clock', 'heart'];
      const weights = [0.34, 0.28, 0.24, 0.14];
      let pick = powers[0];
      let roll2 = rand();
      for (let i = 0; i < powers.length; i += 1) {
        if (roll2 < weights[i]) { pick = powers[i]; break; }
        roll2 -= weights[i];
      }
      addPickup(pick, start + runTiles - 2, groundTop - tile * 0.6);
    }

    cursorTile = start + runTiles;

    const wantsGap = rand() < 0.34 + d * 0.24 && metres > 40;
    if (wantsGap) {
      const maxGap = Math.max(2, Math.min(4, Math.round(reachTiles * 0.6)));
      const gap = 1 + Math.floor(rand() * maxGap);
      addHazard('fire', cursorTile, gap, 2.2 * tile, {});
      if (rand() < 0.35 && gap >= 2) {
        addPlatform(cursorTile + Math.floor(gap / 2), 1, 3);
        if (rand() < 0.6) addPickup('coin', cursorTile + Math.floor(gap / 2), -4 * tile);
      }
      cursorTile += gap;
    }
  }

  function ensureAhead(worldX, metres) {
    while (cursorTile * tile < worldX + RUN.aheadPx) emitSection(metres);
  }

  function prune(worldX) {
    const cut = worldX - RUN.behindPx;
    while (solids.length && solids[0].x + solids[0].w < cut) solids.shift();
    while (hazards.length && hazards[0].x + hazards[0].w < cut) hazards.shift();
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      if (entities[i].x + RUN.tile < cut) entities.splice(i, 1);
    }
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      if (pickups[i].x + RUN.tile < cut) pickups.splice(i, 1);
    }
  }

  // The opening stretch is deliberately flat and empty: the first jump a player
  // makes should never be the one that kills them.
  addGround(0, 14);
  cursorTile = 14;

  return {
    solids,
    hazards,
    entities,
    pickups,
    ensureAhead,
    prune,
    get end() { return cursorTile * tile; },
  };
}
