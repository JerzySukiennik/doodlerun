// DoodleRun — microphone capture: one short mono take per slot.
import { AUDIO } from '../config.js';

function emptyResult() {
  return { blob: null, url: null, durationMs: 0, mimeType: '' };
}

export function isRecordingSupported() {
  return typeof MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  for (let i = 0; i < AUDIO.mimeTypes.length; i += 1) {
    if (MediaRecorder.isTypeSupported(AUDIO.mimeTypes[i])) return AUDIO.mimeTypes[i];
  }
  return '';
}

export function createRecorder() {
  let stream = null;
  let recorder = null;
  let chunks = [];
  let state = 'idle';
  let timer = 0;
  let startedAt = 0;
  let cancelled = false;
  let disposed = false;
  let pending = null;
  let deliver = null;

  function settle(result) {
    const send = deliver;
    deliver = null;
    if (send) send(result);
  }

  function stopTracks() {
    if (!stream) return;
    const tracks = stream.getTracks();
    for (let i = 0; i < tracks.length; i += 1) tracks[i].stop();
    stream = null;
  }

  function finalize() {
    if (timer !== 0) {
      clearTimeout(timer);
      timer = 0;
    }
    const type = (recorder && recorder.mimeType) || pickMimeType() || '';
    const captured = chunks;
    chunks = [];
    state = disposed ? 'disposed' : 'idle';
    if (cancelled || captured.length === 0) {
      cancelled = false;
      settle(emptyResult());
      return;
    }
    const blob = new Blob(captured, type ? { type } : undefined);
    settle({
      blob,
      url: URL.createObjectURL(blob),
      durationMs: Math.min(AUDIO.maxMs, Math.round(performance.now() - startedAt)),
      mimeType: blob.type || type,
    });
  }

  async function ensureStream() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true },
    });
    return stream;
  }

  function stopNow() {
    if (!recorder || state !== 'recording') return;
    state = 'stopping';
    try {
      recorder.stop();
    } catch (err) {
      finalize();
    }
  }

  return {
    async start() {
      if (disposed || state === 'recording' || state === 'stopping') return;
      if (!isRecordingSupported()) throw new Error('unsupported');
      await ensureStream();
      if (disposed) {
        stopTracks();
        return;
      }
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      cancelled = false;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = finalize;
      recorder.onerror = () => {
        cancelled = true;
        finalize();
      };
      pending = new Promise((resolve) => { deliver = resolve; });
      startedAt = performance.now();
      state = 'recording';
      recorder.start();
      timer = setTimeout(stopNow, AUDIO.maxMs);
    },
    stop() {
      if (state === 'recording') stopNow();
      return pending || Promise.resolve(emptyResult());
    },
    cancel() {
      if (state !== 'recording') {
        chunks = [];
        return;
      }
      cancelled = true;
      stopNow();
    },
    get state() {
      return state;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelled = true;
      if (timer !== 0) {
        clearTimeout(timer);
        timer = 0;
      }
      if (recorder && state === 'recording') {
        try {
          recorder.stop();
        } catch (err) {
          settle(emptyResult());
        }
      } else {
        settle(emptyResult());
      }
      pending = null;
      recorder = null;
      chunks = [];
      state = 'disposed';
      stopTracks();
    },
  };
}

export function playSound(sound) {
  if (!sound || !sound.url) return null;
  const audio = new Audio(sound.url);
  audio.play();
  return audio;
}
