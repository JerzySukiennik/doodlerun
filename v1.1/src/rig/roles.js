// DoodleRun — rig roles, role sets per behaviour, and rig validation.

export const ROLES = ['body', 'head', 'legL', 'legR', 'wingL', 'wingR', 'tail', 'spin'];

export const ROLE_LABELS = {
  body: 'Body',
  head: 'Head',
  legL: 'Left leg',
  legR: 'Right leg',
  wingL: 'Left wing',
  wingR: 'Right wing',
  tail: 'Tail',
  spin: 'Spin axis',
};

export const ROLE_RADIUS = {
  body: 0,
  head: 26,
  legL: 22,
  legR: 22,
  wingL: 30,
  wingR: 30,
  tail: 20,
  spin: 0,
};

export const BEHAVIOURS = ['walk', 'fly', 'jump', 'spin', 'idle'];

export const ROLE_SETS = {
  walk: { required: ['body', 'legL', 'legR'], optional: ['head', 'tail'] },
  fly: { required: ['body', 'wingL', 'wingR'], optional: ['head', 'tail', 'legL', 'legR'] },
  jump: { required: ['body', 'legL', 'legR'], optional: ['head', 'tail'] },
  spin: { required: ['spin'], optional: [] },
  idle: { required: ['body'], optional: ['head', 'tail', 'wingL', 'wingR', 'legL', 'legR'] },
};

export function rolesFor(behaviour) {
  const set = ROLE_SETS[behaviour];
  if (!set) return [];
  return [...set.required, ...set.optional];
}

export function requiredRoles(behaviour) {
  const set = ROLE_SETS[behaviour];
  return set ? [...set.required] : [];
}

export function isRequired(behaviour, role) {
  const set = ROLE_SETS[behaviour];
  return !!set && set.required.indexOf(role) !== -1;
}

export function isRigComplete(rig) {
  if (!rig) return false;
  const need = requiredRoles(rig.behaviour);
  if (need.length === 0) return true;
  const points = rig.points || {};
  for (let i = 0; i < need.length; i += 1) {
    const p = points[need[i]];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  }
  return true;
}

export function missingRoles(rig) {
  if (!rig) return [];
  const need = requiredRoles(rig.behaviour);
  const points = rig.points || {};
  const out = [];
  for (let i = 0; i < need.length; i += 1) {
    const p = points[need[i]];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) out.push(need[i]);
  }
  return out;
}

export function missingRoleLabels(rig) {
  return missingRoles(rig).map((role) => ROLE_LABELS[role] || role);
}

export function defaultRig(slot) {
  return { behaviour: slot && slot.defaultBehaviour ? slot.defaultBehaviour : 'none', points: {} };
}

export function sanitizeRig(slot, rig) {
  const fallback = slot && slot.defaultBehaviour ? slot.defaultBehaviour : 'none';
  const allowed = slot && Array.isArray(slot.behaviours) ? slot.behaviours : [];
  let behaviour = rig && typeof rig.behaviour === 'string' ? rig.behaviour : fallback;
  if (behaviour !== fallback && allowed.indexOf(behaviour) === -1) behaviour = fallback;
  if (!ROLE_SETS[behaviour]) behaviour = ROLE_SETS[fallback] ? fallback : 'none';

  const keep = rolesFor(behaviour);
  const width = slot && Number.isFinite(slot.width) ? slot.width : 0;
  const height = slot && Number.isFinite(slot.height) ? slot.height : 0;
  const src = rig && rig.points ? rig.points : {};
  const points = {};

  for (let i = 0; i < keep.length; i += 1) {
    const role = keep[i];
    const p = src[role];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const x = Math.min(Math.max(p.x, 0), Math.max(0, width - 0.001));
    const y = Math.min(Math.max(p.y, 0), Math.max(0, height - 0.001));
    points[role] = { x, y };
  }

  return { behaviour, points };
}
