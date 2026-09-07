// DoodleRun — the editor screen: draw, rig and sound for one slot.

import { COPY, EDITOR, KEYS, SCREENS, SHELL, AUDIO, MESH, PREVIEW } from '../config.js';
import { SLOT_BY_ID, CATEGORIES, slotsByCategory } from '../config.slots.js';
import * as store from '../state/assets.js';
import { el, button } from './screens.css.js';
import { createSurface } from '../draw/surface.js';
import { createHistory } from '../draw/history.js';
import { measureCoverage, holeMask, passesGate } from '../draw/coverage.js';
import { ROLE_LABELS, rolesFor, isRequired, isRigComplete, missingRoleLabels, sanitizeRig } from '../rig/roles.js';
import { createPreview } from '../rig/preview.js';
import { createRecorder, isRecordingSupported, playSound } from '../audio/record.js';

const ICONS = {
  brush: '<svg viewBox="0 0 28 28"><path d="M6 22h6l10-10-6-6L6 16z"/><path d="M6 16l6 6"/></svg>',
  eraser: '<svg viewBox="0 0 28 28"><path d="M4 20l10-10 8 8-4 4H8z"/><path d="M4 24h20"/></svg>',
  fill: '<svg viewBox="0 0 28 28"><path d="M5 13L13 5l9 9-8 8z"/><path d="M23 18c0 2-1 3-2 3s-2-1-2-3 2-4 2-4 2 2 2 4z"/></svg>',
  picker: '<svg viewBox="0 0 28 28"><path d="M22 4l3 3-4 4-3-3z"/><path d="M18 8L6 20v3h3L21 11"/></svg>',
  mirror: '<svg viewBox="0 0 28 28"><path d="M14 3v22"/><path d="M9 10L4 15l5 5"/><path d="M19 10l5 5-5 5"/></svg>',
  pixel: '<svg viewBox="0 0 28 28"><path d="M4 4h20v20H4z"/><path d="M11 4v20M18 4v20M4 11h20M4 18h20"/></svg>',
  undo: '<svg viewBox="0 0 28 28"><path d="M5 12h11a6 6 0 010 12h-6"/><path d="M10 6L4 12l6 6"/></svg>',
  redo: '<svg viewBox="0 0 28 28"><path d="M23 12H12a6 6 0 000 12h6"/><path d="M18 6l6 6-6 6"/></svg>',
  clear: '<svg viewBox="0 0 28 28"><path d="M5 8h18"/><path d="M11 4h6"/><path d="M7 8l1 16h12l1-16"/><path d="M12 12v8M16 12v8"/></svg>',
};

const HEX_FULL = /^#[0-9a-f]{6}$/i;
const HEX_SHORT = /^#[0-9a-f]{3}$/i;

function setHidden(node, on) {
  node.hidden = !!on;
  node.style.display = on ? 'none' : '';
}

function reduceMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function normalizeHex(value) {
  const text = String(value || '').trim();
  if (HEX_FULL.test(text)) return text.toLowerCase();
  if (HEX_SHORT.test(text)) {
    const a = text.charAt(1);
    const b = text.charAt(2);
    const c = text.charAt(3);
    return ('#' + a + a + b + b + c + c).toLowerCase();
  }
  return null;
}

function splitGlyph(text) {
  const source = String(text || '');
  const gap = source.indexOf(' ');
  if (gap <= 0) return { glyph: '', label: source };
  return { glyph: source.slice(0, gap), label: source.slice(gap + 1) };
}

function screenScale(slot) {
  return Math.max(1, Math.floor(Math.min(EDITOR.canvasMaxWidth / slot.width, EDITOR.canvasMaxHeight / slot.height)));
}

function categoryName(slot) {
  const found = CATEGORIES.find((entry) => entry.id === slot.category);
  return found ? found.name : slot.category;
}

function slotIndexLabel(slot) {
  const peers = slotsByCategory(slot.category);
  const index = peers.indexOf(slot) + 1;
  return String(index).padStart(2, '0');
}

function animate(node, frames, duration, easing, delay) {
  if (!node || typeof node.animate !== 'function' || reduceMotion()) return null;
  return node.animate(frames, { duration, easing, delay: delay || 0, fill: 'both' });
}

function enterFrames(x, y) {
  return [
    { opacity: 0, transform: `translate3d(${x}px,${y}px,0)` },
    { opacity: 1, transform: 'translate3d(0,0,0)' },
  ];
}

function clusterHoles(imageData, threshold) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const seen = new Uint8Array(width * height);
  const clusters = [];
  const stack = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (seen[index] === 1 || data[index * 4 + 3] > threshold) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      seen[index] = 1;
      stack.push(x, y);
      while (stack.length > 0) {
        const cy = stack.pop();
        const cx = stack.pop();
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx > 0) {
          const left = cy * width + cx - 1;
          if (seen[left] === 0 && data[left * 4 + 3] <= threshold) { seen[left] = 1; stack.push(cx - 1, cy); }
        }
        if (cx < width - 1) {
          const right = cy * width + cx + 1;
          if (seen[right] === 0 && data[right * 4 + 3] <= threshold) { seen[right] = 1; stack.push(cx + 1, cy); }
        }
        if (cy > 0) {
          const up = (cy - 1) * width + cx;
          if (seen[up] === 0 && data[up * 4 + 3] <= threshold) { seen[up] = 1; stack.push(cx, cy - 1); }
        }
        if (cy < height - 1) {
          const down = (cy + 1) * width + cx;
          if (seen[down] === 0 && data[down * 4 + 3] <= threshold) { seen[down] = 1; stack.push(cx, cy + 1); }
        }
      }
      clusters.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
  }
  return clusters;
}

