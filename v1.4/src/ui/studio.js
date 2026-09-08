// DoodleRun — the studio: one player, one part, four clicks and two bars.

import { COPY, SCREENS, MUSIC, SHELL } from '../config.js';
import { SLOT_BY_ID } from '../config.slots.js';
import { el, button } from './screens.css.js';
import { audioContext, resumeAudio, createMetronome, decodeLoop } from '../audio/song.js';

function pickMime() {
  const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (let i = 0; i < list.length; i += 1) {
    if (MediaRecorder.isTypeSupported(list[i])) return list[i];
  }
  return '';
}

export function createStudio(options) {
  const opts = options || {};
  const copy = COPY.studio;
  const slot = SLOT_BY_ID[opts.trackId];
  const song = opts.song;

  const root = el('section', 'dr-screen dr-studio');
  root.setAttribute('aria-label', copy.title);

  const head = el('header', 'dr-studio-head', root);
  button(copy.back, 'dr-btn-ghost', head, () => leave());
  const title = el('h2', 'dr-studio-title', head, slot ? slot.name : copy.title);
  el('p', 'dr-studio-tip', head, (copy.tip && copy.tip[opts.trackId]) || '');
  const doneBtn = button(copy.done, 'dr-btn-solid dr-studio-done', head, () => leave());

  const body = el('div', 'dr-studio-body', root);

  const stage = el('div', 'dr-studio-stage dr-raise', body);
  const state = el('div', 'dr-studio-state', stage, copy.ready);
  const beatRow = el('div', 'dr-studio-beats', stage);
  const beatDots = [];
  for (let i = 0; i < MUSIC.countIn + MUSIC.beats; i += 1) {
    const dot = el('i', 'dr-studio-beat', beatRow);
    if (i < MUSIC.countIn) dot.classList.add('is-countin');
    beatDots.push(dot);
  }
  const wave = el('canvas', 'dr-studio-wave', stage);
  wave.width = 900;
  wave.height = 150;
  const meta = el('p', 'dr-studio-meta', stage, copy.empty);

  const acts = el('div', 'dr-studio-acts', body);
  const recordBtn = button(copy.record, 'is-primary dr-studio-record', acts, () => toggleRecord());
  const playMine = button(copy.play, '', acts, () => previewMine());
  const playAll = button(copy.playAll, '', acts, () => previewAll());
  const clearBtn = button(copy.clear, '', acts, () => clearTake());

  const withOthers = el('label', 'dr-studio-toggle', body);
  const withOthersBox = el('input', null, withOthers);
  withOthersBox.type = 'checkbox';
  withOthersBox.checked = true;
  el('span', null, withOthers, copy.withOthers);

  const hint = el('p', 'dr-studio-hint', body, copy.hint);
  const micNote = el('p', 'dr-studio-mic', body, copy.noMic);
  micNote.hidden = true;

  const metronome = createMetronome();
  let stream = null;
  let recorder = null;
  let chunks = [];
  let phase = 'idle';
  let beatTimer = 0;
  let stopTimer = 0;
  let takeBlob = opts.blob || null;
  let takeBuffer = null;
  let preview = null;
  let disposed = false;

  function setPhase(next) {
    phase = next;
    root.dataset.phase = next;
    state.textContent = next === 'count' ? copy.countIn : next === 'record' ? copy.recording : copy.ready;
    recordBtn.textContent = next === 'record' || next === 'count' ? copy.stop : takeBlob ? copy.rerecord : copy.record;
    recordBtn.classList.toggle('is-live', next === 'record');
    playMine.disabled = !takeBlob || next !== 'idle';
    playAll.disabled = next !== 'idle' || (!takeBlob && song.size === 0);
    clearBtn.disabled = !takeBlob || next !== 'idle';
  }

  function litBeats(count) {
    beatDots.forEach((dot, i) => dot.classList.toggle('is-on', i < count));
  }

  function drawWave(buffer) {
    const ctx2 = wave.getContext('2d');
    ctx2.clearRect(0, 0, wave.width, wave.height);
    ctx2.fillStyle = SHELL.color.paper;
    ctx2.fillRect(0, 0, wave.width, wave.height);
    ctx2.strokeStyle = SHELL.color.edge;
    ctx2.lineWidth = 2;
    for (let i = 1; i < MUSIC.beats; i += 1) {
      const x = (wave.width / MUSIC.beats) * i;
      ctx2.beginPath();
      ctx2.moveTo(x, 0);
      ctx2.lineTo(x, wave.height);
      ctx2.stroke();
    }
    if (!buffer) return;
    const data = buffer.getChannelData(0);
    const cols = wave.width;
    const per = Math.max(1, Math.floor(data.length / cols));
    ctx2.fillStyle = SHELL.color.ink;
    for (let x = 0; x < cols; x += 1) {
      let peak = 0;
      const from = x * per;
      for (let i = 0; i < per; i += 1) {
        const v = Math.abs(data[from + i] || 0);
        if (v > peak) peak = v;
      }
      const h = Math.max(2, peak * wave.height * 0.92);
      ctx2.fillRect(x, (wave.height - h) / 2, 1, h);
    }
  }

  async function showTake() {
    if (!takeBlob) {
      takeBuffer = null;
      drawWave(null);
      meta.textContent = copy.empty;
      return;
    }
    takeBuffer = await decodeLoop(takeBlob);
    drawWave(takeBuffer);
    meta.textContent = copy.length((MUSIC.loopMs / 1000).toFixed(1));
  }

  async function ensureStream() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    return stream;
  }

  function clearTimers() {
    if (beatTimer) window.clearInterval(beatTimer);
    if (stopTimer) window.clearTimeout(stopTimer);
    beatTimer = 0;
    stopTimer = 0;
  }

  // The clicks, the other players' loop and the recorder all hang off one moment
  // on the audio clock, so a take starts exactly on the downbeat.
  async function startRecording() {
    const ctx = resumeAudio();
    if (!ctx) return;
    try {
      await ensureStream();
    } catch (error) {
      micNote.hidden = false;
      setPhase('idle');
      return;
    }
    if (disposed) return;
    micNote.hidden = true;

    const begin = ctx.currentTime + 0.35;
    const startAt = begin + (MUSIC.countIn * MUSIC.beatMs) / 1000;
    metronome.schedule(MUSIC.countIn + MUSIC.beats, begin, 4);
    if (withOthersBox.checked && song.size > 0) song.play(opts.trackId, startAt);

    setPhase('count');
    litBeats(0);
    const beat = MUSIC.beatMs / 1000;
    beatTimer = window.setInterval(() => {
      const elapsed = ctx.currentTime - begin;
      const count = Math.max(0, Math.min(beatDots.length, Math.floor(elapsed / beat) + 1));
      litBeats(count);
      if (elapsed >= (MUSIC.countIn * MUSIC.beatMs) / 1000 && phase === 'count') setPhase('record');
    }, 40);

    const mimeType = pickMime();
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = finishRecording;

    window.setTimeout(() => {
      if (disposed || phase === 'idle') return;
      try {
        recorder.start();
      } catch (error) {
        cancelRecording();
        return;
      }
      stopTimer = window.setTimeout(() => {
        if (recorder && recorder.state === 'recording') recorder.stop();
      }, MUSIC.loopMs);
    }, Math.max(0, (startAt - ctx.currentTime) * 1000));
  }

  function finishRecording() {
    clearTimers();
    litBeats(0);
    song.stop();
    const type = (recorder && recorder.mimeType) || 'audio/webm';
    const captured = chunks;
    chunks = [];
    recorder = null;
    if (captured.length > 0) {
      takeBlob = new Blob(captured, { type });
      showTake().then(() => {
        if (opts.onTake) opts.onTake(opts.trackId, takeBlob);
      });
    }
    setPhase('idle');
  }

  function cancelRecording() {
    clearTimers();
    litBeats(0);
    song.stop();
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      return;
    }
    recorder = null;
    setPhase('idle');
  }

  function toggleRecord() {
    if (phase === 'idle') startRecording();
    else cancelRecording();
  }

  function stopPreview() {
    if (preview) {
      try {
        preview.stop();
      } catch (error) {
        // Already finished.
      }
      preview = null;
    }
    song.stop();
    playMine.textContent = copy.play;
    playAll.textContent = copy.playAll;
  }

  function previewMine() {
    const ctx = resumeAudio();
    if (!ctx || !takeBuffer) return;
    if (preview) {
      stopPreview();
      return;
    }
    const node = ctx.createBufferSource();
    node.buffer = takeBuffer;
    node.loop = true;
    node.loopEnd = MUSIC.loopMs / 1000;
    node.connect(ctx.destination);
    node.start();
    preview = node;
    playMine.textContent = copy.stopPlay;
  }

  function previewAll() {
    if (song.playing || preview) {
      stopPreview();
      return;
    }
    const ctx = resumeAudio();
    if (!ctx) return;
    const when = song.play(takeBuffer ? opts.trackId : null);
    if (takeBuffer) {
      const node = ctx.createBufferSource();
      node.buffer = takeBuffer;
      node.loop = true;
      node.loopEnd = MUSIC.loopMs / 1000;
      node.connect(ctx.destination);
      node.start(when || ctx.currentTime + 0.08);
      preview = node;
    }
    playAll.textContent = copy.stopPlay;
  }

  function clearTake() {
    takeBlob = null;
    takeBuffer = null;
    stopPreview();
    showTake();
    setPhase('idle');
    if (opts.onTake) opts.onTake(opts.trackId, null);
  }

  function leave() {
    stopPreview();
    cancelRecording();
    if (opts.onExit) opts.onExit();
  }

  function onKeyDown(event) {
    if (event.target && event.target.tagName === 'INPUT') return;
    if (event.code === 'Escape') {
      event.preventDefault();
      leave();
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      toggleRecord();
    }
  }

  setPhase('idle');
  showTake();

  return {
    root,
    show() {
      if (!root.isConnected) document.body.appendChild(root);
      void root.offsetHeight;
      root.classList.add('is-on');
      window.addEventListener('keydown', onKeyDown);
      audioContext();
      return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
    },
    hide() {
      root.classList.remove('is-on');
      window.removeEventListener('keydown', onKeyDown);
      stopPreview();
      return new Promise((resolve) => window.setTimeout(resolve, SCREENS.fadeMs));
    },
    dispose() {
      disposed = true;
      clearTimers();
      stopPreview();
      window.removeEventListener('keydown', onKeyDown);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      stream = null;
      if (root.isConnected) root.remove();
    },
  };
}
