I've read the plan, the scoping file, the design principles, and the Hollowtree layout rules. Here is the specification.

---

# DoodleRun v1 — UI/UX Specification

**Authoritative for:** `src/config.js`, `src/ui/screens.css.js`, `src/ui/menu.js`, `src/ui/board.js`, `src/ui/editor.js`, `src/demo/backdrop.js`.
**Prefix for every class and CSS custom property: `dr-`.** One stylesheet, injected once, same pattern as Hollowtree's `injectScreenStyles()`.

**The one rule above all others:** the shell is black, white and grey. The only chromatic pixels on screen are the ones the player painted (and the built-in demo doodles, which are painted in the same format). Never tint, dim, desaturate, overlay or blur a player drawing to "make it fit" — separation from the shell is achieved with black frames and white mats, never by weakening the artwork.

---

## A. Design tokens

### A.1 Palette

All shell colour lives in these eleven values. Declare them on `:root`.

```css
:root{
  /* ground + paper */
  --dr-ink:        #000000;  /* every border, every rule, all heavy type */
  --dr-paper:      #FFFFFF;  /* card and panel fill, canvas mat */
  --dr-ground:     #F2F0EC;  /* app background behind all cards */
  --dr-hatch:      #E2E0DB;  /* diagonal stripes marking an empty slot */
  --dr-edge:       #C9C6C0;  /* hairline inside inverted blocks, disabled borders */
  --dr-mute:       #8E8B85;  /* secondary/meta text on paper */
  --dr-mute-inv:   #A8A5A0;  /* secondary text on ink */
  --dr-disabled:   #B5B2AC;  /* disabled label text */
  --dr-shadow:     #000000;  /* hard offset shadow block — always pure black */

  /* the single accent */
  --dr-alert:      #E5231B;
  --dr-alert-ink:  #FFFFFF;  /* text placed on alert fill */
}
```

**The accent means exactly one thing: THIS IS BLOCKING YOU.** `--dr-alert` may appear in only four places in the whole application, and nowhere else, ever:

