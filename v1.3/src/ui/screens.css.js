// DoodleRun — the single injected neo-brutalist stylesheet plus the tiny DOM helpers.

import { SHELL } from '../config.js';

const c = SHELL.color;
const b = SHELL.border;
const o = SHELL.offset;
const g = SHELL.gap;
const t = SHELL.type;
const tr = SHELL.track;
const e = SHELL.ease;
const d = SHELL.dur;

const CSS = `
:root{
--dr-ink:${c.ink};--dr-paper:${c.paper};--dr-ground:${c.ground};--dr-hatch:${c.hatch};
--dr-edge:${c.edge};--dr-mute:${c.mute};--dr-mute-inv:${c.muteInv};--dr-disabled:${c.disabled};
--dr-shadow:${c.shadow};--dr-alert:${c.alert};--dr-alert-ink:${c.alertInk};
--dr-sun:${c.sun};--dr-done:${c.done};
--dr-b1:${b.b1};--dr-b2:${b.b2};--dr-b3:${b.b3};--dr-b4:${b.b4};
--dr-off1:${o.off1};--dr-off2:${o.off2};--dr-off3:${o.off3};--dr-off4:${o.off4};
--dr-r:${SHELL.radius};
--dr-gap-xs:${g.xs};--dr-gap-s:${g.s};--dr-gap-m:${g.m};--dr-gap-l:${g.l};--dr-gap-xl:${g.xl};
--dr-pad:${SHELL.pad};
--dr-face-display:${SHELL.face.display};
--dr-face-mono:${SHELL.face.mono};
--dr-t-mega:${t.mega};--dr-t-h1:${t.h1};--dr-t-h2:${t.h2};--dr-t-h3:${t.h3};
--dr-t-body:${t.body};--dr-t-label:${t.label};--dr-t-micro:${t.micro};--dr-t-num:${t.num};
--dr-tr-mega:${tr.mega};--dr-tr-h1:${tr.h1};--dr-tr-h2:${tr.h2};--dr-tr-h3:${tr.h3};
--dr-tr-label:${tr.label};--dr-tr-micro:${tr.micro};
--dr-e-out:${e.out};--dr-e-snap:${e.snap};--dr-e-in:${e.in};--dr-e-pop:${e.pop};
--dr-d-tap:${d.tap};--dr-d-fast:${d.fast};--dr-d-base:${d.base};--dr-d-exit:${d.exit};
--dr-d-screen:${d.screen};--dr-d-land:${d.land};
--dr-checker:${SHELL.checker};
}

.dr-app{margin:0;min-height:100%;background:var(--dr-ground);color:var(--dr-ink);
font-family:var(--dr-face-display);-webkit-font-smoothing:antialiased;overflow:hidden}
.dr-app *,.dr-app *::before,.dr-app *::after{box-sizing:border-box;border-radius:var(--dr-r)}
.dr-app button,.dr-app input{font-family:inherit}
.dr-app ::selection{background:var(--dr-ink);color:var(--dr-paper)}
.dr-app :focus{outline:none}
.dr-app :focus-visible{outline:3px solid var(--dr-paper);outline-offset:0;
box-shadow:0 0 0 6px var(--dr-ink);position:relative;z-index:5}
.dr-slot.is-done:focus-visible,.dr-btn-solid:focus-visible,.dr-tool.is-on:focus-visible,
.dr-nav-item:focus-visible,.dr-tab.is-on:focus-visible{
outline-color:var(--dr-ink);box-shadow:0 0 0 6px var(--dr-paper)}

.dr-skip{position:absolute;left:-9999px;top:0;z-index:40}
.dr-skip:focus{left:16px;top:16px;background:var(--dr-ink);color:var(--dr-paper);
padding:10px 16px;font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase;border:var(--dr-b2) solid var(--dr-ink)}

.dr-raise,.dr-btn,.dr-slot,.dr-tool,.dr-panel,.dr-canvas-frame,.dr-preview-frame,
.dr-inspect,.dr-side,.dr-sound-box{position:relative;background:transparent;border:0;
--dr-fill:var(--dr-paper);--dr-bd:var(--dr-b3);--dr-line:var(--dr-ink)}
.dr-raise::before,.dr-btn::before,.dr-slot::before,.dr-tool::before,.dr-panel::before,
.dr-canvas-frame::before,.dr-preview-frame::before,.dr-inspect::before,.dr-side::before,
.dr-sound-box::before{content:"";position:absolute;inset:0;z-index:-1;
background:var(--dr-fill);border:var(--dr-bd) solid var(--dr-line);pointer-events:none}
.dr-raise::after,.dr-btn::after,.dr-slot::after,.dr-tool::after,.dr-panel::after,
.dr-canvas-frame::after,.dr-preview-frame::after,.dr-inspect::after,.dr-side::after,
.dr-sound-box::after{
content:"";position:absolute;inset:0;z-index:-2;background:var(--dr-shadow);
transform:translate3d(var(--dr-off,5px),var(--dr-off,5px),0);
transition:transform var(--dr-d-fast) var(--dr-e-out);will-change:transform;pointer-events:none}

.dr-btn{--dr-bd:var(--dr-b2);display:inline-flex;align-items:center;justify-content:center;gap:8px;
min-height:44px;padding:0 22px;color:var(--dr-ink);cursor:pointer;text-transform:uppercase;
font:900 var(--dr-t-h3) var(--dr-face-display);letter-spacing:var(--dr-tr-h3);
transition:transform var(--dr-d-fast) var(--dr-e-out),
background-color var(--dr-d-tap) linear,color var(--dr-d-tap) linear}
.dr-btn:hover{transform:translate3d(-2px,-2px,0)}
.dr-btn:hover::after{transform:translate3d(7px,7px,0)}
.dr-btn:active{transform:translate3d(5px,5px,0)}
.dr-btn:active::after{transform:translate3d(0,0,0)}
.dr-btn[disabled]{cursor:default;--dr-line:var(--dr-edge);color:var(--dr-disabled);transform:none}
.dr-btn[disabled]::after{display:none}
.dr-btn-solid{--dr-fill:var(--dr-ink);color:var(--dr-paper)}
.dr-btn.is-primary,.dr-start,.dr-hero-cta{--dr-fill:var(--dr-sun);color:var(--dr-ink)}
.dr-btn.is-primary .dr-key,.dr-start .dr-key{color:var(--dr-ink);opacity:.55}
.dr-ed-done .dr-btn-solid:not([disabled]){--dr-fill:var(--dr-done);color:var(--dr-ink)}
.dr-ed-done .dr-btn-solid:not([disabled]) .dr-key{color:var(--dr-ink);opacity:.55}
.dr-btn-danger{--dr-fill:var(--dr-alert);color:var(--dr-alert-ink)}
.dr-btn-ghost{--dr-fill:transparent;--dr-line:transparent;min-height:44px;padding:0 12px;
font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label)}
.dr-btn-ghost::after{display:none}
.dr-btn-ghost:hover{--dr-fill:var(--dr-ink);color:var(--dr-paper);transform:none}
.dr-key{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
color:var(--dr-mute)}
.dr-btn-solid .dr-key,.dr-btn-danger .dr-key{color:var(--dr-mute-inv)}

.dr-screen{position:fixed;inset:0;z-index:10;opacity:0;pointer-events:none;
transition:opacity var(--dr-d-exit) var(--dr-e-in)}
.dr-screen.is-on{opacity:1;pointer-events:auto;transition:opacity var(--dr-d-base) var(--dr-e-out)}

@keyframes dr-in-left{from{opacity:0;transform:translate3d(-20px,0,0)}to{opacity:1;transform:none}}
@keyframes dr-in-slab{from{opacity:0;transform:translate3d(-28px,0,0)}to{opacity:1;transform:none}}
@keyframes dr-in-up{from{opacity:0;transform:translate3d(0,16px,0)}to{opacity:1;transform:none}}
@keyframes dr-in-down{from{opacity:0;transform:translate3d(0,-18px,0)}to{opacity:1;transform:none}}
@keyframes dr-in-bar{from{transform:translate3d(0,100%,0)}to{transform:none}}
@keyframes dr-in-fade{from{opacity:0}to{opacity:1}}
@keyframes dr-land{0%{transform:translate3d(0,-10px,0)}60%{transform:translate3d(0,3px,0)}100%{transform:none}}
@keyframes dr-nudge{0%{transform:translate3d(-3px,0,0)}50%{transform:translate3d(3px,0,0)}100%{transform:none}}
@keyframes dr-blink{0%,49%{opacity:1}50%,100%{opacity:.15}}
@keyframes dr-ants{to{background-position:24px 0,-24px 0,0 -24px,0 24px}}

.dr-menu{position:absolute;inset:0;display:flex;align-items:center;
padding:0 clamp(32px,7vw,120px);gap:clamp(32px,4vw,72px);background:transparent}
.dr-menu-col{width:min(520px,46vw);flex:0 0 auto;display:flex;flex-direction:column;
gap:var(--dr-gap-l);position:relative;z-index:2;isolation:isolate}
.dr-brand{--dr-off:var(--dr-off4);--dr-bd:var(--dr-b4);padding:26px 30px 30px;display:inline-block;align-self:flex-start;opacity:0}
.dr-menu.is-on .dr-brand{animation:dr-in-slab var(--dr-d-screen) var(--dr-e-snap) 40ms both}
.dr-title{font:900 var(--dr-t-mega) var(--dr-face-display);text-transform:uppercase;
letter-spacing:var(--dr-tr-mega);display:flex;flex-direction:column;margin:0}
.dr-title-run{background:var(--dr-sun);color:var(--dr-ink);align-self:flex-start;
padding:.02em .12em .06em;margin-left:-.04em}
.dr-tagline{margin:0;max-width:44ch;font:500 var(--dr-t-body) var(--dr-face-display);opacity:0}
.dr-menu.is-on .dr-tagline{animation:dr-in-fade var(--dr-d-base) var(--dr-e-out) 120ms both}
.dr-nav{display:flex;flex-direction:column;align-items:flex-start;gap:var(--dr-gap-xs)}
.dr-nav-item{position:relative;display:grid;grid-template-columns:auto 1fr;
column-gap:14px;row-gap:2px;align-items:baseline;min-height:48px;padding:8px 16px 10px;
background:var(--dr-paper);border:var(--dr-b2) solid var(--dr-ink);cursor:pointer;text-align:left;
color:var(--dr-ink);opacity:0;box-shadow:var(--dr-off2) var(--dr-off2) 0 var(--dr-shadow);
transition:transform var(--dr-d-fast) var(--dr-e-out),box-shadow var(--dr-d-fast) var(--dr-e-out),
background-color var(--dr-d-tap) linear,color var(--dr-d-tap) linear;will-change:transform}
.dr-menu.is-on .dr-nav-item{animation:dr-in-left 220ms var(--dr-e-snap) var(--dr-delay,0ms) both}
.dr-menu.is-settled .dr-brand,.dr-menu.is-settled .dr-tagline,
.dr-menu.is-settled .dr-nav-item,.dr-menu.is-settled .dr-foot{animation:none;opacity:1}
.dr-nav-idx{grid-row:1/3;font:700 var(--dr-t-micro) var(--dr-face-mono);
letter-spacing:var(--dr-tr-micro);color:var(--dr-mute)}
.dr-nav-text{font:900 var(--dr-t-h2) var(--dr-face-display);letter-spacing:var(--dr-tr-h2);
text-transform:uppercase}
.dr-nav-note{grid-column:2;font:700 var(--dr-t-micro) var(--dr-face-mono);
letter-spacing:var(--dr-tr-micro);text-transform:uppercase;color:var(--dr-mute);opacity:0;
transition:opacity var(--dr-d-fast) linear}
.dr-nav-item:hover,.dr-nav-item:focus-visible,.dr-nav-item.is-active{
background:var(--dr-sun);color:var(--dr-ink);border-color:var(--dr-ink);
box-shadow:0 0 0 var(--dr-shadow);transform:translate3d(var(--dr-off2),var(--dr-off2),0)}
.dr-nav-item:hover .dr-nav-idx,.dr-nav-item:focus-visible .dr-nav-idx,
.dr-nav-item.is-active .dr-nav-idx{color:var(--dr-ink)}
.dr-nav-item:hover .dr-nav-note,.dr-nav-item:focus-visible .dr-nav-note,
.dr-nav-item.is-active .dr-nav-note{opacity:1;color:var(--dr-ink)}
.dr-nav-item:active{transform:translate3d(var(--dr-off2),var(--dr-off2),0)}
.dr-nav-item[disabled]{cursor:default;color:var(--dr-disabled);border-color:var(--dr-edge);
box-shadow:var(--dr-off1) var(--dr-off1) 0 var(--dr-edge)}
.dr-nav-item[disabled]:hover{background:var(--dr-paper);color:var(--dr-disabled);
border-color:var(--dr-edge);box-shadow:var(--dr-off1) var(--dr-off1) 0 var(--dr-edge);transform:none}
.dr-nav-item[disabled] .dr-nav-note{opacity:1}

.dr-panels{display:grid;position:relative;z-index:2;isolation:isolate}
.dr-panel{--dr-off:var(--dr-off3);grid-area:1/1;width:min(460px,42vw);padding:var(--dr-pad);
opacity:0;visibility:hidden;transform:translate3d(12px,0,0);
transition:opacity var(--dr-d-fast) var(--dr-e-out),transform var(--dr-d-fast) var(--dr-e-out),
visibility 0s linear var(--dr-d-fast)}
.dr-panel.is-on{opacity:1;visibility:visible;transform:none;transition-delay:0s}
.dr-panel h3{margin:0 0 var(--dr-gap-m);font:900 var(--dr-t-h3) var(--dr-face-display);
letter-spacing:var(--dr-tr-h3);text-transform:uppercase}
.dr-panel p{margin:0 0 var(--dr-gap-s);font:500 var(--dr-t-body) var(--dr-face-display)}
.dr-panel p b{font-weight:900;text-transform:uppercase}
.dr-panel-foot{margin:var(--dr-gap-m) calc(var(--dr-pad) * -1) calc(var(--dr-pad) * -1);
padding:12px var(--dr-pad);background:var(--dr-ink);color:var(--dr-paper);
font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase}
.dr-foot{position:absolute;left:clamp(32px,7vw,120px);bottom:clamp(24px,5vh,48px);
display:flex;gap:var(--dr-gap-m);z-index:2;opacity:0;
font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute)}
.dr-menu.is-on .dr-foot{animation:dr-in-fade var(--dr-d-base) var(--dr-e-out) 340ms both}

[hidden]{display:none !important}
.dr-run{background:var(--dr-ground);overflow:hidden}
.dr-run-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;
image-rendering:auto;background:var(--dr-paper)}
.dr-hud{position:absolute;top:0;left:0;right:0;display:flex;align-items:stretch;gap:0;
border-bottom:var(--dr-b4) solid var(--dr-ink);background:var(--dr-paper);z-index:2}
.dr-hud-group{display:flex;flex-direction:column;gap:2px;padding:10px clamp(16px,2.4vw,32px);
border-right:var(--dr-b2) solid var(--dr-ink);min-width:130px}
.dr-hud-label{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute)}
.dr-hud-value{font:900 var(--dr-t-h2) var(--dr-face-display);letter-spacing:var(--dr-tr-h2);
font-variant-numeric:tabular-nums}
.dr-hud-peers{display:flex;align-items:stretch;gap:0;border-right:var(--dr-b2) solid var(--dr-ink)}
.dr-hud-peer{display:flex;flex-direction:column;gap:2px;justify-content:center;
padding:8px 14px;border-left:var(--dr-b1) dashed var(--dr-edge)}
.dr-hud-peer:first-child{border-left:0}
.dr-hud-peer-name{font:700 9px var(--dr-face-mono);letter-spacing:.16em;color:var(--dr-mute)}
.dr-hud-peer-m{font:900 var(--dr-t-h3) var(--dr-face-display);font-variant-numeric:tabular-nums}
.dr-hud-shield{margin-left:auto;align-self:center;padding:8px 18px;margin-right:clamp(16px,2.4vw,32px);
background:var(--dr-done);border:var(--dr-b2) solid var(--dr-ink);
box-shadow:var(--dr-off1) var(--dr-off1) 0 var(--dr-shadow);
font:900 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);text-transform:uppercase}
.dr-run-hint{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);z-index:2;
padding:9px 18px;background:var(--dr-paper);border:var(--dr-b2) solid var(--dr-ink);
box-shadow:var(--dr-off1) var(--dr-off1) 0 var(--dr-shadow);
font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-ink);white-space:nowrap}
.dr-run-over{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;
background:rgba(17,17,17,.34);animation:dr-in-fade var(--dr-d-base) var(--dr-e-out) both}
.dr-run-card{--dr-off:var(--dr-off4);--dr-bd:var(--dr-b4);width:min(520px,92vw);padding:30px 32px 32px;
position:relative;background:var(--dr-paper);border:var(--dr-b4) solid var(--dr-ink);
box-shadow:var(--dr-off4) var(--dr-off4) 0 var(--dr-shadow);
animation:dr-in-slab var(--dr-d-screen) var(--dr-e-snap) both}
.dr-run-title{margin:0;font:900 var(--dr-t-h1) var(--dr-face-display);letter-spacing:var(--dr-tr-h1);
text-transform:uppercase}
.dr-run-why{margin:8px 0 20px;font:500 var(--dr-t-body) var(--dr-face-display);color:var(--dr-mute)}
.dr-run-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin:0 0 22px;
background:var(--dr-ink);border:var(--dr-b2) solid var(--dr-ink)}
.dr-run-stat{background:var(--dr-paper);padding:12px 10px;display:flex;flex-direction:column;gap:4px}
.dr-run-stat dt{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute)}
.dr-run-stat dd{margin:0;font:900 var(--dr-t-h3) var(--dr-face-display);font-variant-numeric:tabular-nums}
.dr-run-acts{display:flex;gap:var(--dr-gap-s);flex-wrap:wrap}

.dr-rooms{background:var(--dr-ground);display:flex;flex-direction:column;
padding:32px clamp(32px,5vw,80px);gap:var(--dr-gap-l);overflow-y:auto}
.dr-rooms-head{display:grid;grid-template-columns:auto 1fr;gap:var(--dr-gap-m) var(--dr-gap-l);align-items:baseline}
.dr-rooms-title{margin:0;font:900 var(--dr-t-h1) var(--dr-face-display);letter-spacing:var(--dr-tr-h1);
text-transform:uppercase}
.dr-rooms-sub{grid-column:2;margin:0;max-width:56ch;font:500 var(--dr-t-body) var(--dr-face-display);color:var(--dr-mute)}
.dr-rooms-body{display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:var(--dr-gap-xl);align-items:start}
.dr-rooms-side{--dr-off:var(--dr-off3);padding:var(--dr-pad);display:flex;flex-direction:column;gap:var(--dr-gap-m)}
.dr-rooms-host{width:100%}
.dr-rooms-joinrow{display:flex;gap:var(--dr-gap-s)}
.dr-code-input{text-transform:uppercase;letter-spacing:.32em;font-family:var(--dr-face-mono);font-weight:700}
.dr-rooms-error{margin:0;padding:9px 12px;background:var(--dr-alert);color:var(--dr-alert-ink);
font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);text-transform:uppercase}
.dr-rooms-list-wrap{display:flex;flex-direction:column;gap:var(--dr-gap-s)}
.dr-rooms-list{display:flex;flex-direction:column;gap:var(--dr-gap-s)}
.dr-rooms-empty{margin:0;font:500 var(--dr-t-body) var(--dr-face-display);color:var(--dr-mute)}
.dr-room-row{--dr-off:var(--dr-off2);display:flex;align-items:center;justify-content:space-between;
gap:var(--dr-gap-m);padding:14px 16px}
.dr-room-info{display:flex;flex-direction:column;gap:3px}
.dr-room-code{font:900 var(--dr-t-h3) var(--dr-face-mono);letter-spacing:.24em}
.dr-room-meta{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute)}

.dr-roombar{display:flex;align-items:center;gap:var(--dr-gap-m);flex-wrap:wrap;
margin:0 0 var(--dr-gap-m);padding:10px 14px;background:var(--dr-paper);
border:var(--dr-b3) solid var(--dr-ink);box-shadow:var(--dr-off2) var(--dr-off2) 0 var(--dr-shadow)}
.dr-roombar-code{font:900 var(--dr-t-h3) var(--dr-face-mono);letter-spacing:.2em;text-transform:uppercase}
.dr-roombar-players{display:flex;gap:var(--dr-gap-s);flex-wrap:wrap}
.dr-roombar-player{display:flex;align-items:center;gap:7px;padding:5px 10px;
border:var(--dr-b2) solid var(--dr-ink);font:700 var(--dr-t-label) var(--dr-face-mono);
letter-spacing:.06em;text-transform:uppercase}
.dr-roombar-player.is-me{background:var(--dr-sun)}
.dr-roombar-player.is-host .dr-roombar-nick{text-decoration:underline;text-underline-offset:3px}
.dr-roombar-tag{font-size:9px;color:var(--dr-mute)}
.dr-roombar-player.is-me .dr-roombar-tag{color:var(--dr-ink);opacity:.6}
.dr-roombar-kick{border:0;background:var(--dr-ink);color:var(--dr-paper);cursor:pointer;
padding:3px 7px;font:700 9px var(--dr-face-mono);letter-spacing:.14em;text-transform:uppercase}
.dr-roombar-kick:hover{background:var(--dr-alert)}
.dr-roombar-note{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute)}
.dr-roombar-leave{margin-left:auto}
.dr-slot.is-locked{cursor:not-allowed;opacity:.62}
.dr-slot-lock{position:absolute;left:0;right:0;bottom:0;padding:6px 8px;background:var(--dr-ink);
color:var(--dr-paper);font:700 9px var(--dr-face-mono);letter-spacing:.16em;text-transform:uppercase;
text-align:center;z-index:3}
.dr-run-wait{margin:0;font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase;color:var(--dr-mute)}

.dr-board{display:flex;flex-direction:column;background:var(--dr-ground);
padding:32px clamp(32px,5vw,80px) 0}
.dr-board-head{flex:0 0 auto;display:grid;grid-template-columns:auto 1fr;
column-gap:var(--dr-gap-m);row-gap:6px;align-items:center}
.dr-board-head .dr-btn-ghost{grid-row:1/3}
.dr-board-title{margin:0;font:900 var(--dr-t-h1) var(--dr-face-display);
letter-spacing:var(--dr-tr-h1);text-transform:uppercase}
.dr-board-sub{margin:0;grid-column:2;max-width:70ch;
font:500 var(--dr-t-body) var(--dr-face-display);color:var(--dr-ink)}
.dr-board-scroll{flex:1;min-height:0;overflow-y:auto;padding-bottom:140px;margin-top:var(--dr-gap-l);
scrollbar-width:thin;isolation:isolate}
.dr-board-scroll::-webkit-scrollbar{width:14px}
.dr-board-scroll::-webkit-scrollbar-thumb{background:var(--dr-ink)}
.dr-board-scroll::-webkit-scrollbar-track{background:var(--dr-ground);
border-left:var(--dr-b2) solid var(--dr-ink)}
.dr-group{margin-top:var(--dr-gap-xl)}
.dr-group-head{display:flex;align-items:baseline;gap:12px;
border-bottom:var(--dr-b2) solid var(--dr-ink);padding-bottom:8px;margin-bottom:var(--dr-gap-m)}
.dr-group-name{font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase}
.dr-group-count{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute);margin-left:auto}
.dr-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--dr-gap-m)}
.dr-grid > .dr-slot[data-cat="terrain"]{grid-column:span 2}
.dr-grid > .dr-slot[data-cat="creature"]{grid-column:span 1}
.dr-grid > .dr-slot[data-cat="loot"]{grid-column:span 3}
.dr-grid > .dr-slot[data-cat="backdrop"]{grid-column:span 2}
@media (max-width:1180px){.dr-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.dr-grid > .dr-slot[data-cat="terrain"],
.dr-grid > .dr-slot[data-cat="backdrop"],
.dr-grid > .dr-slot[data-cat="loot"]{grid-column:span 3}}

.dr-slot{--dr-off:var(--dr-off2);display:grid;
grid-template-rows:auto 1fr auto auto;gap:8px;padding:14px;
cursor:pointer;text-align:left;min-height:196px;color:var(--dr-ink);opacity:0;
transition:transform var(--dr-d-fast) var(--dr-e-out),color var(--dr-d-tap) linear}
.dr-board.is-on .dr-slot{animation:dr-in-up 240ms var(--dr-e-snap) var(--dr-delay,0ms) both}
.dr-board.is-settled .dr-slot{animation:none;opacity:1}
.dr-board.is-settled .dr-slot.is-landing{animation:dr-land var(--dr-d-land) var(--dr-e-snap) both}
.dr-slot-idx{position:absolute;top:8px;right:10px;font:700 var(--dr-t-micro) var(--dr-face-mono);
letter-spacing:var(--dr-tr-micro);color:var(--dr-mute)}
.dr-slot-thumb{display:grid;place-items:center;background:var(--dr-paper);
border:var(--dr-b2) solid var(--dr-ink);aspect-ratio:var(--dr-ar,1);
width:min(100%,calc(var(--dr-ar,1) * var(--dr-thumb-h,168px)));justify-self:center;
background-image:var(--dr-checker);image-rendering:pixelated;overflow:hidden}
.dr-slot-thumb canvas{display:block;width:100%;height:100%;object-fit:contain;
image-rendering:pixelated}
.dr-slot.is-empty .dr-slot-thumb::before{content:"+";font:900 28px/1 var(--dr-face-display);
color:var(--dr-ink)}
.dr-slot-name{font:900 var(--dr-t-h3) var(--dr-face-display);letter-spacing:var(--dr-tr-h3);
text-transform:uppercase}
.dr-slot-note{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute)}
.dr-slot-state{display:flex;align-items:center;gap:7px;flex-wrap:wrap;
font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;border-top:var(--dr-b1) solid var(--dr-ink);padding-top:8px;margin-top:2px}
.dr-slot-state i{width:8px;height:8px;background:currentColor;flex:0 0 auto}
.dr-slot-chip{border:2px solid currentColor;padding:2px 5px;line-height:1;height:16px;
display:inline-flex;align-items:center}
.dr-slot.is-empty{--dr-fill:repeating-linear-gradient(45deg,var(--dr-hatch) 0 8px,var(--dr-paper) 8px 16px)}
.dr-slot.is-done{--dr-fill:var(--dr-done);color:var(--dr-ink)}
.dr-slot.is-done .dr-slot-note,.dr-slot.is-done .dr-slot-idx{color:var(--dr-ink);opacity:.7}
.dr-slot.is-done .dr-slot-thumb{border-color:var(--dr-ink)}
.dr-slot.is-done .dr-slot-state{border-top-color:var(--dr-ink)}
.dr-slot:hover,.dr-slot:focus-visible{transform:translate3d(-2px,-2px,0)}
.dr-slot:hover::after,.dr-slot:focus-visible::after{transform:translate3d(9px,9px,0)}
.dr-slot:active{transform:translate3d(5px,5px,0)}
.dr-slot:active::after{transform:translate3d(0,0,0)}

.dr-hero-row{margin-bottom:var(--dr-gap-l);isolation:isolate;opacity:0}
.dr-board.is-on .dr-hero-row{animation:dr-in-down var(--dr-d-screen) var(--dr-e-snap) both}
.dr-board.is-settled .dr-hero-row{animation:none;opacity:1}
.dr-hero-label{display:block;margin-bottom:var(--dr-gap-s);
font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase}
.dr-slot-hero{--dr-off:var(--dr-off3);--dr-bd:var(--dr-b4);min-height:220px;
display:grid;grid-template-columns:200px 1fr auto;grid-template-rows:auto;
align-items:center;gap:var(--dr-gap-l);padding:36px 24px 20px}
.dr-slot-hero .dr-slot-thumb{width:172px}
.dr-slot-hero .dr-slot-name{font:900 var(--dr-t-h1) var(--dr-face-display);
letter-spacing:var(--dr-tr-h1)}
.dr-hero-text{display:flex;flex-direction:column;gap:8px}
.dr-hero-ledger{position:absolute;left:0;right:0;top:0;background:var(--dr-ink);
color:var(--dr-paper);padding:5px 12px;font:700 var(--dr-t-micro) var(--dr-face-mono);
letter-spacing:var(--dr-tr-micro);text-transform:uppercase}
.dr-hero-cta{pointer-events:none}

.dr-actionbar{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;
align-items:center;gap:var(--dr-gap-l);background:var(--dr-paper);
border-top:var(--dr-b4) solid var(--dr-ink);padding:16px clamp(32px,5vw,80px);isolation:isolate}
.dr-board.is-on .dr-actionbar{animation:dr-in-bar 260ms var(--dr-e-snap) 120ms both}
.dr-board.is-settled .dr-actionbar{animation:none}
.dr-pips{display:flex;gap:4px}
.dr-pip{width:14px;height:14px;border:var(--dr-b2) solid var(--dr-ink);background:var(--dr-paper)}
.dr-pip.is-working{background:repeating-linear-gradient(45deg,var(--dr-hatch) 0 4px,var(--dr-paper) 4px 8px)}
.dr-pip.is-ready{background:var(--dr-done)}
.dr-counts{display:flex;gap:var(--dr-gap-m);font:700 var(--dr-t-label) var(--dr-face-mono);
letter-spacing:var(--dr-tr-label);text-transform:uppercase;font-variant-numeric:tabular-nums}
.dr-start-wrap{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.dr-start-note{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute)}
.dr-start{--dr-off:var(--dr-off3);--dr-bd:var(--dr-b3);min-height:64px;padding:0 36px;
font:900 var(--dr-t-h2) var(--dr-face-display);letter-spacing:var(--dr-tr-h2)}

.dr-modal{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;
gap:var(--dr-gap-l);background:var(--dr-ink);color:var(--dr-paper);
padding:clamp(24px,4vw,56px);opacity:0;pointer-events:none;
transition:opacity var(--dr-d-fast) var(--dr-e-out)}
.dr-modal.is-on{opacity:1;pointer-events:auto}
.dr-modal h2{margin:0;font:900 var(--dr-t-h1) var(--dr-face-display);
letter-spacing:var(--dr-tr-h1);text-transform:uppercase}
.dr-modal-line{margin:0;font:700 var(--dr-t-label) var(--dr-face-mono);
letter-spacing:var(--dr-tr-label);text-transform:uppercase;color:var(--dr-mute-inv)}
.dr-modal-grid{flex:1;min-height:0;overflow-y:auto;display:grid;
grid-template-columns:repeat(5,minmax(0,1fr));gap:var(--dr-gap-m)}
.dr-modal-cell{display:flex;flex-direction:column;gap:6px}
.dr-modal-cell .dr-slot-thumb{border-color:var(--dr-paper)}
.dr-modal-cell span{font:700 var(--dr-t-micro) var(--dr-face-mono);
letter-spacing:var(--dr-tr-micro);text-transform:uppercase}
.dr-modal-cell em{font-style:normal;color:var(--dr-mute-inv);
font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase}
.dr-modal-acts{display:flex;gap:var(--dr-gap-m)}
.dr-modal .dr-btn{--dr-fill:var(--dr-ink);--dr-line:var(--dr-paper);color:var(--dr-paper)}
.dr-modal .dr-btn::after{background:var(--dr-paper)}

.dr-editor{display:flex;flex-direction:column;background:var(--dr-ground)}
.dr-ed-head{display:flex;align-items:center;gap:var(--dr-gap-m);
padding:14px clamp(24px,3vw,44px);background:var(--dr-paper);
border-bottom:var(--dr-b4) solid var(--dr-ink);flex:0 0 auto;isolation:isolate}
.dr-ed-name{font:900 var(--dr-t-h1) var(--dr-face-display);letter-spacing:var(--dr-tr-h1);
text-transform:uppercase;margin:0 auto 0 0}
.dr-ed-cat,.dr-ed-spec,.dr-ed-saved{font:700 var(--dr-t-micro) var(--dr-face-mono);
letter-spacing:var(--dr-tr-micro);text-transform:uppercase;color:var(--dr-mute)}
.dr-ed-done{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.dr-ed-reason{font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-alert)}
.dr-ed-body{flex:1;min-height:0;display:grid;
grid-template-columns:88px minmax(0,1fr) 360px;gap:var(--dr-gap-l);
padding:var(--dr-gap-l) clamp(24px,3vw,44px)}
.dr-editor[data-tab="rig"] .dr-ed-body{grid-template-columns:88px minmax(0,1fr) 320px}
.dr-editor[data-tab="rig"] .dr-stage{display:grid;grid-template-columns:1fr 1fr;gap:var(--dr-gap-l)}
.dr-editor[data-tab="sound"] .dr-rail,.dr-editor[data-tab="sound"] .dr-tools{visibility:hidden}

.dr-tabs{display:flex}
.dr-tab{min-height:44px;padding:0 22px;background:var(--dr-paper);color:var(--dr-ink);
border:var(--dr-b3) solid var(--dr-ink);margin-left:-3px;cursor:pointer;position:relative;
font:900 var(--dr-t-h3) var(--dr-face-display);letter-spacing:var(--dr-tr-h3);
text-transform:uppercase;transition:background-color var(--dr-d-tap) linear,color var(--dr-d-tap) linear}
.dr-tab:first-child{margin-left:0}
.dr-tab:hover{background:var(--dr-hatch)}
.dr-tab.is-on{background:var(--dr-sun);color:var(--dr-ink)}
.dr-tab.is-on::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:4px;
background:var(--dr-ink)}

.dr-rail,.dr-tools{display:flex;flex-direction:column;gap:var(--dr-gap-s);
align-items:center;isolation:isolate}
.dr-rail-rule{width:100%;height:2px;background:var(--dr-ink);margin:6px 0}
.dr-tool{--dr-off:var(--dr-off1);width:64px;height:64px;
display:grid;place-items:center;color:var(--dr-ink);cursor:pointer;
transition:transform var(--dr-d-tap) var(--dr-e-out),color var(--dr-d-tap) linear}
.dr-tool:hover{transform:translate3d(-1px,-1px,0)}
.dr-tool:hover::after{transform:translate3d(4px,4px,0)}
.dr-tool.is-on{--dr-fill:var(--dr-sun);color:var(--dr-ink)}
.dr-tool.is-on::after{transform:translate3d(0,0,0)}
.dr-tool svg{width:28px;height:28px;stroke:currentColor;stroke-width:3;
stroke-linecap:square;fill:none}
.dr-tool-key{position:absolute;right:3px;bottom:2px;font:700 9px var(--dr-face-mono);
color:var(--dr-mute)}
.dr-tool.is-on .dr-tool-key{color:var(--dr-ink);opacity:.55}
.dr-tool[disabled]{--dr-line:var(--dr-edge);color:var(--dr-disabled);cursor:default}
.dr-tool[disabled]::after{display:none}
.dr-tool.is-nudging{animation:dr-nudge 160ms var(--dr-e-out) 1}

.dr-stage{display:flex;align-items:center;justify-content:center;min-height:0;isolation:isolate}
.dr-canvas-frame{--dr-off:var(--dr-off3);--dr-bd:var(--dr-b4);--dr-fill:var(--dr-checker);
line-height:0;padding:var(--dr-b4)}
.dr-canvas{display:block;cursor:crosshair;touch-action:none}
.dr-canvas-frame.is-pixel .dr-canvas{image-rendering:pixelated}
.dr-canvas-layer{position:absolute;inset:0;pointer-events:none}
.dr-frame-chip{position:absolute;top:8px;right:8px;z-index:2;min-height:28px;padding:0 10px;
background:var(--dr-paper);border:var(--dr-b2) solid var(--dr-ink);cursor:pointer;
font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;line-height:1}
.dr-frame-chip.is-on{background:var(--dr-ink);color:var(--dr-paper)}

.dr-inspect,.dr-side{--dr-off:var(--dr-off3);padding:var(--dr-pad);overflow-y:auto;
display:flex;flex-direction:column;gap:var(--dr-gap-m)}
.dr-field{display:flex;flex-direction:column;gap:var(--dr-gap-s);padding-bottom:var(--dr-gap-m);
border-bottom:var(--dr-b1) solid var(--dr-ink)}
.dr-field:last-child{border-bottom:0;padding-bottom:0}
.dr-field-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.dr-field-label{font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase}
.dr-field-num{font:700 var(--dr-t-num) var(--dr-face-mono);font-variant-numeric:tabular-nums}
.dr-field-note{font:500 var(--dr-t-body) var(--dr-face-display);color:var(--dr-ink)}
.dr-colour{display:flex;align-items:center;gap:var(--dr-gap-s);flex-wrap:wrap}
.dr-app input[type=color]{-webkit-appearance:none;appearance:none;width:56px;height:56px;
padding:0;background:none;border:var(--dr-b3) solid var(--dr-ink);cursor:pointer}
.dr-app input[type=color]::-webkit-color-swatch-wrapper{padding:0}
.dr-app input[type=color]::-webkit-color-swatch{border:0}
.dr-hex{width:100px;min-height:44px;padding:0 8px;background:var(--dr-paper);
border:var(--dr-b2) solid var(--dr-ink);font:700 var(--dr-t-label) var(--dr-face-mono);
letter-spacing:var(--dr-tr-label);text-transform:uppercase}
.dr-recent{display:flex;gap:4px;flex-wrap:wrap}
.dr-recent button{width:44px;height:44px;display:grid;place-items:center;background:none;
border:0;cursor:pointer;padding:0;transition:transform var(--dr-d-fast) var(--dr-e-out)}
.dr-recent button:hover{transform:translate3d(0,-3px,0)}
.dr-recent i{width:28px;height:28px;border:var(--dr-b2) solid var(--dr-ink);display:block}
.dr-sizes{display:flex;gap:6px}
.dr-size{width:44px;height:44px;display:grid;place-items:center;background:var(--dr-paper);
border:var(--dr-b2) solid var(--dr-ink);cursor:pointer}
.dr-size i{background:var(--dr-ink);display:block}
.dr-size.is-on{background:var(--dr-ink)}
.dr-size.is-on i{background:var(--dr-paper)}
.dr-range{-webkit-appearance:none;appearance:none;width:100%;height:24px;background:transparent;
padding:10px 0}
.dr-range::-webkit-slider-runnable-track{height:8px;background:var(--dr-paper);
border:var(--dr-b2) solid var(--dr-ink)}
.dr-range::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-9px;
background:var(--dr-ink);border:0;border-radius:0}
.dr-range::-moz-range-track{height:8px;background:var(--dr-paper);
border:var(--dr-b2) solid var(--dr-ink)}
.dr-range::-moz-range-thumb{width:22px;height:22px;background:var(--dr-ink);border:0;border-radius:0}
.dr-seg{display:flex}
.dr-seg button{min-height:44px;padding:0 16px;background:var(--dr-paper);color:var(--dr-ink);
border:var(--dr-b2) solid var(--dr-ink);margin-left:-3px;cursor:pointer;
font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase}
.dr-seg button:first-child{margin-left:0}
.dr-seg button.is-on{background:var(--dr-sun);color:var(--dr-ink)}
.dr-switch{width:56px;height:28px;border:var(--dr-b2) solid var(--dr-ink);background:var(--dr-paper);
cursor:pointer;padding:0;display:flex;align-items:center}
.dr-switch i{width:24px;height:24px;background:var(--dr-ink);display:block;
transition:transform var(--dr-d-fast) var(--dr-e-out)}
.dr-switch.is-on i{transform:translate3d(26px,0,0)}

.dr-cov,.dr-meter{display:flex;flex-direction:column;gap:8px}
.dr-cov-head{display:flex;align-items:baseline;justify-content:space-between}
.dr-cov-label{font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase}
.dr-cov-num{font:700 var(--dr-t-num) var(--dr-face-mono);font-variant-numeric:tabular-nums}
.dr-cov[data-state="short"] .dr-cov-num{color:var(--dr-alert)}
.dr-cov-bar{display:flex;gap:3px;height:22px}
.dr-cov-bar i{flex:1;border:var(--dr-b2) solid var(--dr-ink);background:var(--dr-paper);
transform-origin:bottom}
.dr-cov-bar i.is-on{background:var(--dr-done);animation:dr-in-fade var(--dr-d-tap) linear both}
.dr-cov[data-state="short"] .dr-cov-bar i.is-gap{border-color:var(--dr-alert)}
.dr-cov[data-state="short"] .dr-cov-bar i.is-gap ~ i.is-gap{border-color:var(--dr-ink)}
.dr-cov[data-state="full"] .dr-cov-num{color:var(--dr-done)}
.dr-cov-msg{margin:0;font:500 var(--dr-t-body) var(--dr-face-display)}
.dr-holes{position:absolute;inset:0;pointer-events:none}
.dr-holes.is-blinking{animation:dr-blink 900ms steps(1,end) infinite}

.dr-roles{display:flex;flex-direction:column}
.dr-role{min-height:52px;display:flex;align-items:center;gap:10px;padding:0 12px;
background:var(--dr-paper);color:var(--dr-ink);border:var(--dr-b2) solid var(--dr-ink);
margin-top:-3px;cursor:pointer;text-align:left;
font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase}
.dr-role:first-child{margin-top:0}
.dr-role-state{margin-left:auto;color:var(--dr-mute);
font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro)}
.dr-role.is-placed{background:var(--dr-done);color:var(--dr-ink)}
.dr-role.is-placed .dr-role-state{color:var(--dr-ink);opacity:.7}
.dr-role.is-selected{background:var(--dr-sun);color:var(--dr-ink);border-width:var(--dr-b3);
background-image:repeating-linear-gradient(90deg,var(--dr-ink) 0 6px,transparent 6px 12px),
repeating-linear-gradient(90deg,var(--dr-ink) 0 6px,transparent 6px 12px),
repeating-linear-gradient(0deg,var(--dr-ink) 0 6px,transparent 6px 12px),
repeating-linear-gradient(0deg,var(--dr-ink) 0 6px,transparent 6px 12px);
background-size:100% 2px,100% 2px,2px 100%,2px 100%;
background-position:0 0,0 100%,0 0,100% 0;background-repeat:no-repeat;
animation:dr-ants 900ms linear infinite}
.dr-role.is-required .dr-role-state{color:var(--dr-ink)}

.dr-preview{display:flex;flex-direction:column;gap:var(--dr-gap-s);min-height:0;isolation:isolate}
.dr-preview-cap{font:700 var(--dr-t-label) var(--dr-face-mono);letter-spacing:var(--dr-tr-label);
text-transform:uppercase;background:var(--dr-ink);color:var(--dr-paper);padding:8px 12px;margin:0}
.dr-preview-cap.is-flash{background:var(--dr-paper);color:var(--dr-ink)}
.dr-preview-frame{--dr-off:var(--dr-off4);--dr-bd:var(--dr-b4);flex:1;min-height:420px;
padding:var(--dr-b4)}
.dr-preview-canvas{display:block;width:100%;height:100%}
.dr-preview-fps{position:absolute;right:6px;bottom:4px;
font:700 var(--dr-t-micro) var(--dr-face-mono);letter-spacing:var(--dr-tr-micro);
text-transform:uppercase;color:var(--dr-mute);font-variant-numeric:tabular-nums}
.dr-preview-ctl{display:flex;align-items:center;gap:var(--dr-gap-s);flex-wrap:wrap}

.dr-sound-box{--dr-off:var(--dr-off2);padding:var(--dr-gap-m);display:flex;
flex-direction:column;gap:var(--dr-gap-s);align-items:center}
.dr-level{display:flex;gap:3px;width:100%;height:22px}
.dr-level i{flex:1;border:var(--dr-b2) solid var(--dr-ink);background:var(--dr-paper)}
.dr-level i.is-on{background:var(--dr-ink)}
.dr-sound-time{font:700 var(--dr-t-num) var(--dr-face-mono);font-variant-numeric:tabular-nums}
.dr-sound-acts{display:flex;gap:var(--dr-gap-s)}
.dr-sound-acts .dr-btn{min-height:56px}
.dr-rec-dot.is-live{animation:dr-blink 600ms steps(1,end) infinite}

.dr-fallback{display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:var(--dr-gap-s);background:var(--dr-ground)}
.dr-fallback h2{margin:0;font:900 var(--dr-t-h1) var(--dr-face-display);
letter-spacing:var(--dr-tr-h1);text-transform:uppercase}
.dr-fallback p{margin:0;font:700 var(--dr-t-label) var(--dr-face-mono);
letter-spacing:var(--dr-tr-label);text-transform:uppercase;color:var(--dr-mute)}

@media (prefers-reduced-motion:reduce){
.dr-app *,.dr-app *::before,.dr-app *::after{
transition-duration:.01ms!important;animation-duration:.01ms!important;
animation-iteration-count:1!important}
}
`;

export function injectScreenStyles() {
  if (document.getElementById('dr-screens')) return;
  const style = document.createElement('style');
  style.id = 'dr-screens';
  style.textContent = CSS;
  document.head.appendChild(style);
  document.body.classList.add('dr-app');
}

export function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function button(label, cls, parent, onClick) {
  const node = el('button', cls ? `dr-btn ${cls}` : 'dr-btn', parent, label);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}
