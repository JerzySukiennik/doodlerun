# DoodleRun v1 — Implementation Brief (Planner)

Authoritative sources: `/Users/jurek/.claude/plans/planuj-purrfect-origami.md` (build plan) and `/Users/jurek/Downloads/Claude/ClaudeMemory/projects/doodlerun.md` (scope). Where this brief adds detail, the detail is binding; where it would contradict the plan, the plan wins. Visual and interaction detail lives in `.claude/SPEC-ui.md` and is binding for anything the UI touches.

## 0. Ground rules for the Coder

- Vanilla Canvas 2D, native ES modules loaded straight from `index.html`, no importmap, no build, no third-party code, no network calls, no `fetch`, no `localStorage` (assets are never persisted by design).
- Desktop only, mouse/trackpad. Below 960 px viewport width show a flat "DoodleRun needs a desktop window" overlay (stage 7).
- All UI text, code, identifiers and commit messages in English.
- Every file starts with exactly one comment line: `// DoodleRun — <what this file owns>.` No other comments anywhere.
- Always deliver whole files. Never partial code, never `...`.
- Module style follows Hollowtree structurally only: factory functions (`createEditor(options)`) returning plain objects; a single injected stylesheet module exporting `injectScreenStyles()` and `el(tag, cls, parent, text)`; all copy, sizes and timings live in `src/config.js` / `src/config.slots.js`, never inline. Do not copy Hollowtree's palette, class names (`ht-`), veil/blur/grain, or any of its text. Class prefix is `dr-`.
- Shell is neo-brutalist and achromatic. Exact tokens come from `.claude/SPEC-ui.md` section A.
- Root layout: `<canvas id="backdrop">` fixed full-window at `z-index:0`; every screen is a `.dr-screen` fixed inset 0 at `z-index:10`; the desktop-only overlay is `z-index:20`.
- Verification runs through `.claude/launch.json` (`python3 -m http.server 5180`) and the Browser pane, never via Bash-hosted servers. `window.doodlerun` exposes internals for `javascript_tool` checks (see section C).

## 1. File tree (final, all files created by the end of stage 7)

```
/Users/jurek/Downloads/Claude/Projects/DoodleRun/
  index.html
  .claude/launch.json
  src/main.js
  src/config.js
  src/config.slots.js
  src/state/assets.js
  src/ui/screens.css.js
  src/ui/menu.js
  src/ui/board.js
  src/ui/editor.js
  src/draw/surface.js
  src/draw/history.js
  src/draw/coverage.js
  src/rig/roles.js
  src/rig/mesh.js
  src/rig/motion.js
  src/rig/preview.js
  src/audio/record.js
  src/demo/doodles.js
  src/demo/backdrop.js
```

No other files. Helpers that would tempt a new file (op replay, thumbnails, affine math) live in the module named below.

---

## A. Slot table — `src/config.slots.js`

### A.1 Exports

```js
export const CANVAS = { tile: { w: 64, h: 64 }, creature: { w: 96, h: 96 }, backdrop: { w: 512, h: 160 }, hero: { w: 96, h: 96 } };
export const CATEGORIES = [
  { id: 'terrain',  name: 'Terrain' },
  { id: 'creature', name: 'Creatures' },
  { id: 'loot',     name: 'Loot' },
  { id: 'backdrop', name: 'Backdrop' },
  { id: 'hero',     name: 'Your hero' },
];
export const SLOTS = [ /* 14 entries in the order below */ ];
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
export function slotsByCategory(categoryId) { /* filtered, in SLOTS order */ }
```

Each slot object has exactly these fields:

```js
{
  id, name, hint, category,
  width, height,
  requiresFullCoverage,   // boolean
  defaultBehaviour,       // 'walk' | 'fly' | 'jump' | 'spin' | 'idle' | 'none'
  behaviours,             // array of switchable behaviours; [] when 'none'
  tempo,                  // multiplier on motion angular speed; 1 when not animated
  shared,                 // true for the 13 shared slots, false for hero
}
```

The rig role list is NOT stored on the slot; it is derived by `rolesFor(behaviour)` in `src/rig/roles.js` (section B.8) so that switching the behaviour switch re-derives it. The "Roles (default)" column below is what that derivation yields for the default behaviour and is given so the Coder can verify.

### A.2 The table

Coordinates: canvas origin top-left, y grows downward, in target pixels.

