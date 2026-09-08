// DoodleRun — the run itself: physics, collisions, camera and the world drawn from the player's own scribbles.

import { RUN, EDITOR, MESH, COPY, SHELL } from '../config.js';
import { el, button } from '../ui/screens.css.js';
import { createMesh, markOccupancy, makeTexture, drawMesh } from '../rig/mesh.js';
import { poseAt, applyPose } from '../rig/motion.js';
import { createTrack, speedAt } from './track.js';
import { playSound } from '../audio/record.js';

const RIGGED = ['walker', 'flyer', 'jumper', 'charger', 'crawler', 'guard', 'coin', 'shield', 'hero',
  'saw', 'rock', 'chaser', 'magnet', 'clock', 'heart', 'gate', 'sparkle'];
const SOLID_ART = { ground: 'ground', platform: 'platform', lucky: 'luckyBlock', trampoline: 'trampoline', mover: 'mover', conveyor: 'conveyor' };
const HAZARD_ART = { spikes: 'spikes', saw: 'saw', rock: 'rock', fire: 'fire' };

let bestScore = 0;

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// A drawing is not its canvas. Spikes are a shape with air between the points,
// so the hitbox has to follow the ink rather than the square it was drawn in.
export function buildMask(imageData) {
  const { width, height, data } = imageData;
  const bits = new Uint8Array(width * height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= EDITOR.alphaThreshold) continue;
      bits[y * width + x] = 1;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  const empty = x1 < 0;
  return {
    width,
    height,
    bits,
    box: empty ? { x: 0, y: 0, w: width, h: height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
  };
}

export function stompOutcome(feet, vy, shape) {
  if (vy <= 0) return 'hit';
  return feet - shape.y <= shape.h * 0.55 ? 'stomp' : 'hit';
}

// Rising into a block is a bump on the head, never a death. Clipping the top
// corner on the way down puts you on the block, which is what a player expects
// when they only just cleared it. Everything else is running into a wall.
export function blockOutcome(box, vy, solid) {
  if (vy < 0) return 'bonk';
  const feet = box.y + box.h;
  if (feet - solid.y <= 16) return 'step';
  return 'crash';
}

export function maskHit(mask, box, originX, originY, scale) {
  const step = 2;
  const left = Math.max(0, Math.floor((box.x - originX) / scale));
  const right = Math.min(mask.width - 1, Math.ceil((box.x + box.w - originX) / scale));
  const top = Math.max(0, Math.floor((box.y - originY) / scale));
  const bottom = Math.min(mask.height - 1, Math.ceil((box.y + box.h - originY) / scale));
  for (let y = top; y <= bottom; y += step) {
    for (let x = left; x <= right; x += step) {
      if (mask.bits[y * mask.width + x]) return true;
    }
  }
  return false;
}

export function getBest() {
  return bestScore;
}

export function createRun(options) {
  const assets = options.assets;
  const onExit = options.onExit || (() => {});
  const onDeath = options.onDeath || null;
  const onTick = options.onTick || null;
  const onRestartRequest = options.onRestartRequest || null;
  const multiplayer = !!options.multiplayer;
  const canRestart = options.canRestart !== false;
  const seed = options.seed || 1;

  const root = el('section', 'dr-screen dr-run');
  root.setAttribute('aria-label', COPY.run.title);
  const canvas = el('canvas', 'dr-run-canvas', root);
  const ctx = canvas.getContext('2d', { alpha: false });

  const hud = el('div', 'dr-hud', root);
  const hudLeft = el('div', 'dr-hud-group', hud);
  el('span', 'dr-hud-label', hudLeft, COPY.run.distance);
  const distNode = el('strong', 'dr-hud-value', hudLeft, '0');
  const hudMid = el('div', 'dr-hud-group', hud);
  el('span', 'dr-hud-label', hudMid, COPY.run.coins);
  const coinNode = el('strong', 'dr-hud-value', hudMid, '0');
  const hudRight = el('div', 'dr-hud-group', hud);
  el('span', 'dr-hud-label', hudRight, COPY.run.score);
  const scoreNode = el('strong', 'dr-hud-value', hudRight, '0');
  const peerBox = el('div', 'dr-hud-peers', hud);
  peerBox.hidden = true;
  const shieldNode = el('div', 'dr-hud-shield', hud, COPY.run.shielded);
  shieldNode.hidden = true;
  const hint = el('div', 'dr-run-hint', root, COPY.run.hint);

  const over = el('div', 'dr-run-over', root);
  over.hidden = true;
  const overCard = el('div', 'dr-run-card', over);
  el('h2', 'dr-run-title', overCard, COPY.run.dead);
  const overWhy = el('p', 'dr-run-why', overCard, '');
  const overStats = el('dl', 'dr-run-stats', overCard);
  function stat(label) {
    const wrap = el('div', 'dr-run-stat', overStats);
    el('dt', null, wrap, label);
    return el('dd', null, wrap, '0');
  }
  const statDist = stat(COPY.run.distance);
  const statCoins = stat(COPY.run.coins);
  const statScore = stat(COPY.run.score);
  const statBest = stat(COPY.run.best);
  const overActs = el('div', 'dr-run-acts', overCard);
  const againBtn = button(COPY.run.again, 'is-primary', overActs, () => {
    if (multiplayer && onRestartRequest) onRestartRequest();
    else restart();
  });
  button(COPY.run.leave, '', overActs, () => onExit());
  const overWait = el('p', 'dr-run-wait', overCard, COPY.run.waitingHost);
  overWait.hidden = true;

  const sprites = new Map();
  const statics = new Map();
  const peerSprites = new Map();
  let peers = {};
  let peerNames = {};
  let cols = MESH.cols;
  let rows = MESH.rows;
  let fellBack = false;

  let track = null;
  let hero = null;
  let camera = 0;
  let metres = 0;
  let coins = 0;
  let shield = false;
  let shieldFlash = 0;
  let hitFlash = 0;
  let dead = false;
  let deadAt = 0;
  let deathCause = '';
  let started = false;
  let frame = 0;
  let last = 0;
  let clock = 0;
  let acc = 0;
  let view = null;
  let jumpBuffer = 0;
  let coyote = 0;
  let slideLeft = 0;
  let disposed = false;
  let fpsValue = 0;
  let fpsFrames = 0;
  let fpsTime = 0;
  let magnetLeft = 0;
  let clockLeft = 0;
  let hasHeart = false;
  let checkpointX = 0;
  let checkpointMetres = 0;
  let nextGate = RUN.gateEvery;
  const gates = [];
  const sparkles = [];
  let chaser = null;
  let slowFor = 0;
  let fastFor = 0;

  function buildSprite(asset) {
    const mesh = createMesh(asset.width, asset.height, cols, rows);
    markOccupancy(mesh, asset.bitmap, EDITOR.alphaThreshold);
    return {
      width: asset.width,
      height: asset.height,
      bitmap: asset.bitmap,
      texture: makeTexture(asset.bitmap),
      mesh,
      rig: asset.rig,
      tempo: Number.isFinite(asset.tempo) ? asset.tempo : 1,
      sizeScale: Math.max(asset.width, asset.height) / 96,
      sound: asset.sound || null,
    };
  }

  function loadAssets() {
    sprites.clear();
    statics.clear();
    if (!assets || typeof assets.forEach !== 'function') return;
    assets.forEach((asset, slotId) => {
      if (!asset || !asset.bitmap) return;
      if (RIGGED.indexOf(slotId) === -1) {
        statics.set(slotId, {
          texture: makeTexture(asset.bitmap),
          width: asset.width,
          height: asset.height,
          sound: asset.sound || null,
          mask: buildMask(asset.bitmap),
        });
        return;
      }
      const sprite = buildSprite(asset);
      sprite.mask = buildMask(asset.bitmap);
      sprites.set(slotId, sprite);
    });
  }

  function dropToFallback() {
    fellBack = true;
    cols = MESH.fallbackCols;
    rows = MESH.fallbackRows;
    sprites.forEach((sprite) => {
      const mesh = createMesh(sprite.width, sprite.height, cols, rows);
      markOccupancy(mesh, sprite.bitmap, EDITOR.alphaThreshold);
      sprite.mesh = mesh;
    });
  }

  function layout() {
    const w = Math.max(320, Math.floor(root.clientWidth || window.innerWidth));
    const h = Math.max(240, Math.floor(root.clientHeight || window.innerHeight));
    canvas.width = w;
    canvas.height = h;
    view = { w, h, groundY: Math.round(h * RUN.groundLine), heroX: Math.round(w * RUN.camX) };
  }

  function reset() {
    track = createTrack(seed);
    if (checkpointX > 0) track.ensureAhead(checkpointX, checkpointMetres);
    hero = {
      x: checkpointX > 0 ? checkpointX : 3 * RUN.tile,
      y: -RUN.heroH,
      vy: 0,
      w: RUN.heroW,
      h: RUN.heroH,
      grounded: true,
      jumps: 0,
      sliding: false,
    };
    camera = 0;
    metres = checkpointMetres;
    coins = 0;
    shield = false;
    magnetLeft = 0;
    clockLeft = 0;
    hasHeart = false;
    slowFor = 0;
    fastFor = 0;
    chaser = null;
    sparkles.length = 0;
    gates.length = 0;
    nextGate = Math.ceil((checkpointMetres + 1) / RUN.gateEvery) * RUN.gateEvery;
    shieldFlash = 0;
    hitFlash = 0;
    slideLeft = 0;
    jumpBuffer = 0;
    coyote = 0;
    dead = false;
    deadAt = 0;
    deathCause = '';
    clock = 0;
    acc = 0;
    over.hidden = true;
    hint.hidden = false;
    updateHud();
    track.ensureAhead(hero.x, 0);
  }

  function restart() {
    reset();
    started = true;
    last = 0;
    if (frame === 0) frame = requestAnimationFrame(tick);
  }

  function score() {
    return Math.floor(metres) + coins * RUN.coinValue;
  }

  function openLucky(block) {
    block.used = true;
    play('luckyBlock');
    if (Math.random() < 0.62) {
      const n = 1 + Math.floor(Math.random() * RUN.luckyCoins);
      for (let i = 0; i < n; i += 1) {
        coins += 1;
        spark(block.x + block.w / 2 + (i - n / 2) * 18, block.y - 24);
      }
    } else {
      const powers = ['shield', 'magnet', 'clock', 'heart'];
      grantPower(powers[Math.floor(Math.random() * powers.length)]);
      spark(block.x + block.w / 2, block.y - 24);
    }
    updateHud();
  }

  function grantPower(slotId) {
    if (slotId === 'shield') {
      shield = true;
      shieldFlash = RUN.shieldFlashMs;
    } else if (slotId === 'magnet') {
      magnetLeft = RUN.magnetMs;
    } else if (slotId === 'clock') {
      clockLeft = RUN.clockMs;
    } else if (slotId === 'heart') {
      hasHeart = true;
    }
  }

  function gateX(gateMetres) {
    return RUN.tile * 3 + (gateMetres / RUN.metresPerTile) * RUN.tile;
  }

  function spark(x, y) {
    sparkles.push({ x, y, left: RUN.sparkleMs });
  }

  function solidArt(kind) {
    return SOLID_ART[kind] || 'ground';
  }

  function updateHud() {
    distNode.textContent = String(Math.floor(metres));
    coinNode.textContent = String(coins);
    scoreNode.textContent = String(score());
    const badges = [];
    if (shield) badges.push(COPY.run.shielded);
    if (hasHeart) badges.push(COPY.run.hearted);
    if (magnetLeft > 0) badges.push(COPY.run.magneted);
    if (clockLeft > 0) badges.push(COPY.run.slowed);
    shieldNode.hidden = badges.length === 0;
    shieldNode.textContent = badges.join(' · ');
  }

  function play(slotId) {
    const sprite = sprites.get(slotId) || statics.get(slotId);
    if (sprite && sprite.sound) playSound(sprite.sound);
  }

  function hazardBox(hz) {
    if (hz.kind === 'saw') return { x: hz.x + (hz.offset || 0) + 8, y: hz.y + 10, w: RUN.tile - 16, h: RUN.tile - 16 };
    if (hz.kind === 'rock') return { x: hz.x + 10, y: hz.y + 10, w: hz.w - 20, h: RUN.tile - 14 };
    if (hz.kind === 'fire') return { x: hz.x, y: hz.y, w: hz.w, h: RUN.tile * 2 };
    return hz;
  }

  function creatureBox(entity) {
    const sprite = sprites.get(entity.slotId);
    if (!sprite || !sprite.mask) return { x: entity.x + 16, y: entity.y + 12, w: 64, h: 72 };
    const b = sprite.mask.box;
    const inset = 0.12;
    return {
      x: entity.x + b.x + b.w * inset,
      y: entity.y - 32 + b.y + b.h * inset,
      w: b.w * (1 - inset * 2),
      h: b.h * (1 - inset * 2),
    };
  }

  function solidUnder(box, fromFeet, toFeet) {
    let best = null;
    for (let i = 0; i < track.solids.length; i += 1) {
      const s = track.solids[i];
      if (s.x > box.x + box.w || s.x + s.w < box.x) continue;
      if (fromFeet <= s.y && toFeet >= s.y) {
        if (!best || s.y < best.y) best = s;
      }
    }
    return best;
  }

  function standingOn(box) {
    const feet = box.y + box.h;
    for (let i = 0; i < track.solids.length; i += 1) {
      const s = track.solids[i];
      if (s.x > box.x + box.w || s.x + s.w < box.x) continue;
      if (Math.abs(feet - s.y) < 2) return s;
    }
    return null;
  }

  function die(cause, remote) {
    if (dead) return;
    dead = true;
    deadAt = clock;
    deathCause = cause;
    if (!remote && multiplayer && onDeath) onDeath(cause, metres);
    play('hero');
    hint.hidden = true;
    if (score() > bestScore) bestScore = score();
    statDist.textContent = String(Math.floor(metres));
    statCoins.textContent = String(coins);
    statScore.textContent = String(score());
    statBest.textContent = String(bestScore);
    overWhy.textContent = checkpointMetres > 0
      ? `${cause} ${COPY.run.fromCheckpoint(checkpointMetres)}`
      : cause;
    againBtn.hidden = multiplayer && !canRestart;
    overWait.hidden = !(multiplayer && !canRestart);
    if (multiplayer) againBtn.textContent = COPY.run.hostRestart;
  }

  function takeHit(cause) {
    if (dead) return;
    if (hasHeart) {
      hasHeart = false;
      hitFlash = RUN.hitFlashMs * 3;
      shieldFlash = RUN.shieldFlashMs;
      hero.vy = -RUN.jumpV * 0.5;
      updateHud();
      return;
    }
    if (shield) {
      shield = false;
      shieldFlash = RUN.shieldFlashMs;
      hitFlash = RUN.hitFlashMs;
      updateHud();
      return;
    }
    die(cause);
  }

  function stepCreature(entity, dt) {
    const groundTop = -RUN.tile;
    if (entity.mode === 'patrol') {
      entity.x -= RUN.walkerSpeed * dt;
    } else if (entity.mode === 'fly') {
      entity.x -= RUN.flyerSpeed * dt;
      entity.y = groundTop - RUN.tile * (2.0 + Math.sin(clock * 2 + entity.phase) * 0.55);
    } else if (entity.mode === 'hop') {
      entity.x -= RUN.jumperSpeed * dt;
      const bounce = Math.abs(Math.sin(clock * 2.4 + entity.phase));
      entity.y = groundTop - bounce * RUN.tile * 1.1;
    } else if (entity.mode === 'ceiling') {
      entity.x -= RUN.crawlerSpeed * dt;
    } else if (entity.mode === 'charge') {
      const gap = entity.x - (hero.x + hero.w);
      if (!entity.charging && gap < RUN.chargerRange && gap > -40) {
        entity.charging = true;
        play(entity.slotId);
      }
      entity.x -= (entity.charging ? RUN.chargerSpeed : 20) * dt;
    }
  }

  function stepWorld(dt) {
    for (let i = 0; i < track.solids.length; i += 1) {
      const s = track.solids[i];
      if (s.kind !== 'mover') continue;
      const before = s.y;
      s.y = s.homeY + Math.sin(clock * s.speed + s.phase) * s.range;
      s.drift = s.y - before;
    }
    for (let i = 0; i < track.hazards.length; i += 1) {
      const hz = track.hazards[i];
      if (hz.kind === 'saw') {
        const t = clock * (RUN.sawRangeSpeed / Math.max(1, hz.range)) + hz.phase;
        hz.offset = (Math.sin(t) * 0.5 + 0.5) * hz.range;
      } else if (hz.kind === 'rock') {
        if (hz.state === 'hang') {
          if (Math.abs((hero.x + hero.w / 2) - (hz.x + hz.w / 2)) < RUN.rockTriggerPx) hz.state = 'falling';
        } else if (hz.state === 'falling') {
          hz.vy += RUN.rockGravity * dt;
          hz.y += hz.vy * dt;
          if (hz.y > 0) hz.state = 'gone';
        }
      }
    }
    for (let i = sparkles.length - 1; i >= 0; i -= 1) {
      sparkles[i].left -= dt * 1000;
      if (sparkles[i].left <= 0) sparkles.splice(i, 1);
    }
  }

  // The chaser is the answer to standing still: it wakes when the runner is
  // moving well below the pace the track expects, and gives up once it is not.
  function stepChaser(dt, speed, nominal) {
    const slow = speed < nominal * RUN.chaserWakeRatio;
    if (slow) {
      slowFor += dt * 1000;
      fastFor = 0;
    } else {
      fastFor += dt * 1000;
      slowFor = 0;
    }
    if (!chaser && slowFor > RUN.chaserWakeMs) {
      chaser = { x: hero.x - RUN.chaserStartGap, y: -RUN.tile * 1.6, phase: 0 };
      play('chaser');
    }
    if (!chaser) return;
    chaser.x += nominal * RUN.chaserSpeed * dt;
    chaser.y = -RUN.tile * (1.4 + Math.sin(clock * 3) * 0.3);
    if (fastFor > RUN.chaserCalmMs && chaser.x < hero.x - RUN.chaserStartGap * 0.7) chaser = null;
    else if (chaser && chaser.x + 64 > hero.x && chaser.x < hero.x + hero.w) takeHit(COPY.run.causeChaser);
  }

  function step(dt) {
    const nominal = speedAt(metres);
    let speed = nominal;
    if (clockLeft > 0) speed *= RUN.clockScale;
    clock += dt;

    if (jumpBuffer > 0) jumpBuffer -= dt * 1000;
    if (coyote > 0) coyote -= dt * 1000;
    if (shieldFlash > 0) shieldFlash -= dt * 1000;
    if (hitFlash > 0) hitFlash -= dt * 1000;

    const floor = standingOn(hero);
    if (floor && floor.kind === 'conveyor') speed *= floor.dir > 0 ? RUN.conveyorFast : RUN.conveyorSlow;
    if (magnetLeft > 0) magnetLeft -= dt * 1000;
    if (clockLeft > 0) clockLeft -= dt * 1000;
    stepWorld(dt);
    hero.x += speed * dt;
    metres = ((hero.x - RUN.tile * 3) / RUN.tile) * RUN.metresPerTile;
    if (metres < 0) metres = 0;

    if (slideLeft > 0) {
      slideLeft -= dt * 1000;
      if (slideLeft <= 0 && hero.sliding) {
        hero.sliding = false;
        hero.y -= RUN.heroH - RUN.slideH;
        hero.h = RUN.heroH;
      }
    }

    const canJump = hero.grounded || coyote > 0 || hero.jumps < 2;
    if (jumpBuffer > 0 && canJump) {
      if (hero.grounded || coyote > 0) {
        hero.vy = -RUN.jumpV;
        hero.jumps = 1;
      } else {
        hero.vy = -RUN.doubleJumpV;
        hero.jumps = 2;
      }
      hero.grounded = false;
      coyote = 0;
      jumpBuffer = 0;
    }

    const feetBefore = hero.y + hero.h;
    hero.vy += RUN.gravity * dt;
    hero.y += hero.vy * dt;
    const feetAfter = hero.y + hero.h;

    if (hero.vy >= 0) {
      const landing = solidUnder(hero, feetBefore, feetAfter);
      if (landing && landing.kind === 'trampoline') {
        hero.y = landing.y - hero.h;
        hero.vy = -RUN.trampolineV;
        hero.grounded = false;
        hero.jumps = 1;
        play('trampoline');
      } else if (landing) {
        hero.y = landing.y - hero.h;
        hero.vy = 0;
        hero.grounded = true;
        hero.jumps = 0;
        if (landing.kind === 'mover' && landing.drift) hero.y += landing.drift;
      } else {
        if (hero.grounded) coyote = RUN.coyoteMs;
        hero.grounded = false;
      }
    } else {
      hero.grounded = false;
    }

    if (hero.grounded && !standingOn(hero)) {
      hero.grounded = false;
      coyote = RUN.coyoteMs;
    }

    // A block is a block from every side: you bonk your head on the underside
    // and you cannot run through the edge of one.
    for (let i = 0; i < track.solids.length; i += 1) {
      const s = track.solids[i];
      const box = { x: hero.x, y: hero.y, w: hero.w, h: hero.h };
      if (!overlap(box, s)) continue;
      const outcome = blockOutcome(box, hero.vy, s);
      if (outcome === 'bonk') {
        hero.y = s.y + s.h;
        hero.vy = 0;
        if (s.kind === 'lucky' && !s.used) openLucky(s);
      } else if (outcome === 'step') {
        hero.y = s.y - hero.h;
        hero.vy = 0;
        hero.grounded = true;
        hero.jumps = 0;
      } else {
        die(COPY.run.causeBlock);
        return;
      }
    }

    if (hero.y > view.h * 0.9) {
      die(COPY.run.causePit);
      return;
    }

    stepChaser(dt, speed, nominal);

    while (metres >= nextGate) {
      const at = gateX(nextGate);
      gates.push({ x: at, metres: nextGate });
      checkpointX = at;
      checkpointMetres = nextGate;
      play('gate');
      nextGate += RUN.gateEvery;
    }

    track.ensureAhead(hero.x, metres);
    track.prune(hero.x);

    for (let i = 0; i < track.entities.length; i += 1) stepCreature(track.entities[i], dt);

    const box = { x: hero.x, y: hero.y, w: hero.w, h: hero.h };

    for (let i = 0; i < track.hazards.length; i += 1) {
      const hz = track.hazards[i];
      if (hz.kind === 'rock' && hz.state === 'gone') continue;
      const shape = hazardBox(hz);
      if (!overlap(box, shape)) continue;
      if (hz.kind === 'spikes') {
        const art = statics.get('spikes');
        let touched = !art || !art.mask;
        if (art && art.mask) {
          const scale = RUN.tile / art.mask.width;
          for (let n = 0; n < hz.tiles && !touched; n += 1) {
            touched = maskHit(art.mask, box, hz.x + n * RUN.tile, hz.y, scale);
          }
        }
        if (!touched) continue;
        takeHit(COPY.run.causeSpikes);
      } else if (hz.kind === 'saw') {
        takeHit(COPY.run.causeSaw);
      } else if (hz.kind === 'rock') {
        takeHit(COPY.run.causeRock);
      } else {
        takeHit(COPY.run.causeFire);
      }
      if (dead) return;
    }

    for (let i = 0; i < track.entities.length; i += 1) {
      const en = track.entities[i];
      if (!en.alive) continue;
      const shape = creatureBox(en);
      if (!overlap(box, shape)) continue;
      // Landing on top of one squashes it; walking into it is what hurts.
      const feet = hero.y + hero.h;
      if (stompOutcome(feet, hero.vy, shape) === 'stomp') {
        en.alive = false;
        en.squashedAt = clock;
        play(en.slotId);
        hero.vy = -RUN.jumpV * 0.62;
        hero.jumps = 1;
        hero.grounded = false;
        continue;
      }
      play(en.slotId);
      takeHit(COPY.run.causeCreature);
      if (dead) return;
    }

    if (magnetLeft > 0) {
      const cx = hero.x + hero.w / 2;
      const cy = hero.y + hero.h / 2;
      for (let i = 0; i < track.pickups.length; i += 1) {
        const pk = track.pickups[i];
        if (pk.taken || pk.slotId !== 'coin') continue;
        const dx = cx - pk.x;
        const dy = cy - pk.y;
        const dist = Math.hypot(dx, dy);
        if (dist > RUN.magnetRange || dist < 1) continue;
        pk.x += (dx / dist) * RUN.magnetPull * dt;
        pk.y += (dy / dist) * RUN.magnetPull * dt;
      }
    }

    for (let i = 0; i < track.pickups.length; i += 1) {
      const pk = track.pickups[i];
      if (pk.taken) continue;
      const shape = { x: pk.x - 26, y: pk.y - 8, w: 52, h: 60 };
      if (!overlap(box, shape)) continue;
      pk.taken = true;
      play(pk.slotId);
      if (pk.slotId === 'coin') {
        coins += 1;
        spark(pk.x, pk.y);
      } else {
        grantPower(pk.slotId);
      }
      updateHud();
    }

    camera = hero.x - view.heroX;
    updateHud();
    if (onTick) onTick(hero.x, hero.y, metres, hero.grounded ? 'run' : 'air');
  }

  function drawSky() {
    ctx.fillStyle = SHELL.color.paper;
    ctx.fillRect(0, 0, view.w, view.h);
    const entry = statics.get('sky');
    if (entry) ctx.drawImage(entry.texture, 0, 0, view.w, view.h);
  }

  function drawTileRow(item, slotId, alpha) {
    const entry = statics.get(slotId);
    const sx = Math.round(item.x - camera);
    if (sx > view.w || sx + item.w < 0) return;
    const sy = view.groundY + item.y;
    if (alpha && alpha !== 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
    }
    for (let n = 0; n < item.tiles; n += 1) {
      const x = sx + n * RUN.tile;
      if (x > view.w || x + RUN.tile < 0) continue;
      if (entry) ctx.drawImage(entry.texture, x, sy, RUN.tile, RUN.tile);
      else {
        ctx.fillStyle = SHELL.color.edge;
        ctx.fillRect(x, sy, RUN.tile, RUN.tile);
      }
    }
    if (alpha && alpha !== 1) ctx.restore();
    if (item.kind === 'ground' || item.kind === 'conveyor' || item.kind === 'trampoline') {
      const soilTop = sy + RUN.tile;
      if (soilTop < view.h) {
        ctx.fillStyle = SHELL.color.ink;
        ctx.fillRect(sx, soilTop, item.w, view.h - soilTop);
      }
    }
  }

  function drawSolids() {
    for (let i = 0; i < track.solids.length; i += 1) {
      const item = track.solids[i];
      drawTileRow(item, solidArt(item.kind), item.kind === 'lucky' && item.used ? 0.4 : 1);
    }
  }

  function drawHazards() {
    for (let i = 0; i < track.hazards.length; i += 1) {
      const hz = track.hazards[i];
      if (hz.kind === 'rock' && hz.state === 'gone') continue;
      if (hz.kind === 'saw') {
        drawSprite('saw', hz.x + (hz.offset || 0), hz.y - 16, hz.phase, false, 1);
        continue;
      }
      if (hz.kind === 'rock') {
        drawSprite('rock', hz.x, hz.y - 16, 0, false, 1);
        continue;
      }
      drawTileRow(hz, HAZARD_ART[hz.kind] || 'spikes', 1);
    }
  }

  function drawSprite(slotId, worldX, worldY, phase, flip, squash, behaviourOverride, flipY) {
    const sprite = sprites.get(slotId);
    const sx = Math.round(worldX - camera);
    if (sx > view.w + 96 || sx + 96 < -96) return;
    const sy = view.groundY + worldY;
    if (!sprite) {
      ctx.fillStyle = SHELL.color.mid;
      ctx.fillRect(sx, sy, 64, 64);
      return;
    }
    const behaviour = behaviourOverride
      || (sprite.rig && sprite.rig.behaviour ? sprite.rig.behaviour : 'idle');
    const pose = poseAt(behaviour, clock + phase, sprite.tempo);
    const visible = applyPose(sprite.mesh, sprite.rig, pose, sprite.sizeScale);
    if (!visible) return;
    ctx.save();
    ctx.translate(sx, sy);
    if (flip) {
      ctx.translate(sprite.width, 0);
      ctx.scale(-1, 1);
    }
    if (flipY) {
      ctx.translate(0, sprite.height);
      ctx.scale(1, -1);
    }
    if (squash && squash !== 1) {
      ctx.translate(0, sprite.height * (1 - squash));
      ctx.scale(1, squash);
    }
    drawMesh(ctx, sprite.texture, sprite.mesh);
    ctx.restore();
  }

  function draw() {
    drawSky();

    drawSolids();
    drawHazards();

    for (let i = 0; i < gates.length; i += 1) {
      const gate = gates[i];
      drawSprite('gate', gate.x - 48, -RUN.tile * 2.6, 0, false, 1);
    }

    for (let i = 0; i < track.pickups.length; i += 1) {
      const pk = track.pickups[i];
      if (pk.taken) continue;
      drawSprite(pk.slotId, pk.x - 32, pk.y - 32, pk.phase, false, 1);
    }

    for (let i = 0; i < track.entities.length; i += 1) {
      const en = track.entities[i];
      if (!en.alive) continue;
      drawSprite(en.slotId, en.x, en.y - 32, en.phase, true, 1, undefined, en.mode === 'ceiling');
    }

    Object.keys(peers).forEach((id) => {
      const peer = peers[id];
      if (!peer) return;
      const sprite = peerSprites.get(id);
      const px = Math.round(peer.x - camera);
      if (px > view.w + 96 || px < -96) return;
      const py = view.groundY + peer.y + RUN.heroH - 96;
      ctx.save();
      if (sprite) {
        const pose = poseAt(peer.s === 'air' ? 'jump' : 'walk', clock, 1);
        if (applyPose(sprite.mesh, sprite.rig, pose, sprite.sizeScale)) {
          ctx.translate(px, py);
          drawMesh(ctx, sprite.texture, sprite.mesh);
        }
      } else {
        ctx.fillStyle = SHELL.color.ink;
        ctx.fillRect(px + 24, py + 20, 48, 76);
      }
      ctx.restore();
      const name = (peerNames[id] || '').toUpperCase();
      if (name) {
        ctx.save();
        ctx.font = '900 12px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        const w = ctx.measureText(name).width + 14;
        ctx.fillStyle = SHELL.color.sun;
        ctx.fillRect(px + 48 - w / 2, py - 22, w, 20);
        ctx.strokeStyle = SHELL.color.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 48 - w / 2, py - 22, w, 20);
        ctx.fillStyle = SHELL.color.ink;
        ctx.fillText(name, px + 48, py - 7);
        ctx.restore();
      }
    });

    for (let i = 0; i < sparkles.length; i += 1) {
      const sp = sparkles[i];
      const life = sp.left / RUN.sparkleMs;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, life));
      drawSprite('sparkle', sp.x - 32, sp.y - 32, 1 - life, false, 0.6 + life * 0.6);
      ctx.restore();
    }

    if (chaser) drawSprite('chaser', chaser.x, chaser.y - 32, 0, true, 1);

    const heroSprite = sprites.get('hero');
    const heroW = heroSprite ? heroSprite.width : 96;
    const drawX = hero.x - (heroW - hero.w) / 2;
    const squash = hero.sliding ? 0.55 : 1;
    if (hitFlash <= 0 || Math.floor(clock * 30) % 2 === 0) {
      drawSprite('hero', drawX, hero.y + hero.h - 96, 0, false, squash, hero.grounded ? 'walk' : 'jump');
    }

    if (shield) {
      const sx = Math.round(hero.x - camera + hero.w / 2);
      const sy = view.groundY + hero.y + hero.h / 2;
      ctx.save();
      ctx.strokeStyle = SHELL.color.done;
      ctx.lineWidth = 4;
      ctx.globalAlpha = shieldFlash > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(clock * 14)) : 0.85;
      ctx.beginPath();
      ctx.arc(sx, sy, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = SHELL.color.ink;
    ctx.fillRect(0, view.h - 4, view.w, 4);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (disposed) return;
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.08) dt = 0.08;

    fpsFrames += 1;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      fpsValue = fpsFrames / fpsTime;
      fpsFrames = 0;
      fpsTime = 0;
      if (!fellBack && fpsValue > 0 && fpsValue < MESH.minFps && document.visibilityState === 'visible') dropToFallback();
    }

    if (!dead && started) {
      acc += dt;
      const fixed = 1 / 120;
      let guard = 0;
      while (acc >= fixed && guard < 8) {
        step(fixed);
        acc -= fixed;
        guard += 1;
        if (dead) break;
      }
    } else if (dead) {
      clock += dt;
      if (over.hidden && clock - deadAt > RUN.deathHoldMs / 1000) {
        over.hidden = false;
        againBtn.focus();
      }
    }

    draw();
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const code = event.code;
    if (code === 'Escape') {
      event.preventDefault();
      onExit();
      return;
    }
    if (code === 'KeyR') {
      event.preventDefault();
      restart();
      return;
    }
    if (dead) {
      if (code === 'Space' || code === 'Enter') {
        event.preventDefault();
        restart();
      }
      return;
    }
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
      event.preventDefault();
      jumpBuffer = RUN.bufferMs;
      hint.hidden = true;
      return;
    }
    if (code === 'ArrowDown' || code === 'KeyS') {
      event.preventDefault();
      if (!hero.sliding && hero.grounded) {
        hero.sliding = true;
        hero.y += RUN.heroH - RUN.slideH;
        hero.h = RUN.slideH;
        slideLeft = RUN.slideMs;
      }
    }
  }

  function onKeyUp(event) {
    if (event.code !== 'ArrowDown' && event.code !== 'KeyS') return;
    if (hero && hero.sliding && slideLeft > 120) slideLeft = 120;
  }

  function onResize() {
    layout();
  }

  loadAssets();
  layout();
  reset();

  return {
    root,
    show() {
      document.body.appendChild(root);
      void root.offsetHeight;
      root.classList.add('is-on');
      layout();
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('resize', onResize);
      started = true;
      last = 0;
      if (frame === 0) frame = requestAnimationFrame(tick);
      return new Promise((resolve) => window.setTimeout(resolve, 200));
    },
    hide() {
      root.classList.remove('is-on');
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      started = false;
      return new Promise((resolve) => window.setTimeout(resolve, 200));
    },
    dispose() {
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      if (root.isConnected) root.remove();
    },
    // Steps the simulation without drawing, so a run can be advanced
    // deterministically — used for checks now and for replays later.
    advance(seconds) {
      const fixed = 1 / 120;
      let left = seconds;
      while (left > 0 && !dead) {
        step(Math.min(fixed, left));
        left -= fixed;
      }
      return { metres, coins, dead, cause: deathCause };
    },
    // In a room the checkpoint belongs to the room, not to whoever ran furthest.
    setCheckpoint(gateMetres) {
      const value = Number(gateMetres) || 0;
      checkpointMetres = value;
      checkpointX = value > 0 ? gateX(value) : 0;
    },
    get checkpoint() {
      return checkpointMetres;
    },
    setPeers(next, names) {
      peers = next || {};
      if (names) peerNames = names;
      const ids = Object.keys(peers);
      peerBox.hidden = ids.length === 0;
      peerBox.textContent = '';
      ids.forEach((id) => {
        const row = el('div', 'dr-hud-peer', peerBox);
        el('span', 'dr-hud-peer-name', row, (peerNames[id] || '…').toUpperCase());
        el('strong', 'dr-hud-peer-m', row, String(Math.round(peers[id].m || 0)));
      });
    },
    setPeerHero(playerId, asset) {
      if (!asset || !asset.bitmap) return;
      peerSprites.set(playerId, buildSprite(asset));
    },
    dropPeer(playerId) {
      peerSprites.delete(playerId);
      delete peers[playerId];
    },
    // Somebody else died: the run ends for everyone, which is the point.
    remoteDeath(info) {
      if (dead) return;
      die(COPY.run.killedBy(info.nick || '…', info.cause || ''), true);
      overWhy.textContent = `${COPY.run.killedBy(info.nick || '…', info.cause || '')} ${COPY.run.everyoneBack}`;
    },
    restart,
    get state() {
      return { metres, coins, score: score(), dead, shield, fps: fpsValue, mesh: cols };
    },
  };
}