export function createEditor({ slotId, onDone, onExit }) {
  const slot = SLOT_BY_ID[slotId];
  if (!slot) throw new Error('unknown slot: ' + slotId);

  const asset = store.getAsset(slotId);
  const scale = screenScale(slot);
  const animated = slot.behaviours.length > 0;
  const copy = COPY.editor;

  const ops = asset.ops.slice();
  let rig = sanitizeRig(slot, asset.rig);
  let recent = [];
  let tab = 'draw';
  let armedRole = null;
  let selectedRole = null;
  let dragRole = null;
  let dragFrame = 0;
  let ghostOn = true;
  let meshOn = false;
  let holeLatch = false;
  let holeHold = false;
  let holeTimer = 0;
  let holeCycles = 0;
  let holePhase = false;
  let secondary = EDITOR.defaultSecondary;
  let cursor = { x: 0, y: 0, inside: false };
  let altPrevious = null;
  let clearArmed = 0;
  let deleteArmed = 0;
  let confirmTimer = 0;
  let previewSize = 0;
  let preview = null;
  let previewRunning = false;
  let previewSpeed = 1;
  let fpsTimer = 0;
  let resizeFrame = 0;
  let capFlashTimer = 0;
  let recorder = null;
  let recordState = 'idle';
  let recordStart = 0;
  let recordTimer = 0;
  let waveform = null;
  let playing = null;
  let playFrame = 0;
  let micDenied = false;
  let disposed = false;
  let shown = false;

  const root = el('section', 'dr-screen dr-editor');
  root.dataset.tab = 'draw';
  root.setAttribute('aria-label', slot.name);

  const skip = el('button', 'dr-skip', root, copy.skip);
  skip.type = 'button';

  const live = el('p', 'dr-skip', root, '');
  live.setAttribute('aria-live', 'polite');

  const head = el('header', 'dr-ed-head', root);
  const backBtn = button(copy.back, 'dr-btn-ghost', head, () => onExit && onExit());
  el('span', 'dr-ed-cat', head, `${categoryName(slot)} · ${slotIndexLabel(slot)}`);
  const nameNode = el('h2', 'dr-ed-name', head, slot.name);
  el('span', 'dr-ed-spec', head, copy.spec(slot.width, slot.height, COPY.board.notes[slot.id] || ''));
  el('span', 'dr-ed-saved', head, copy.saved);

  const tabsNav = el('nav', 'dr-tabs', head);
  tabsNav.setAttribute('role', 'tablist');
  const tabButtons = {};
  const tabOrder = ['draw'];
  if (animated) tabOrder.push('rig');
  if (slot.sound) tabOrder.push('sound');
  tabOrder.forEach((id) => {
    const node = el('button', 'dr-tab', tabsNav, copy.tabs[id]);
    node.type = 'button';
    node.setAttribute('role', 'tab');
    node.addEventListener('click', () => setTab(id));
    tabButtons[id] = node;
  });

  const doneWrap = el('div', 'dr-ed-done', head);
  const doneBtn = button(copy.done, 'dr-btn-solid', doneWrap, () => commitDone());
  const reasonNode = el('span', 'dr-ed-reason', doneWrap, '');

  const body = el('div', 'dr-ed-body', root);
  const rail = el('aside', 'dr-rail', body);
  const stage = el('main', 'dr-stage', body);
  const inspect = el('aside', 'dr-inspect', body);

  const frame = el('div', 'dr-canvas-frame', stage);
  const surface = createSurface({
    width: slot.width,
    height: slot.height,
    scale,
    mount: frame,
    onOp: handleOp,
    onPointerMove: handlePointerMove,
  });
  surface.canvas.tabIndex = 0;
  surface.canvas.setAttribute('role', 'img');
  surface.canvas.setAttribute('aria-label', `${slot.name} — ${slot.hint}`);
  const canvasNote = el('p', 'dr-skip', frame, copy.canvasNote);
  canvasNote.id = `dr-canvas-note-${slot.id}`;
  surface.canvas.setAttribute('aria-describedby', canvasNote.id);

  const hint = el('canvas', 'dr-canvas-layer', frame);
  hint.width = surface.canvas.width;
  hint.height = surface.canvas.height;
  hint.style.width = surface.canvas.width + 'px';
  hint.style.height = surface.canvas.height + 'px';
  hint.style.inset = SHELL.border.b4;
  const hintCtx = hint.getContext('2d');

  const ghostChip = el('button', 'dr-frame-chip is-on', frame, copy.ghost);
  ghostChip.type = 'button';
  ghostChip.setAttribute('aria-pressed', 'true');
  ghostChip.addEventListener('click', () => setGhost(!ghostOn));

  const previewFig = el('figure', 'dr-preview', stage);
  previewFig.style.margin = '0';
  setHidden(previewFig, true);
  const previewCap = el('figcaption', 'dr-preview-cap', previewFig, copy.previewCap(copy.behaviours[rig.behaviour] || rig.behaviour));
  const previewFrame = el('div', 'dr-preview-frame', previewFig);
  previewFrame.style.display = 'flex';
  previewFrame.style.alignItems = 'center';
  previewFrame.style.justifyContent = 'center';
  const meshChip = el('button', 'dr-frame-chip', previewFrame, copy.mesh);
  meshChip.type = 'button';
  meshChip.setAttribute('aria-pressed', 'false');
  meshChip.addEventListener('click', () => {
    meshOn = !meshOn;
    meshChip.classList.toggle('is-on', meshOn);
    meshChip.setAttribute('aria-pressed', meshOn ? 'true' : 'false');
    if (preview) preview.setDebug(meshOn);
  });
  const fpsNode = el('span', 'dr-preview-fps', previewFrame, '');
  const previewCtl = el('div', 'dr-preview-ctl', previewFig);

  const behaviourSeg = el('div', 'dr-seg', previewCtl);
  const behaviourButtons = {};
  slot.behaviours.forEach((id) => {
    const node = el('button', 'dr-seg-btn', behaviourSeg, copy.behaviours[id] || id);
    node.type = 'button';
    node.addEventListener('click', () => setBehaviour(id));
    behaviourButtons[id] = node;
  });
  if (slot.behaviours.length < 2) setHidden(behaviourSeg, true);

  el('span', 'dr-field-label', previewCtl, copy.speed);
  const speedRange = el('input', 'dr-range', previewCtl);
  speedRange.type = 'range';
  speedRange.min = '50';
  speedRange.max = '200';
  speedRange.step = '10';
  speedRange.value = '100';
  speedRange.style.width = '110px';
  speedRange.setAttribute('aria-label', copy.speed);
  speedRange.addEventListener('input', () => {
    previewSpeed = Number(speedRange.value) / 100;
    if (preview) preview.setTempo(slot.tempo * previewSpeed);
  });

  const playBtn = button('▶', 'dr-btn-ghost', previewCtl, () => togglePreview());

  const rails = {};
  function tool(id, key, icon, onClick, pressed) {
    const node = el('button', 'dr-tool', rail);
    node.type = 'button';
    node.innerHTML = icon;
    node.setAttribute('aria-label', `${copy.tools[id]} (${key})`);
    if (pressed) node.setAttribute('aria-pressed', 'false');
    el('span', 'dr-tool-key', node, key);
    node.addEventListener('click', onClick);
    rails[id] = node;
    return node;
  }

  tool('brush', 'B', ICONS.brush, () => setTool('brush'));
  tool('eraser', 'E', ICONS.eraser, () => setTool('eraser'));
  tool('fill', 'G', ICONS.fill, () => setTool('fill'));
  tool('picker', 'I', ICONS.picker, () => setTool('picker'));
  el('div', 'dr-rail-rule', rail);
  tool('mirror', 'M', ICONS.mirror, () => setMirror(!surface.settings.mirror), true);
  tool('pixel', 'P', ICONS.pixel, () => setPixel(!surface.settings.pixel), true);
  el('div', 'dr-rail-rule', rail);
  tool('undo', '⌘Z', ICONS.undo, () => doUndo());
  tool('redo', '⌘⇧Z', ICONS.redo, () => doRedo());
  tool('clear', '⇧⌫', ICONS.clear, () => pressClear());

  const drawPanel = el('div', 'dr-panel-body', inspect);

  const colourField = el('div', 'dr-field', drawPanel);
  const colourHead = el('div', 'dr-field-head', colourField);
  el('span', 'dr-field-label', colourHead, copy.colour);
  const colourRow = el('div', 'dr-colour', colourField);
  const fgInput = el('input', 'dr-colour-fg', colourRow);
  fgInput.type = 'color';
  fgInput.value = EDITOR.defaultColor;
  fgInput.setAttribute('aria-label', copy.colour);
  const bgInput = el('input', 'dr-colour-bg', colourRow);
  bgInput.type = 'color';
  bgInput.value = secondary;
  bgInput.setAttribute('aria-label', copy.swap);
  const swapBtn = button(copy.swap, 'dr-btn-ghost', colourRow, () => swapColours());
  const hexInput = el('input', 'dr-hex', colourRow);
  hexInput.type = 'text';
  hexInput.maxLength = 7;
  hexInput.value = EDITOR.defaultColor;
  hexInput.setAttribute('aria-label', copy.colour);
  const recentHead = el('div', 'dr-field-head', colourField);
  el('span', 'dr-field-label', recentHead, copy.recent);
  const recentRow = el('div', 'dr-recent', colourField);

  const brushField = el('div', 'dr-field', drawPanel);
  const brushHead = el('div', 'dr-field-head', brushField);
  el('span', 'dr-field-label', brushHead, copy.brush);
  const brushNum = el('span', 'dr-field-num', brushHead, '');
  const sizesRow = el('div', 'dr-sizes', brushField);
  const sizeButtons = EDITOR.brushSizes.map((px, index) => {
    const node = el('button', 'dr-size', sizesRow);
    node.type = 'button';
    node.setAttribute('aria-label', copy.brushValue(px));
    const dot = el('i', null, node);
    const visual = Math.min(28, Math.max(4, px * 3));
    dot.style.width = visual + 'px';
    dot.style.height = visual + 'px';
    node.addEventListener('click', () => setSizeIndex(index));
    return node;
  });
  const sizeRange = el('input', 'dr-range', brushField);
  sizeRange.type = 'range';
  sizeRange.min = String(EDITOR.brushRange.min);
  sizeRange.max = String(EDITOR.brushRange.max);
  sizeRange.step = '1';
  sizeRange.value = String(surface.settings.size);
  sizeRange.setAttribute('aria-label', copy.brush);
  sizeRange.addEventListener('input', () => {
    surface.settings.size = Number(sizeRange.value);
    surface.settings.sizeIndex = -1;
    refreshBrush();
  });

  const gridField = el('div', 'dr-field', drawPanel);
  const gridHead = el('div', 'dr-field-head', gridField);
  el('span', 'dr-field-label', gridHead, copy.grid);
  const gridSeg = el('div', 'dr-seg', gridField);
  const freeBtn = el('button', null, gridSeg, copy.gridFree);
  freeBtn.type = 'button';
  freeBtn.addEventListener('click', () => setPixel(false));
  const pixelBtn = el('button', null, gridSeg, copy.gridPixel);
  pixelBtn.type = 'button';
  pixelBtn.addEventListener('click', () => setPixel(true));
  const gridWorking = el('p', 'dr-field-note', gridField, '');
  gridWorking.style.margin = '0';
  const gridNote = el('p', 'dr-field-note', gridField, copy.gridNote);
  gridNote.style.color = SHELL.color.mute;
  setHidden(gridNote, true);

  const covField = el('div', 'dr-field', drawPanel);
  const cov = el('div', 'dr-cov', covField);
  cov.dataset.state = slot.requiresFullCoverage ? 'short' : 'free';
  const covHead = el('div', 'dr-cov-head', cov);
  el('span', 'dr-cov-label', covHead, copy.coverage);
  const covNum = el('span', 'dr-cov-num', covHead, '0%');
  const covBar = el('div', 'dr-cov-bar', cov);
  covBar.setAttribute('role', 'progressbar');
  covBar.setAttribute('aria-valuemin', '0');
  covBar.setAttribute('aria-valuemax', '100');
  const covSegments = [];
  for (let i = 0; i < EDITOR.coverageSegments; i += 1) covSegments.push(el('i', 'is-gap', covBar));
  const covMsg = el('p', 'dr-cov-msg', cov, '');
  const holesBtn = button(copy.showHoles, 'dr-btn-ghost dr-cov-show', cov, () => toggleHoleLatch());
  if (!slot.requiresFullCoverage) setHidden(holesBtn, true);

  const scaleField = el('div', 'dr-field', drawPanel);
  const scaleHead = el('div', 'dr-field-head', scaleField);
  el('span', 'dr-field-label', scaleHead, copy.ghost);
  const ghostSwitch = el('button', 'dr-switch is-on', scaleHead);
  ghostSwitch.type = 'button';
  ghostSwitch.setAttribute('aria-label', copy.ghost);
  ghostSwitch.setAttribute('aria-pressed', 'true');
  el('i', null, ghostSwitch);
  ghostSwitch.addEventListener('click', () => setGhost(!ghostOn));
  const ghostNote = el('p', 'dr-field-note', scaleField, copy.ghostNote);
  ghostNote.style.color = SHELL.color.mute;
  if (slot.id === 'hero') setHidden(scaleField, true);

  const rigPanel = el('div', 'dr-panel-body', inspect);
  const rolesField = el('div', 'dr-field', rigPanel);
  const rolesHead = el('div', 'dr-field-head', rolesField);
  const rolesTitle = el('span', 'dr-field-label', rolesHead, '');
  const rolesList = el('div', 'dr-roles', rolesField);
  const rolesNote = el('p', 'dr-field-note', rolesField, copy.rolesNote);
  const rolesMissing = el('p', 'dr-field-note', rolesField, copy.rolesMissing);
  rolesMissing.style.color = SHELL.color.mute;
  rolesMissing.style.textTransform = 'uppercase';
  const clearRigBtn = button(copy.clearRig, 'dr-btn-ghost', rolesField, () => clearRig());

  const soundPanel = el('div', 'dr-panel-body', inspect);
  const soundField = el('div', 'dr-field', soundPanel);
  const soundHead = el('div', 'dr-field-head', soundField);
  el('span', 'dr-field-label', soundHead, copy.sound);
  const soundBox = el('div', 'dr-sound-box', soundField);
  const level = el('div', 'dr-level', soundBox);
  const levelSegments = [];
  for (let i = 0; i < AUDIO.meterSegments; i += 1) levelSegments.push(el('i', null, level));
  const wave = el('canvas', 'dr-wave', soundBox);
  wave.width = 300;
  wave.height = 60;
  wave.style.width = '100%';
  wave.style.height = '60px';
  wave.style.display = 'none';
  const waveCtx = wave.getContext('2d');
  const soundTime = el('span', 'dr-sound-time', soundBox, copy.soundTime('0.0', (AUDIO.maxMs / 1000).toFixed(1)));
  const soundActs = el('div', 'dr-sound-acts', soundField);
  soundActs.style.flexWrap = 'wrap';
  const recordBtn = button(copy.record, '', soundActs, () => toggleRecord());
  const playSoundBtn = button(copy.play, '', soundActs, () => playCapture());
  const deleteBtn = button(copy.delete, '', soundActs, () => pressDelete());
  const soundNote = el('p', 'dr-field-note', soundField, copy.soundNote);
  soundNote.style.color = SHELL.color.mute;
  const micNote = el('p', 'dr-field-note', soundField, copy.noMic);
  micNote.style.color = SHELL.color.mute;
  micNote.style.textTransform = 'uppercase';
  setHidden(micNote, true);

  const history = createHistory(EDITOR.historyLimit);

  function announce(text) {
    live.textContent = text;
  }

  function showPanel(panel, on) {
    panel.style.display = on ? 'flex' : 'none';
    panel.style.flexDirection = 'column';
    panel.style.gap = SHELL.gap.m;
    panel.style.minHeight = '0';
  }

  function currentImage() {
    return surface.getImageData();
  }

  function setGhost(on) {
    ghostOn = !!on && slot.id !== 'hero';
    ghostChip.classList.toggle('is-on', ghostOn);
    ghostChip.setAttribute('aria-pressed', ghostOn ? 'true' : 'false');
    ghostSwitch.classList.toggle('is-on', ghostOn);
    ghostSwitch.setAttribute('aria-pressed', ghostOn ? 'true' : 'false');
    applyGhost();
  }

  let ghostSource = null;
  function applyGhost() {
    surface.setGhost(ghostOn && ghostSource ? ghostSource : null);
  }

  function loadGhost() {
    if (slot.id === 'hero') return;
    setHidden(ghostChip, false);
    const hero = store.getAsset('hero');
    if (hero && hero.bitmap) {
      ghostSource = hero.bitmap;
      applyGhost();
      return;
    }
    const demo = window.doodlerun && window.doodlerun.demo ? window.doodlerun.demo.get('hero') : null;
    if (demo && demo.bitmap) {
      ghostSource = demo.bitmap;
      applyGhost();
    }
  }
  if (slot.id === 'hero') setHidden(ghostChip, true);

  function pushRecent(hex) {
    const value = normalizeHex(hex);
    if (!value) return;
    const next = [value].concat(recent.filter((item) => item !== value));
    recent = next.slice(0, EDITOR.recentSwatches);
    renderRecent();
  }

  function renderRecent() {
    recentRow.textContent = '';
    recent.forEach((hex) => {
      const node = el('button', null, recentRow);
      node.type = 'button';
      node.setAttribute('aria-label', hex);
      const chip = el('i', null, node);
      chip.style.background = hex;
      node.addEventListener('click', () => setColour(hex));
    });
  }

  function setColour(hex) {
    const value = normalizeHex(hex);
    if (!value) return;
    surface.setColor(value);
    fgInput.value = value;
    hexInput.value = value;
    drawHints();
  }

  function swapColours() {
    const front = surface.settings.color;
    setColour(secondary);
    secondary = front;
    bgInput.value = secondary;
    animate(fgInput, [{ transform: 'translate3d(18px,18px,0)' }, { transform: 'translate3d(0,0,0)' }], 160, SHELL.ease.out);
    animate(bgInput, [{ transform: 'translate3d(-18px,-18px,0)' }, { transform: 'translate3d(0,0,0)' }], 160, SHELL.ease.out);
  }

  function setTool(id) {
    surface.setTool(id);
    ['brush', 'eraser', 'fill', 'picker'].forEach((key) => {
      rails[key].classList.toggle('is-on', key === id);
    });
    drawHints();
  }

  function setMirror(on) {
    surface.setMirror(on);
    rails.mirror.classList.toggle('is-on', !!on);
    rails.mirror.setAttribute('aria-pressed', on ? 'true' : 'false');
    drawHints();
  }

  function setPixel(on) {
    surface.setPixel(on);
    rails.pixel.classList.toggle('is-on', !!on);
    rails.pixel.setAttribute('aria-pressed', on ? 'true' : 'false');
    frame.classList.toggle('is-pixel', !!on);
    freeBtn.classList.toggle('is-on', !on);
    pixelBtn.classList.toggle('is-on', !!on);
    setHidden(gridNote, !on);
    refreshBrush();
    drawHints();
  }

  function setSizeIndex(index) {
    surface.setSizeIndex(index);
    sizeRange.value = String(surface.settings.size);
    refreshBrush();
    animate(brushNum, [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], 140, SHELL.ease.pop);
    drawHints();
  }

  function stepSize(direction) {
    const current = surface.settings.sizeIndex;
    const base = current >= 0 ? current : EDITOR.brushSizes.findIndex((px) => px >= surface.settings.size);
    const start = base < 0 ? EDITOR.brushSizes.length - 1 : base;
    const next = Math.min(EDITOR.brushSizes.length - 1, Math.max(0, start + direction));
    setSizeIndex(next);
  }

  function refreshBrush() {
    const pixel = surface.settings.pixel;
    brushNum.textContent = pixel ? copy.brushCells(1) : copy.brushValue(Math.round(surface.settings.size));
    sizeRange.disabled = pixel;
    sizeButtons.forEach((node, index) => {
      node.disabled = pixel;
      node.classList.toggle('is-on', !pixel && index === surface.settings.sizeIndex);
    });
    const cell = EDITOR.pixelCell;
    gridWorking.textContent = pixel
      ? copy.gridWorking(Math.ceil(slot.width / cell), Math.ceil(slot.height / cell), cell)
      : copy.gridWorking(slot.width, slot.height, 1);
  }

  function drawHints() {
    hintCtx.clearRect(0, 0, hint.width, hint.height);
    if (armedRole) {
      hintCtx.save();
      hintCtx.strokeStyle = SHELL.color.ink;
      hintCtx.lineWidth = 3;
      hintCtx.setLineDash([10, 8]);
      hintCtx.strokeRect(4, 4, hint.width - 8, hint.height - 8);
      hintCtx.restore();
    }
    if (surface.settings.mirror && tab === 'draw') {
      hintCtx.save();
      hintCtx.strokeStyle = SHELL.color.ink;
      hintCtx.lineWidth = 2;
      hintCtx.setLineDash([6, 6]);
      hintCtx.beginPath();
      hintCtx.moveTo(hint.width / 2, 0);
      hintCtx.lineTo(hint.width / 2, hint.height);
      hintCtx.stroke();
      hintCtx.restore();
    }
    if (!cursor.inside) return;
    const cx = cursor.x * scale;
    const cy = cursor.y * scale;
    if (armedRole) {
      hintCtx.save();
      hintCtx.strokeStyle = SHELL.color.paper;
      hintCtx.lineWidth = 4;
      strokeReticle(cx, cy);
      hintCtx.strokeStyle = SHELL.color.ink;
      hintCtx.lineWidth = 2;
      strokeReticle(cx, cy);
      hintCtx.restore();
      return;
    }
    if (surface.settings.tool !== 'brush' && surface.settings.tool !== 'eraser') return;
    const radius = surface.settings.pixel
      ? (EDITOR.pixelCell * scale) / 2
      : Math.max(2, (surface.settings.size * scale) / 2);
    hintCtx.save();
    hintCtx.lineWidth = 1;
    hintCtx.beginPath();
    hintCtx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
    hintCtx.strokeStyle = SHELL.color.paper;
    hintCtx.stroke();
    hintCtx.beginPath();
    hintCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    hintCtx.strokeStyle = SHELL.color.ink;
    hintCtx.stroke();
    hintCtx.restore();
  }

  function strokeReticle(cx, cy) {
    const arm = 22;
    hintCtx.beginPath();
    hintCtx.moveTo(cx - arm, cy);
    hintCtx.lineTo(cx - 6, cy);
    hintCtx.moveTo(cx + 6, cy);
    hintCtx.lineTo(cx + arm, cy);
    hintCtx.moveTo(cx, cy - arm);
    hintCtx.lineTo(cx, cy - 6);
    hintCtx.moveTo(cx, cy + 6);
    hintCtx.lineTo(cx, cy + arm);
    hintCtx.stroke();
    hintCtx.strokeRect(cx - 11, cy - 11, 22, 22);
  }

  function markerAt(x, y) {
    const reach = 24 / scale;
    const names = Object.keys(rig.points);
    let best = null;
    let bestDistance = reach;
    for (let i = 0; i < names.length; i += 1) {
      const point = rig.points[names[i]];
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = names[i];
      }
    }
    return best;
  }

  function handlePointerMove(position) {
    cursor = position;
    if (dragRole) {
      rig.points[dragRole] = { x: position.x, y: position.y };
      if (dragFrame === 0) {
        dragFrame = requestAnimationFrame(() => {
          dragFrame = 0;
          commitRig(false);
        });
      }
      drawHints();
      return;
    }
    if (tab === 'rig' && !armedRole) {
      const hit = position.inside ? markerAt(position.x, position.y) : null;
      surface.setInputMode(hit ? 'rig' : 'draw');
      surface.canvas.style.cursor = hit ? 'move' : 'crosshair';
    }
    drawHints();
  }

  function handleOp(op) {
    ops.push(op);
    const image = currentImage();
    history.push(image, ops.length);
    store.setBitmap(slotId, image, ops);
    if (op.color) pushRecent(op.color);
    stopHoles();
    afterBitmap(image);
  }

  function afterBitmap(image) {
    refreshCoverage(image);
    refreshHistoryButtons();
    if (preview) preview.setBitmap(image);
    refreshDone(image);
  }

  function refreshHistoryButtons() {
    rails.undo.disabled = !history.canUndo();
    rails.redo.disabled = !history.canRedo();
  }

  let lastFilled = -1;
  function refreshCoverage(image) {
    const result = measureCoverage(image, EDITOR.alphaThreshold);
    const full = result.empty === 0 && result.total > 0;
    const percent = full ? 100 : Math.floor(result.ratio * 10000) / 100;
    covNum.textContent = full ? '100%' : percent.toFixed(2) + '%';
    const filled = full ? EDITOR.coverageSegments : Math.min(EDITOR.coverageSegments - 1, Math.floor(result.ratio * EDITOR.coverageSegments));
    covSegments.forEach((node, index) => {
      const on = index < filled;
      node.classList.toggle('is-on', on);
      node.classList.toggle('is-gap', !on);
      node.style.borderColor = '';
    });
    if (filled > lastFilled && lastFilled >= 0 && filled > 0) {
      animate(covSegments[filled - 1], [{ transform: 'scale(1,0.7)' }, { transform: 'scale(1,1)' }], 120, SHELL.ease.out);
    }
    lastFilled = filled;
    covBar.setAttribute('aria-valuenow', String(Math.floor(percent)));
    covBar.setAttribute('aria-valuetext', `${covNum.textContent}, ${result.empty} empty`);
    if (!slot.requiresFullCoverage) {
      cov.dataset.state = 'free';
      covMsg.textContent = copy.coverageFree;
      return;
    }
    if (full) {
      cov.dataset.state = 'full';
      covMsg.textContent = copy.coverageFull;
      return;
    }
    cov.dataset.state = 'short';
    if (filled < EDITOR.coverageSegments) covSegments[filled].style.borderColor = SHELL.color.alert;
    const clusters = result.empty > 0 && result.empty < EDITOR.ringClusterThreshold ? clusterHoles(image, EDITOR.alphaThreshold) : null;
    covMsg.textContent = clusters ? copy.coverageHoles(clusters.length) : copy.coverageShort(result.empty);
  }

  let doneEnabled = false;
  function refreshDone(image) {
    const gate = passesGate(slot, image);
    const rigOk = !animated || isRigComplete(rig);
    const enabled = gate && rigOk;
    if (!gate) {
      const result = measureCoverage(image, EDITOR.alphaThreshold);
      reasonNode.textContent = copy.doneBlocked(result.empty);
      reasonNode.style.color = SHELL.color.alert;
      doneBtn.title = reasonNode.textContent;
    } else if (!rigOk) {
      reasonNode.textContent = copy.donePlace(missingRoleLabels(rig).join(', '));
      reasonNode.style.color = SHELL.color.mute;
      doneBtn.title = reasonNode.textContent;
    } else {
      reasonNode.textContent = '';
      doneBtn.title = copy.done;
    }
    doneBtn.disabled = !enabled;
    if (enabled && !doneEnabled) {
      animate(doneBtn, [{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], 220, SHELL.ease.pop);
      announce(reasonNode.textContent || copy.coverageFull);
    }
    doneEnabled = enabled;
  }

  function commitDone() {
    if (doneBtn.disabled) {
      nudge(doneBtn);
      return;
    }
    store.setStatus(slotId, 'ready');
    if (onDone) onDone();
  }

  function nudge(node) {
    node.classList.remove('is-nudging');
    void node.offsetWidth;
    node.classList.add('is-nudging');
    window.setTimeout(() => node.classList.remove('is-nudging'), 200);
  }

  function doUndo() {
    const snapshot = history.undo();
    if (!snapshot) {
      nudge(rails.undo);
      return;
    }
    applySnapshot(snapshot);
    flashTool(rails.undo);
  }

  function doRedo() {
    const snapshot = history.redo();
    if (!snapshot) {
      nudge(rails.redo);
      return;
    }
    applySnapshot(snapshot);
    flashTool(rails.redo);
  }

  function applySnapshot(snapshot) {
    surface.putImageData(snapshot.imageData);
    ops.length = snapshot.opCount;
    store.setBitmap(slotId, snapshot.imageData, ops);
    stopHoles();
    afterBitmap(snapshot.imageData);
  }

  function flashTool(node) {
    node.classList.add('is-on');
    window.setTimeout(() => {
      if (node === rails.undo || node === rails.redo) node.classList.remove('is-on');
    }, 120);
  }

  function clearConfirms() {
    if (confirmTimer !== 0) {
      clearTimeout(confirmTimer);
      confirmTimer = 0;
    }
    if (clearArmed) {
      clearArmed = 0;
      rails.clear.classList.remove('is-on');
      rails.clear.title = copy.tools.clear;
    }
    if (deleteArmed) {
      deleteArmed = 0;
      deleteBtn.classList.remove('dr-btn-danger');
      deleteBtn.textContent = copy.delete;
    }
  }

  function pressClear() {
    if (clearArmed) {
      clearConfirms();
      surface.clear();
      return;
    }
    clearConfirms();
    clearArmed = 1;
    rails.clear.classList.add('is-on');
    rails.clear.title = copy.clearConfirm;
    confirmTimer = window.setTimeout(clearConfirms, EDITOR.confirmMs);
  }

  function buildHoleOverlay(image) {
    const mask = holeMask(image, EDITOR.alphaThreshold);
    if (!mask) return null;
    const result = measureCoverage(image, EDITOR.alphaThreshold);
    if (result.empty === 0 || result.empty >= EDITOR.ringClusterThreshold) return mask;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(mask, 0, 0);
    const radius = Math.max(2, Math.round(14 / scale));
    ctx.strokeStyle = SHELL.color.alert;
    ctx.lineWidth = Math.max(1, Math.round(3 / scale));
    clusterHoles(image, EDITOR.alphaThreshold).forEach((cluster) => {
      const size = Math.max(radius * 2, cluster.w + 2, cluster.h + 2);
      ctx.strokeRect(Math.round(cluster.x - size / 2), Math.round(cluster.y - size / 2), size, size);
    });
    return ctx.getImageData(0, 0, image.width, image.height);
  }

  function showHoles() {
    surface.setOverlay(buildHoleOverlay(currentImage()));
  }

  function stopHoles() {
    if (holeTimer !== 0) {
      clearInterval(holeTimer);
      holeTimer = 0;
    }
    holeLatch = false;
    holeCycles = 0;
    holePhase = false;
    holesBtn.style.removeProperty('--dr-fill');
    holesBtn.style.removeProperty('color');
    if (!holeHold) surface.setOverlay(null);
  }

  function toggleHoleLatch() {
    if (holeLatch) {
      stopHoles();
      return;
    }
    holeLatch = true;
    holeCycles = 0;
    holePhase = true;
    holesBtn.style.setProperty('--dr-fill', SHELL.color.ink);
    holesBtn.style.setProperty('color', SHELL.color.paper);
    showHoles();
    holeTimer = window.setInterval(() => {
      holePhase = !holePhase;
      if (holePhase) {
        showHoles();
        holeCycles += 1;
        if (holeCycles >= EDITOR.holeFlashCount) stopHoles();
      } else {
        surface.setOverlay(null);
      }
    }, EDITOR.holeFlashMs / 2);
  }

  function holdHoles(on) {
    holeHold = on;
    if (on) {
      showHoles();
      return;
    }
    if (!holeLatch) surface.setOverlay(null);
  }

  function commitRig(restart) {
    rig = sanitizeRig(slot, rig);
    store.setRig(slotId, rig);
    if (preview) {
      preview.setRig(rig);
      if (restart) preview.setTime(0);
    }
    refreshMarkers();
    refreshRoles();
    refreshDone(currentImage());
    if (restart) flashCaption();
  }

  function flashCaption() {
    previewCap.classList.add('is-flash');
    if (capFlashTimer !== 0) clearTimeout(capFlashTimer);
    capFlashTimer = window.setTimeout(() => {
      previewCap.classList.remove('is-flash');
      capFlashTimer = 0;
    }, 200);
  }

  function refreshMarkers() {
    if (tab !== 'rig') {
      surface.setMarkers([]);
      return;
    }
    const list = Object.keys(rig.points).map((role) => ({
      role,
      label: ROLE_LABELS[role] || role,
      x: rig.points[role].x,
      y: rig.points[role].y,
      selected: role === selectedRole || role === armedRole,
    }));
    surface.setMarkers(list);
  }

  function armRole(role) {
    armedRole = role;
    selectedRole = role;
    surface.setInputMode(role ? 'rig' : 'draw');
    surface.canvas.style.cursor = 'crosshair';
    refreshRoles();
    refreshMarkers();
    drawHints();
  }

  function nextUnplaced() {
    const list = rolesFor(rig.behaviour);
    for (let i = 0; i < list.length; i += 1) {
      if (isRequired(rig.behaviour, list[i]) && !rig.points[list[i]]) return list[i];
    }
    return null;
  }

  function placePoint(position) {
    if (armedRole) {
      rig.points[armedRole] = { x: position.x, y: position.y };
      const placed = armedRole;
      commitRig(true);
      const marker = nextUnplaced();
      armRole(marker);
      const total = rolesFor(rig.behaviour).length;
      announce(`${ROLE_LABELS[placed] || placed} — ${copy.roles(Object.keys(rig.points).length, total)}`);
      pop();
      return;
    }
    const hit = markerAt(position.x, position.y);
    if (!hit) return;
    selectedRole = hit;
    dragRole = hit;
    refreshMarkers();
    refreshRoles();
  }

  function pop() {
    animate(frame, [{ transform: 'scale(1.008)' }, { transform: 'scale(1)' }], 180, SHELL.ease.pop);
  }

  function removePoint(role) {
    if (!role || !rig.points[role]) return;
    delete rig.points[role];
    commitRig(true);
    if (armedRole === role) armRole(role);
  }

  function clearRig() {
    rig = { behaviour: rig.behaviour, points: {} };
    selectedRole = null;
    commitRig(true);
    armRole(nextUnplaced());
  }

  function setBehaviour(id) {
    if (slot.behaviours.indexOf(id) === -1) return;
    rig = sanitizeRig(slot, { behaviour: id, points: rig.points });
    selectedRole = null;
    commitRig(true);
    previewCap.textContent = copy.previewCap(copy.behaviours[id] || id);
    Object.keys(behaviourButtons).forEach((key) => {
      behaviourButtons[key].classList.toggle('is-on', key === id);
    });
    armRole(nextUnplaced());
  }

  function refreshRoles() {
    const list = rolesFor(rig.behaviour);
    const placedCount = list.filter((role) => !!rig.points[role]).length;
    rolesTitle.textContent = copy.roles(placedCount, list.length);
    rolesList.textContent = '';
    list.forEach((role) => {
      const placed = !!rig.points[role];
      const required = isRequired(rig.behaviour, role);
      const row = el('div', 'dr-role', rolesList);
      row.dataset.role = role;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.classList.toggle('is-placed', placed);
      row.classList.toggle('is-selected', role === armedRole);
      row.classList.toggle('is-required', required && !placed);
      el('span', null, row, ROLE_LABELS[role] || role);
      let state = required ? copy.roleRequired : copy.roleOptional;
      if (placed) state = copy.rolePlaced;
      else if (role === armedRole) state = copy.rolePlace;
      el('span', 'dr-role-state', row, state);
      row.setAttribute('aria-label', `${ROLE_LABELS[role] || role} — ${state}`);
      if (placed) {
        const remove = el('button', 'dr-role-x', row, '⌫');
        remove.type = 'button';
        remove.style.background = 'none';
        remove.style.border = '0';
        remove.style.color = 'inherit';
        remove.style.cursor = 'pointer';
        remove.style.font = 'inherit';
        remove.style.padding = '0 4px';
        remove.setAttribute('aria-label', ROLE_LABELS[role] || role);
        remove.addEventListener('click', (event) => {
          event.stopPropagation();
          removePoint(role);
        });
      }
      row.addEventListener('click', () => armRole(role === armedRole ? null : role));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          armRole(role === armedRole ? null : role);
        }
      });
    });
    setHidden(rolesMissing, isRigComplete(rig));
  }

  function measurePreviewBox() {
    const rect = previewFrame.getBoundingClientRect();
    const border = parseInt(SHELL.border.b4, 10) * 2;
    const width = Math.max(160, Math.floor(rect.width - border));
    const height = Math.max(160, Math.floor(rect.height - border));
    return Math.max(160, Math.min(width, height));
  }

  function ensurePreview() {
    if (!animated || disposed) return;
    const size = measurePreviewBox();
    if (preview && Math.abs(size - previewSize) < 12) return;
    const wasRunning = preview ? preview.isRunning() : !reduceMotion();
    if (preview) preview.dispose();
    previewSize = size;
    const fit = (size * 0.74) / Math.max(slot.width, slot.height);
    preview = createPreview({ mount: previewFrame, size, scale: Math.max(PREVIEW.scale, fit) });
    preview.setAsset({ width: slot.width, height: slot.height, bitmap: currentImage(), rig, tempo: slot.tempo * previewSpeed });
    preview.setDebug(meshOn);
    previewRunning = wasRunning;
    if (previewRunning) preview.start();
    updatePlayButton();
  }

  function togglePreview() {
    if (!preview) return;
    if (preview.isRunning()) {
      preview.stop();
      previewRunning = false;
    } else {
      preview.start();
      previewRunning = true;
    }
    updatePlayButton();
  }

  function updatePlayButton() {
    const running = !!preview && preview.isRunning();
    playBtn.textContent = running ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', running ? copy.previewCap(copy.behaviours[rig.behaviour] || rig.behaviour) : copy.paused);
    previewCap.textContent = running
      ? copy.previewCap(copy.behaviours[rig.behaviour] || rig.behaviour)
      : copy.paused;
  }

  function startFpsTicker() {
    if (fpsTimer !== 0) return;
    fpsTimer = window.setInterval(() => {
      if (!preview) return;
      const value = Math.round(preview.fps);
      const cols = preview.meshResolution;
      fpsNode.textContent = cols < MESH.cols
        ? copy.fpsFallback(value, cols, cols)
        : copy.fps(value);
    }, 250);
  }

  function stopFpsTicker() {
    if (fpsTimer === 0) return;
    clearInterval(fpsTimer);
    fpsTimer = 0;
  }

  function setTab(next) {
    if (next === tab) return;
    if (tabOrder.indexOf(next) === -1) return;
    tab = next;
    root.dataset.tab = next;
    tabOrder.forEach((id) => {
      const node = tabButtons[id];
      node.classList.toggle('is-on', id === next);
      node.setAttribute('aria-selected', id === next ? 'true' : 'false');
    });
    showPanel(drawPanel, next === 'draw');
    showPanel(rigPanel, next === 'rig');
    showPanel(soundPanel, next === 'sound');
    setHidden(previewFig, next !== 'rig');
    stopHoles();
    clearConfirms();
    if (next !== 'rig') {
      armedRole = null;
      surface.setMarkers([]);
      surface.setInputMode(next === 'sound' ? 'rig' : 'draw');
      surface.canvas.style.cursor = next === 'sound' ? 'default' : 'crosshair';
      if (preview) preview.stop();
      stopFpsTicker();
    } else {
      void previewFrame.offsetHeight;
      ensurePreview();
      if (preview && previewRunning) preview.start();
      startFpsTicker();
      refreshMarkers();
      refreshRoles();
      if (!armedRole) armRole(nextUnplaced());
    }
    if (next === 'sound') stopPlayback();
    animate(inspect, enterFrames(0, 8), 140, SHELL.ease.out);
    animate(stage, enterFrames(0, 8), 140, SHELL.ease.out);
    drawHints();
  }

  function drawWaveform(progress) {
    waveCtx.setTransform(1, 0, 0, 1, 0, 0);
    waveCtx.fillStyle = SHELL.color.paper;
    waveCtx.fillRect(0, 0, wave.width, wave.height);
    if (!waveform || waveform.length === 0) return;
    waveCtx.fillStyle = SHELL.color.ink;
    const step = 3;
    const bars = Math.floor(wave.width / step);
    for (let i = 0; i < bars; i += 1) {
      const value = waveform[Math.floor((i / bars) * waveform.length)] || 0;
      const h = Math.max(2, value * (wave.height - 4));
      waveCtx.fillRect(i * step, (wave.height - h) / 2, 2, h);
    }
    if (progress > 0) {
      waveCtx.fillRect(Math.round(progress * wave.width), 0, 3, wave.height);
    }
  }

  function showWave(on) {
    wave.style.display = on ? 'block' : 'none';
  }

  function buildWaveform(blob) {
    waveform = null;
    drawWaveform(0);
    if (!blob || typeof AudioContext === 'undefined') return;
    blob.arrayBuffer().then((buffer) => {
      const context = new AudioContext();
      return context.decodeAudioData(buffer).then((audio) => {
        context.close();
        const channel = audio.getChannelData(0);
        const bars = 100;
        const block = Math.max(1, Math.floor(channel.length / bars));
        const peaks = [];
        let max = 0.0001;
        for (let i = 0; i < bars; i += 1) {
          let peak = 0;
          const start = i * block;
          for (let j = 0; j < block && start + j < channel.length; j += 1) {
            const value = Math.abs(channel[start + j]);
            if (value > peak) peak = value;
          }
          if (peak > max) max = peak;
          peaks.push(peak);
        }
        waveform = peaks.map((peak) => peak / max);
        showWave(true);
        drawWaveform(0);
      });
    }).catch(() => {});
  }

  function setLevel(ratio) {
    const on = Math.round(Math.max(0, Math.min(1, ratio)) * levelSegments.length);
    levelSegments.forEach((node, index) => node.classList.toggle('is-on', index < on));
  }

  function refreshSound() {
    const sound = store.getAsset(slotId).sound;
    const has = !!sound.url;
    playSoundBtn.disabled = !has;
    deleteBtn.disabled = !has;
    const seconds = (sound.durationMs / 1000).toFixed(1);
    soundTime.textContent = copy.soundTime(seconds, (AUDIO.maxMs / 1000).toFixed(1));
    if (!has) {
      setLevel(0);
      waveform = null;
      showWave(false);
      drawWaveform(0);
    }
    recordBtn.disabled = micDenied || !isRecordingSupported();
    setHidden(micNote, !micDenied && isRecordingSupported());
  }

  function setRecordLabel(text, live) {
    const parts = splitGlyph(text);
    recordBtn.textContent = '';
    const dot = el('i', live ? 'dr-rec-dot is-live' : 'dr-rec-dot', recordBtn, parts.glyph);
    dot.style.fontStyle = 'normal';
    el('span', null, recordBtn, parts.label);
    recordBtn.classList.toggle('dr-btn-solid', !!live);
  }

  async function toggleRecord() {
    if (!recorder) recorder = createRecorder();
    if (recordState === 'recording') {
      await finishRecording();
      return;
    }
    try {
      await recorder.start();
    } catch (error) {
      micDenied = true;
      refreshSound();
      announce(copy.noMic);
      return;
    }
    if (disposed) return;
    micDenied = false;
    recordState = 'recording';
    recordStart = performance.now();
    setRecordLabel(copy.recording('0.0'), true);
    recordTimer = window.setInterval(() => {
      const elapsed = performance.now() - recordStart;
      setLevel(elapsed / AUDIO.maxMs);
      setRecordLabel(copy.recording((elapsed / 1000).toFixed(1)), true);
      if (elapsed >= AUDIO.maxMs) finishRecording();
    }, 60);
  }

  async function finishRecording() {
    if (recordState !== 'recording') return;
    recordState = 'idle';
    if (recordTimer !== 0) {
      clearInterval(recordTimer);
      recordTimer = 0;
    }
    setRecordLabel(copy.record, false);
    const result = await recorder.stop();
    if (disposed) return;
    setLevel(0);
    if (result && result.blob) {
      store.setSound(slotId, result);
      buildWaveform(result.blob);
      announce(copy.soundTime((result.durationMs / 1000).toFixed(1), (AUDIO.maxMs / 1000).toFixed(1)));
    }
    refreshSound();
  }

  function stopPlayback() {
    if (playFrame !== 0) {
      cancelAnimationFrame(playFrame);
      playFrame = 0;
    }
    if (playing) {
      playing.pause();
      playing = null;
    }
    drawWaveform(0);
  }

  function playCapture() {
    stopPlayback();
    const sound = store.getAsset(slotId).sound;
    playing = playSound(sound);
    if (!playing) return;
    const total = Math.max(0.05, sound.durationMs / 1000);
    const tick = () => {
      if (!playing) return;
      drawWaveform(Math.min(1, playing.currentTime / total));
      if (playing.ended || playing.paused) {
        stopPlayback();
        return;
      }
      playFrame = requestAnimationFrame(tick);
    };
    playFrame = requestAnimationFrame(tick);
  }

  function pressDelete() {
    if (deleteArmed) {
      clearConfirms();
      stopPlayback();
      store.setSound(slotId, null);
      refreshSound();
      return;
    }
    clearConfirms();
    deleteArmed = 1;
    deleteBtn.classList.add('dr-btn-danger');
    deleteBtn.textContent = copy.deleteConfirm;
    confirmTimer = window.setTimeout(clearConfirms, EDITOR.confirmMs);
  }

  function typing(event) {
    const node = event.target;
    if (!node || !node.tagName) return false;
    const tag = node.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || node.isContentEditable;
  }

  function onKeyDown(event) {
    if (typing(event)) {
      if (event.code === KEYS.exit) blurTarget(event);
      return;
    }
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.code === KEYS.undo) {
      event.preventDefault();
      if (event.shiftKey) doRedo();
      else doUndo();
      return;
    }
    if (meta && event.code === KEYS.redo) {
      event.preventDefault();
      doRedo();
      return;
    }
    if (meta && event.code === 'Enter') {
      event.preventDefault();
      commitDone();
      return;
    }
    if (event.code === KEYS.exit) {
      event.preventDefault();
      if (clearArmed || deleteArmed) {
        clearConfirms();
        return;
      }
      if (armedRole) {
        armRole(null);
        return;
      }
      if (onExit) onExit();
      return;
    }
    if (meta) return;
    if (event.code === KEYS.tabDraw) { event.preventDefault(); setTab('draw'); return; }
    if (event.code === KEYS.tabRig) { event.preventDefault(); setTab('rig'); return; }
    if (event.code === KEYS.tabSound) { event.preventDefault(); setTab('sound'); return; }
    if (event.code === KEYS.clear && event.shiftKey) { event.preventDefault(); pressClear(); return; }

    if (tab === 'draw') {
      if (event.code === KEYS.brush) { setTool('brush'); return; }
      if (event.code === KEYS.eraser) { setTool('eraser'); return; }
      if (event.code === KEYS.fill) { setTool('fill'); return; }
      if (event.code === KEYS.picker) { setTool('picker'); return; }
      if (event.code === KEYS.sizeDown) { event.preventDefault(); stepSize(-1); return; }
      if (event.code === KEYS.sizeUp) { event.preventDefault(); stepSize(1); return; }
      if (event.code === KEYS.swap) { swapColours(); return; }
      if (event.code === KEYS.resetColors) {
        setColour(EDITOR.defaultColor);
        secondary = EDITOR.defaultSecondary;
        bgInput.value = secondary;
        return;
      }
      if (event.code === KEYS.mirror) { setMirror(!surface.settings.mirror); return; }
      if (event.code === KEYS.pixel) { setPixel(!surface.settings.pixel); return; }
      if (event.code === KEYS.ghost) { setGhost(!ghostOn); return; }
      if (event.code === KEYS.holes && slot.requiresFullCoverage) {
        event.preventDefault();
        if (event.repeat) return;
        holdHoles(true);
        return;
      }
    }

    if (tab === 'rig') {
      if (event.code === KEYS.armNext) { event.preventDefault(); armRole(nextUnplaced()); return; }
      if (event.code === KEYS.mesh) { meshChip.click(); return; }
      if (event.code === KEYS.playPause) { event.preventDefault(); togglePreview(); return; }
      if (event.code === 'Backspace' || event.code === 'Delete') {
        event.preventDefault();
        removePoint(selectedRole);
        return;
      }
      if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
        event.preventDefault();
        const list = rolesFor(rig.behaviour);
        const at = list.indexOf(selectedRole);
        const step = event.code === 'ArrowDown' ? 1 : -1;
        const index = at < 0 ? 0 : Math.min(list.length - 1, Math.max(0, at + step));
        selectedRole = list[index];
        refreshMarkers();
        refreshRoles();
        return;
      }
    }

    if (tab === 'sound') {
      if (event.code === KEYS.record) { event.preventDefault(); toggleRecord(); return; }
      if (event.code === KEYS.playPause) { event.preventDefault(); playCapture(); return; }
      if (event.code === 'Backspace') { event.preventDefault(); pressDelete(); }
    }
  }

  function blurTarget(event) {
    if (event.target && typeof event.target.blur === 'function') event.target.blur();
  }

  function onKeyUp(event) {
    if (event.code === KEYS.holes && holeHold) holdHoles(false);
    if (event.key === 'Alt' && altPrevious) {
      setTool(altPrevious);
      altPrevious = null;
    }
  }

  function onAltDown(event) {
    if (event.key !== 'Alt' || typing(event) || altPrevious || tab !== 'draw') return;
    altPrevious = surface.settings.tool;
    setTool('picker');
  }

  function onWindowPointerUp() {
    if (!dragRole) return;
    dragRole = null;
    commitRig(false);
  }

  function onResize() {
    if (resizeFrame !== 0) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (tab === 'rig') ensurePreview();
    });
  }

  function onVisibility() {
    if (!preview) return;
    if (document.hidden) preview.stop();
    else if (tab === 'rig' && previewRunning) preview.start();
    updatePlayButton();
  }

  surface.onRigClick(placePoint);
  surface.onPick((hex) => {
    fgInput.value = hex;
    hexInput.value = hex;
    setTool('brush');
    pushRecent(hex);
    drawHints();
  });

  fgInput.addEventListener('input', () => setColour(fgInput.value));
  bgInput.addEventListener('input', () => { secondary = normalizeHex(bgInput.value) || secondary; });
  hexInput.addEventListener('change', () => {
    const value = normalizeHex(hexInput.value);
    if (value) setColour(value);
    else hexInput.value = surface.settings.color;
  });
  hexInput.addEventListener('blur', () => { hexInput.value = surface.settings.color; });
  skip.addEventListener('click', () => surface.canvas.focus());

  if (asset.bitmap) surface.putImageData(asset.bitmap);
  const initialImage = currentImage();
  history.reset(initialImage, ops.length);
  if (!asset.bitmap) ops.length = 0;

  setTool('brush');
  setMirror(false);
  setPixel(false);
  setSizeIndex(EDITOR.defaultSizeIndex);
  setColour(EDITOR.defaultColor);
  bgInput.value = secondary;
  setGhost(slot.id !== 'hero');
  loadGhost();
  renderRecent();
  refreshBrush();
  refreshHistoryButtons();
  refreshCoverage(initialImage);
  refreshDone(initialImage);
  refreshRoles();
  refreshSound();
  setRecordLabel(copy.record, false);
  drawWaveform(0);
  tabButtons.draw.classList.add('is-on');
  tabOrder.forEach((id) => tabButtons[id].setAttribute('aria-selected', id === 'draw' ? 'true' : 'false'));
  Object.keys(behaviourButtons).forEach((key) => {
    behaviourButtons[key].classList.toggle('is-on', key === rig.behaviour);
  });
  showPanel(drawPanel, true);
  showPanel(rigPanel, false);
  showPanel(soundPanel, false);
  previewRunning = !reduceMotion();

  return {
    root,

    show() {
      if (!root.isConnected) document.body.appendChild(root);
      root.style.display = '';
      void root.offsetHeight;
      requestAnimationFrame(() => {
        root.classList.add('is-on');
        animate(head, enterFrames(0, -40), 240, SHELL.ease.snap);
        animate(rail, enterFrames(-60, 0), 240, SHELL.ease.snap, 40);
        animate(frame, [
          { opacity: 0, transform: 'scale(.965)' },
          { opacity: 1, transform: 'scale(1)' },
        ], 240, SHELL.ease.snap, 60);
        animate(inspect, enterFrames(24, 0), 240, SHELL.ease.snap, 80);
      });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keydown', onAltDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('pointerup', onWindowPointerUp);
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
      shown = true;
      return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
    },

    hide() {
      root.classList.remove('is-on');
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keydown', onAltDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      shown = false;
      if (preview) preview.stop();
      stopFpsTicker();
      stopPlayback();
      stopHoles();
      return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (shown) {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keydown', onAltDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('pointerup', onWindowPointerUp);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
      }
      stopFpsTicker();
      stopPlayback();
      stopHoles();
      clearConfirms();
      if (recordTimer !== 0) clearInterval(recordTimer);
      if (dragFrame !== 0) cancelAnimationFrame(dragFrame);
      if (resizeFrame !== 0) cancelAnimationFrame(resizeFrame);
      if (capFlashTimer !== 0) clearTimeout(capFlashTimer);
      if (recorder) recorder.dispose();
      recorder = null;
      if (preview) preview.dispose();
      preview = null;
      surface.dispose();
      if (root.isConnected) root.remove();
    },

    get tab() { return tab; },
    get rig() { return rig; },
    get preview() { return preview; },
    get surface() { return surface; },
    get coverage() { return measureCoverage(currentImage(), EDITOR.alphaThreshold); },
    get doneEnabled() { return !doneBtn.disabled; },
    setTab,
    armRole,
  };
}