| # | id | Display name | Hint (shown in editor header) | category | w×h | 100% coverage | default | switchable to | tempo | Roles (default): required + optional |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `ground` | Ground block | A solid block of ground. Fill every pixel — the runner stands on this and it tiles in every direction. | terrain | 64×64 | yes | none | — | 1 | — |
| 2 | `platform` | Platform | A floating platform. Fill every pixel; copies sit side by side to make longer ledges. | terrain | 64×64 | yes | none | — | 1 | — |
| 3 | `spikes` | Spikes | Deadly spikes. Fill every pixel; touching this tile ends the run for everyone. | terrain | 64×64 | yes | none | — | 1 | — |
| 4 | `walker` | Walker | A creature that walks toward you along the ground. Two legs, a body and a head make it move. | creature | 96×96 | no | walk | walk, fly, jump | 1 | body, legL, legR + head, tail |
| 5 | `flyer` | Flyer | A creature that flies at head height. Two wings and a body make it flap. | creature | 96×96 | no | fly | fly, walk, jump | 1 | body, wingL, wingR + head, tail, legL, legR |
| 6 | `jumper` | Jumper | A creature that hops along the ground. Two legs and a body make it bounce. | creature | 96×96 | no | jump | jump, walk, fly | 1 | body, legL, legR + head, tail |
| 7 | `crawler` | Ceiling crawler | A creature that crawls upside down along ceilings. Draw it upright; the game hangs it from the ceiling. | creature | 96×96 | no | walk | walk, fly, jump | 0.8 | body, legL, legR + head, tail |
| 8 | `charger` | Charger | A creature that sprints at you the moment it sees you. Same rig as a walker, just angrier. | creature | 96×96 | no | walk | walk, fly, jump | 1.8 | body, legL, legR + head, tail |
| 9 | `guard` | Stationary guard | A creature that stands still and blocks the way. It only needs a body; add a head for a nod. | creature | 96×96 | no | idle | idle, walk, fly, jump | 1 | body + head, tail, wingL, wingR, legL, legR |
| 10 | `coin` | Coin | A coin worth ten points. Place the spin axis and it twirls in place. | loot | 64×64 | no | spin | spin, idle | 1 | spin |
| 11 | `shield` | Shield | A one-hit shield pickup. Give it a spin axis, or let it hover with a body point. | loot | 64×64 | no | spin | spin, idle | 0.7 | spin |
| 12 | `sky` | Sky | The sky behind everything. It stretches to the screen and never scrolls. Gaps show white paper. | backdrop | 512×160 | no | none | — | 1 | — |
| 13 | `far` | Far layer | Distant hills, clouds or towers. Scrolls slowly. Leave gaps so the sky shows through. | backdrop | 512×160 | no | none | — | 1 | — |
| 14 | `near` | Near layer | Bushes, fences, signs — whatever sits just behind the track. Scrolls fast. Leave gaps. | backdrop | 512×160 | no | none | — | 1 | — |
| 15 | `hero` | Your hero | Your own runner. Two legs, a body and a head — this one is you and it is not shared. | hero | 96×96 | no | walk | walk, jump | 1 | body, legL, legR + head, tail |

Decisions made here that the scope note left open: loot slots are 64×64 (tile-sized pickups); the crawler is drawn upright and flipped by the v2 engine; `tempo` is the only per-slot motion knob.

### A.3 Derived per-slot values (computed by the editor, not stored)

- Screen scale: `scale = Math.max(1, Math.floor(Math.min(EDITOR.canvasMaxWidth / width, EDITOR.canvasMaxHeight / height)))` with `canvasMaxWidth = 1040`, `canvasMaxHeight = 520`. Yields 8 for 64×64 (512 px), 5 for 96×96 (480 px), 2 for 512×160 (1024×320 px).
- Pixel-art cell: `EDITOR.pixelCell = 4` target px → 16×16 cells for tiles, 24×24 for creatures, 128×40 for backdrops.
- Motion amplitude scale: `sizeScale = Math.max(width, height) / 96`.

---

## B. Module APIs and state ownership

State ownership in one line each:
- `state/assets.js` owns every asset (bitmap, ops, rig, sound, status, thumbnail, owner). Singleton store, module-level.
- `draw/history.js` owns undo/redo snapshots for the currently open editor only; discarded on editor dispose.
- `draw/surface.js` owns the working canvas of the open editor and the current tool settings.
- `ui/editor.js` owns the editor's transient UI state (active tab, selected role, mirror/pixel toggles, secondary colour, recent swatches) and is the only module that writes to the store while editing.
- `rig/preview.js` owns its own rAF loop, texture cache and fps counter.
- `demo/backdrop.js` owns the menu-backdrop rAF loop, scroll offsets and its own copies of the demo assets.
- `main.js` owns the router state (`screen`, `slotId`, `transitioning`) and the screen instances.

### B.1 `src/config.js`

```js
export const SHELL = { /* tokens per SPEC-ui.md A.1 */ };
export const SCREENS = { fadeMs: 160, itemStaggerMs: 40 };
export const EDITOR = {
  canvasMaxWidth: 1040, canvasMaxHeight: 520,
  brushSizes: [1, 2, 4, 8],          // target px; in pixel mode the brush is always exactly one cell
  defaultSizeIndex: 2,
  defaultColor: '#111111', defaultSecondary: '#ffffff',
  recentSwatches: 8,
  pixelCell: 4,
  historyLimit: 20,
  alphaThreshold: 8,
  fillTolerance: 48,                 // sum of |dR|+|dG|+|dB|+|dA|
  ghostAlpha: 0.14,
  holeFlashMs: 900, holeFlashCount: 3,
};
export const MESH = { cols: 12, rows: 12, fallbackCols: 8, fallbackRows: 8, minFps: 45, fpsWindow: 120, clipExpand: 0.35 };
export const PREVIEW = { size: 260, scale: 2, groundLine: true };
export const AUDIO = { maxMs: 1500, mimeTypes: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] };
export const BACKDROP = { farSpeed: 18, nearSpeed: 60, groundSpeed: 120, creatureCount: 6, spawnGapPx: 220 };
export const KEYS = { undo: 'KeyZ', redo: 'KeyY', sizeDown: 'BracketLeft', sizeUp: 'BracketRight', swap: 'KeyX',
  brush: 'KeyB', eraser: 'KeyE', fill: 'KeyG', picker: 'KeyI', mirror: 'KeyM', pixel: 'KeyP', exit: 'Escape' };
export const COPY = { /* every UI string; final strings are given in SPEC-ui.md */ };
```

All strings the user can read must come from `COPY`.

### B.2 `src/state/assets.js`

Asset record (exact shape; every field always present, never `undefined`):

```js
{
  slotId: 'walker',
  owner: null,                     // reserved for v2 multiplayer: player uid string; always null in v1
  status: 'empty',                 // 'empty' | 'working' | 'ready'
  width: 96, height: 96,           // copied from the slot so consumers never need config
  bitmap: null,                    // ImageData(width, height) in target resolution, or null while empty
  ops: [],                         // ordered stroke history; see B.4 for the op format
  rig: { behaviour: 'walk', points: {} },   // points: { legL: { x, y }, ... } in target px; behaviour from slot default
  sound: { blob: null, url: null, durationMs: 0, mimeType: '' },
  thumbnail: null,                 // HTMLCanvasElement 96×96 (backdrops 192×60), redrawn on every setBitmap
  updatedAt: 0,                    // performance.now() of the last mutation
}
```

