// DoodleRun — the rooms screen: open one, or join a room that is already drawing.

import { COPY, SCREENS, NET } from '../config.js';
import { el, button } from './screens.css.js';

export function createRooms(options) {
  const opts = options || {};
  const copy = COPY.rooms;

  const root = el('section', 'dr-screen dr-rooms');
  root.style.display = 'none';
  root.setAttribute('aria-labelledby', 'dr-rooms-title');

  const head = el('header', 'dr-rooms-head', root);
  button(copy.back, 'dr-btn-ghost', head, () => opts.onBack && opts.onBack());
  const title = el('h2', 'dr-rooms-title', head, copy.title);
  title.id = 'dr-rooms-title';
  el('p', 'dr-rooms-sub', head, copy.sub);

  const body = el('div', 'dr-rooms-body', root);

  const side = el('div', 'dr-rooms-side dr-raise', body);
  const nickField = el('label', 'dr-field', side);
  el('span', 'dr-field-label', nickField, copy.nick);
  const nickInput = el('input', 'dr-input', nickField);
  nickInput.type = 'text';
  nickInput.maxLength = 16;
  nickInput.placeholder = copy.nickPlaceholder;
  nickInput.value = opts.nick || '';

  const hostBtn = button(copy.hostBtn, 'is-primary dr-rooms-host', side, () => doHost());
  el('p', 'dr-field-note', side, copy.hostNote);

  const joinField = el('label', 'dr-field', side);
  el('span', 'dr-field-label', joinField, copy.joinLabel);
  const joinRow = el('div', 'dr-rooms-joinrow', joinField);
  const codeInput = el('input', 'dr-input dr-code-input', joinRow);
  codeInput.type = 'text';
  codeInput.maxLength = NET.codeLength;
  codeInput.placeholder = 'ABCD';
  codeInput.autocapitalize = 'characters';
  const joinBtn = button(copy.joinBtn, '', joinRow, () => doJoin(codeInput.value.trim().toUpperCase()));
  const error = el('p', 'dr-rooms-error', side, '');
  error.hidden = true;

  const listWrap = el('div', 'dr-rooms-list-wrap', body);
  el('span', 'dr-field-label', listWrap, copy.listLabel);
  const list = el('div', 'dr-rooms-list', listWrap);
  const empty = el('p', 'dr-rooms-empty', listWrap, copy.listEmpty);

  let unwatch = null;
  let busy = false;

  function setError(text) {
    error.textContent = text || '';
    error.hidden = !text;
  }

  function setBusy(next) {
    busy = next;
    hostBtn.disabled = next;
    joinBtn.disabled = next;
    hostBtn.textContent = next ? copy.connecting : copy.hostBtn;
  }

  function nick() {
    return nickInput.value.trim();
  }

  async function doHost() {
    if (busy) return;
    if (!nick()) {
      setError(copy.errNick);
      nickInput.focus();
      return;
    }
    setError('');
    setBusy(true);
    try {
      await opts.onHost(nick());
    } catch (err) {
      setError(copy.errNet);
    }
    setBusy(false);
  }

  async function doJoin(code) {
    if (busy) return;
    if (!nick()) {
      setError(copy.errNick);
      nickInput.focus();
      return;
    }
    if (!code || code.length !== NET.codeLength) {
      setError(copy.errCode);
      codeInput.focus();
      return;
    }
    setError('');
    setBusy(true);
    try {
      await opts.onJoin(code, nick());
    } catch (err) {
      const reason = String(err && err.message);
      setError(reason === 'no room' ? copy.errMissing : reason === 'full' ? copy.errFull : copy.errNet);
    }
    setBusy(false);
  }

  function renderList(rows) {
    list.textContent = '';
    empty.hidden = rows.length > 0;
    rows.forEach((row) => {
      const card = el('div', 'dr-room-row dr-raise', list);
      const info = el('div', 'dr-room-info', card);
      el('strong', 'dr-room-code', info, row.code);
      el('span', 'dr-room-meta', info, `${row.nick} · ${copy.listOne(row.players)} · ${row.phase === 'run' ? copy.phaseRun : copy.phaseLobby}`);
      const full = row.players >= NET.maxPlayers;
      const act = button(full ? copy.full : copy.join, full ? '' : 'is-primary', card, () => doJoin(row.code));
      act.disabled = full;
    });
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (opts.onBack) opts.onBack();
    }
  }

  return {
    root,
    async show() {
      if (!root.isConnected) document.body.appendChild(root);
      root.style.display = '';
      void root.offsetHeight;
      root.classList.add('is-on');
      window.addEventListener('keydown', onKeyDown);
      setError('');
      if (opts.watchRooms) {
        try {
          unwatch = await opts.watchRooms(renderList);
        } catch (err) {
          setError(copy.errNet);
        }
      }
      return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
    },
    hide() {
      root.classList.remove('is-on');
      window.removeEventListener('keydown', onKeyDown);
      if (unwatch) {
        unwatch();
        unwatch = null;
      }
      return new Promise((resolve) => window.setTimeout(() => {
        root.style.display = 'none';
        resolve();
      }, SCREENS.fadeMs));
    },
    dispose() {
      if (unwatch) unwatch();
      window.removeEventListener('keydown', onKeyDown);
      if (root.isConnected) root.remove();
    },
    setNick(value) {
      nickInput.value = value || '';
    },
  };
}
