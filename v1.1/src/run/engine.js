// DoodleRun — the run itself: physics, collisions, camera and the world drawn from the player's own scribbles.

import { RUN, EDITOR, MESH, COPY, SHELL } from '../config.js';
import { el, button } from '../ui/screens.css.js';
import { createMesh, markOccupancy, makeTexture, drawMesh } from '../rig/mesh.js';
import { poseAt, applyPose } from '../rig/motion.js';
import { createTrack, speedAt } from './track.js';
import { playSound } from '../audio/record.js';

const RIGGED = ['walker', 'flyer', 'jumper', 'charger', 'crawler', 'guard', 'coin', 'shield', 'hero'];

let bestScore = 0;

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
        });
        return;
      }
      sprites.set(slotId, buildSprite(asset));
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
    hero = {
      x: 3 * RUN.tile,
      y: -RUN.heroH,
      vy: 0,
      w: RUN.heroW,
      h: RUN.heroH,
      grounded: true,
      jumps: 0,
      sliding: false,
    };
    camera = 0;
    metres = 0;
    coins = 0;
    shield = false;
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

  function updateHud() {
    distNode.textContent = String(Math.floor(metres));
    coinNode.textContent = String(coins);
    scoreNode.textContent = String(score());
    shieldNode.hidden = !shield;
  }

  function play(slotId) {
    const sprite = sprites.get(slotId) || statics.get(slotId);
    if (sprite && sprite.sound) playSound(sprite.sound);
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
    overWhy.textContent = cause;
    againBtn.hidden = multiplayer && !canRestart;
    overWait.hidden = !(multiplayer && !canRestart);
    if (multiplayer) againBtn.textContent = COPY.run.hostRestart;
  }

  function takeHit(cause) {
    if (dead) return;
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
    } else if (entity.mode === 'charge') {
      const gap = entity.x - (hero.x + hero.w);
      if (!entity.charging && gap < RUN.chargerRange && gap > -40) {
        entity.charging = true;
        play(entity.slotId);
      }
      entity.x -= (entity.charging ? RUN.chargerSpeed : 20) * dt;
    }
  }

  function step(dt) {
    const speed = speedAt(metres);
    clock += dt;

    if (jumpBuffer > 0) jumpBuffer -= dt * 1000;
    if (coyote > 0) coyote -= dt * 1000;
    if (shieldFlash > 0) shieldFlash -= dt * 1000;
    if (hitFlash > 0) hitFlash -= dt * 1000;

    hero.x += speed * dt;
    metres += (speed * dt) / RUN.tile * RUN.metresPerTile;

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
      if (landing) {
        hero.y = landing.y - hero.h;
        hero.vy = 0;
        if (!hero.grounded) play('ground');
        hero.grounded = true;
        hero.jumps = 0;
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

    if (hero.y > view.h * 0.9) {
      die(COPY.run.causePit);
      return;
    }

    track.ensureAhead(hero.x, metres);
    track.prune(hero.x);

    for (let i = 0; i < track.entities.length; i += 1) stepCreature(track.entities[i], dt);

    const box = { x: hero.x, y: hero.y, w: hero.w, h: hero.h };

    for (let i = 0; i < track.hazards.length; i += 1) {
      const hz = track.hazards[i];
      const shape = { x: hz.x + 6, y: hz.y + RUN.tile * 0.35, w: hz.w - 12, h: RUN.tile * 0.65 };
      if (overlap(box, shape)) {
        takeHit(COPY.run.causeSpikes);
        if (dead) return;
      }
    }

    for (let i = 0; i < track.entities.length; i += 1) {
      const en = track.entities[i];
      if (!en.alive) continue;
      const shape = { x: en.x + 16, y: en.y + 12, w: 64, h: 72 };
      if (overlap(box, shape)) {
        en.alive = false;
        play(en.slotId);
        takeHit(COPY.run.causeCreature);
        if (dead) return;
      }
    }

    for (let i = 0; i < track.pickups.length; i += 1) {
      const pk = track.pickups[i];
      if (pk.taken) continue;
      const shape = { x: pk.x - 26, y: pk.y - 8, w: 52, h: 60 };
      if (!overlap(box, shape)) continue;
      pk.taken = true;
      play(pk.slotId);
      if (pk.slotId === 'shield') {
        shield = true;
        shieldFlash = RUN.shieldFlashMs;
      } else {
        coins += 1;
      }
      updateHud();
    }

    camera = hero.x - view.heroX;
    updateHud();
    if (onTick) onTick(hero.x, hero.y, metres, hero.grounded ? 'run' : 'air');
  }

  function drawLayer(slotId, speedFactor, height, bottom) {
    const entry = statics.get(slotId);
    if (!entry) return;
    const tileW = entry.width * (height / entry.height);
    if (!(tileW > 1)) return;
    let offset = (camera * speedFactor) % tileW;
    if (offset < 0) offset += tileW;
    for (let x = -offset; x < view.w + tileW; x += tileW) {
      ctx.drawImage(entry.texture, x, bottom - height, tileW, height);
    }
  }

  function drawSky() {
    const entry = statics.get('sky');
    if (entry) {
      ctx.drawImage(entry.texture, 0, 0, view.w, view.groundY + RUN.tile);
    } else {
      ctx.fillStyle = SHELL.color.paper;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  function drawTiles(list, slotId) {
    const entry = statics.get(slotId);
    for (let i = 0; i < list.length; i += 1) {
      const s = list[i];
      const sx = Math.round(s.x - camera);
      if (sx > view.w || sx + s.w < 0) continue;
      const sy = view.groundY + s.y;
      for (let n = 0; n < s.tiles; n += 1) {
        const x = sx + n * RUN.tile;
        if (x > view.w || x + RUN.tile < 0) continue;
        if (entry) ctx.drawImage(entry.texture, x, sy, RUN.tile, RUN.tile);
        else {
          ctx.fillStyle = SHELL.color.edge;
          ctx.fillRect(x, sy, RUN.tile, RUN.tile);
        }
      }
      if (s.kind === 'ground') {
        const soilTop = sy + RUN.tile;
        if (soilTop < view.h) {
          ctx.fillStyle = SHELL.color.ink;
          ctx.fillRect(sx, soilTop, s.w, view.h - soilTop);
        }
      }
    }
  }

  function drawSprite(slotId, worldX, worldY, phase, flip, squash, behaviourOverride) {
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
    if (squash && squash !== 1) {
      ctx.translate(0, sprite.height * (1 - squash));
      ctx.scale(1, squash);
    }
    drawMesh(ctx, sprite.texture, sprite.mesh);
    ctx.restore();
  }

  function draw() {
    drawSky();
    drawLayer('far', 0.18, view.groundY * 0.55, view.groundY + RUN.tile * 0.4);
    drawLayer('near', 0.55, view.groundY * 0.34, view.groundY + RUN.tile * 0.2);

    drawTiles(track.solids.filter((s) => s.kind === 'ground'), 'ground');
    drawTiles(track.solids.filter((s) => s.kind === 'platform'), 'platform');
    drawTiles(track.hazards, 'spikes');

    for (let i = 0; i < track.pickups.length; i += 1) {
      const pk = track.pickups[i];
      if (pk.taken) continue;
      drawSprite(pk.slotId, pk.x - 32, pk.y - 32, pk.phase, false, 1);
    }

    for (let i = 0; i < track.entities.length; i += 1) {
      const en = track.entities[i];
      if (!en.alive) continue;
      drawSprite(en.slotId, en.x, en.y - 32, en.phase, true, 1);
    }

    Object.keys(peers).forEach((id) => {
      const peer = peers[id];
      if (!peer) return;
      const sprite = peerSprites.get(id);
      const px = Math.round(peer.x - camera);
      if (px > view.w + 96 || px < -96) return;
      const py = view.groundY + peer.y + RUN.heroH - 96;
      ctx.save();
      ctx.globalAlpha = 0.55;
      if (sprite) {
        const pose = poseAt(peer.s === 'air' ? 'jump' : 'walk', clock, 1);
        if (applyPose(sprite.mesh, sprite.rig, pose, sprite.sizeScale)) {
          ctx.translate(px, py);
          drawMesh(ctx, sprite.texture, sprite.mesh);
        }
      } else {
        ctx.fillStyle = SHELL.color.mid;
        ctx.fillRect(px, py + 20, 48, 76);
      }
      ctx.restore();
      const name = peerNames[id];
      if (name) {
        ctx.save();
        ctx.font = '700 11px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = SHELL.color.ink;
        ctx.globalAlpha = 0.7;
        ctx.fillText(name.toUpperCase(), px + 48, py + 6);
        ctx.restore();
      }
    });

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
    setPeers(next, names) {
      peers = next || {};
      if (names) peerNames = names;
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