API (module-level singleton, no class):

```js
export function getAsset(slotId)                    // returns the record (live reference; callers must not mutate)
export function listAssets()                        // all 14 records in SLOTS order
export function setBitmap(slotId, imageData, ops)   // stores copies, rebuilds thumbnail, bumps status empty→working, notifies
export function setRig(slotId, rig)                 // { behaviour, points }; validated against roles.js; notifies
export function setSound(slotId, sound)             // revokes previous object URL; notifies
export function setStatus(slotId, status)           // 'empty' | 'working' | 'ready'; notifies
export function resetAsset(slotId)                  // back to the empty record (bitmap null, ops [], rig default); revokes sound URL
export function subscribe(listener)                 // listener(slotId, asset); returns unsubscribe()
export function summary()                           // { total: 14, ready, working, empty }
export function makeThumbnail(imageData, maxW, maxH) // exported so demo/backdrop and board can reuse it
```

Rules: `setBitmap` copies the `ImageData` (`new ImageData(new Uint8ClampedArray(src.data), w, h)`) and slices `ops`; the store never shares buffers with the surface. `status` transitions: `empty → working` automatically on the first `setBitmap` with a non-empty op list; `working → ready` only via `setStatus` from the editor's Done; `ready → working` automatically when a further `setBitmap`/`setRig` mutates a ready asset (so the board reflects an unfinished re-edit).

### B.3 `src/draw/coverage.js`

```js
export function measureCoverage(imageData, alphaThreshold = EDITOR.alphaThreshold)
// -> { filled, empty, total, ratio }   ratio = filled / total (Number, 1 only when empty === 0)
export function holeMask(imageData, alphaThreshold)
// -> ImageData same size; pixels with alpha <= threshold set to the alert colour at 140 alpha, everything else transparent
export function passesGate(slot, imageData) // -> true when !slot.requiresFullCoverage || measureCoverage(...).empty === 0
```

Pure functions, no DOM.

### B.4 `src/draw/surface.js`

Op format (the one format shared by the editor, the store, the demo set and the history):

```js
{ t: 'stroke', tool: 'brush' | 'eraser', color: '#rrggbb', size: 4, mirror: false, pixel: false, points: [[x, y], ...] }
{ t: 'fill',   x: 12, y: 40, color: '#rrggbb', pixel: false }
{ t: 'clear' }
```

Coordinates are target px (floats allowed in normal mode; in pixel mode they are already snapped to cell centres). `size` is target px. In pixel mode `size` is ignored and each point paints the enclosing 4×4 cell; mirror duplicates about the vertical axis `x' = width - x`.

```js
export function createSurface({ width, height, scale, mount, onOp, onPointerMove })
// mount: the HTMLElement the screen canvas is appended to
// onOp(op): fired once per committed op (pointerup for strokes, click for fill, call for clear)
// onPointerMove({ x, y, inside }): target-space cursor for the coverage/picker hints
// returns:
{
  canvas,                                  // screen canvas, width*scale × height*scale CSS px, imageSmoothingEnabled=false
  work,                                    // offscreen canvas width × height (target res); do not draw on it from outside
  settings: { tool: 'brush', color, size: 4, sizeIndex: 2, mirror: false, pixel: false },   // mutable
  setTool(tool), setColor(hex), setSizeIndex(i), setMirror(bool), setPixel(bool),
  setInputMode('draw' | 'rig'),            // in 'rig' mode pointer events are forwarded via onRigClick instead of painting
  onRigClick(handler),                     // handler({ x, y }) in target px, only while inputMode === 'rig'
  setGhost(imageData | null),              // hero silhouette drawn under the work canvas at EDITOR.ghostAlpha, bottom-left aligned, clipped
  setOverlay(imageData | null),            // hole mask or rig markers; drawn above work at 1:1 target scale
  setMarkers(markers),                     // [{ role, x, y, selected }] drawn as circles+labels in screen space above everything
  applyOp(op),                             // paints one op on work (used for replay)
  getImageData(), putImageData(imageData), clear(),
  pickColor(x, y),                         // '#rrggbb' or null if alpha <= threshold
  render(),                                // repaints the screen canvas from work + ghost + overlay + markers
  dispose(),
}
export function renderOps(ops, width, height)   // -> ImageData; offscreen, no DOM; used by demo/doodles and history rebuilds
```

Painting rules:
- Brush: `lineCap = lineJoin = 'round'`, `lineWidth = size`, single `moveTo/lineTo` path per pointermove segment, drawn on `work`. For a single click (no move) draw a filled circle radius `size/2`.
- Eraser: same path with `globalCompositeOperation = 'destination-out'`.
- Pixel mode: snap `x = floor(x / 4) * 4 + 2`, `y` likewise; paint `fillRect(cellX, cellY, 4, 4)` for every cell touched along the segment (Bresenham over cells); eraser = `clearRect` on cells.
- Fill: 4-connected scanline flood on `work`'s ImageData, seed match with `EDITOR.fillTolerance`; in pixel mode the fill runs on the 4-px cell grid (sample cell centres). Fill on a fully transparent canvas fills every pixel — this is the documented way to hit 100% coverage fast.
- Picker: reads `work`; on success the editor sets colour and switches the tool back to brush.
- Screen render every frame something changed (dirty flag + rAF): paper background, faint checker so transparency is visible, ghost, `drawImage(work, 0, 0, w*scale, h*scale)` with smoothing off, overlay, markers, and in pixel mode a 1-px cell grid. Exact colours per SPEC-ui.md.

