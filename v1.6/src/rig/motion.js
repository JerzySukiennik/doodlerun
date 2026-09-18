// DoodleRun — motion tables per behaviour and the generic pose evaluator.

import { ROLES, ROLE_RADIUS } from './roles.js';
import { resetMesh, pullPoint, translateAll, scaleXAbout } from './mesh.js';

const PI = Math.PI;

export const WAVES = {
  sin: (theta) => Math.sin(theta),
  cos: (theta) => Math.cos(theta),
  pos: (theta) => Math.max(0, Math.sin(theta)),
  bob: (theta) => 1 - Math.cos(2 * theta),
  one: () => 1,
};

export const MOTION = {
  walk: {
    legL: { period: 0.6, phase: 0, dx: [6, 'sin'], dy: [-3, 'pos'] },
    legR: { period: 0.6, phase: PI, dx: [6, 'sin'], dy: [-3, 'pos'] },
    body: { period: 0.6, phase: 0, dy: [-1.5, 'bob'] },
    head: { period: 0.6, phase: PI / 4, dx: [1, 'sin'], dy: [-1, 'bob'] },
    tail: { period: 0.6, phase: PI / 2, dx: [4, 'sin'] },
    wingL: { period: 0.6, phase: 0, dy: [2, 'sin'] },
    wingR: { period: 0.6, phase: PI, dy: [2, 'sin'] },
    spin: { period: 0.6, phase: 0, scaleX: [1, 'one'] },
  },
  fly: {
    wingL: { period: 0.45, phase: 0, dy: [12, 'sin'] },
    wingR: { period: 0.45, phase: PI, dy: [12, 'sin'] },
    body: { period: 1.8, phase: 0, dy: [4, 'sin'] },
    head: { period: 0.45, phase: PI / 2, dy: [1, 'sin'] },
    tail: { period: 0.9, phase: 0, dx: [3, 'sin'], dy: [1, 'sin'] },
    legL: { period: 0.9, phase: 0, dy: [2, 'sin'] },
    legR: { period: 0.9, phase: PI / 3, dy: [2, 'sin'] },
    spin: { period: 0.45, phase: 0, scaleX: [1, 'one'] },
  },
  jump: {
    body: { period: 0.9, phase: 0, dy: [[-14, 'pos'], [2, 'pos', PI]] },
    legL: { period: 0.9, phase: 0, dx: [-3, 'pos'], dy: [-4, 'pos'] },
    legR: { period: 0.9, phase: 0, dx: [3, 'pos'], dy: [-4, 'pos'] },
    head: { period: 0.9, phase: -0.4, dy: [2, 'sin'] },
    tail: { period: 0.9, phase: 0, dx: [5, 'sin'] },
    wingL: { period: 0.45, phase: 0, dy: [3, 'sin'] },
    wingR: { period: 0.45, phase: PI, dy: [3, 'sin'] },
    spin: { period: 0.9, phase: 0, scaleX: [1, 'one'] },
  },
  spin: {
    spin: { period: 1.2, phase: 0, scaleX: [1, 'cos'] },
    body: { period: 1.2, phase: 0, dy: [2, 'sin'] },
  },
  idle: {
    body: { period: 2.0, phase: 0, dy: [1.5, 'sin'] },
    head: { period: 2.0, phase: PI / 2, dy: [1, 'sin'] },
    tail: { period: 2.0, phase: 0, dx: [2, 'sin'] },
    wingL: { period: 2.0, phase: 0, dy: [2, 'sin'] },
    wingR: { period: 2.0, phase: PI, dy: [2, 'sin'] },
    spin: { period: 2.0, phase: 0, scaleX: [1, 'one'] },
  },
};

function evalTerm(term, base) {
  const amp = term[0];
  const wave = WAVES[term[1]] || WAVES.sin;
  const extra = term.length > 2 && Number.isFinite(term[2]) ? term[2] : 0;
  return amp * wave(base + extra);
}

function evalChannel(channel, base, fallback) {
  if (!channel) return fallback;
  if (Array.isArray(channel[0])) {
    let sum = 0;
    for (let i = 0; i < channel.length; i += 1) sum += evalTerm(channel[i], base);
    return sum;
  }
  return evalTerm(channel, base);
}

export function poseAt(behaviour, timeSeconds, tempo = 1) {
  const table = MOTION[behaviour] || null;
  const pose = {};
  const speed = Number.isFinite(tempo) ? tempo : 1;

  for (let i = 0; i < ROLES.length; i += 1) {
    const role = ROLES[i];
    const entry = table ? table[role] : null;
    if (!entry || !(entry.period > 0)) {
      pose[role] = role === 'spin' ? { dx: 0, dy: 0, scaleX: 1 } : { dx: 0, dy: 0 };
      continue;
    }
    const base = (2 * Math.PI * timeSeconds * speed) / entry.period + (entry.phase || 0);
    const value = {
      dx: evalChannel(entry.dx, base, 0),
      dy: evalChannel(entry.dy, base, 0),
    };
    if (role === 'spin') value.scaleX = evalChannel(entry.scaleX, base, 1);
    pose[role] = value;
  }

  if (!pose.spin) pose.spin = { dx: 0, dy: 0, scaleX: 1 };
  if (!Number.isFinite(pose.spin.scaleX)) pose.spin.scaleX = 1;
  return pose;
}

export function applyPose(mesh, rig, pose, sizeScale = 1) {
  resetMesh(mesh);
  if (!rig || !rig.points) return true;
  const points = rig.points;
  const s = Number.isFinite(sizeScale) && sizeScale > 0 ? sizeScale : 1;

  for (let i = 0; i < ROLES.length; i += 1) {
    const role = ROLES[i];
    if (role === 'body' || role === 'spin') continue;
    const point = points[role];
    if (!point) continue;
    const p = pose[role];
    if (!p) continue;
    pullPoint(mesh, point.x, point.y, (ROLE_RADIUS[role] || 0) * s, p.dx * s, p.dy * s);
  }

  let visible = true;
  const axis = points.spin;
  if (axis && pose.spin && pose.spin.scaleX !== 1) {
    visible = scaleXAbout(mesh, axis.x, pose.spin.scaleX);
  }

  const body = points.body;
  if (body && pose.body) translateAll(mesh, pose.body.dx * s, pose.body.dy * s);

  return visible;
}
