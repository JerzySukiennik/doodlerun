// DoodleRun — undo/redo snapshots for the open editor.
import { EDITOR } from '../config.js';

function copyImageData(imageData) {
  if (!imageData) return null;
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function snapshot(imageData, opCount) {
  return { imageData: copyImageData(imageData), opCount: Math.max(0, opCount | 0) };
}

function expose(entry) {
  if (!entry) return null;
  return { imageData: copyImageData(entry.imageData), opCount: entry.opCount };
}

export function createHistory(limit = EDITOR.historyLimit) {
  const max = Math.max(1, limit | 0);
  let stack = [];
  let index = -1;

  return {
    reset(imageData, opCount) {
      stack = [snapshot(imageData, opCount)];
      index = 0;
    },
    push(imageData, opCount) {
      if (index < 0) {
        stack = [snapshot(imageData, opCount)];
        index = 0;
        return;
      }
      stack.length = index + 1;
      stack.push(snapshot(imageData, opCount));
      index = stack.length - 1;
      while (stack.length > max + 1) {
        stack.shift();
        index -= 1;
      }
    },
    undo() {
      if (index <= 0) return null;
      index -= 1;
      return expose(stack[index]);
    },
    redo() {
      if (index < 0 || index >= stack.length - 1) return null;
      index += 1;
      return expose(stack[index]);
    },
    canUndo() {
      return index > 0;
    },
    canRedo() {
      return index >= 0 && index < stack.length - 1;
    },
  };
}
