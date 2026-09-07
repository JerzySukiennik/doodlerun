// DoodleRun — the board screen: hero row, the four slot groups, the progress ledger and the set summary.

import { COPY, SCREENS, EDITOR } from '../config.js';
import { CATEGORIES, SLOTS, slotsByCategory } from '../config.slots.js';
import { el, button } from './screens.css.js';
import { getAsset, listAssets, subscribe } from '../state/assets.js';

let coverageModule = null;
let coverageLoading = false;

function copyCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function createBoard(options) {
  const opts = options || {};
  const copy = COPY.board;
  const heroSlot = SLOTS.find((slot) => slot.category === 'hero');
  const sharedTotal = SLOTS.length;

  const root = el('section', 'dr-screen dr-board');
  root.id = 'dr-board';
  root.setAttribute('aria-labelledby', 'dr-board-title');
  root.style.display = 'none';

  const skip = el('a', 'dr-skip', root, copy.skip);
  skip.href = '#dr-board-scroll';

  const head = el('header', 'dr-board-head', root);
  button(copy.back, 'dr-btn-ghost', head, () => opts.onBack && opts.onBack());
  const title = el('h2', 'dr-board-title', head, copy.title);
  title.id = 'dr-board-title';
  el('p', 'dr-board-sub', head, copy.sub);

  const scroll = el('div', 'dr-board-scroll', root);
  scroll.id = 'dr-board-scroll';
  scroll.tabIndex = -1;

  const cards = new Map();

  const heroRow = el('section', 'dr-hero-row', scroll);
  el('span', 'dr-hero-label', heroRow, copy.heroLabel);
  const heroCard = buildHeroCard(heroSlot, heroRow);

  CATEGORIES.filter((cat) => cat.id !== 'hero').forEach((cat) => {
    const slots = slotsByCategory(cat.id);
    const group = el('section', 'dr-group', scroll);
    group.dataset.group = cat.id;
    const groupHead = el('div', 'dr-group-head', group);
    el('span', 'dr-group-name', groupHead, copy.groups[cat.id].name);
    el('span', 'dr-group-count', groupHead, copy.groups[cat.id].count);
    const grid = el('div', 'dr-grid', group);
    slots.forEach((slot, i) => buildCard(slot, grid, i + 1, slots.length, copy.groups[cat.id].name));
  });

  const bar = el('footer', 'dr-actionbar', root);
  const pipWrap = el('div', 'dr-pips', bar);
  pipWrap.setAttribute('aria-hidden', 'true');
  const pips = SLOTS.map(() => el('i', 'dr-pip', pipWrap));
  const counts = el('div', 'dr-counts', bar);
  const countDrawn = el('span', null, counts, copy.drawn(0, sharedTotal));
  const countRigged = el('span', null, counts, copy.rigged(0));
  const countSound = el('span', null, counts, copy.sound(0));
  const startWrap = el('div', 'dr-start-wrap', bar);
  const startNote = el('span', 'dr-start-note', startWrap, copy.consequenceNone);
  const startBtn = button(copy.start, 'dr-btn-solid dr-start', startWrap, () => opts.onStart && opts.onStart());

  const live = el('div', 'dr-live', root);
  live.setAttribute('aria-live', 'polite');
  live.style.position = 'absolute';
  live.style.left = '-9999px';

  const modal = el('div', 'dr-modal', root);
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', copy.summaryTitle);
  el('h2', null, modal, copy.summaryTitle);
  el('p', 'dr-modal-line', modal, copy.summaryLine);
  const modalGrid = el('div', 'dr-modal-grid', modal);
  const modalActs = el('div', 'dr-modal-acts', modal);
  button(copy.summaryBack, '', modalActs, () => closeSummary());
  button(copy.summaryMenu, '', modalActs, () => {
    closeSummary();
    if (opts.onBack) opts.onBack();
  });
  const modalCells = new Map();
  SLOTS.forEach((slot) => {
    const cell = el('div', 'dr-modal-cell', modalGrid);
    const thumb = el('span', 'dr-slot-thumb', cell);
    thumb.style.setProperty('--dr-ar', String(slot.width / slot.height));
    el('span', null, cell, slot.name);
    const state = el('em', null, cell, copy.stateEmpty);
    modalCells.set(slot.id, { thumb, state });
  });

  let unsubscribe = null;
  let settleTimer = 0;
  let landTimer = 0;
  let modalOpen = false;

  function buildCard(slot, parent, indexInGroup, groupCount, groupName) {
    const card = el('button', 'dr-slot dr-card dr-raise is-empty', parent);
    card.type = 'button';
    card.dataset.cat = slot.category;
    card.dataset.slot = slot.id;
    const order = SLOTS.indexOf(slot) + 1;
    el('span', 'dr-slot-idx', card, String(order).padStart(2, '0'));
    const thumb = el('span', 'dr-slot-thumb', card);
    thumb.style.setProperty('--dr-ar', String(slot.width / slot.height));
    el('span', 'dr-slot-name', card, slot.name);
    el('span', 'dr-slot-note', card, copy.notes[slot.id]);
    const state = el('span', 'dr-slot-state', card);
    el('i', null, state);
    const stateText = el('span', 'dr-slot-state-text', state, copy.stateEmpty);
    card.addEventListener('click', () => opts.onOpen && opts.onOpen(slot.id));
    const record = { slot, card, thumb, state, stateText, indexInGroup, groupCount, groupName };
    cards.set(slot.id, record);
    return record;
  }

  function buildHeroCard(slot, parent) {
    const card = el('button', 'dr-slot dr-card dr-slot-hero dr-raise is-empty', parent);
    card.type = 'button';
    card.dataset.cat = slot.category;
    card.dataset.slot = slot.id;
    el('span', 'dr-hero-ledger', card, copy.heroLedger);
    const thumb = el('span', 'dr-slot-thumb', card);
    thumb.style.setProperty('--dr-ar', String(slot.width / slot.height));
    const text = el('div', 'dr-hero-text', card);
    el('span', 'dr-slot-name', text, slot.name);
    el('span', 'dr-slot-note', text, copy.notes[slot.id]);
    const state = el('span', 'dr-slot-state', text);
    el('i', null, state);
    const stateText = el('span', 'dr-slot-state-text', state, copy.heroEmptyState);
    const cta = el('span', 'dr-btn dr-btn-solid dr-hero-cta', card, copy.heroDraw);
    card.addEventListener('click', () => opts.onOpen && opts.onOpen(slot.id));
    const record = { slot, card, thumb, state, stateText, cta, indexInGroup: 1, groupCount: 1, groupName: copy.heroLabel };
    cards.set(slot.id, record);
    return record;
  }

  function ensureCoverage() {
    if (coverageModule || coverageLoading) return;
    coverageLoading = true;
    import('../draw/coverage.js').then((mod) => {
      coverageModule = mod;
      refresh();
    }).catch(() => {
      coverageLoading = false;
    });
  }

  function coveragePercent(asset) {
    if (!asset.bitmap) return null;
    if (!coverageModule) {
      ensureCoverage();
      return null;
    }
    const measured = coverageModule.measureCoverage(asset.bitmap, EDITOR.alphaThreshold);
    return Math.floor(measured.ratio * 100);
  }

  function stateWords(slot, asset) {
    if (asset.status === 'empty') return slot.category === 'hero' ? copy.heroEmptyState : copy.stateEmpty;
    if (asset.status === 'ready') return copy.stateDone;
    if (slot.requiresFullCoverage) {
      const pct = coveragePercent(asset);
      if (pct !== null) return `${copy.stateProgress} · ${copy.progressPercent(pct)}`;
    }
    return `${copy.stateProgress} · ${copy.progressStrokes(asset.ops.length)}`;
  }

  function paintThumb(record, asset) {
    const current = record.thumb.querySelector('canvas');
    if (!asset.thumbnail) {
      if (current) current.remove();
      return;
    }
    if (current !== asset.thumbnail) {
      if (current) current.remove();
      record.thumb.appendChild(asset.thumbnail);
    }
  }

  function updateCard(slotId) {
    const record = cards.get(slotId);
    if (!record) return;
    const asset = getAsset(slotId);
    const slot = record.slot;
    record.card.classList.toggle('is-empty', asset.status === 'empty');
    record.card.classList.toggle('is-progress', asset.status === 'working');
    record.card.classList.toggle('is-working', asset.status === 'working');
    record.card.classList.toggle('is-done', asset.status === 'ready');
    record.card.classList.toggle('is-ready', asset.status === 'ready');
    record.card.classList.toggle('is-hero', slot.category === 'hero');
    paintThumb(record, asset);
    const words = stateWords(slot, asset);
    record.stateText.textContent = words;
    const chips = record.state.querySelectorAll('.dr-slot-chip');
    chips.forEach((chip) => chip.remove());
    if (asset.status === 'ready') {
      if (Object.keys(asset.rig.points).length > 0) el('span', 'dr-slot-chip', record.state, copy.chipRigged);
      if (asset.sound.url) el('span', 'dr-slot-chip', record.state, copy.chipSound);
    }
    if (record.cta) record.cta.textContent = asset.status === 'empty' ? copy.heroDraw : copy.heroEdit;
    record.card.setAttribute('aria-label', copy.cardAria(slot.name, record.groupName, record.indexInGroup, record.groupCount, words));
    const cell = modalCells.get(slotId);
    if (cell) {
      cell.state.textContent = words;
      const existing = cell.thumb.querySelector('canvas');
      if (existing) existing.remove();
      if (asset.thumbnail) cell.thumb.appendChild(copyCanvas(asset.thumbnail));
    }
  }

  function updateBar() {
    const assets = listAssets();
    let drawn = 0;
    let rigged = 0;
    let sound = 0;
    assets.forEach((asset, i) => {
      const pip = pips[i];
      pip.classList.toggle('is-working', asset.status === 'working');
      pip.classList.toggle('is-ready', asset.status === 'ready');
      if (asset.status !== 'empty') drawn += 1;
      if (Object.keys(asset.rig.points).length > 0) rigged += 1;
      if (asset.sound.url) sound += 1;
    });
    countDrawn.textContent = copy.drawn(drawn, sharedTotal);
    countRigged.textContent = copy.rigged(rigged);
    countSound.textContent = copy.sound(sound);
    const missing = sharedTotal - drawn;
    startNote.textContent = missing === 0 ? copy.consequenceAll
      : drawn === 0 ? copy.consequenceNone
      : copy.consequenceSome(missing);
  }

  function refresh(landSlotId) {
    SLOTS.forEach((slot) => updateCard(slot.id));
    updateBar();
    if (landSlotId) {
      const record = cards.get(landSlotId);
      if (record) {
        window.clearTimeout(landTimer);
        record.card.classList.remove('is-landing');
        landTimer = window.setTimeout(() => {
          record.card.classList.add('is-landing');
          window.setTimeout(() => record.card.classList.remove('is-landing'), SCREENS.landMs + 60);
        }, SCREENS.fadeMs);
      }
    }
  }

  function stageRowDelays() {
    const rows = new Map();
    cards.forEach((record) => {
      if (record.slot.category === 'hero') return;
      const top = Math.round(record.card.getBoundingClientRect().top);
      if (!rows.has(top)) rows.set(top, []);
      rows.get(top).push(record.card);
    });
    Array.from(rows.keys()).sort((a, b) => a - b).forEach((top, index) => {
      const delay = `${SCREENS.rowDelayMs + index * SCREENS.rowStaggerMs}ms`;
      rows.get(top).forEach((card) => card.style.setProperty('--dr-delay', delay));
    });
  }

  function cardList() {
    return Array.from(root.querySelectorAll('.dr-slot'));
  }

  function moveFocus(dx, dy) {
    const list = cardList();
    const active = document.activeElement;
    if (!list.includes(active)) {
      list[0].focus();
      return;
    }
    const from = active.getBoundingClientRect();
    let best = null;
    let bestScore = Infinity;
    list.forEach((node) => {
      if (node === active) return;
      const box = node.getBoundingClientRect();
      const ex = box.left - from.left;
      const ey = box.top - from.top;
      if (dx > 0 && ex <= 4) return;
      if (dx < 0 && ex >= -4) return;
      if (dy > 0 && ey <= 4) return;
      if (dy < 0 && ey >= -4) return;
      const score = Math.abs(ex) * (dx ? 1 : 3) + Math.abs(ey) * (dy ? 1 : 3);
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    });
    if (best) best.focus();
  }

  function openSummary() {
    modalOpen = true;
    refresh();
    modal.classList.add('is-on');
    const first = modal.querySelector('.dr-btn');
    if (first) first.focus();
  }

  function closeSummary() {
    if (!modalOpen) return;
    modalOpen = false;
    modal.classList.remove('is-on');
    refresh();
    startBtn.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (modalOpen) closeSummary();
      else if (opts.onBack) opts.onBack();
      return;
    }
    if (modalOpen) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (opts.onStart) opts.onStart();
      return;
    }
    const target = document.activeElement;
    if (target && (target.tagName === 'INPUT' || target.isContentEditable)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(1, 0); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(-1, 0); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(0, 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(0, -1); }
    else if (event.code === 'KeyH') { event.preventDefault(); heroCard.card.focus(); }
  }

  function show() {
    if (!root.isConnected) document.body.appendChild(root);
    root.style.display = '';
    root.classList.remove('is-settled');
    void root.offsetHeight;
    stageRowDelays();
    root.classList.add('is-on');
    if (!unsubscribe) unsubscribe = subscribe((slotId) => {
      updateCard(slotId);
      updateBar();
    });
    window.addEventListener('keydown', onKeyDown);
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => root.classList.add('is-settled'), 900);
    return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
  }

  function hide() {
    root.classList.remove('is-on');
    window.removeEventListener('keydown', onKeyDown);
    window.clearTimeout(settleTimer);
    window.clearTimeout(landTimer);
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    closeSummary();
    return new Promise((resolve) => window.setTimeout(() => {
      root.style.display = 'none';
      root.classList.remove('is-settled');
      resolve();
    }, SCREENS.fadeMs));
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (root.isConnected) root.remove();
  }

  refresh();

  return { root, show, hide, dispose, refresh, showSummary: openSummary, closeSummary };
}