1. The coverage meter and its numeric readout while a `requiresFullCoverage` slot is below 100%.
2. The **SHOW HOLES** overlay — uncovered pixels blink in `--dr-alert`.
3. The one-line reason under a disabled **DONE** button.
4. The confirm state of a destructive action (`CLEAR CANVAS`, `DELETE SOUND` — the button's second press state).

It is **not** used for: focus, hover, selection, active tool, recording, errors that are not blocking, the Start button, or decoration. There is no green: "done" is expressed by **inversion** (black fill, white type), not by colour. There is no second accent.

### A.2 Structure tokens

```css
:root{
  --dr-b1: 2px;   /* hairline division inside a card, tab underline */
  --dr-b2: 3px;   /* default border: buttons, inputs, tool buttons, chips */
  --dr-b3: 4px;   /* cards, panels, slot tiles, canvas frame */
  --dr-b4: 6px;   /* hero slot, title slab, animation preview frame */

  --dr-off1: 3px; /* small controls */
  --dr-off2: 5px; /* buttons, slot cards */
  --dr-off3: 8px; /* panels, hero slot */
  --dr-off4: 12px;/* title slab, animation preview */

  --dr-r: 0;      /* radius. Zero. Everywhere. No exceptions. */

  --dr-gap-xs: 6px; --dr-gap-s: 10px; --dr-gap-m: 16px;
  --dr-gap-l: 24px; --dr-gap-xl: 40px;
  --dr-pad:    20px;
}
```

**Radii are deliberately absent.** `border-radius:0` on `*` inside `.dr-app`, including `input[type=range]`, `input[type=color]` and buttons, which carry UA radii on macOS. Do not round a single corner anywhere, including thumbnails, the colour swatch, and the range thumb.

### A.3 Shadow — implementation is mandatory, not optional

Hard offset shadows are drawn as a **pseudo-element block**, not `box-shadow`, because hover animates them and animating `box-shadow` will not hold 60fps on a 2019 Intel MacBook Pro.

```css
.dr-raise{position:relative;background:var(--dr-paper);
  border:var(--dr-b3) solid var(--dr-ink)}
.dr-raise::after{content:"";position:absolute;inset:0;z-index:-1;
  background:var(--dr-shadow);
  transform:translate3d(var(--dr-off,5px),var(--dr-off,5px),0);
  transition:transform 140ms cubic-bezier(.2,.9,.25,1);
  will-change:transform}
```

The parent needs `isolation:isolate` or a non-`auto` z-index so `z-index:-1` sits behind the element but above the page. No `filter`, no `blur`, no `rgba` shadow, no `inset` shadow, anywhere in the app.

### A.4 Type

System fonts only. No `@font-face`, no `link` to fonts, zero network requests.

```css
--dr-face-display: ui-sans-serif, -apple-system, BlinkMacSystemFont,
                   "Helvetica Neue", Helvetica, Arial, sans-serif;
--dr-face-mono:    ui-monospace, SFMono-Regular, Menlo, Monaco,
                   Consolas, "Liberation Mono", monospace;
```

Display face carries `font-weight:900` and `font-stretch:condensed` where the system honours it (`-apple-system` does not, and that is fine — 900 alone is heavy enough). Mono face carries all numbers, counters, coordinates and micro-labels; enable `font-variant-numeric:tabular-nums` on every counter so digits do not jitter.

| Token | Size / line-height | Weight | Tracking | Case | Face | Used for |
|---|---|---|---|---|---|---|
| `--dr-t-mega` | `clamp(56px,8vw,104px)` / .84 | 900 | -0.03em | upper | display | DOODLERUN title |
| `--dr-t-h1` | 40px / .95 | 900 | -0.02em | upper | display | Screen headings (`SLOTS`, slot name in editor) |
| `--dr-t-h2` | 26px / 1.05 | 900 | -0.01em | upper | display | Nav items, hero slot name, Start button |
| `--dr-t-h3` | 18px / 1.15 | 900 | 0 | upper | display | Card titles, tab labels, primary buttons |
| `--dr-t-body` | 15px / 1.5 | 500 | 0 | sentence | display | Panel prose, How it works copy |
| `--dr-t-label` | 12px / 1.2 | 700 | .18em | upper | mono | Group labels, state chips, field labels |
| `--dr-t-micro` | 10px / 1.2 | 700 | .22em | upper | mono | Slot index, keyboard hints, footer |
| `--dr-t-num` | 20px / 1 | 700 | 0 | — | mono | Coverage %, brush px, counters |

`-webkit-font-smoothing:antialiased` on `.dr-app`. `::selection{background:var(--dr-ink);color:var(--dr-paper)}`.

Uppercase display text is set with `text-transform:uppercase` in CSS; the strings in JS are written normally so a future translation is not fighting the CSS.

---

## B. Screen 1 — MENU

### B.1 Structure

Layout follows Hollowtree: left column carrying the title above a vertical nav list, panel alongside. Palette, borders and motion are entirely ours.

```html
<section class="dr-screen dr-menu" id="dr-menu">
  <canvas class="dr-demo" aria-hidden="true"></canvas>
  <div class="dr-demo-mask" aria-hidden="true"></div>

  <div class="dr-menu-col">
    <div class="dr-brand dr-raise">
      <h1 class="dr-title"><span>DOODLE</span><span class="dr-title-run">RUN</span></h1>
    </div>
    <p class="dr-tagline">Draw the whole world first. Then rig it. Then run it.</p>

    <nav class="dr-nav">
      <button class="dr-nav-item" data-act="new">
        <span class="dr-nav-idx">01</span>
        <span class="dr-nav-text">New set</span>
        <span class="dr-nav-note">Start a fresh world of 14 drawings</span>
      </button>
      <!-- 02 Continue, 03 How it works, 04 Demo set -->
    </nav>
  </div>

  <div class="dr-panels"><!-- .dr-panel per nav item --></div>

  <footer class="dr-foot">
    <span>DOODLERUN V1</span><span>DESKTOP ONLY</span><span>MOUSE / TRACKPAD</span>
  </footer>
</section>
```

```css
.dr-menu{position:absolute;inset:0;display:flex;align-items:center;
  padding:0 clamp(32px,7vw,120px);gap:clamp(32px,4vw,72px)}
.dr-menu-col{width:min(520px,46vw);flex:0 0 auto;
  display:flex;flex-direction:column;gap:var(--dr-gap-l);position:relative;z-index:2}
```

### B.2 The word DOODLERUN

The title is a **slab**, not free-floating text: white fill, `--dr-b4` black border, `--dr-off4` shadow block. Two lines, tight. `DOODLE` is black on white; `RUN` is **inverted** — white type in a black band that bleeds to the slab's inner edges. That inversion is functional, not decorative: it is the same inversion that means "done / active" on the board and in the tool rail, and here it names the verb the whole game is built around.

```css
.dr-brand{--dr-off:var(--dr-off4);padding:26px 30px 30px;display:inline-block;align-self:flex-start}
.dr-title{font:900 var(--dr-t-mega) var(--dr-face-display);
  text-transform:uppercase;letter-spacing:-.03em;line-height:.84;
  display:flex;flex-direction:column;margin:0}
.dr-title-run{background:var(--dr-ink);color:var(--dr-paper);
  align-self:flex-start;padding:.02em .12em .06em;margin-left:-.04em}
```

No outline text, no drop shadow on the glyphs, no gradient, no animation on the title itself beyond the entry transition (§E.1).

### B.3 Nav items

Four items. Each is `display:grid; grid-template-columns:auto 1fr; ` with the note on a second row, so the hit target is the full row.

| # | Label | Note (final string) | Behaviour |
|---|---|---|---|
| 01 | **New set** | `Start a fresh world of 14 drawings` | → BOARD, all slots empty |
| 02 | **Continue** | `Pick up the set you were drawing` | → BOARD with session state. **Disabled** when no set exists; disabled note becomes `Nothing drawn yet` |
| 03 | **How it works** | `Draw, rig, run — in 40 seconds` | Opens panel, no navigation |
| 04 | **Demo set** | `Open my hand-drawn set and poke at it` | → BOARD preloaded with `demo/doodles.js`, so the editor and rig can be tried instantly |

Item 04 earns its place: v1 ships no run loop, so a player who opens a blank editor has nothing to judge the rig against. Demo set is the fastest route to the animation preview, which is the one thing v1 exists to answer.

```css
.dr-nav{display:flex;flex-direction:column;align-items:flex-start;gap:var(--dr-gap-xs)}
.dr-nav-item{position:relative;display:grid;grid-template-columns:auto 1fr;
  column-gap:14px;row-gap:2px;align-items:baseline;
  min-height:48px;padding:8px 16px 10px;
  background:transparent;border:var(--dr-b2) solid transparent;cursor:pointer;text-align:left;
  transition:transform 140ms cubic-bezier(.2,.9,.25,1),
             background-color 120ms linear, color 120ms linear;
  will-change:transform}
.dr-nav-idx{grid-row:1/3;font:700 var(--dr-t-micro) var(--dr-face-mono);color:var(--dr-mute)}
.dr-nav-text{font:900 var(--dr-t-h2) var(--dr-face-display);text-transform:uppercase}
.dr-nav-note{grid-column:2;font:700 var(--dr-t-micro) var(--dr-face-mono);
  color:var(--dr-mute);opacity:0;transition:opacity 140ms linear}

/* hover / focus / active — one visual language: the item becomes a black bar */
.dr-nav-item:hover,.dr-nav-item:focus-visible,.dr-nav-item.is-active{
  background:var(--dr-ink);color:var(--dr-paper);
  border-color:var(--dr-ink);transform:translate3d(8px,0,0);outline:none}
.dr-nav-item:hover .dr-nav-idx,.dr-nav-item:focus-visible .dr-nav-idx,
.dr-nav-item.is-active .dr-nav-idx{color:var(--dr-paper)}
.dr-nav-item:hover .dr-nav-note,.dr-nav-item:focus-visible .dr-nav-note,
.dr-nav-item.is-active .dr-nav-note{opacity:1;color:var(--dr-mute-inv)}
.dr-nav-item:active{transform:translate3d(8px,2px,0)}
.dr-nav-item[disabled]{cursor:default;color:var(--dr-disabled)}
.dr-nav-item[disabled]:hover{background:transparent;color:var(--dr-disabled);
  border-color:transparent;transform:none}
.dr-nav-item[disabled] .dr-nav-note{opacity:1}
```

Focus and hover are deliberately identical — one meaning ("this is the item under the pointer or the caret"), one appearance. Focus-visible additionally gets the double ring from §G.1 so keyboard users are never guessing whether hover or focus is showing.

### B.4 Panels

`.dr-panels` is the Hollowtree stacked grid (`display:grid;` all panels in `grid-area:1/1`). Only **How it works** has a panel in v1; New set / Continue / Demo set navigate. Panel is `--dr-b3` border, `--dr-off3` shadow, white fill, `width:min(460px,42vw)`, `padding:var(--dr-pad)`.

**How it works** — final copy:

> **HOW IT WORKS**
> **1 — DRAW.** Fourteen slots make up a world: three ground tiles, six creatures, two pickups, three backdrop layers, and your own character. Open a slot and paint it.
> **2 — RIG.** Drop labelled points on your drawing — left leg, right leg, head, wings. The drawing becomes a rubber sheet and the points pull the pixels around them. Nothing is ever cut apart.
> **3 — RUN.** Not in this build. v1 stops at the animation preview, which is the part worth getting right first.
>
> `GROUND TILES MUST COVER 100% OF THE CANVAS. HOLES IN A TILE ARE HOLES IN THE WORLD.`

Last line is `--dr-t-label`, sits in an inverted black strip at the panel foot.

### B.5 The demo run behind the menu

The demo must sell the idea without competing with the title. It is the loudest colour on screen and the title is the loudest shape — so they are given **separate territory**, never dimmed against each other.

- `.dr-demo` is a full-bleed `<canvas>` at `z-index:0`, background `--dr-ground`, `image-rendering:auto`.
- The run itself is drawn **only in the bottom band**: the ground line sits at `72%` of viewport height, and all creatures, tiles, loot and hero occupy `y ∈ [52%, 92%]`. Backdrop layers are drawn in the band too, not up behind the title. Nothing animated is ever painted above 50% viewport height.
- `.dr-demo-mask` is a static `--dr-b3` black horizontal rule at `y:52%` running the full viewport width — the band reads as a framed strip of gameplay, i.e. it has a reason to be there, and it terminates the moving area with a hard edge instead of a fade.
- The menu column's slab is opaque white with a black border, so display type never sits over moving pixels even at narrow widths.
- Parallax is honest: backdrop far at 0.25×, near at 0.55×, ground at 1×. Loop scroll speed **90 px/s**. Creature rig oscillation runs at the same rate the editor preview uses, so the menu is a live test of the mesh pipeline.
- The demo loop **pauses** (`cancelAnimationFrame`) whenever the menu screen is not `.is-on`, and on `document.hidden`. It never runs while the board or editor is up.
- Under `prefers-reduced-motion:reduce` the canvas renders one static frame and stops.

Footer `.dr-foot` sits bottom-left, `--dr-t-micro`, `--dr-mute`, above the band's rule.

---

## C. Screen 2 — BOARD

### C.1 Frame

```html
<section class="dr-screen dr-board">
  <header class="dr-board-head">
    <button class="dr-btn dr-btn-ghost" data-act="menu">← Menu</button>
    <h2 class="dr-board-title">Slots</h2>
    <p class="dr-board-sub">Fourteen drawings make a world. Draw as many as you like — the rest run on my scribbles.</p>
  </header>

  <div class="dr-board-scroll">
    <section class="dr-hero-row">…</section>
    <section class="dr-group" data-group="terrain">…</section>
    <section class="dr-group" data-group="creatures">…</section>
    <section class="dr-group" data-group="loot">…</section>
    <section class="dr-group" data-group="backdrop">…</section>
  </div>

  <footer class="dr-actionbar">…</footer>
</section>
```

`.dr-board` is `display:flex;flex-direction:column;` `padding:32px clamp(32px,5vw,80px) 0`. `.dr-board-scroll` is the only scrolling region (`overflow-y:auto`, `padding-bottom:120px` to clear the action bar). Scrollbar styled square: `scrollbar-width:thin`, and on WebKit `::-webkit-scrollbar{width:14px}` with `::-webkit-scrollbar-thumb{background:var(--dr-ink)}` and `::-webkit-scrollbar-track{background:var(--dr-ground);border-left:var(--dr-b2) solid var(--dr-ink)}`.

### C.2 Groups and grid

Every group is its own six-column grid. Card spans give each category a distinct silhouette without any colour coding, and each card's aspect matches the real canvas aspect of that slot type — the grid is a truthful map of the world.

```css
.dr-group{margin-top:var(--dr-gap-xl)}
.dr-group-head{display:flex;align-items:baseline;gap:12px;
  border-bottom:var(--dr-b2) solid var(--dr-ink);padding-bottom:8px;margin-bottom:var(--dr-gap-m)}
.dr-group-name{font:700 var(--dr-t-label) var(--dr-face-mono)}
.dr-group-count{font:700 var(--dr-t-micro) var(--dr-face-mono);color:var(--dr-mute);margin-left:auto}
.dr-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--dr-gap-m)}
.dr-grid > .dr-slot[data-cat="terrain"]{grid-column:span 2}
.dr-grid > .dr-slot[data-cat="creature"]{grid-column:span 1}
.dr-grid > .dr-slot[data-cat="loot"]{grid-column:span 3}
.dr-grid > .dr-slot[data-cat="backdrop"]{grid-column:span 2}
@media (max-width:1180px){.dr-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .dr-grid > .dr-slot[data-cat="terrain"],
  .dr-grid > .dr-slot[data-cat="backdrop"]{grid-column:span 3}
  .dr-grid > .dr-slot[data-cat="loot"]{grid-column:span 3}}
```

Group headings and their exact strings:

| Group | Heading | Count string | Slot names (final strings, in order) |
|---|---|---|---|
| terrain | `TERRAIN` | `3 SLOTS · 100% COVERAGE REQUIRED` | Block, Platform, Spikes |
| creatures | `CREATURES` | `6 SLOTS` | Walker, Flyer, Hopper, Ceiling crawler, Charger, Guard |
| loot | `LOOT` | `2 SLOTS` | Coin, Shield |
| backdrop | `BACKDROP` | `3 SLOTS` | Sky, Far layer, Near layer |

Each card shows a one-line behaviour note in `--dr-t-micro`, because the player controls looks and the game controls behaviour, and that bargain must be legible before they start drawing:

Block `SOLID GROUND` · Platform `STAND ON TOP ONLY` · Spikes `KILLS ON TOUCH` · Walker `WALKS THE FLOOR` · Flyer `FLIES A SINE PATH` · Hopper `HOPS TOWARD YOU` · Ceiling crawler `CRAWLS UPSIDE DOWN` · Charger `RUSHES WHEN SEEN` · Guard `STANDS STILL` · Coin `+1 POINT` · Shield `TAKE ONE HIT` · Sky `NO SCROLL` · Far layer `SCROLLS 0.25×` · Near layer `SCROLLS 0.55×`

### C.3 Slot card anatomy

```html
<button class="dr-slot dr-raise is-empty" data-cat="creature" data-slot="walker">
  <span class="dr-slot-idx">04</span>
  <span class="dr-slot-thumb"><!-- canvas or hatch --></span>
  <span class="dr-slot-name">Walker</span>
  <span class="dr-slot-note">Walks the floor</span>
  <span class="dr-slot-state"><i></i>Empty</span>
</button>
```

```css
.dr-slot{--dr-off:var(--dr-off2);position:relative;
  display:grid;grid-template-rows:auto 1fr auto auto;gap:8px;
  padding:14px;background:var(--dr-paper);border:var(--dr-b3) solid var(--dr-ink);
  cursor:pointer;text-align:left;min-height:196px;
  transition:transform 140ms cubic-bezier(.2,.9,.25,1),
             background-color 120ms linear,color 120ms linear;
  will-change:transform;isolation:isolate}
.dr-slot-idx{position:absolute;top:8px;right:10px;
  font:700 var(--dr-t-micro) var(--dr-face-mono);color:var(--dr-mute)}
.dr-slot-name{font:900 var(--dr-t-h3) var(--dr-face-display);text-transform:uppercase}
.dr-slot-note{font:700 var(--dr-t-micro) var(--dr-face-mono);color:var(--dr-mute)}
.dr-slot-state{display:flex;align-items:center;gap:7px;
  font:700 var(--dr-t-micro) var(--dr-face-mono);
  border-top:var(--dr-b1) solid var(--dr-ink);padding-top:8px;margin-top:2px}
.dr-slot-state i{width:8px;height:8px;background:currentColor;flex:0 0 auto}
```

**Thumbnail framing.** The player's pixels always sit on a pure white mat inside a black frame, and the frame's aspect ratio equals the slot's real canvas aspect (64×64, 96×96, 512×160). This is the only frame treatment in the app and it is used identically on the board, in the editor header, and in the rig preview, so a drawing is always recognisably "the artwork, matted".

```css
.dr-slot-thumb{display:block;background:var(--dr-paper);
  border:var(--dr-b2) solid var(--dr-ink);
  aspect-ratio:var(--dr-ar,1);width:100%;
  background-image:var(--dr-checker);          /* transparency check, see below */
  image-rendering:pixelated}                    /* pixel-art slots keep hard edges */
```

Transparent regions of a drawing show a **grey hard-stop checker** so the player can tell "white paint" from "no paint" at a glance — this is the same distinction the coverage gate enforces, so it must be visible everywhere, not only in the editor:

```css
--dr-checker:
  repeating-conic-gradient(var(--dr-hatch) 0% 25%, var(--dr-paper) 0% 50%) 0 0/12px 12px;
```

Backdrop slots use `--dr-ar:3.2`, terrain and creatures `--dr-ar:1`.

**States.**

| State | Fill | Border | Thumb | State chip text |
|---|---|---|---|---|
| `is-empty` | diagonal hatch | `--dr-b3` ink | hatch block with a centred `+` glyph, 28px, ink | `EMPTY` |
| `is-progress` | `--dr-paper` | `--dr-b3` ink | live thumbnail | `IN PROGRESS · 62%` (coverage for terrain, stroke count elsewhere) |
| `is-done` | `--dr-ink` | `--dr-b3` ink | live thumbnail, mat stays white | `DONE` + `RIGGED` and/or `SOUND` chips |

```css
.dr-slot.is-empty{background:
  repeating-linear-gradient(45deg,var(--dr-hatch) 0 8px,var(--dr-paper) 8px 16px)}
.dr-slot.is-done{background:var(--dr-ink);color:var(--dr-paper)}
.dr-slot.is-done .dr-slot-note,.dr-slot.is-done .dr-slot-idx{color:var(--dr-mute-inv)}
.dr-slot.is-done .dr-slot-thumb{border-color:var(--dr-paper)}
```

Note what inversion buys: on a done card, the drawing sits in a white rectangle surrounded by black. It is the brightest, most colourful object in a field of black. Progress across the board is legible from three metres away, and the mechanism of that legibility is the artwork itself.

Sub-state chips inside `is-done` (`RIGGED`, `SOUND`) are 16px-tall outlined boxes, `--dr-t-micro`, white border on ink. Absence of a chip is the message; there is no "not rigged" chip.

**Hover / focus / press** (identical for all three states):

```css
.dr-slot:hover,.dr-slot:focus-visible{transform:translate3d(-2px,-2px,0);outline:none}
.dr-slot:hover::after,.dr-slot:focus-visible::after{transform:translate3d(9px,9px,0)}
.dr-slot:active{transform:translate3d(5px,5px,0)}
.dr-slot:active::after{transform:translate3d(0,0,0)}
```

Lift on hover (shadow grows), press flat into the page on click (card travels onto its own shadow). Both are pure `transform` — cheap, and physically consistent across every raised object in the app.

### C.4 The hero slot

The hero is the player's own character: mandatory, outside the shared pool, and the only asset that is theirs. It is privileged four ways, none of which use colour.

```css
.dr-hero-row{margin-bottom:var(--dr-gap-l)}
.dr-slot-hero{--dr-off:var(--dr-off3);
  grid-column:1/-1;min-height:220px;
  border-width:var(--dr-b4);
  display:grid;grid-template-columns:200px 1fr auto;
  align-items:center;gap:var(--dr-gap-l);padding:20px 24px}
.dr-slot-hero .dr-slot-thumb{width:172px}
.dr-slot-hero .dr-slot-name{font:900 var(--dr-t-h1) var(--dr-face-display)}
```

1. **Full-bleed row of its own**, above every group, under the label `YOUR CHARACTER — REQUIRED`.
2. **Heavier frame** (`--dr-b4`) and a deeper shadow (`--dr-off3`) than any shared card.
3. **Horizontal layout** — thumbnail left at 172px, text centre, `DRAW` / `EDIT` button right. Nothing else on the board is laid out horizontally, so it cannot be mistaken for one of the thirteen.
4. **A black ledger strip** across the row's top edge reading `01 / 01 · THIS ONE IS YOURS`, inverted, `--dr-t-micro`.

When empty, its state chip reads `EMPTY — THE RUNNER IS YOU`. When done, the whole row inverts exactly like a shared card.

### C.5 The action bar and Start

Sticky at the bottom of the board screen, full width, `border-top:var(--dr-b4) solid var(--dr-ink)`, `background:var(--dr-paper)`, `padding:16px clamp(32px,5vw,80px)`, `z-index:3`. It does **not** float as a raised card — it is a structural edge of the screen.

```
[ ●●●●●○○○○○○○○○  6 / 14 DRAWN ]      [ 3 RIGGED ]  [ 1 SOUND ]        [ START SET → ]
```

- **Progress ledger**, left: fourteen 14×14 square pips, `--dr-b2` ink border; filled solid ink when that slot is done, hatched when in progress, empty white when untouched. Order matches the board reading order, hero first. Pips are display only, not clickable, and carry `aria-hidden` — the counter beside them is the accessible text.
- Counter strings: `6 / 14 DRAWN`, `3 RIGGED`, `1 SOUND` — mono, tabular numerals.
- **START SET** sits far right: `--dr-t-h2`, inverted by default (ink fill, white type, `--dr-b3` white inner keyline via `box-shadow:none;outline:none;` and a real `border:var(--dr-b3) solid var(--dr-ink)`), `--dr-off3` shadow, `min-height:64px`, `padding:0 36px`.
- **Start is always enabled** (v1 decision: solo, no completeness requirement). It never greys out. Instead, a mono line above it states the consequence honestly, updating live:
  - 14/14 → `EVERYTHING IS YOURS`
  - 1–13 → `8 SLOTS WILL USE MY SCRIBBLES`
  - 0 → `THE WHOLE SET WILL USE MY SCRIBBLES`
- In v1 Start opens the **set summary** overlay (not a run): a full-screen inverted sheet listing all 14 thumbnails on white mats in a 7×2 grid, with the heading `YOUR SET` and the line `THE RUN LANDS IN V2. FOR NOW, THIS IS THE WORLD YOU MADE.` and two buttons, `BACK TO SLOTS` and `MENU`. Under no circumstances is Start allowed to imply a run is about to start — the label is `START SET`, never `PLAY`.

---

## D. Screen 3 — EDITOR

### D.1 Frame and the three layouts

```html
<section class="dr-screen dr-editor" data-tab="draw">
  <header class="dr-ed-head">
    <button class="dr-btn dr-btn-ghost" data-act="back">← Esc  Slots</button>
    <span class="dr-ed-cat">CREATURES · 04</span>
    <h2 class="dr-ed-name">Walker</h2>
    <span class="dr-ed-spec">96 × 96 · WALKS THE FLOOR</span>
    <nav class="dr-tabs" role="tablist">
      <button role="tab" class="dr-tab is-on">Draw</button>
      <button role="tab" class="dr-tab">Rig</button>
      <button role="tab" class="dr-tab">Sound</button>
    </nav>
    <button class="dr-btn dr-btn-solid" data-act="done">Done</button>
  </header>

  <div class="dr-ed-body">
    <aside class="dr-rail">…</aside>
    <main class="dr-stage">…</main>
    <aside class="dr-inspect">…</aside>
  </div>
</section>
```

```css
.dr-editor{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--dr-ground)}
.dr-ed-head{display:flex;align-items:center;gap:var(--dr-gap-m);
  padding:14px clamp(24px,3vw,44px);background:var(--dr-paper);
  border-bottom:var(--dr-b4) solid var(--dr-ink);flex:0 0 auto}
.dr-ed-name{font:900 var(--dr-t-h1) var(--dr-face-display);text-transform:uppercase;margin-right:auto}
.dr-ed-cat,.dr-ed-spec{font:700 var(--dr-t-micro) var(--dr-face-mono);color:var(--dr-mute)}
.dr-ed-body{flex:1;min-height:0;display:grid;
  grid-template-columns:88px minmax(0,1fr) 360px;gap:var(--dr-gap-l);
  padding:var(--dr-gap-l) clamp(24px,3vw,44px)}
/* RIG tab reshapes the middle: canvas and preview share the stage */
.dr-editor[data-tab="rig"] .dr-ed-body{grid-template-columns:88px minmax(0,1fr) 320px}
.dr-editor[data-tab="rig"] .dr-stage{display:grid;grid-template-columns:1fr 1fr;gap:var(--dr-gap-l)}
.dr-editor[data-tab="sound"] .dr-rail{visibility:hidden}
```

Tabs are a hard segmented control: three buttons in a row, `--dr-b3` ink border, no gap between them (shared borders via `margin-left:-3px`), `--dr-t-h3`, `min-height:44px`, `padding:0 22px`. Active tab is inverted (ink fill, white type) and gains a 4px black tick extending below into the header border. Inactive tabs are white; hover fills `--dr-hatch`.

### D.2 Canvas stage

```css
.dr-stage{display:flex;align-items:center;justify-content:center;min-height:0}
.dr-canvas-frame{--dr-off:var(--dr-off3);position:relative;
  border:var(--dr-b4) solid var(--dr-ink);background:var(--dr-paper);
  background-image:var(--dr-checker);line-height:0}
.dr-canvas{display:block;cursor:crosshair;touch-action:none;image-rendering:pixelated}
```

Screen canvas is **520 px on its long edge** (backdrop slots: 832 × 260, letterboxed inside the stage). `image-rendering:pixelated` is set only when the pixel-art toggle is on; otherwise `auto`. The frame is centred; `--dr-ground` shows around it, so the artwork always reads as a matted object, never as "the page".

Overlays stacked inside `.dr-canvas-frame`, each an absolutely positioned sibling canvas with `pointer-events:none`:

1. **Ghost hero silhouette** (`.dr-ghost`) — the hero drawing, or the demo hero when the player's is empty, rendered as a **flat 14% black silhouette** (alpha thresholded, all colour discarded), scaled to the slot's true world scale, anchored bottom-centre on terrain and creature slots, bottom-left on backdrop slots. It is the only place a drawing is allowed to lose its colour, and that is precisely because it is not artwork here — it is a ruler. It never sits above the player's strokes (`z-index` below the paint layer... in practice: drawn on a canvas *behind* the paint canvas, over the checker). A `GHOST` toggle chip in the top-right of the frame turns it off; state persists across slots for the session. Ghost never captures pointer events.
2. **Mirror axis** (`.dr-mirror-line`) — a 2px dashed vertical ink line at the mid-point, visible only while mirror mode is on.
3. **Holes overlay** (`.dr-holes`) — §D.6.
4. **Rig points layer** — §D.7, Rig tab only.

Cursor: `crosshair` for brush/eraser/fill, and a live **brush ring** — a 1px ink circle plus 1px white circle at the true brush diameter, drawn on a lightweight overlay canvas following `pointermove`. The double ring guarantees the cursor is visible over black paint and white paper alike. Redraw only on pointermove, never in the rAF loop.

### D.3 Tool rail

Vertical, 88px wide, left edge. Buttons are **64 × 64**, `--dr-b3` ink border, white fill, stacked with `gap:var(--dr-gap-s)`, each with a mono keycap in the bottom-right corner of the button.

```css
.dr-tool{--dr-off:var(--dr-off1);position:relative;width:64px;height:64px;
  display:grid;place-items:center;background:var(--dr-paper);
  border:var(--dr-b3) solid var(--dr-ink);cursor:pointer;
  transition:transform 120ms cubic-bezier(.2,.9,.25,1),
             background-color 100ms linear,color 100ms linear;isolation:isolate}
.dr-tool:hover{transform:translate3d(-1px,-1px,0)}
.dr-tool:hover::after{transform:translate3d(4px,4px,0)}
.dr-tool.is-on{background:var(--dr-ink);color:var(--dr-paper)}
.dr-tool.is-on::after{transform:translate3d(0,0,0)}   /* active = pressed in, shadow gone */
.dr-tool-key{position:absolute;right:3px;bottom:2px;
  font:700 9px var(--dr-face-mono);color:var(--dr-mute)}
.dr-tool.is-on .dr-tool-key{color:var(--dr-mute-inv)}
.dr-tool[disabled]{border-color:var(--dr-edge);color:var(--dr-disabled);cursor:default}
.dr-tool[disabled]::after{display:none}
```

Icons are inline SVG, `stroke:currentColor`, `stroke-width:3`, `stroke-linecap:square`, `fill:none`, 28×28, no rounded joins — they must look like they were cut, not drawn.

| Order | Tool | Key | Icon | Notes |
|---|---|---|---|---|
| 1 | Brush | `B` | tapered nib, square tip | Default tool on slot open |
| 2 | Eraser | `E` | rectangle with one corner cut | Erases to transparent, not to white — this is the difference the gate cares about |
| 3 | Fill | `G` | bucket with a single drop | Flood fill, 8-connected, tolerance 24/255. The 100% gate's escape hatch |
| 4 | Eyedropper | `I` | pipette | Picks colour under cursor; auto-returns to Brush after one pick |
| — | *(rule)* | | 2px ink divider, `margin:6px 0` | |
| 5 | Mirror | `M` | vertical axis with two arrows | Toggle, not a mode — brush strokes are duplicated across the vertical axis live |
| 6 | Pixel art | `P` | 3×3 square grid | Toggle, §D.5 |
| — | *(rule)* | | | |
| 7 | Undo | `⌘Z` | anticlockwise arrow | Disabled at history floor |
| 8 | Redo | `⌘⇧Z` | clockwise arrow | Disabled at history ceiling |
| 9 | Clear | `⇧⌫` | trash | Two-press confirm, §D.9 |

Every tool button carries `aria-label` (`"Brush (B)"`) and `aria-pressed` for toggles.

### D.4 Draw tab inspector

The right panel, `.dr-inspect`, is a stack of fields separated by 2px ink rules. Panel itself: white, `--dr-b3` border, `--dr-off3` shadow, `padding:var(--dr-pad)`, `overflow-y:auto`.

**Field 1 — COLOUR.** Two overlapping squares (foreground 56×56 in front, background 56×56 offset 18px behind, both `--dr-b3` ink border), exactly like the classic paint-program pair, plus a swap affordance.

```html
<div class="dr-colour">
  <input type="color" class="dr-colour-fg" value="#000000" aria-label="Foreground colour">
  <input type="color" class="dr-colour-bg" value="#FFFFFF" aria-label="Background colour">
  <button class="dr-colour-swap" aria-label="Swap colours (X)">⇄ X</button>
  <input type="text" class="dr-hex" value="#000000" aria-label="Hex colour" maxlength="7">
</div>
```

`input[type=color]` is stripped to a raw square: `-webkit-appearance:none;appearance:none;padding:0;border:var(--dr-b3) solid var(--dr-ink);border-radius:0;` plus `::-webkit-color-swatch-wrapper{padding:0}` and `::-webkit-color-swatch{border:0;border-radius:0}`. Full free choice — **no preset palette is offered anywhere in the app**, per the scoping decision, and offering one would also be the shell dictating colour, which is the one thing it must never do.

The hex field accepts `#RGB` / `#RRGGBB`, normalises on blur, and rejects invalid input by reverting silently (no red — invalid hex is not blocking, it is just ignored).

Below: **RECENT** — the last eight colours actually used, as 28×28 squares in a row, `--dr-b2` border, no labels. These are the player's own colours, so they may be chromatic; they are the only chromatic chips in the shell and they are literally a record of the artwork.

**Field 2 — BRUSH.** Label `BRUSH`, value `12 PX` in `--dr-t-num`. Four hard size presets shown as four solid ink dots (4, 8, 16, 32 target px) in 44×44 hit boxes, plus a square-thumb range for anything between.

```css
.dr-range{-webkit-appearance:none;appearance:none;width:100%;height:24px;background:transparent}
.dr-range::-webkit-slider-runnable-track{height:8px;background:var(--dr-paper);
  border:var(--dr-b2) solid var(--dr-ink)}
.dr-range::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;
  margin-top:-9px;background:var(--dr-ink);border:0;border-radius:0}
.dr-range:focus-visible::-webkit-slider-thumb{outline:3px solid var(--dr-paper);
  box-shadow:0 0 0 6px var(--dr-ink)}
```

Range is 1–48 in normal mode, 1–12 in pixel-art mode (units are grid cells there, and the value readout switches to `3 CELLS`). `[` and `]` step through the four presets, not the raw range — the keys should feel like gear changes, not a dial.

**Field 3 — GRID / PIXEL ART.** §D.5.

**Field 4 — COVERAGE.** §D.6. Present on all slots; on non-terrain slots it is informational (label `COVERAGE`, no gate, no accent, ever).

**Field 5 — SCALE.** The ghost toggle: `GHOST HERO` with an on/off switch styled as a 56×28 ink-bordered box whose knob is a solid 24×24 ink square that slides. Note underneath: `Your character, at true size, for scale.`

### D.5 Pixel-art toggle

Presented as a **grid size**, not a mode, matching the technical decision:

```
GRID
[ FREE ]  [ PIXEL ]        ← two-button segmented control, ink border, active inverted
Working grid: 96 × 96      /  Working grid: 24 × 24 · 1 cell = 4 px
```

When PIXEL is on:
- A 1px `--dr-edge` grid overlay is drawn on the canvas frame at cell boundaries, **only when cells are ≥ 8 screen px**; below that the overlay is suppressed rather than turning into moiré.
- The brush snaps to cells; `image-rendering:pixelated` is applied to the canvas and to every thumbnail of this asset.
- The eyedropper picks the cell colour.
- Switching FREE → PIXEL does **not** resample existing artwork (same bitmap, same export). A one-line note states it: `Same drawing, chunkier tool. Nothing already painted changes.`

### D.6 Coverage meter and the 100% gate

```html
<div class="dr-cov" data-state="short">
  <div class="dr-cov-head">
    <span class="dr-cov-label">Coverage</span>
    <span class="dr-cov-num">98%</span>
  </div>
  <div class="dr-cov-bar" role="progressbar" aria-valuenow="98" aria-valuemin="0" aria-valuemax="100">
    <i></i><i></i><!-- 20 segments -->
  </div>
  <p class="dr-cov-msg">124 pixels still empty. Ground tiles must be solid.</p>
  <button class="dr-btn dr-btn-ghost dr-cov-show">Show holes  H</button>
</div>
```

- Bar is **20 hard segments**, each `--dr-b2` ink border, `gap:3px`, height 22px. Filled segments are solid ink. Segments, not a smooth fill: the player can count how far off they are, and a 2px sliver of missing fill is invisible while a missing segment is not. The last segment fills only at a true 100.00%.
- Numeric readout is exact and never rounds up: `Math.floor` to two decimals below 100, so 99.996% displays `99.99%`, never `100%`. Rounding here would be a lie the gate then contradicts, which is the single worst failure this screen can have.
- **Below 100% on a `requiresFullCoverage` slot:** `data-state="short"` — the last unfilled segment and the numeric readout take `--dr-alert`; the DONE button is disabled and carries the reason line `NEEDS 100% — 124 PIXELS EMPTY` in `--dr-alert`, `--dr-t-micro`, directly under the button in the header.
- **At 100%:** `data-state="full"` — accent vanishes entirely, bar is fully ink, readout reads `100%`, message reads `Solid. No holes.`, DONE enables with the entry pop from §E.3.
- On non-terrain slots the meter never uses `--dr-alert` and DONE is never gated; message reads `Nothing to fill — this one can have gaps.`

**SHOW HOLES** is the safety valve that keeps the hard gate humane. Two ways in, both bound to `H`:

- **Hold `H`** (or press-and-hold the button): every pixel with alpha ≤ 8 is painted `--dr-alert` at full opacity on the `.dr-holes` overlay for as long as it is held.
- **Click the button**: latches on, blinking on a 900ms cycle (`opacity 1 → 0.15 → 1`, `steps` timing so it snaps rather than fades — this is a warning, not a pulse), until clicked again or a stroke is drawn.

Additionally, when there are **fewer than 40 empty pixels**, the overlay draws a 3px `--dr-alert` ring around each connected hole cluster at a minimum on-screen radius of 14px, and the message becomes `2 holes left. Ringed in red.` A single stray pixel is then a 28px target, not a needle. If a cluster falls outside the visible frame area (impossible at 520px but guard anyway), the overlay draws an edge arrow toward it.

### D.7 Rig tab

**Layout change is the point.** On this tab the stage splits 50/50: drawing canvas left, **animation preview right, at the same height and nearly the same width as the canvas itself**. It is not a thumbnail, not a popover, not a corner inset. It is the co-equal half of the screen, because it is the thing v1 exists to answer.

```html
<main class="dr-stage">
  <div class="dr-canvas-frame">…drawing + rig point layer…</div>
  <figure class="dr-preview">
    <figcaption class="dr-preview-cap">LIVE — WALK CYCLE</figcaption>
    <div class="dr-preview-frame"><canvas class="dr-preview-canvas"></canvas></div>
    <div class="dr-preview-ctl">…</div>
  </figure>
</main>
```

```css
.dr-preview{display:flex;flex-direction:column;gap:var(--dr-gap-s);min-height:0}
.dr-preview-cap{font:700 var(--dr-t-label) var(--dr-face-mono);
  background:var(--dr-ink);color:var(--dr-paper);padding:8px 12px}
.dr-preview-frame{--dr-off:var(--dr-off4);position:relative;flex:1;min-height:420px;
  border:var(--dr-b4) solid var(--dr-ink);background:var(--dr-paper);isolation:isolate}
.dr-preview-canvas{display:block;width:100%;height:100%}
```

- Heaviest border in the app (`--dr-b4`) and the deepest shadow (`--dr-off4`) — same weight as the DOODLERUN title slab. Nothing else on this screen is that loud.
- The rigged drawing is rendered **at 2.2× its target size**, centred, looping continuously, on a plain white ground with a single 3px ink baseline rule for terrain contact.
- A faint 1px `--dr-edge` wireframe of the deformation mesh can be toggled (`MESH` chip, top-right of the frame). Off by default — the question is whether the doodle looks alive, and the mesh answers a different question.
- Preview controls beneath the frame, one row: motion preset segmented control `WALK / FLY / HOP / SPIN` (slot's default pre-selected, per the swap-switch decision), a `SPEED` range (0.5×–2×, default 1×), and `⏸ / ▶` (`Space`).
- **FPS badge** in the frame's bottom-right: mono, `--dr-t-micro`, e.g. `58 FPS`. It is not decoration — the plan's verification step needs it, and the 45fps mesh-density fallback needs a number to trip on. Below 45fps sustained for 2s the badge reads `44 FPS · MESH 8×8` after the automatic downgrade.
- The preview loop runs only while the Rig tab is active and the document is visible.

**Role list** occupies the right inspector on this tab:

```
ROLES · 2 / 4 PLACED
┌────────────────────────────────┐
│ ● LEFT LEG        placed  ⌫   │   ← placed: inverted row, ink fill
│ ● RIGHT LEG       placed  ⌫   │
│ ○ HEAD            click canvas │   ← armed: 3px ink border + marching-ants
│ ○ BODY            required     │
└────────────────────────────────┘
```

- Rows are 52px tall, full-width, `--dr-b2` ink borders, stacked with shared edges.
- Roles come from `rig/roles.js` per slot type. Required roles show `required` in `--dr-mute`; optional roles show `optional`.
- **Placing a point:** click a role row → it becomes *armed* (border thickens to `--dr-b3`, a 2px dashed marching-ants outline animates at 900ms linear infinite via `background-position` on a repeating hard-stop gradient, and the canvas cursor changes to `crosshair` with a 44px targeting reticle following the pointer). Click on the canvas → the point lands with a 180ms `scale(1.6)→1` pop, the row flips to *placed* (inverted), the next unplaced required role auto-arms, and the preview restarts its loop from phase 0 so the change is immediately legible. `Esc` disarms without placing.
- **A placed point** renders on the canvas as a 16px white square with a 3px ink border and a 4px solid ink centre, plus its role name in `--dr-t-micro` on an inverted 2px-padded label offset 10px up-right. It is draggable; dragging updates the preview live (throttled to rAF). Its influence radius is shown as a 1px dashed ink circle **only while hovered or dragged** — permanent circles would bury the drawing.
- `⌫` on a row, or `Delete` while a point is selected, removes it.
- Under the list: `Points pull the pixels around them. Nothing gets cut.` and, when required roles are missing, `PLACE ALL REQUIRED POINTS TO SEE THE FULL CYCLE` — in `--dr-mute`, **not** in the accent, because an unrigged asset is legal in v1. The rig is never a gate.

### D.8 Sound tab

The stage keeps the drawing canvas (read-only, so the player sees what they are voicing) and replaces the inspector with the recorder. The tool rail hides (`visibility:hidden`, keeping layout stable — no reflow between tabs).

```
SOUND
┌──────────────────────────────────────┐
│      ▮▮▮▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯          │  ← 20-segment level meter, live input
│              0.6 s / 2.0 s           │
└──────────────────────────────────────┘
[ ● RECORD  R ]   [ ▶ PLAY ]   [ ⌫ DELETE ]
One short mono take. Two seconds, max.
```

- Three buttons, 56px tall, ink border, `--dr-off2`.
- **RECORD**: idle label `● Record`. Held or clicked to start; while recording the button inverts, the dot blinks at 600ms `steps(1,end)` (achromatic — recording is a state, not an alarm), and the label counts `● Recording 0.8s`. Hard stop at 2.0s. Press again to stop early.
- After capture, a **static waveform** is drawn in the meter box: ink bars on white, 2px wide, 1px gap, peak-normalised. PLAY sweeps a 3px ink playhead across it.
- **PLAY** disabled with no sample. **DELETE** disabled with no sample; with a sample it is a two-press confirm (§D.9).
- Permission denied → the box shows `NO MICROPHONE ACCESS. SOUND IS OPTIONAL — SKIP IT.` in `--dr-mute`. Not accent: no microphone does not block anything.

### D.9 Destructive confirms

`CLEAR CANVAS` and `DELETE SOUND` are two-press. First press: the button inverts to `--dr-alert` fill with `--dr-alert-ink` type and the label changes to `Clear it?` / `Delete it?`, with a 3.2s timeout that reverts. Second press executes. No modal, no dialog — this is the only place the accent appears on a control, and it appears only for those 3.2 seconds. `Clear` is undoable (it is one history step); the label still confirms, because a full canvas is expensive to lose even with undo available.

### D.10 DONE and leaving

- **DONE** sits top-right of the editor header, `--dr-t-h3`, ink fill, white type, `--dr-off2`, `min-height:44px`, `padding:0 28px`. Enabled unless the coverage gate blocks it. Marks the slot done, returns to the board with the slot card playing the land animation (§E.1).
- **← Esc Slots** returns without marking done. Work is always kept — the slot becomes `in progress`. There is **no unsaved-changes dialog**; the store commits on every stroke end. Say so once, in the header: `SAVED AS YOU DRAW`, `--dr-t-micro`, `--dr-mute`.

---

## E. Motion

**Global rules.** Only `transform` and `opacity` are ever transitioned. Never transition `box-shadow`, `filter`, `width`, `height`, `top/left`, `background-image`, or `border-width`. `background-color` and `color` transitions are permitted at ≤120ms `linear` only (they are cheap on paint, and the snap is the point). `will-change:transform` on elements that actually animate on hover; remove it from anything static. Every animated element must be its own compositor layer only while animating — do not blanket the app in `translateZ(0)`.

**Easings.**

```css
--dr-e-out:   cubic-bezier(.2,.9,.25,1);    /* default: fast out, hard settle */
--dr-e-snap:  cubic-bezier(.16,1,.3,1);     /* entries, land */
--dr-e-in:    cubic-bezier(.6,0,.9,.3);     /* exits */
--dr-e-pop:   cubic-bezier(.34,1.4,.5,1);   /* single overshoot, points and unlocks */
```

Neo-brutalism means **no bounce, no spring, no easing that lingers**. `--dr-e-pop` overshoots exactly once, by ~12%, and only on point placement and the DONE unlock — two events, nothing else.

**Durations.** `--dr-d-tap:100ms` · `--dr-d-fast:140ms` · `--dr-d-base:200ms` · `--dr-d-screen:280ms` · `--dr-d-land:360ms`. Nothing in the app exceeds 420ms.

### E.1 Screen entries

Screens are absolutely positioned siblings; the outgoing one gets `.is-gone` (`pointer-events:none`) and both are alive for the duration of the crossfade. No blur, no scale on the container.

| Screen | In | Out |
|---|---|---|
| MENU | Container `opacity 0→1`, 200ms `--dr-e-out`. Title slab `translate3d(-28px,0,0)→0` + opacity, 280ms `--dr-e-snap`, delay 40ms. Nav items stagger: `translate3d(-20px,0,0)→0` + opacity, 220ms `--dr-e-snap`, delay `80 + i*45ms`. Footer opacity 200ms delay 340ms. | opacity → 0, 160ms `--dr-e-in` |
| BOARD | Container opacity 180ms. Hero row `translate3d(0,-18px,0)→0`, 280ms `--dr-e-snap`. Group headings and cards stagger by **row, not by card** (`delay = 60 + rowIndex*55ms`, cards within a row share a delay): `translate3d(0,16px,0)→0` + opacity, 240ms `--dr-e-snap`. Fourteen simultaneous per-card timers would not hold frame; five row timers will. Action bar `translate3d(0,100%,0)→0`, 260ms `--dr-e-snap`, delay 120ms. | opacity → 0, 160ms |
| EDITOR | Header `translate3d(0,-100%,0)→0` 240ms `--dr-e-snap`. Rail `translate3d(-100%,0,0)→0` 240ms delay 40ms. Canvas frame `scale(.965)→1` + opacity 240ms `--dr-e-snap` delay 60ms — the only scale in the app, and it is on a single element. Inspector `translate3d(24px,0,0)→0` 240ms delay 80ms. | Reverse, 180ms `--dr-e-in`, no stagger |

**Slot land** (returning from editor with a slot newly done): that card runs `dr-land` — `transform: translate3d(0,-10px,0) → translate3d(0,3px,0) → none` over 360ms `--dr-e-snap`, while its shadow pseudo travels `12px → 3px → 5px`. Once, on the one card, immediately after the board entry completes.

**Tab switch inside the editor:** the inspector and stage contents crossfade at 140ms `--dr-e-out` with `translate3d(0,8px,0)` on the incoming content. The grid-template change (Draw → Rig) is instantaneous — do not transition `grid-template-columns`; it triggers layout every frame. The canvas frame's own size change is absorbed by a single 200ms `transform:scale()` correction applied via FLIP, or simply accepted as a snap. Prefer the snap: it is honest and it is free.

### E.2 Hover microinteractions

All of these are one `transform` on the element plus one `transform` on its `::after` shadow, both 140ms `--dr-e-out`.

| Element | Hover | Active/press |
|---|---|---|
| Slot card, panel button | `translate3d(-2px,-2px,0)`; shadow → `9px,9px` | `translate3d(5px,5px,0)`; shadow → `0,0` |
| `.dr-btn` | `translate3d(-2px,-2px,0)`; shadow → `7px,7px` | shadow → `0,0`, element to shadow position |
| `.dr-tool` | `translate3d(-1px,-1px,0)`; shadow → `4px,4px` | inverted, shadow → `0,0` |
| `.dr-nav-item` | fills black, `translate3d(8px,0,0)` | `translate3d(8px,2px,0)` |
| `.dr-tab` | fills `--dr-hatch` | no transform |
| Recent-colour chip | `translate3d(0,-3px,0)` | — |

Everything obeys the same fiction: raised objects are lifted by the pointer and pressed flat when clicked. There is no other hover vocabulary in the app.

### E.3 Tool and canvas feedback

- **Tool select:** the button inverts (100ms `linear` on colours) and its shadow collapses to `0,0` in 120ms. The previously active tool's shadow returns over the same 120ms. No icon animation.
- **Brush size change** (keys or presets): the readout in the inspector plays `scale(1.18)→1`, 140ms `--dr-e-pop`, and the on-canvas brush ring redraws at the new diameter immediately — the ring is the real feedback, the readout is the confirmation.
- **Colour swap (`X`):** the two colour squares swap positions with a 160ms `--dr-e-out` `translate3d` cross, not a fade.
- **Undo / redo:** the corresponding rail button flashes inverted for 120ms then returns. If the stack is exhausted, the button plays `dr-nudge` — `translate3d(-3px,0,0) → translate3d(3px,0,0) → 0` over 160ms, once. Never a colour change; being at the end of history is not an error.
- **Stroke commit:** no animation. The canvas is the artwork; it must never be animated by the shell.
- **Coverage bar:** a newly filled segment appears instantly (no width transition) and plays `scale(1,0.7)→scale(1,1)` over 120ms `--dr-e-out`, transform-origin bottom. The gate crossing 100% additionally plays: the DONE button `scale(1.06)→1`, 220ms `--dr-e-pop`, and the accent leaves the bar in a single 100ms `linear` colour change — the accent's departure should feel like a switch, not a sunset.
- **Rig point placement:** `scale(1.6)→scale(1)`, 180ms `--dr-e-pop` on the point marker; the preview frame's caption strip flashes inverted-white-on-ink → ink-on-white → back over 200ms to signal the loop restarted.
- **Preview loop:** driven by one `requestAnimationFrame` loop for the whole app, with a fixed logical timestep. Mesh deformation and `drawImage` triangle blitting stay inside it. Nothing else in the app runs a rAF loop while the editor is open.

### E.4 Holding 60fps on a 2019 Intel MacBook Pro

Non-negotiable implementation constraints, all of which follow from the above:

1. One rAF loop, app-wide. Menu backdrop, rig preview and brush ring never run concurrently — the menu backdrop is cancelled on navigation, the ring redraws on pointer events only.
2. Offset shadows are pseudo-element transforms, never `box-shadow` transitions.
3. Board entry staggers by row (5 timers), not by card (14 timers).
4. No `backdrop-filter` anywhere in this app — not one instance. It is the single most expensive thing Hollowtree does and it is exactly what our style rejects anyway.
5. Thumbnails are cached `ImageBitmap`s or offscreen canvases, redrawn only when the asset changes, never per frame.
6. Hatch and checker backgrounds are static CSS gradients on non-animating elements. Never animate an element whose background is a repeating gradient.
7. The mesh preview downgrades 12×12 → 8×8 automatically after 2s below 45fps, and announces it in the FPS badge.
8. `@media (prefers-reduced-motion:reduce)`: all transitions and animations to `0.01ms`, the menu backdrop renders one static frame, the rig preview **keeps running** (it is content, not decoration) but gains a visible `⏸` control and starts paused, with the caption `PAUSED — PRESS PLAY`.

---

## F. Keyboard map

Global handler on `window`, suppressed whenever `document.activeElement` is an `input` or `[contenteditable]` (so typing a hex value never fires a tool shortcut). `⌘` on macOS, `Ctrl` elsewhere — detect once via `navigator.platform` and render the correct glyph in every keycap and hint.

**Global**

| Key | Action |
|---|---|
| `Esc` | Editor → board (keeps work). Board → menu. Overlay → close. Armed rig role → disarm. Confirm state → cancel |
| `Tab` / `Shift+Tab` | Standard focus traversal, never trapped except in the set-summary overlay |
| `Enter` / `Space` | Activate the focused control |
| `?` | Toggle the keyboard sheet — an inverted panel listing this whole table |

**Board**

| Key | Action |
|---|---|
| `↑ ↓ ← →` | Move between slot cards in the visual grid |
| `Enter` | Open the focused slot |
| `H` | Jump focus to the hero slot |
| `⌘Enter` | Start set |

**Editor — always**

| Key | Action |
|---|---|
| `⌘Z` | Undo (20 steps) |
| `⌘⇧Z` / `⌘Y` | Redo — bind both; `⌘Y` costs nothing and the spec asks for it |
| `1` `2` `3` | Draw / Rig / Sound tab |
| `⌘Enter` | Done (no-op with feedback nudge when the coverage gate blocks) |
| `Esc` | Back to slots |

**Editor — Draw tab**

| Key | Action |
|---|---|
| `B` | Brush |
| `E` | Eraser |
| `G` | Fill |
| `I` | Eyedropper |
| `Alt` (hold) | Temporary eyedropper — releases back to the previous tool. Standard in every paint program; its absence is felt immediately |
| `[` / `]` | Brush size down / up, stepping the four presets |
| `⇧[` / `⇧]` | Brush size by ±1 raw unit for precision |
| `X` | Swap foreground and background colour |
| `D` | Reset colours to black / white |
| `M` | Mirror toggle |
| `P` | Pixel-art toggle |
| `H` | Show holes — tap to latch, hold for momentary |
| `Q` | Ghost hero toggle |
| `⇧⌫` | Clear canvas (enters the two-press confirm) |

**Editor — Rig tab**

| Key | Action |
|---|---|
| `1`–`8` … | *(conflicts with tab switching — do not bind digits here)* |
| `A` | Arm the next unplaced required role |
| `↑ ↓` | Move selection through the role list |
| `Enter` | Arm the selected role |
| `⌫` / `Delete` | Remove the selected role's point |
| `Space` | Pause / play the preview |
| `Esc` | Disarm |
| `W` | Toggle mesh wireframe |

**Editor — Sound tab**

| Key | Action |
|---|---|
| `R` | Record start/stop |
| `Space` | Play the sample |
| `⌫` | Delete (two-press confirm) |

Every bound key appears as a keycap on its control (`.dr-tool-key`, or a mono suffix in a button label like `Show holes  H`), so the map is discoverable without opening the `?` sheet.

---

## G. Accessibility and clarity

### G.1 Focus

Focus must survive both white and black surfaces, so the ring is a **double ring** and is drawn identically everywhere:

```css
.dr-app :focus{outline:none}
.dr-app :focus-visible{
  outline:3px solid var(--dr-paper);
  outline-offset:0;
  box-shadow:0 0 0 6px var(--dr-ink);   /* static, never transitioned */
  position:relative;z-index:5}
/* on inverted surfaces the layers swap */
.dr-slot.is-done:focus-visible,.dr-btn-solid:focus-visible,.dr-tool.is-on:focus-visible{
  outline-color:var(--dr-ink);box-shadow:0 0 0 6px var(--dr-paper)}
```

The ring is never the only signal — hovered and focused states share the same fill/transform change (§B.3, §E.2), so a keyboard user sees exactly what a mouse user sees, plus the ring. `:focus-visible` only; never show the ring on mouse click. Never remove the ring "because the design is loud enough".

Skip link as the first focusable element on each screen: `Skip to slots` / `Skip to canvas`, visually hidden until focused, then rendered as a normal inverted button pinned top-left.

### G.2 Hit targets

Absolute floor **44 × 44 CSS px** for anything clickable, no exceptions. Actual sizes: tool buttons 64×64, tabs 44 tall × 22 padding, brush presets 44×44, nav rows 48 tall (full column width), slot cards ≥196 tall, colour swatches 56×56, recent-colour chips 28×28 visually but wrapped in a 44×44 button with transparent padding, range thumb 22px visually inside a 24px track with a 44px-tall hit area via padding. Rig point markers are 16px visually with a 24px pointer radius in hit-testing — and they are drag targets on a canvas, so also reachable via the role list.

Minimum 6px between adjacent independent targets, except the tab segmented control and role list, where shared borders make the grouping explicit.

### G.3 Contrast

Every shell pairing is measured against the WCAG ratio, and neo-brutalism makes this trivial — do not spend the surplus.

| Pair | Ratio | Status |
|---|---|---|
| `--dr-ink` on `--dr-paper` | 21.0 | AAA |
| `--dr-ink` on `--dr-ground` | 18.9 | AAA |
| `--dr-paper` on `--dr-ink` | 21.0 | AAA |
| `--dr-mute` on `--dr-paper` | 3.5 | Large/bold text only — and `--dr-mute` is used **only** at `--dr-t-label`/`--dr-t-micro` weight 700, which qualifies. Never for body copy |
| `--dr-mute-inv` on `--dr-ink` | 8.3 | AAA |
| `--dr-alert` on `--dr-paper` | 4.9 | AA. Additionally the accent **never carries meaning alone** — it always accompanies a text string and a disabled state |
| `--dr-alert-ink` on `--dr-alert` | 4.3 | AA large only → accent-filled buttons use `--dr-t-h3` (18px, 900) exclusively |
| `--dr-disabled` on `--dr-paper` | 2.3 | Fails deliberately — disabled controls also carry `--dr-edge` borders, `aria-disabled`, and an adjacent reason string in passing contrast |

The holes overlay is red on the player's own artwork, whose colours we do not control, so it cannot rely on contrast: it therefore **blinks** and, at low counts, adds a 3px ring — motion and shape, not colour alone.

### G.4 Semantics and announcements

- Screens are `<section>` with `aria-labelledby` pointing at their heading; only the active screen is in the tree (`aria-hidden="true"` + `inert` on the others).
- Slot cards are `<button>` with `aria-label="Walker, creature slot 4 of 6, in progress, 62 percent covered"`.
- Tabs use `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`, with arrow-key traversal per the WAI pattern.
- The coverage bar is `role="progressbar"` with live `aria-valuenow` and `aria-valuetext="98 percent, 124 pixels empty"`.
- One `aria-live="polite"` region per screen for state changes that have no focus event: `Coverage complete. Done is available.`, `Left leg placed. 3 of 4 roles placed.`, `Recording stopped. 1.4 seconds captured.` Never `assertive` — nothing here is urgent.
- The drawing canvas carries `role="img"` with a description, and `aria-describedby` pointing at a note stating plainly: `Drawing needs a pointer. Rig points can be placed from the role list with the keyboard.` v1 is desktop mouse/trackpad by decision; say so rather than implying otherwise.
- Icon-only buttons all carry `aria-label` including the shortcut, e.g. `aria-label="Mirror mode (M)"` with `aria-pressed`.

---

## Copy index

Every user-visible string, for the Coder to lift verbatim.

**Menu** — `DOODLERUN` · `Draw the whole world first. Then rig it. Then run it.` · `New set` / `Start a fresh world of 14 drawings` · `Continue` / `Pick up the set you were drawing` / `Nothing drawn yet` · `How it works` / `Draw, rig, run — in 40 seconds` · `Demo set` / `Open my hand-drawn set and poke at it` · `DOODLERUN V1` · `DESKTOP ONLY` · `MOUSE / TRACKPAD`

**Board** — `Slots` · `Fourteen drawings make a world. Draw as many as you like — the rest run on my scribbles.` · `YOUR CHARACTER — REQUIRED` · `01 / 01 · THIS ONE IS YOURS` · `EMPTY — THE RUNNER IS YOU` · `TERRAIN` / `3 SLOTS · 100% COVERAGE REQUIRED` · `CREATURES` / `6 SLOTS` · `LOOT` / `2 SLOTS` · `BACKDROP` / `3 SLOTS` · `EMPTY` · `IN PROGRESS` · `DONE` · `RIGGED` · `SOUND` · `6 / 14 DRAWN` · `3 RIGGED` · `1 SOUND` · `START SET` · `EVERYTHING IS YOURS` / `8 SLOTS WILL USE MY SCRIBBLES` / `THE WHOLE SET WILL USE MY SCRIBBLES` · `YOUR SET` · `THE RUN LANDS IN V2. FOR NOW, THIS IS THE WORLD YOU MADE.` · `BACK TO SLOTS` · `MENU`

**Editor** — `Draw` · `Rig` · `Sound` · `Done` · `Esc  Slots` · `SAVED AS YOU DRAW` · `Colour` · `Recent` · `Swap  X` · `Brush` · `12 PX` / `3 CELLS` · `Grid` · `FREE` / `PIXEL` · `Working grid: 24 × 24 · 1 cell = 4 px` · `Same drawing, chunkier tool. Nothing already painted changes.` · `Ghost hero` · `Your character, at true size, for scale.` · `Coverage` · `124 pixels still empty. Ground tiles must be solid.` · `Solid. No holes.` · `Nothing to fill — this one can have gaps.` · `2 holes left. Ringed in red.` · `Show holes  H` · `NEEDS 100% — 124 PIXELS EMPTY` · `Clear it?` · `Delete it?` · `Roles · 2 / 4 placed` · `click canvas` · `placed` · `required` · `optional` · `Points pull the pixels around them. Nothing gets cut.` · `PLACE ALL REQUIRED POINTS TO SEE THE FULL CYCLE` · `LIVE — WALK CYCLE` · `MESH` · `WALK` / `FLY` / `HOP` / `SPIN` · `SPEED` · `PAUSED — PRESS PLAY` · `● Record` / `● Recording 0.8s` · `▶ Play` · `⌫ Delete` · `One short mono take. Two seconds, max.` · `NO MICROPHONE ACCESS. SOUND IS OPTIONAL — SKIP IT.`

---

## Notes for the Coder

- `screens.css.js` exports one template string and an `injectStyles()` guard, exactly like Hollowtree's — but none of Hollowtree's rules, values or helpers are copied. `el()` is worth reimplementing; it is four lines.
- Put every token from §A in `config.js` as the single source, and interpolate into the CSS string. No hex literal appears twice in the codebase.
- The `.dr-raise::after` shadow pattern is used by roughly ten element types. Write it once as a class and compose, do not repeat the pseudo-element block per selector.
- The three things most likely to be got wrong, in order: (1) animating `box-shadow` instead of the pseudo transform — it will cost the frame budget; (2) rounding coverage up to `100%` before the gate opens — it destroys trust in the meter instantly; (3) tinting or dimming a player drawing for "harmony" — that inverts the entire premise of the design.agentId: a75658bdb2a273961 (use SendMessage with to: 'a75658bdb2a273961', summary: '<5-10 word recap>' to continue this agent)
<usage>subagent_tokens: 115846
tool_uses: 5
duration_ms: 406797</usage>