### B.5 `src/draw/history.js`

```js
export function createHistory(limit = EDITOR.historyLimit)
// returns:
{
  reset(imageData, opCount),     // clears both stacks and stores the baseline snapshot
  push(imageData, opCount),      // after each committed op; drops redo; evicts oldest beyond `limit`
  undo(),                        // -> { imageData, opCount } | null
  redo(),                        // -> { imageData, opCount } | null
  canUndo(), canRedo(),
}
```

Rule: the stack holds up to `limit + 1` snapshots (baseline + 20 steps). Snapshots are ImageData copies. `opCount` lets the editor truncate `ops` to match after undo, so the store's op history always equals what the bitmap shows.

### B.6 `src/ui/screens.css.js`

```js
export function injectScreenStyles()   // idempotent, <style id="dr-screens">
export function el(tag, cls, parent, text)
export function button(label, cls, parent, onClick)   // <button type="button"> with .dr-btn base class
```

Required class families (all `dr-`): `.dr-screen`, `.dr-screen.is-on`, `.dr-menu`, `.dr-menu-col`, `.dr-title`, `.dr-tagline`, `.dr-nav`, `.dr-nav-item`, `.dr-panel`, `.dr-board`, `.dr-board-group`, `.dr-card` (+ `.is-empty/.is-working/.is-ready/.is-hero`), `.dr-card-thumb`, `.dr-card-status`, `.dr-editor`, `.dr-editor-head`, `.dr-tools`, `.dr-tool` (+ `.is-on`), `.dr-stage`, `.dr-side`, `.dr-tabs`, `.dr-tab` (+ `.is-on`), `.dr-roles`, `.dr-role` (+ `.is-placed/.is-selected/.is-required`), `.dr-preview`, `.dr-meter`, `.dr-btn` (+ `.is-primary`, `[disabled]`), `.dr-modal`, `.dr-desktop-only`. Reduced-motion media query kills transitions. Full rules in SPEC-ui.md.

Menu layout mirrors the Hollowtree structure only: full-height flex row, left column with title block and a vertical nav list, a panel area to the right.

### B.7 `src/ui/menu.js`, `src/ui/board.js`, `src/ui/editor.js`

Common screen contract (all three):

```js
{ root, show(): Promise<void>, hide(): Promise<void>, dispose() }
```

`show()` appends `root` to `document.body` if detached, forces reflow, adds `is-on` on the next frame, binds its keydown handler, resolves after `SCREENS.fadeMs`. `hide()` removes `is-on`, unbinds keys, resolves after `SCREENS.fadeMs`, then sets `root.style.display = 'none'` (menu/board) — the editor instead detaches in `dispose()`.

```js
export function createMenu({ onPlay })
export function createBoard({ onOpen, onBack, onStart })
// grid grouped by CATEGORIES; each card: thumbnail canvas, name, status chip, category-specific gate text
// (terrain: 'Needs 100% fill'); hero card separate under 'Your hero'. Start button always enabled → onStart().
// board.refresh() redraws all cards from the store; board subscribes to the store on show() and unsubscribes on hide().
// board.showSummary() opens a .dr-modal listing the 14 slots with status and the line 'Running arrives in v2.'
export function createEditor({ slotId, onDone, onExit })
```

### B.8 `src/rig/roles.js`

```js
export const ROLES = ['body', 'head', 'legL', 'legR', 'wingL', 'wingR', 'tail', 'spin'];
export const ROLE_LABELS = { body: 'Body', head: 'Head', legL: 'Left leg', legR: 'Right leg', wingL: 'Left wing', wingR: 'Right wing', tail: 'Tail', spin: 'Spin axis' };
export const ROLE_RADIUS = { body: 0, head: 26, legL: 22, legR: 22, wingL: 30, wingR: 30, tail: 20, spin: 0 };  // px at 96; 0 = whole-drawing effect
export const BEHAVIOURS = ['walk', 'fly', 'jump', 'spin', 'idle'];
export const ROLE_SETS = {
  walk: { required: ['body', 'legL', 'legR'], optional: ['head', 'tail'] },
  fly:  { required: ['body', 'wingL', 'wingR'], optional: ['head', 'tail', 'legL', 'legR'] },
  jump: { required: ['body', 'legL', 'legR'], optional: ['head', 'tail'] },
  spin: { required: ['spin'], optional: [] },
  idle: { required: ['body'], optional: ['head', 'tail', 'wingL', 'wingR', 'legL', 'legR'] },
};
export function rolesFor(behaviour)            // -> [...required, ...optional] in that order; [] for 'none'
export function isRequired(behaviour, role)
export function isRigComplete(rig)             // every required role of rig.behaviour has a point
export function missingRoles(rig)              // -> array of required roles without a point
export function defaultRig(slot)               // { behaviour: slot.defaultBehaviour, points: {} }
export function sanitizeRig(slot, rig)         // clamps points into [0,w)×[0,h), drops roles not in rolesFor(behaviour), rejects behaviours not in slot.behaviours
```

### B.9 `src/rig/mesh.js` — see section D for the algorithm.

```js
export function createMesh(width, height, cols = MESH.cols, rows = MESH.rows)
// -> { width, height, cols, rows, rest: Float32Array((cols+1)*(rows+1)*2), pos: Float32Array(same), occupied: Uint8Array(cols*rows) }
export function resetMesh(mesh)                                   // pos ← rest
export function markOccupancy(mesh, imageData, alphaThreshold)    // occupied[q] = 1 if any pixel with alpha > threshold lies in quad q (with 1-quad dilation)
export function pullPoint(mesh, cx, cy, radius, dx, dy)           // cosine-falloff displacement (D.2)
export function translateAll(mesh, dx, dy)
export function scaleXAbout(mesh, axisX, factor)
export function triangleTransform(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2)
// -> [a, b, c, d, e, f] or null when the source triangle is degenerate
export function drawMesh(ctx, texture, mesh, debug = false)       // D.4; texture is a canvas or ImageBitmap at mesh.width × mesh.height
export function makeTexture(imageData)                            // -> offscreen canvas with the ImageData put on it (cached by callers)
```

