// DoodleRun — the soundtrack: four-odd microphone loops kept in lockstep and sped up with the run.

import { MUSIC } from '../config.js';

let context = null;

export function audioContext() {
  if (context) return context;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

export function resumeAudio() {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export async function decodeLoop(blob) {
  const ctx = audioContext();
  if (!ctx || !blob) return null;
  const bytes = await blob.arrayBuffer();
  return new Promise((resolve) => {
    ctx.decodeAudioData(bytes.slice(0), (buffer) => resolve(buffer), () => resolve(null));
  });
}

// Every loop is forced to the same length. The playing inside a take can wander;
// what cannot wander is where the take starts and ends, or the parts drift apart
// a little further on every repeat.
export function createSong() {
  const buffers = new Map();
  const sources = new Map();
  const gains = new Map();
  let playing = false;
  let rate = 1;
  let master = null;

  function ensureMaster() {
    const ctx = audioContext();
    if (!ctx) return null;
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    return master;
  }

  function stopSource(id) {
    const node = sources.get(id);
    if (!node) return;
    try {
      node.stop();
    } catch (error) {
      // Already stopped: nothing to undo.
    }
    sources.delete(id);
    gains.delete(id);
  }

  function startSource(id, when) {
    const ctx = audioContext();
    const buffer = buffers.get(id);
    const out = ensureMaster();
    if (!ctx || !buffer || !out) return;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.loopStart = 0;
    node.loopEnd = MUSIC.loopMs / 1000;
    node.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = id === 'drums' ? 1 : 0.85;
    node.connect(gain);
    gain.connect(out);
    node.start(when);
    sources.set(id, node);
    gains.set(id, gain);
  }

  return {
    async setTrack(id, blob) {
      const buffer = await decodeLoop(blob);
      if (!buffer) return false;
      buffers.set(id, buffer);
      if (playing) {
        stopSource(id);
        const ctx = audioContext();
        startSource(id, ctx.currentTime + 0.06);
      }
      return true;
    },
    clearTrack(id) {
      buffers.delete(id);
      stopSource(id);
    },
    hasTrack(id) {
      return buffers.has(id);
    },
    get ids() {
      return Array.from(buffers.keys());
    },
    get size() {
      return buffers.size;
    },
    get playing() {
      return playing;
    },
    // `except` lets the studio play everybody else's parts while you record yours.
    play(except, at) {
      const ctx = resumeAudio();
      if (!ctx || buffers.size === 0) return 0;
      this.stop();
      const when = at && at > ctx.currentTime ? at : ctx.currentTime + 0.08;
      buffers.forEach((buffer, id) => {
        if (except && id === except) return;
        startSource(id, when);
      });
      playing = sources.size > 0;
      return when;
    },
    stop() {
      Array.from(sources.keys()).forEach(stopSource);
      playing = false;
    },
    setRate(next) {
      rate = Math.max(0.5, Math.min(MUSIC.tempoCap, next));
      sources.forEach((node) => {
        node.playbackRate.value = rate;
      });
    },
    setVolume(value) {
      const out = ensureMaster();
      if (out) out.gain.value = Math.max(0, Math.min(1, value));
    },
  };
}

export function createMetronome() {
  let stopAt = 0;

  return {
    // Schedules the clicks up front so they land on the beat regardless of what
    // the main thread is doing while the microphone spins up.
    schedule(beats, startAt, accentEvery) {
      const ctx = resumeAudio();
      if (!ctx) return 0;
      const beat = MUSIC.beatMs / 1000;
      const begin = startAt || ctx.currentTime + 0.1;
      for (let i = 0; i < beats; i += 1) {
        const when = begin + i * beat;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const accent = accentEvery ? i % accentEvery === 0 : i === 0;
        osc.frequency.value = accent ? MUSIC.clickAccentHz : MUSIC.clickHz;
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(accent ? 0.45 : 0.26, when + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + MUSIC.clickMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(when);
        osc.stop(when + MUSIC.clickMs / 1000 + 0.02);
      }
      stopAt = begin + beats * beat;
      return begin;
    },
    get endsAt() {
      return stopAt;
    },
  };
}
