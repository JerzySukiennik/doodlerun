// DoodleRun — the menu screen: title slab, nav list, how-it-works panel and footer.

import { COPY, SCREENS } from '../config.js';
import { el, button } from './screens.css.js';
import { summary } from '../state/assets.js';

export function createMenu(options) {
  const opts = options || {};
  const copy = COPY.menu;

  const root = el('section', 'dr-screen dr-menu');
  root.id = 'dr-menu';
  root.setAttribute('aria-labelledby', 'dr-menu-title');

  const col = el('div', 'dr-menu-col', root);
  const brand = el('div', 'dr-brand dr-raise', col);
  const title = el('h1', 'dr-title', brand);
  title.id = 'dr-menu-title';
  el('span', null, title, copy.titleA);
  el('span', 'dr-title-run', title, copy.titleB);
  el('p', 'dr-tagline', col, copy.tagline);

  const nav = el('nav', 'dr-nav', col);
  nav.setAttribute('aria-label', copy.panelTitle);

  const items = new Map();
  copy.nav.forEach((entry, index) => {
    const item = el('button', 'dr-nav-item', nav);
    item.type = 'button';
    item.dataset.act = entry.id;
    item.style.setProperty('--dr-delay', `${SCREENS.navDelayMs + index * SCREENS.navStaggerMs}ms`);
    el('span', 'dr-nav-idx', item, entry.idx);
    el('span', 'dr-nav-text', item, entry.label);
    const note = el('span', 'dr-nav-note', item, entry.note);
    item.addEventListener('click', () => activate(entry.id));
    items.set(entry.id, { item, note, entry });
  });

  const panels = el('div', 'dr-panels', root);
  const panel = el('div', 'dr-panel', panels);
  panel.id = 'dr-panel-how';
  el('h3', null, panel, copy.panelTitle);
  copy.steps.forEach(([lead, body]) => {
    const p = el('p', null, panel);
    el('b', null, p, lead);
    p.appendChild(document.createTextNode(` ${body}`));
  });
  el('div', 'dr-panel-foot', panel, copy.panelFoot);

  const foot = el('footer', 'dr-foot', root);
  copy.footer.forEach((line) => el('span', null, foot, line));

  let panelOpen = false;
  let settleTimer = 0;
  let demoReady = false;

  function setPanel(open) {
    panelOpen = open;
    panel.classList.toggle('is-on', open);
    const how = items.get('how');
    if (how) {
      how.item.classList.toggle('is-active', open);
      how.item.setAttribute('aria-expanded', String(open));
    }
  }

  function activate(id) {
    if (id === 'how') {
      setPanel(!panelOpen);
      return;
    }
    setPanel(false);
    if (id === 'new' && opts.onPlay) opts.onPlay('new');
    else if (id === 'continue') (opts.onContinue || opts.onPlay)('continue');
    else if (id === 'demo' && opts.onDemo) opts.onDemo();
  }

  function refresh() {
    const stats = summary();
    const drawn = stats.total - stats.empty;
    const cont = items.get('continue');
    if (cont) {
      const off = drawn === 0;
      cont.item.disabled = off;
      cont.note.textContent = off ? cont.entry.noteOff : cont.entry.note;
    }
    const demo = items.get('demo');
    if (demo) {
      demo.item.disabled = !demoReady;
      demo.note.textContent = demoReady ? demo.entry.note : demo.entry.noteOff;
    }
  }

  function setDemoReady(ready) {
    demoReady = !!ready;
    refresh();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && panelOpen) {
      event.preventDefault();
      setPanel(false);
    }
  }

  function show() {
    if (!root.isConnected) document.body.appendChild(root);
    root.style.display = '';
    root.classList.remove('is-settled');
    refresh();
    void root.offsetHeight;
    root.classList.add('is-on');
    window.addEventListener('keydown', onKeyDown);
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => root.classList.add('is-settled'), SCREENS.navDelayMs + copy.nav.length * SCREENS.navStaggerMs + 400);
    return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
  }

  function hide() {
    root.classList.remove('is-on');
    window.removeEventListener('keydown', onKeyDown);
    window.clearTimeout(settleTimer);
    setPanel(false);
    return new Promise((resolve) => window.setTimeout(() => {
      root.style.display = 'none';
      root.classList.remove('is-settled');
      resolve();
    }, SCREENS.fadeMs));
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.clearTimeout(settleTimer);
    if (root.isConnected) root.remove();
  }

  refresh();

  return { root, show, hide, dispose, refresh, setDemoReady };
}