### B.10 `src/rig/motion.js` — see section E for the numbers.

```js
export const MOTION = { walk: {...}, fly: {...}, jump: {...}, spin: {...}, idle: {...} };   // the tables in section E
export function poseAt(behaviour, timeSeconds, tempo = 1)
// -> { body: { dx, dy }, head: { dx, dy }, legL: {...}, legR: {...}, wingL: {...}, wingR: {...}, tail: {...}, spin: { scaleX } }
// every role always present; zero for roles the behaviour does not animate
export function applyPose(mesh, rig, pose, sizeScale)
// resetMesh, then for each placed role: body → translateAll(dx*s, dy*s); spin → scaleXAbout(point.x, pose.spin.scaleX);
// all others → pullPoint(mesh, point.x, point.y, ROLE_RADIUS[role]*s, dx*s, dy*s)
```

Order of application inside `applyPose`: radius-limited pulls first (legs, wings, head, tail), then `scaleXAbout`, then `translateAll`. Pulls are additive on `pos`, so order among them does not matter.

### B.11 `src/rig/preview.js`

```js
export function createPreview({ mount, size = PREVIEW.size, scale = PREVIEW.scale })
// returns:
{
  canvas,                                            // size × size
  setAsset({ width, height, bitmap, rig, tempo }),   // rebuilds mesh + texture + occupancy; bitmap may be null → draws placeholder text
  setBitmap(imageData),                              // texture + occupancy only
  setRig(rig),                                       // behaviour + points
  setDebug(bool),                                    // wireframe + role markers over the warped drawing
  start(), stop(), isRunning(),
  get fps(),                                         // rolling average over MESH.fpsWindow frames
  get time(),                                        // seconds since start(), so screenshots can be taken at known phases
  setTime(seconds),                                  // forces the clock (used by acceptance checks)
  dispose(),
}
```

Draws centred with the drawing scaled by `scale`, a ground line at `bottom = size - 24` when `PREVIEW.groundLine && behaviour in {walk, jump, idle}`, scrolling left at 60 px/s × tempo for walk. When `rig.points` lacks every required role the preview still runs (undeformed) and prints `Place: <missing roles>` under the drawing.

### B.12 `src/ui/editor.js` internals (contract, not code)

Layout: header (slot name, hint, coverage meter or rig completeness, Exit, Done), left `.dr-tools` column, centre `.dr-stage` with the surface canvas, right `.dr-side` with tabs Draw / Rig / Sound plus the preview panel (always visible for slots with `behaviours.length > 0`).

- On create: read slot + asset; `createSurface` with derived scale; if `asset.bitmap` put it on the surface, else clear; `history.reset(surface.getImageData(), asset.ops.length)`; ghost = demo hero bitmap (from `demo/doodles.js`) except on the hero slot; preview created for animated slots and started on `show()`.
- Every committed op: `ops.push(op)`, `history.push(surface.getImageData(), ops.length)`, `setBitmap(slotId, imageData, ops)`, update coverage meter, `preview.setBitmap`.
- Undo/redo: get snapshot, `surface.putImageData`, `ops.length = opCount`, `setBitmap`.
- Done gate: enabled only when `passesGate(slot, imageData)` and (`slot.behaviours.length === 0` or `isRigComplete(rig)`). The disabled button's title and the header line state the reason (`'12 empty pixels'` / `'Place: Left leg, Right leg'`). Clicking Done: `setStatus(slotId, 'ready')`, `onDone()`.
- Coverage meter (terrain only): `filled/total` as a percent with two decimals plus the empty count, and a `Show holes` button that sets `surface.setOverlay(holeMask(...))` three times for `holeFlashMs` each.
- Rig tab: behaviour switch (`slot.behaviours`, only if length > 1), role list from `rolesFor(behaviour)` with required rows marked, `Clear rig`. Selecting a role sets `surface.setInputMode('rig')`; a canvas click places/moves the selected role, then selection advances to the next unplaced required role. Leaving the Rig tab returns input mode to `draw`. Markers always visible while Rig tab is active. Each change: `sanitizeRig`, `setRig`, `preview.setRig`.
- Sound tab: Record (holds until `AUDIO.maxMs` or a second click), Play, Delete, duration readout. Uses `audio/record.js`.
- Keys: `KEYS` table; `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` redo, `[`/`]` size, `X` swaps primary/secondary colour, `B/E/G/I` tools, `M` mirror, `P` pixel, `Esc` → `onExit()`. Keys ignored while an `<input>` has focus.
- Autosave means Exit never loses work; status stays `working`.

### B.13 `src/audio/record.js`

```js
export function isRecordingSupported()      // MediaRecorder && getUserMedia present
export function createRecorder()
// -> { start(): Promise<void>, stop(): Promise<{ blob, url, durationMs, mimeType }>, cancel(), get state(), dispose() }
export function playSound(sound)            // -> HTMLAudioElement already playing; no-op when sound.url is null
```

`start()` requests `{ audio: { channelCount: 1, echoCancellation: true } }`, picks the first supported entry of `AUDIO.mimeTypes`, auto-stops at `AUDIO.maxMs`. `dispose()` stops all tracks. The editor creates one recorder per open editor and disposes it on exit, so the mic indicator disappears when leaving the slot.

