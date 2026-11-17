import { ST } from './engine.js';
/* The stage: one window component that drives a Run and draws every step. */
const RM = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const SLIPGLYPH = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="3" width="14" height="1"/><rect x="1" y="12" width="14" height="1"/><rect x="1" y="3" width="1" height="10"/><rect x="14" y="3" width="1" height="10"/><rect x="3" y="5" width="1" height="1"/><rect x="4" y="6" width="1" height="1"/><rect x="5" y="7" width="1" height="1"/><rect x="6" y="8" width="1" height="1"/><rect x="7" y="9" width="2" height="1"/><rect x="9" y="8" width="1" height="1"/><rect x="10" y="7" width="1" height="1"/><rect x="11" y="6" width="1" height="1"/><rect x="12" y="5" width="1" height="1"/></svg>';

const Store = {
  ok: (function () { try { const k = '__er'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } })(),
  get(k, d) { try { const v = localStorage.getItem('er:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('er:' + k, JSON.stringify(v)); } catch (e) { /* the page works without it */ } },
  del(k) { try { localStorage.removeItem('er:' + k); } catch (e) { /* ignore */ } }
};
const saveImage = () => Store.set('image', ST.log);
function applyHighlight() {
  const s = ST.highlightStyle();
  if (s === 'inverted' || s === 'outline' || s === 'dither') { if (document.documentElement.getAttribute('data-highlight') !== s) document.documentElement.setAttribute('data-highlight', s); return s; }
  return s;
}

/* pop-up menu shared by the page */
let openMenu = null;
function closeMenu() { if (openMenu) { openMenu.el.remove(); if (openMenu.btn) { openMenu.btn.setAttribute('aria-expanded', 'false'); openMenu.btn.focus({ preventScroll: true }); } openMenu = null; } }
function showMenu(btn, items, opts) {
  const wasMine = openMenu && openMenu.btn === btn;
  closeMenu(); if (wasMine) return;
  const el = document.createElement('div'); el.className = 'pop' + (opts && opts.code ? ' code' : ''); el.setAttribute('role', 'menu');
  items.forEach((it, i) => {
    const b = document.createElement('button'); b.textContent = it.label; b.setAttribute('role', 'menuitem'); b.id = btn.id + '-item-' + i;
    b.addEventListener('click', () => { closeMenu(); it.act(); });
    el.appendChild(b);
  });
  el.addEventListener('keydown', e => {
    const list = $$('button', el), at = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { list[(at + 1) % list.length].focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { list[(at - 1 + list.length) % list.length].focus(); e.preventDefault(); }
    if (e.key === 'Escape') { closeMenu(); e.preventDefault(); }
  });
  btn.parentElement.style.position = btn.parentElement.style.position || 'relative';
  btn.parentElement.appendChild(el);
  el.style.left = btn.offsetLeft + 'px'; el.style.top = (btn.offsetTop + btn.offsetHeight + 2) + 'px';
  btn.setAttribute('aria-expanded', 'true');
  openMenu = { el, btn };
  if (el.firstChild) el.firstChild.focus({ preventScroll: true });
}
document.addEventListener('pointerdown', e => { if (openMenu && !openMenu.el.contains(e.target) && e.target !== openMenu.btn) closeMenu(); });

/* the moving slip: stepped frames, XOR while moving, solid at rest */
function flyEl(host, flyer, fromEl, toEl, html, dur, opts) {
  opts = opts || {};
  const hr = host.getBoundingClientRect();
  flyer.innerHTML = html;
  flyer.classList.toggle('bigslip', !!opts.big);
  flyer.hidden = false;
  const fw = flyer.offsetWidth, fh = flyer.offsetHeight;
  const place = (el, align) => {
    const r = el.getBoundingClientRect();
    let x = align === 'right' ? r.right - hr.left - fw - 4 : r.left - hr.left + (r.width - fw) / 2;
    const y = r.top - hr.top + (r.height - fh) / 2;
    x = Math.max(2, Math.min(x, hr.width - fw - 2));
    return [Math.round(x), Math.round(y)];
  };
  const [x0, y0] = place(fromEl, opts.fromAlign), [x1, y1] = place(toEl, opts.toAlign);
  const rest = () => { flyer.classList.remove('moving'); flyer.style.left = x1 + 'px'; flyer.style.top = y1 + 'px'; flyer.style.transform = ''; };
  if (RM() || !dur || !flyer.animate) { rest(); return Promise.resolve(null); }
  flyer.style.left = x0 + 'px'; flyer.style.top = y0 + 'px';
  flyer.classList.add('moving');
  const a = flyer.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${x1 - x0}px,${y1 - y0}px)` }], { duration: dur, easing: 'steps(8)', fill: 'forwards' });
  const finish = () => { a.cancel(); rest(); };
  return { anim: a, done: a.finished.then(finish, finish) };
}

const RAILS = ['find receiver', 'evaluate arguments', 'look up', 'run', 'answer'];
const FILLS = { shout: "^ self asUppercase , '!'", double: '^ self * 2', total: '^ 0' };
let stageCount = 0;
const STAGES = [];

class Stage {
  constructor(root, cfg) {
    this.root = root; this.cfg = cfg || {}; this.id = root.id || ('st' + (++stageCount));
    this.vars = ST.newVars(); this.lens = this.cfg.lens || 'language'; this.speed = 1; this.playing = false; this.locked = !!this.cfg.locked;
    this.presets = this.cfg.presets || []; this.hist = []; this.i = 0; this.pending = null; this.edit = null; this.browse = null; this.popKey = undefined; this.anims = []; this.towerKey = ''; this.showLog = false; this.tok = 0; this.playId = 0;
    this.resetVars();
    this.build(); STAGES.push(this);
    this.load(this.cfg.src || (this.presets[0] && this.presets[0].src) || '3 + 4', this.presets[0] || {});
    new ResizeObserver(() => this.drawLinks()).observe(this.q('.st-grid'));
  }
  q(s) { return this.root.querySelector(s); }
  /* a stage's workspace variables, with any setup it needs (section 2's opposites) */
  resetVars() { this.vars = ST.newVars(); if (this.cfg.setup) ST.evaluate(this.cfg.setup, { vars: this.vars, quiet: true }); }
  build() {
    const id = this.id;
    const f = this.f = Object.assign({ tower: true, exprs: true, method: true, ctx: true, lens: true }, this.cfg.f || {});
    ['tower', 'exprs', 'method', 'ctx', 'lens'].forEach(k => this.root.classList.toggle('no-' + k, !f[k]));
    const playBtn = `<button class="btn" id="${id}-play">Play</button>`;
    this.root.classList.add('stage'); this.root.tabIndex = 0; this.root.setAttribute('role', 'group'); this.root.setAttribute('aria-label', 'Live Smalltalk stage');
    this.root.innerHTML = `
      <div class="st-bar">
        <span style="position:relative;display:inline-flex"><button class="btn" id="${id}-presets" aria-haspopup="true" aria-expanded="false">Expressions</button></span>
        <input class="expr" id="${id}-expr" aria-label="Expression to run" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="btn" id="${id}-doit">Do it</button>
        <span class="lens"><button class="btn" id="${id}-lang" aria-pressed="true">Language</button><button class="btn" id="${id}-mach" aria-pressed="false">Machine</button></span>
      </div>
      <div class="tape"></div>
      <p class="pnote tiny" hidden></p>
      <div class="ctl">
        <button class="btn" id="${id}-back">Back</button><button class="btn primary" id="${id}-step">Step</button>${f.tower ? playBtn : ''}<button class="btn" id="${id}-more" aria-expanded="false">More</button>
      </div>
      <div class="ctl ctlmore" hidden>
        ${f.tower ? '' : playBtn}<button class="btn" id="${id}-over">Step over</button><button class="btn" id="${id}-x4" aria-pressed="false">x4</button><button class="btn" id="${id}-skip">Skip to answer</button><button class="btn" id="${id}-reset">Reset run</button><button class="btn" id="${id}-text" aria-pressed="false">Show as text</button>
      </div>
      <ol class="rail">${RAILS.map(r => `<li>${r}</li>`).join('')}</ol>
      <p class="cap" aria-live="polite"></p>
      <div class="popslot"></div>
      <div class="tscript" hidden><div class="tshead">Transcript</div><pre aria-live="polite"></pre></div>
      <div class="st-grid">
        <div class="objs"></div>
        <div class="towerwrap"><div class="hatchzone"></div><div class="tower"></div><div class="methodslot"></div></div>
        <svg class="links" aria-hidden="true"></svg>
      </div>
      <div class="ctxs"></div>
      <div class="machine" hidden></div>
      <p class="modelnote" hidden>${this.cfg.modelNote || 'A model of the machine. Real bytes are in section 7.'}</p>
      <pre class="log" tabindex="0" hidden></pre>
      <div class="slip flyer" hidden></div>`;
    this.el = { tape: this.q('.tape'), note: this.q('.pnote'), objs: this.q('.objs'), tower: this.q('.tower'), hatch: this.q('.hatchzone'), slot: this.q('.methodslot'), links: this.q('.links'), rail: $$('.rail li', this.root), cap: this.q('.cap'), pop: this.q('.popslot'), ctxs: this.q('.ctxs'), machine: this.q('.machine'), ts: this.q('.tscript'), tsText: this.q('.tscript pre'), model: this.q('.modelnote'), log: this.q('.log'), fly: this.q('.flyer'), expr: this.q('.expr'), grid: this.q('.st-grid') };
    const on = (n, f) => this.q('#' + id + '-' + n).addEventListener('click', f);
    on('presets', e => showMenu(e.currentTarget, this.presets.map(p => ({ label: p.src, act: () => this.load(p.src, p) })), { code: true }));
    on('doit', () => this.doIt());
    on('more', e => { const m = this.q('.ctlmore'); m.hidden = !m.hidden; e.currentTarget.setAttribute('aria-expanded', !m.hidden); });
    this.el.expr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.doIt(); } e.stopPropagation(); });
    on('lang', () => this.setLens('language')); on('mach', () => this.setLens('machine'));
    on('back', () => this.back()); on('step', () => this.stepClick()); on('over', () => this.stepOver());
    on('play', () => this.togglePlay()); on('x4', e => { this.speed = this.speed === 1 ? 4 : 1; e.currentTarget.setAttribute('aria-pressed', this.speed === 4); });
    on('skip', () => this.skip()); on('reset', () => this.load(this.src, this.loadOpts));
    on('text', e => { this.showLog = !this.showLog; e.currentTarget.setAttribute('aria-pressed', this.showLog); this.renderLog(); });
    this.root.addEventListener('keydown', e => {
      if (e.target !== this.root) return;
      if (e.code === 'Space' && e.shiftKey) { e.preventDefault(); this.back(); }
      else if (e.code === 'Space') { e.preventDefault(); this.stepClick(); }
      else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); this.stepOver(); }
    });
  }
  setLens(l) { this.lens = l; this.render(); }
  setLocked(b) { this.locked = b; this.syncControls(); }
  setPresets(list, load) { this.presets = list; if (load && list[0]) this.load(list[0].src, list[0]); }
  doIt() {
    const src = this.el.expr.value;
    if (this.locked) return;
    if (!src.trim()) { this.el.cap.textContent = 'Type an expression, then press Do it.'; return; }
    this.load(src, {});
    this.play();
  }
  load(src, opts) {
    this.pause(); this.finishAnims(); this.tok++;
    this.src = src; this.loadOpts = opts || {}; opts = this.loadOpts;
    this.overrides = opts.overrides || null;
    this.run = new ST.Run(src, { vars: this.vars, overrides: this.overrides });
    this.gen = this.run.main(); this.ended = false; this.pending = null; this.edit = null; this.browse = null; this.popKey = undefined; this.last = null;
    this.el.fly.hidden = true;
    this.el.expr.value = src;
    this.el.note.hidden = !opts.note; this.el.note.innerHTML = opts.note || '';
    /* the Transcript is shared: start this stage's output on a fresh line */
    if (/\bTranscript\b/.test(src) && ST.transcript && !ST.transcript.endsWith('\n')) ST.evaluate('Transcript cr', { vars: ST.newVars(), quiet: true });
    const init = { src, collapses: [], range: null, rail: -1, cap: '', chain: [], floors: {}, hatch: false, start: null, superFrom: null, objs: [], ctxs: [], total: 0, active: null, m: null, notifier: null, done: false, result: null, mark: null, labels: !!this.cfg.labels && !opts.noLabels, hit: null, transcript: /\bTranscript\b/.test(src) ? ST.transcript : null };
    if (!this.cfg.emptyStart || opts.fromReceiver) this.prefill(init, src);
    if (opts.pair) { try { const r = ST.evaluate(opts.pair, { vars: ST.newVars(), quiet: true }); if (r.value) this.pair = ST.inspect(r.value); } catch (e) { this.pair = null; } } else this.pair = null;
    this.hist = [init]; this.i = 0;
    if (opts.runTo) this.preRun(opts.runTo);
    this.render();
  }
  prefill(s, src) {
    const p = ST.parts(src);
    if (!p || !(p.recvKind === 'lit' || (p.recvKind === 'var' && p.recvName !== 'self' && p.recvName !== 'super' && p.recvName !== 'thisContext'))) return;
    try {
      const r = ST.evaluate(src.slice(p.recv[0], p.recv[1]), { vars: this.vars, quiet: true });
      if (r.value && !r.notifiers.length) { s.objs = [ST.inspect(r.value)]; s.chain = ST.chain(r.value.cls.name); }
    } catch (e) { /* no tower yet */ }
  }
  preRun(pred) {
    let guard = 0;
    while (guard++ < 5000) {
      const e = this.nextEvent(); if (!e) return;
      if (pred(e)) { this.pending = e; const s = Object.assign({}, this.cur); s.chain = e.chain || s.chain; if (e.chain) s.floors = {}; this.hist[this.i] = s; return; }
      this.pushEvent(e);
    }
  }
  get cur() { return this.hist[this.i]; }
  nextEvent(cmd) {
    if (this.pending) { const e = this.pending; this.pending = null; return e; }
    if (this.ended) return null;
    const n = this.gen.next(cmd);
    if (n.done) { this.ended = true; return null; }
    return n.value;
  }
  reduce(p, e) {
    const s = Object.assign({}, p);
    s.rail = e.rail; s.cap = e.cap || p.cap; s.labels = false;
    if (e.t === 'recv' && e.tags) s.tags = e.tags;
    if (e.t === 'answer' || e.t === 'done') s.tags = null;
    if (e.ctxs) { s.ctxs = e.ctxs; s.total = e.total; s.active = e.active; }
    if (e.m !== undefined) s.m = e.m;
    s.notifier = e.t === 'notifier' ? e : null;
    switch (e.t) {
      case 'recv': s.range = e.range || p.range; if (e.info) s.objs = [e.info]; break;
      case 'look':
        s.chain = e.chain;
        if (e.first) { s.floors = {}; s.hatch = e.wrapped ? p.hatch : false; }
        else s.floors = Object.assign({}, p.floors);
        s.floors[e.cls] = e.hit ? 'hit' : 'searched';
        s.start = e.start; s.superFrom = e.superFrom; s.hit = e.hit ? e.cls : null;
        break;
      case 'dnu': s.hatch = true; if (e.info) s.objs = [e.info]; break;
      case 'enter': if (e.info) s.objs = [e.info]; break;
      case 'store': if (e.info) s.objs = [e.info]; break;
      case 'answer':
        if (e.range) {
          const [a, b] = e.range;
          s.collapses = p.collapses.filter(c => !(c.s >= a && c.e <= b)).concat([{ s: a, e: b, text: e.value }]);
          s.range = [a, b];
        }
        break;
      case 'transcript': if (e.global) s.transcript = e.contents; break;
      case 'parseError': s.mark = [e.pos, e.pos + e.len]; s.done = true; break;
      case 'done': s.done = true; s.result = e.printed; s.abandoned = !!e.abandoned; break;
      default: break;
    }
    return s;
  }
  pushEvent(e) {
    const s = this.reduce(this.cur, e); s.ev = e;
    this.hist.length = this.i + 1;
    this.hist.push(s); this.i++;
    if (this.hist.length > 4000) { this.hist.splice(0, 1000); this.i -= 1000; }
    return s;
  }
  /* one forward step, with animation. Answers the event, or null at the end. */
  async stepOnce(cmd) {
    this.finishAnims();
    applyHighlight();
    let s, e;
    if (this.i < this.hist.length - 1) { s = this.hist[++this.i]; e = s.ev; }
    else {
      if (this.cur.notifier && !cmd) return null;
      e = this.nextEvent(cmd);
      if (!e) { this.syncControls(); return null; }
      s = this.pushEvent(e);
    }
    this.renderCaption(s);
    await this.animate(e, s);
    if (this.cur === s) this.render();
    if (this.cfg.onEvent) this.cfg.onEvent(e, this);
    return e;
  }
  stepClick() { if (!this.locked) { this.pause(); return this.stepOnce(); } }
  back() { if (this.locked || this.i === 0) return; this.pause(); this.finishAnims(); this.i--; this.el.fly.hidden = true; this.render(); }
  stepOver() {
    if (this.locked) return;
    this.pause(); this.finishAnims();
    const d = this.cur.ev ? this.cur.ev.depth : 1;
    while (this.i < this.hist.length - 1) { this.i++; if (this.cur.ev.depth <= d) { this.afterSilent(); return; } }
    let n = 0;
    while (n++ < 200000) {
      if (this.cur.notifier) break;
      const e = this.nextEvent(); if (!e) break;
      this.pushEvent(e);
      if (e.t === 'notifier' || e.t === 'done' || e.t === 'parseError') break;
      if (e.depth <= d) break;
    }
    this.afterSilent();
  }
  skip() {
    if (this.locked) return;
    this.pause(); this.finishAnims();
    this.i = this.hist.length - 1;
    let n = 0;
    while (n++ < 300000) {
      if (this.cur.notifier) break;
      const e = this.nextEvent(); if (!e) break;
      this.pushEvent(e);
      if (e.t === 'notifier' || e.t === 'done' || e.t === 'parseError') break;
    }
    this.afterSilent();
  }
  afterSilent() { applyHighlight(); this.el.fly.hidden = true; this.render(); const e = this.cur.ev; if (e && this.cfg.onEvent) this.cfg.onEvent(e, this); }
  togglePlay() { if (this.playing) this.pause(); else this.play(); }
  pause() { this.playing = false; if (this.gapT) { clearTimeout(this.gapT); if (this.gapR) this.gapR(); this.gapT = null; } this.syncControls(); }
  async play(stop) {
    if (this.locked) return;
    const id = ++this.playId;
    this.playing = true; this.syncControls();
    while (this.playing && id === this.playId) {
      const e = await this.stepOnce();
      if (id !== this.playId) return;
      if (!e || e.t === 'notifier' || e.t === 'done' || e.t === 'parseError' || (stop && stop(e))) break;
      if (!this.playing) break;
      await new Promise(r => { this.gapR = r; this.gapT = setTimeout(r, RM() ? 200 : 450 / this.speed); });
    }
    if (id !== this.playId) return;
    this.playing = false; this.syncControls();
  }
  resume(cmd) {
    this.edit = null; this.popKey = undefined;
    this.i = this.hist.length - 1;
    const r = this.stepOnce(cmd);
    if (cmd === 'proceed' || cmd === 'abandon') r.then(() => { if (cmd === 'proceed' && !this.cur.notifier) this.play(); });
    return r;
  }

  /* ---------- motion ---------- */
  finishAnims() { this.fast = true; this.anims.forEach(a => { try { a.finish(); } catch (e) { /* done already */ } }); this.anims = []; }
  async leg(from, to, text, dur, opts) {
    if (!from || !to || !from.isConnected || !to.isConnected) return;
    const html = SLIPGLYPH + esc(text);
    const r = flyEl(this.root, this.el.fly, from, to, html, this.fast ? 0 : dur / this.speed, opts);
    if (r && r.done) { this.anims.push(r.anim); await r.done; }
  }
  async animate(e, s) {
    this.fast = false;
    const tok = ++this.tok;
    const fly = { set hidden(v) { if (tok === self.tok) self.el.fly.hidden = v; } };
    const self = this;
    const leg = (...a) => (tok === this.tok ? this.leg(...a) : Promise.resolve());
    if (RM()) {
      if (e.t !== 'look' || e.hit) fly.hidden = true;
      return;
    }
    if (e.t === 'transcript' && s.transcript !== null) {
      this.renderTranscript(Object.assign({}, s, { transcript: this.prevTranscript(s) }));
      await leg(this.q('.obj') || this.el.tape, this.el.tsText, e.add.trim() ? e.add : e.cap.replace(/^Run\. The Transcript shows |\.$/g, ''), 320);
      fly.hidden = true;
      return;
    }
    if (!this.f.tower) {
      if (e.t === 'look' && e.first) await leg(this.el.tape, this.q('.tape .cur') || this.el.tape, e.slip, 320, { fromAlign: 'right' });
      fly.hidden = true;
      return;
    }
    const objEl = this.q('.obj');
    if (e.t === 'look') {
      this.renderTower(s, true);
      const fl = this.floorEl(e.cls);
      let text = e.slip;
      if (e.first) {
        if (e.wrapped) {
          text = 'doesNotUnderstand: (' + (this.lastSlip || '') + ')';
          await leg(objEl || this.el.tape, fl, text, 320, { big: true, toAlign: 'right' });
        } else {
          this.lastSlip = e.slip;
          await leg(this.q('.tape .cur') || this.el.tape, objEl || fl, text, 320);
          await leg(objEl || fl, fl, text, 180, { toAlign: 'right' });
        }
      } else {
        if (e.wrapped) text = 'doesNotUnderstand: (' + (this.lastSlip || '') + ')';
        await leg(this.lastFloor || objEl, fl, text, 180, { fromAlign: 'right', toAlign: 'right', big: !!e.wrapped });
      }
      this.lastFloor = fl;
      if (e.hit) fly.hidden = true;
    } else if (e.t === 'dnu') {
      this.el.hatch.classList.add('on');
      await leg(this.lastFloor, this.el.hatch, e.slip, 180, { fromAlign: 'right', toAlign: 'right' });
      const big = 'doesNotUnderstand: (' + e.slip + ')';
      await leg(this.el.hatch, this.el.hatch, big, 0, { big: true });
      await new Promise(r => setTimeout(r, this.fast ? 0 : 160 / this.speed));
      await leg(this.el.hatch, this.q('.obj') || this.el.tape, big, 320, { big: true });
    } else if (e.t === 'answer') {
      fly.hidden = true;
      const from = (this.lastFloor && this.lastFloor.isConnected) ? this.lastFloor : objEl;
      const to = e.range ? (this.q('.tape .cur') || this.el.tape) : (objEl || this.el.tape);
      await leg(from || this.el.tape, to, e.value, 320, { fromAlign: 'right' });
      fly.hidden = true;
    } else {
      fly.hidden = true;
    }
  }
  floorEl(name) { return this.el.tower.querySelector(`[data-cls="${CSS.escape(name)}"]`); }

  /* ---------- drawing ---------- */
  renderCaption(s) {
    this.el.cap.textContent = s.cap || '';
    this.el.rail.forEach((li, i) => li.classList.toggle('hl', s.rail === i));
  }
  render() {
    const s = this.cur;
    this.renderTape(s); this.renderCaption(s); this.renderTranscript(s); this.renderObjs(s); this.renderTower(s); this.renderSlot(s); this.renderCtxs(s); this.renderPop(s); this.renderLog(); this.syncControls(); this.drawLinks();
    if (this.cfg.onState) this.cfg.onState(s, this);
  }
  prevTranscript(s) { const p = this.hist[this.hist.indexOf(s) - 1]; return p ? p.transcript : s.transcript; }
  renderTranscript(s) {
    const on = s.transcript !== null && s.transcript !== undefined;
    this.el.ts.hidden = !on;
    if (!on) return;
    this.el.tsText.textContent = s.transcript;
    this.el.tsText.scrollTop = this.el.tsText.scrollHeight;
  }
  renderTape(s) {
    const t = this.el.tape, src = s.src, len = src.length;
    t.className = 'tape ' + (len <= 14 ? 'big' : len <= 28 ? 'mid' : 'sm2') + (this.cfg.tags ? ' tagged' : '');
    const live = this.cfg.tags && !s.done && s.rail >= 0;
    const curTag = !live ? '' : s.rail === 4 ? 'answer' : (s.tags || s.rail === 0) ? 'receiver' : '';
    const small = l => l ? `<small class="ttag">${l}</small>` : '';
    const tags = (live && s.tags) || [];
    if (s.labels) {
      const p = ST.parts(src);
      if (p && p.args.length === 1) {
        t.classList.add('labelled');
        const part = (r, l) => `<span class="tok"><small>${l}</small>${esc(src.slice(r[0], r[1]))}</span>`;
        t.innerHTML = part(p.recv, 'receiver') + esc(src.slice(p.recv[1], p.sel[0])) + part(p.sel, 'selector') + esc(src.slice(p.sel[1], p.args[0][0])) + part(p.args[0], 'argument');
        return;
      }
    }
    let html = '';
    const inRange = (a, b, r) => r && a >= r[0] && b <= r[1];
    const textSeg = (a, b) => {
      if (a >= b) return;
      const cuts = [a, b];
      [s.range, s.mark].concat(tags.map(g => g.r)).forEach(r => { if (r) r.forEach(x => { if (x > a && x < b) cuts.push(x); }); });
      cuts.sort((x, y) => x - y);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const x = cuts[i], y = cuts[i + 1], tx = esc(src.slice(x, y));
        if (inRange(x, y, s.mark)) html += `<span class="mark">${tx}</span>`;
        else if (inRange(x, y, s.range) && !s.done) html += `<span class="cur hl">${small(curTag)}${tx}</span>`;
        else {
          const g = tags.find(k => k.r[0] === x && k.r[1] === y);
          html += g ? `<span class="taggedtok">${small(g.l)}${tx}</span>` : `<span>${tx}</span>`;
        }
      }
    };
    const cols = s.collapses.slice().sort((a, b) => a.s - b.s);
    let at = 0;
    cols.forEach(c => {
      textSeg(at, c.s);
      const here = inRange(c.s, c.e, s.range) && !s.done;
      html += `<span class="tile${here ? ' cur hl' : ''}">${here ? small(curTag) : ''}${esc(c.text)}</span>`;
      at = c.e;
    });
    textSeg(at, len);
    const whole = cols.length === 1 && cols[0].s === 0 && cols[0].e === len;
    if (s.done && s.result !== null && s.result !== undefined && !whole) html += `<span class="eq">→ <span class="tile">${esc(s.result)}</span></span>`;
    t.innerHTML = html;
  }
  renderObjs(s) {
    const tile = o => `<div class="obj"><div class="oval${/[^\s(]{13,}/.test(o.p) ? ' long' : ''}">${esc(o.p)}</div><div class="ocls">${esc(o.c)}</div>${o.iv.length ? `<ul class="oivs">${o.iv.map(([n, v]) => `<li><span>${esc(n)}</span><i></i><b>${esc(v)}</b></li>`).join('')}</ul>` : ''}</div>`;
    const list = (this.pair ? [this.pair] : []).concat(s.objs);
    this.el.objs.innerHTML = list.map(tile).join('') || '<div class="obj ghost"><div class="ocls">The receiver appears here.</div></div>';
  }
  renderTower(s, structureOnly) {
    const key = s.chain.join('|') + '#' + ST.version + (this.edit ? 'e' : '');
    if (key !== this.towerKey) {
      this.towerKey = key;
      this.el.tower.innerHTML = s.chain.length ? '' : '<p class="tiny towerhint">Its class appears here at look up.</p>';
      s.chain.slice().reverse().forEach(name => {
        const b = document.createElement('button');
        b.className = 'floor'; b.dataset.cls = name; b.id = this.id + '-floor-' + name.replace(/\W+/g, '_');
        const sels = ST.selectors(name);
        const shown = sels.length > 5 ? sels.slice(0, 5).join(' ') + ` ... ${sels.length - 5} more` : sels.join(' ');
        b.innerHTML = `<span class="fname">${esc(name)}</span><span class="fsels">${esc(shown)}</span>`;
        b.addEventListener('click', () => this.floorTap(name));
        this.el.tower.appendChild(b);
      });
    }
    if (structureOnly) return;
    this.el.hatch.classList.toggle('on', !!s.hatch);
    $$('.floor', this.el.tower).forEach(f => {
      const st = s.floors[f.dataset.cls];
      f.classList.toggle('searched', st === 'searched');
      f.classList.toggle('hl', st === 'hit');
      f.classList.toggle('pick', !!this.edit);
      f.classList.toggle('target', !!this.edit && this.edit.target === f.dataset.cls);
      const tag = f.querySelector('.starttag'); if (tag) tag.remove();
      if (this.cfg.startMarker && s.start === f.dataset.cls && !this.edit) { const t = document.createElement('span'); t.className = 'starttag'; t.textContent = 'search starts'; f.appendChild(t); }
    });
  }
  floorTap(name) {
    if (this.edit) { this.edit.target = name; this.popKey = undefined; this.renderPopTitle(); this.renderTower(this.cur); return; }
    this.browse = { cls: name, sel: null }; this.renderSlot(this.cur);
  }
  renderSlot(s) {
    const slot = this.el.slot;
    if (this.browse) {
      const b = this.browse;
      if (b.sel) {
        slot.innerHTML = `<div class="methwin"><header><span>${esc(b.cls)} &gt;&gt; ${esc(b.sel)}</span><button aria-label="Close" id="${this.id}-bclose">x</button></header><pre>${esc(ST.methodSource(b.cls, b.sel))}</pre></div>`;
      } else {
        const sels = ST.selectors(b.cls);
        slot.innerHTML = `<div class="methwin"><header><span>${esc(b.cls)}</span><button aria-label="Close" id="${this.id}-bclose">x</button></header><div class="list">${sels.length ? sels.map((x, i) => `<button id="${this.id}-m${i}" data-s="${esc(x)}">${esc(x)}</button>`).join('') : '<span class="tiny">No methods of its own.</span>'}</div></div>`;
        $$('.list button', slot).forEach(x => x.addEventListener('click', () => { this.browse.sel = x.dataset.s; this.renderSlot(this.cur); }));
      }
      slot.querySelector('header button').addEventListener('click', () => { if (this.browse.sel) this.browse.sel = null; else this.browse = null; this.renderSlot(this.cur); });
      return;
    }
    if (s.m && !s.done && this.f.method) {
      const m = s.m; let body = esc(m.src);
      if (m.s >= 0) body = esc(m.src.slice(0, m.s)) + '<span class="hl">' + esc(m.src.slice(m.s, m.e)) + '</span>' + esc(m.src.slice(m.e));
      slot.innerHTML = `<div class="methwin"><header><span>${esc(m.cls)} &gt;&gt; ${esc(m.sel)}</span></header><pre>${body}</pre></div>`;
    } else slot.innerHTML = '';
  }
  renderCtxs(s) {
    const mach = this.lens === 'machine';
    this.q('#' + this.id + '-lang').setAttribute('aria-pressed', !mach);
    this.q('#' + this.id + '-mach').setAttribute('aria-pressed', mach);
    this.el.ctxs.hidden = mach; this.el.machine.hidden = !mach; this.el.model.hidden = !mach;
    if (mach) {
      const a = s.active || { sender: 'nil', ip: 'start', method: 'Workspace', receiver: 'nil', vars: [], stack: [] };
      this.el.machine.innerHTML = `<dl><dt>sender</dt><dd>${esc(a.sender)}</dd><dt>IP at</dt><dd>${esc(a.ip)}</dd><dt>method</dt><dd>${esc(a.method)}</dd><dt>receiver</dt><dd>${esc(a.receiver)}</dd><dt>temps, args</dt><dd>${a.vars.length ? a.vars.map(([k, v]) => esc(k) + ': ' + esc(v)).join(', ') : 'none'}</dd></dl>
      <div class="stk"><h4>stack</h4>${a.stack.map(v => `<div class="cell">${esc(v)}</div>`).join('')}${a.stack.length ? '<div class="top">top is at the bottom</div>' : ''}</div>`;
    } else {
      const n = s.total, more = n > s.ctxs.length ? n - s.ctxs.length : 0;
      let html = more ? `<div class="ctx more"><span>+${more}</span></div>` : '';
      html += s.ctxs.map((c, i) => { const on = i === s.ctxs.length - 1; return `<div class="ctxcol"><small>${on ? 'running' : 'waiting'}</small><div class="ctx ${on ? 'hl' : 'wait'}"><span>${esc(c)}</span></div></div>`; }).join('');
      this.el.ctxs.innerHTML = html || '<div class="ctxcol"><small>running</small><div class="ctx"><span>Workspace</span></div></div>';
    }
  }
  renderPopTitle() { const t = this.q('.editor .tab'); if (t && this.edit) t.textContent = 'New method in ' + this.edit.target; }
  renderPop(s) {
    const n = s.notifier, head = this.i === this.hist.length - 1;
    const key = (n && head) ? n.n + (this.edit ? 'e' : '') : null;
    if (key === this.popKey) return;
    this.popKey = key;
    const pop = this.el.pop; pop.innerHTML = '';
    if (!n || !head) return;
    const w = document.createElement('div'); w.className = 'win notifier';
    w.innerHTML = `<div class="tab">${esc(n.title)}</div><div class="btnrow">${n.kind === 'dnu' ? `<button class="btn" id="${this.id}-create">Create</button>` : ''}<button class="btn" id="${this.id}-abandon">Abandon</button></div>`;
    pop.appendChild(w);
    const cr = w.querySelector('#' + this.id + '-create');
    if (cr) cr.addEventListener('click', () => this.openEditor(n));
    w.querySelector('#' + this.id + '-abandon').addEventListener('click', () => this.resume('abandon'));
    if (this.edit) {
      const ed = document.createElement('div'); ed.className = 'win editor';
      ed.innerHTML = `<div class="tab"></div><textarea class="src" id="${this.id}-src" aria-label="Method source" spellcheck="false">${esc(this.edit.text)}</textarea>
        <p class="tiny">Tap a class in the tower to put it there.</p>
        <p class="err tiny" hidden></p>
        <div class="btnrow"><button class="btn" id="${this.id}-accept">Accept and Proceed</button>${FILLS[n.sel] ? `<button class="link sm" id="${this.id}-fill">Fill in</button>` : ''}</div>`;
      pop.appendChild(ed);
      this.renderPopTitle();
      const ta = ed.querySelector('textarea');
      ta.addEventListener('keydown', e => e.stopPropagation());
      const clearErr = () => { ed.querySelector('.err').hidden = true; };
      ta.addEventListener('input', clearErr);
      const fl = ed.querySelector('#' + this.id + '-fill');
      if (fl) fl.addEventListener('click', () => { ta.value = this.edit.pattern + '\n  ' + FILLS[n.sel]; clearErr(); ta.focus(); });
      ed.querySelector('#' + this.id + '-accept').addEventListener('click', () => {
        const r = ST.compile(this.edit.target, ta.value, true);
        const err = ed.querySelector('.err');
        if (r.error) {
          const pos = r.pos || 0, end = pos + (r.len || 1), line = ta.value.slice(0, pos).split('\n').length;
          err.textContent = `I can't read this. Check line ${line}, near ${ta.value.slice(pos, end)}`;
          err.hidden = false; ta.focus(); ta.setSelectionRange(pos, end);
          return;
        }
        saveImage(); this.towerKey = '';
        if (this.cfg.onProceed) this.cfg.onProceed(this);
        this.resume('proceed');
      });
    }
  }
  openEditor(n) {
    let pat;
    if (n.nargs === 0) pat = n.sel;
    else if (!n.sel.includes(':')) pat = n.sel + ' anArgument';
    else pat = n.sel.split(':').filter(Boolean).map((p, i) => `${p}: arg${i + 1}`).join(' ');
    this.edit = { target: n.recvClass, pattern: pat, text: pat + '\n  ', sel: n.sel };
    this.popKey = undefined; this.towerKey = '';
    this.render();
  }
  renderLog() {
    this.el.log.hidden = !this.showLog;
    if (!this.showLog) return;
    this.el.log.textContent = this.hist.slice(1, this.i + 1).map(h => h.cap).filter(Boolean).join('\n') || 'Nothing has run yet.';
  }
  syncControls() {
    const s = this.cur; if (!s) return;
    const atEnd = this.i === this.hist.length - 1 && (s.done || this.ended);
    const blocked = s.notifier && this.i === this.hist.length - 1;
    const set = (n, d) => { this.q('#' + this.id + '-' + n).disabled = d; };
    const L = this.locked;
    set('presets', L); set('doit', L); this.el.expr.disabled = L;
    set('back', L || this.i === 0); set('step', L || atEnd || blocked); set('over', L || atEnd || blocked);
    set('play', L || ((atEnd || blocked) && !this.playing)); set('skip', L || atEnd || blocked); set('reset', L);
    this.q('#' + this.id + '-play').textContent = this.playing ? 'Pause' : 'Play';
  }
  drawLinks() {
    const svg = this.el.links, s = this.cur; if (!s) return;
    const g = this.el.grid.getBoundingClientRect(); let d = '', sup = '';
    const rel = r => ({ l: r.left - g.left, r: r.right - g.left, t: r.top - g.top, b: r.bottom - g.top });
    const hit = s.hit && this.floorEl(s.hit);
    if (hit) {
      const f = rel(hit.getBoundingClientRect()); const y1 = Math.round((f.t + f.b) / 2);
      $$('.obj', this.el.objs).forEach((o, i) => {
        const a = rel(o.getBoundingClientRect()), y0 = Math.round((a.t + a.b) / 2), mid = Math.round(a.r + (f.l - a.r) / 2) + i * 4;
        d += `M${Math.round(a.r)} ${y0}H${mid}V${y1}H${Math.round(f.l)}`;
      });
    }
    if (s.superFrom && s.start) {
      const a = this.floorEl(s.superFrom), b = this.floorEl(s.start);
      if (a && b) { const A = rel(a.getBoundingClientRect()), B = rel(b.getBoundingClientRect()), x = Math.round(A.r - 8); sup = `M${x} ${Math.round((A.t + A.b) / 2)}V${Math.round((B.t + B.b) / 2)}`; }
    }
    svg.innerHTML = (d ? `<path d="${d}"/>` : '') + (sup ? `<path class="superline" d="${sup}"/>` : '');
  }
}
/* The page: hero, predictions, each section's own visual, stories, and the menu bar. */

export { RM, esc, $, $$, SLIPGLYPH, Store, saveImage, applyHighlight, closeMenu, showMenu, flyEl, RAILS, FILLS, STAGES, Stage };