### B.14 `src/demo/doodles.js`

```js
export const DEMO = {
  ground:   { ops: [...], rig: null },
  walker:   { ops: [...], rig: { behaviour: 'walk', points: { body: {x,y}, head: {...}, legL: {...}, legR: {...} } } },
  hero:     { ops: [...], rig: { behaviour: 'walk', points: {...} } },
  /* all 14 */
};
export function renderDemoAsset(slotId)   // -> { width, height, bitmap: ImageData, rig, tempo }
export function renderAllDemoAssets()     // -> Map slotId → the object above; cached after first call
```

Authoring rules for the 14 doodles: hand-written op arrays (6–25 ops each), bright saturated colours, brush sizes 2–6, coordinates in target px. Terrain doodles start with `{ t: 'fill', x: 0, y: 0, color }` on the empty canvas so coverage is 100% by construction, then strokes on top. Every creature and the hero must include every required role for their default behaviour. Backdrops: sky is a fill plus a few clouds; far/near leave transparent gaps.

### B.15 `src/demo/backdrop.js`

```js
export function createBackdrop({ canvas })
// -> { start(), stop(), setRunning(bool), isRunning(), setAssets(map), get fps(), get meshResolution(), resize() }
```

Scene: sky stretched to the viewport (no scroll), far layer tiled horizontally scrolling at `BACKDROP.farSpeed`, near at `nearSpeed`, ground blocks tiled along the bottom at `groundSpeed`, coins spinning on platforms, `BACKDROP.creatureCount` creatures cycling through walker/flyer/jumper/charger/crawler(drawn flipped at the top)/guard spaced `spawnGapPx` apart, the hero running at x = 25% width. Each animated sprite has its own mesh; textures come from `makeTexture` once per asset. The loop measures fps over `MESH.fpsWindow` frames after the first second; if below `MESH.minFps` it rebuilds every mesh at `fallbackCols × fallbackRows` exactly once. Canvas is resized to `window.innerWidth × innerHeight` on `resize`.

---

## C. Screen router — `src/main.js`

Screens: `menu → board → editor(slotId) → board`. Menu and board are created once at boot and toggled; the editor is created per slot and destroyed on leave.

Boot sequence (synchronous except awaited transitions):
1. `injectScreenStyles()`.
2. `renderAllDemoAssets()` (fast, offscreen), `backdrop = createBackdrop({ canvas: #backdrop })`, `backdrop.setAssets(demo)`, `backdrop.start()`.
3. `menu = createMenu({ onPlay: () => go('board') })`.
4. `board = createBoard({ onOpen: (slotId) => go('editor', slotId), onBack: () => go('menu'), onStart: () => board.showSummary() })`.
5. `go('menu')`.
6. `window.doodlerun = { go, store, backdrop, demo, get screen(), get slotId(), get editor(), get board(), get menu() }`.

Router:

```js
let current = null;          // 'menu' | 'board' | 'editor'
let currentSlot = null;
let editor = null;
let transitioning = false;

async function go(name, slotId) {
  if (transitioning) return;
  transitioning = true;
  if (current === 'editor' && editor) { await editor.hide(); editor.dispose(); editor = null; }
  else if (current === 'menu') await menu.hide();
  else if (current === 'board') await board.hide();
  current = name; currentSlot = slotId || null;
  backdrop.setRunning(name === 'menu');
  if (name === 'editor') { editor = createEditor({ slotId, onDone: () => go('board'), onExit: () => go('board') }); await editor.show(); }
  else if (name === 'board') { board.refresh(); await board.show(); }
  else await menu.show();
  transitioning = false;
}
```

DOM rules: `#backdrop` is in `index.html` and never removed; screens are `position:fixed; inset:0; z-index:10` and opaque except the menu, whose right side is transparent so the demo run shows through with an ink frame around it. Board and editor cover the backdrop fully, which is why it is stopped there (the editor's preview loop needs the frame budget). Menu `show()` restarts it. No screen keeps its own rAF except preview and backdrop.

Keyboard ownership: each screen binds `window.keydown` in `show()` and unbinds in `hide()`, so exactly one handler is live at a time. Esc in menu closes an open panel, in board triggers `onBack`, in editor triggers `onExit`.

`index.html`: `<!DOCTYPE html>`, lang `en`, minimal inline CSS only for `html,body` reset, `#backdrop` and the `.dr-desktop-only` overlay (so it renders before modules load), `<canvas id="backdrop"></canvas>`, `<div class="dr-desktop-only">…</div>`, `<script type="module" src="./src/main.js"></script>`. No importmap.

`.claude/launch.json`: name `doodlerun`, `python3 -m http.server 5180`, port 5180.

---

## D. Mesh warp — `src/rig/mesh.js`

### D.1 Grid

- `cols × rows` quads (12×12 default, 8×8 fallback), `(cols+1) × (rows+1)` vertices.
- Vertex index `k = j * (cols + 1) + i`, stored at `rest[2k], rest[2k+1]`; `pos` same layout.
- Rest position: `x = i * width / cols`, `y = j * height / rows`, in texture pixels. The last column/row lands exactly on `width`/`height`.
- `occupied[j * cols + i]` is computed once per bitmap: scan the pixels in the quad's rest rectangle; mark 1 if any alpha > threshold; then dilate by one quad in all 8 directions so a stroke deformed outward still has a drawn neighbour. Quads with `occupied === 0` are skipped in `drawMesh`.

### D.2 Displacement with cosine falloff

`pullPoint(mesh, cx, cy, radius, dx, dy)`, radius in texture px:

```
for each vertex k:
  ex = rest[2k] - cx ; ey = rest[2k+1] - cy
  d  = sqrt(ex*ex + ey*ey)
  if d >= radius: continue
  w  = 0.5 * (1 + cos(PI * d / radius))        // 1 at the point, 0 at the radius, C1-smooth
  pos[2k]   += w * dx
  pos[2k+1] += w * dy
```

Weights are computed from `rest`, never from `pos`, so multiple pulls in one frame are order-independent and never compound. `translateAll` adds `(dx, dy)` to every vertex. `scaleXAbout(axisX, f)` sets `pos[2k] = axisX + (pos[2k] - axisX) * f` for every vertex (applied after pulls so leg pulls survive a spin). `f` may be negative (the coin shows its back); a `|f| < 0.02` frame is skipped entirely to avoid degenerate triangles.

### D.3 Triangle split and the affine matrix

For quad `(i, j)` the four vertices are `TL = (i, j)`, `TR = (i+1, j)`, `BR = (i+1, j+1)`, `BL = (i, j+1)`. Two triangles: `(TL, TR, BR)` and `(TL, BR, BL)`.

Given source (rest) triangle `S0=(x0,y0), S1=(x1,y1), S2=(x2,y2)` and destination (pos) triangle `D0=(u0,v0), D1=(u1,v1), D2=(u2,v2)`, find `a,b,c,d,e,f` such that Canvas's `transform(a,b,c,d,e,f)` maps `u = a·x + c·y + e`, `v = b·x + d·y + f`:

```
dx1 = x1 - x0 ; dy1 = y1 - y0 ; dx2 = x2 - x0 ; dy2 = y2 - y0
du1 = u1 - u0 ; dv1 = v1 - v0 ; du2 = u2 - u0 ; dv2 = v2 - v0
det = dx1 * dy2 - dx2 * dy1
if |det| < 1e-6: return null

a = (du1 * dy2 - du2 * dy1) / det
c = (du2 * dx1 - du1 * dx2) / det
b = (dv1 * dy2 - dv2 * dy1) / det
d = (dv2 * dx1 - dv1 * dx2) / det
e = u0 - a * x0 - c * y0
f = v0 - b * x0 - d * y0
```

Because rest triangles are axis-aligned right triangles, `det = ±(width/cols)·(height/rows)` and is never near zero; the guard exists for the degenerate case of a zero-size mesh.

### D.4 Drawing one frame

`drawMesh(ctx, texture, mesh, debug)` assumes the caller has already set the outer transform (translate/scale into the preview or backdrop). Per triangle:

```
ctx.save()
ctx.beginPath()
// clip polygon = destination triangle expanded by MESH.clipExpand px away from its centroid
gx = (u0+u1+u2)/3 ; gy = (v0+v1+v2)/3
for each Dn: len = hypot(un-gx, vn-gy); push (un + (un-gx)/len * clipExpand, vn + (vn-gy)/len * clipExpand)
moveTo / lineTo / closePath
ctx.clip()
ctx.transform(a, b, c, d, e, f)
ctx.drawImage(texture, 0, 0)
ctx.restore()
```

The expansion hides the hairline seams between adjacent triangles that appear with an exact clip.

Performance targets and fallbacks: 144 quads → up to 288 `clip+drawImage` per sprite before occupancy culling. The preview runs one sprite and must hold 60 fps. The backdrop runs up to 7 animated sprites plus static layers; it measures fps as in B.15 and drops to 8×8 once if under 45 fps. `debug` draws `pos` edges at 1 px and role markers.

### D.5 Texture

`makeTexture(imageData)` creates an offscreen canvas `width × height`, `putImageData`, returns it. Callers cache it and rebuild only on `setBitmap`. The texture is drawn at texture scale; the outer transform supplies the 2× (preview) or 1× (backdrop) size.

---

## E. Motion presets — `src/rig/motion.js`

Conventions: `θ = 2π · t · tempo / period` per role (each role has its own period so hover and flap can differ); `s(x) = sin(x)`, `p(x) = max(0, sin(x))` (positive half-wave), `bob = 1 - cos 2θ`; amplitudes are px at a 96-px canvas and are multiplied by `sizeScale` in `applyPose`; `dy` negative is up. `phase` is added to `θ`. Every behaviour lists all eight roles; a dash means zero.

### walk (base period 0.6 s)

| role | dx | dy | period | phase |
|---|---|---|---|---|
| legL | `6·s(θ)` | `-3·p(θ)` | 0.6 | 0 |
| legR | `6·s(θ)` | `-3·p(θ)` | 0.6 | π |
| body | — | `-1.5·(1 - cos 2θ)` | 0.6 | 0 |
| head | `1·s(θ)` | `-1·(1 - cos 2θ)` | 0.6 | π/4 |
| tail | `4·s(θ)` | — | 0.6 | π/2 |
| wingL | — | `2·s(θ)` | 0.6 | 0 |
| wingR | — | `2·s(θ)` | 0.6 | π |
| spin | scaleX 1 | | | |

### fly (base period 0.45 s)

| role | dx | dy | period | phase |
|---|---|---|---|---|
| wingL | — | `12·s(θ)` | 0.45 | 0 |
| wingR | — | `12·s(θ)` | 0.45 | π |
| body | — | `4·s(θ)` | 1.8 | 0 |
| head | — | `1·s(θ)` | 0.45 | π/2 |
| tail | `3·s(θ)` | `1·s(θ)` | 0.9 | 0 |
| legL | — | `2·s(θ)` | 0.9 | 0 |
| legR | — | `2·s(θ)` | 0.9 | π/3 |
| spin | scaleX 1 | | | |

### jump (base period 0.9 s)

| role | dx | dy | period | phase |
|---|---|---|---|---|
| body | — | `-14·p(θ) + 2·p(θ + π)` | 0.9 | 0 |
| legL | `-3·p(θ)` | `-4·p(θ)` | 0.9 | 0 |
| legR | `3·p(θ)` | `-4·p(θ)` | 0.9 | 0 |
| head | — | `2·s(θ)` | 0.9 | -0.4 |
| tail | `5·s(θ)` | — | 0.9 | 0 |
| wingL | — | `3·s(θ)` | 0.45 | 0 |
| wingR | — | `3·s(θ)` | 0.45 | π |
| spin | scaleX 1 | | | |

(Body lifts the whole drawing on the positive half-wave and dips 2 px on landing; legs tuck inward and up while airborne.)

### spin (base period 1.2 s)

| role | value | period | phase |
|---|---|---|---|
| spin | `scaleX = cos(θ)` | 1.2 | 0 |
| body | `dy = 2·s(θ)` | 1.2 | 0 |
| all others | — | | |

### idle (base period 2.0 s)

| role | dx | dy | period | phase |
|---|---|---|---|---|
| body | — | `1.5·s(θ)` | 2.0 | 0 |
| head | — | `1·s(θ)` | 2.0 | π/2 |
| tail | `2·s(θ)` | — | 2.0 | 0 |
| wingL | — | `2·s(θ)` | 2.0 | 0 |
| wingR | — | `2·s(θ)` | 2.0 | π |
| legL, legR | — | — | | |
| spin | scaleX 1 | | | |

Encode each entry as `{ dx: [amp, fn], dy: [amp, fn], period, phase }` where `fn` is `'sin' | 'pos' | 'bob'` plus the jump body's second term as an explicit extra `{ amp: 2, fn: 'pos', phase: Math.PI }`; `poseAt` evaluates the table generically so tweaks never touch code.

---

## F. Build order and acceptance checks

Serve with `.claude/launch.json` → `http://localhost:5180`. All checks are performed in the Browser pane; `window.doodlerun` is the hook for `javascript_tool`.

### Stage 1 — Skeleton and shell
Files: `index.html`, `.claude/launch.json`, `src/config.js`, `src/ui/screens.css.js`, `src/ui/menu.js`, `src/main.js`.
Acceptance: page loads with zero console errors; `read_page` shows the title, the nav items and a footer; clicking Play swaps to the board screen and Back returns; `window.doodlerun.screen` follows; Esc on the board returns to the menu; every visible surface is black/white/grey.

### Stage 2 — Store and board
Files: `src/config.slots.js`, `src/state/assets.js`, `src/ui/board.js` (full).
Acceptance: `read_page` lists 13 shared cards in four groups plus the hero card, all `Empty`; `doodlerun.store.summary()` returns `{ total: 14, ready: 0, working: 0, empty: 14 }`; calling `doodlerun.store.setStatus('walker', 'ready')` from `javascript_tool` flips the card chip live without a reload; Start opens the summary modal and it closes on Esc.

### Stage 3 — Drawing editor
Files: `src/draw/surface.js`, `src/draw/history.js`, `src/draw/coverage.js`, `src/ui/editor.js` (Draw tab and header only).
Acceptance (on `ground`): a scripted sequence of pointer events over 99% of the canvas leaves Done disabled and the meter shows a non-zero empty count; a fill op takes it to 100.00% and enables Done; `Show holes` flashes; 20 strokes then 20 `Ctrl+Z` produce an `ImageData` whose data hash equals the blank canvas hash and the 21st undo is a no-op; `[`/`]`, `X`, `M`, `P` change the visible tool state; Exit keeps status `working` and the board thumbnail shows the drawing; the ghost hero is visible under an empty tile and absent on the hero slot.

### Stage 4 — Rig (the risk gate)
Files: `src/rig/roles.js`, `src/rig/mesh.js`, `src/rig/motion.js`, `src/rig/preview.js`, Rig tab in `src/ui/editor.js`.
Acceptance: `triangleTransform(0,0, 8,0, 8,8, 0,0, 8,0, 8,8)` returns `[1,0,0,1,0,0]` and a translated destination returns `e,f` equal to the translation; placing body/legL/legR on the demo walker makes the preview swing legs with no visible tears; `preview.setTime(0)`, `(0.15)`, `(0.3)` screenshots at three phases; `preview.fps >= 55` in the foreground tab; switching the behaviour to `fly` re-lists roles and Done becomes disabled with `Place: Left wing, Right wing`; `setDebug(true)` shows the deformed wireframe.

### Stage 5 — Sound
Files: `src/audio/record.js`, Sound tab in `src/ui/editor.js`.
Acceptance: Record asks for the mic once per editor session, auto-stops at 1.5 s, Play is audible, the console log prints the blob size and mime type, Delete clears the readout and `store.getAsset(id).sound.url` is null; leaving the editor turns the browser mic indicator off.

### Stage 6 — Demo set and menu backdrop
Files: `src/demo/doodles.js`, `src/demo/backdrop.js`; `main.js` wires the backdrop.
Acceptance: menu shows a scrolling world with a running hero and at least six animated creatures behind the transparent panel area; `read_console_messages` is clean over 30 s; `doodlerun.backdrop.fps >= 45` and `meshResolution` stays 12 (or reports 8 with the fallback logged once); `doodlerun.demo.get('ground').bitmap` measures 100% coverage for all three terrain slots; the backdrop stops when entering the board and restarts on return.

### Stage 7 — Polish and transitions
Files: touch-ups across `screens.css.js`, `menu.js`, `board.js`, `editor.js`, `main.js`; the desktop-only overlay.
Acceptance: screens enter within `SCREENS.fadeMs`; nav items stagger; hover on every button collapses its shadow; all `KEYS` bindings work and are ignored while the colour input has focus; resizing below 960 px shows the overlay and hiding it again restores the app; a final full pass through menu → board → editor(walker) → Done → board → Start summary produces zero console errors.
