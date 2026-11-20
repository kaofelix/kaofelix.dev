import { ST } from './engine.js';
import { RM, esc, $, $$, SLIPGLYPH, Store, saveImage, applyHighlight, closeMenu, showMenu, flyEl, RAILS, FILLS, STAGES, Stage } from './stage.js';

(function () {
  'use strict';
  const html = document.documentElement;
  html.setAttribute('data-highlight', 'inverted');
  ST.importLog(Store.get('image', []));
  applyHighlight();
  const theme = Store.get('theme', null);
  if (theme) html.setAttribute('data-theme', theme);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const toast = text => { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); };

  /* ---------- small generic widgets ---------- */
  $$('.why').forEach(w => { const b = $('button', w), a = $('.ans', w); b.addEventListener('click', () => { a.hidden = false; b.hidden = true; }); });
  $$('.recall').forEach(w => {
    const a = $('.ans', w), toks = $('.tokrow', w);
    $$('button', w).forEach(b => b.addEventListener('click', () => {
      a.hidden = false;
      if (toks) { $$('button', toks).forEach(x => { x.classList.toggle('picked', x === b); if (x.dataset.a) x.classList.add('answer'); }); } else b.hidden = true;
    }));
  });
  if (!Store.ok) $$('.savedline').forEach(s => { s.hidden = true; });

  /* ---------- the ledger: what your language builds in, flipping as you disprove it ---------- */
  const LEDGER = [
    { k: 'ops', c: '+ *', d: 'a message', sec: 1 }, { k: 'dnu', c: 'missing-method errors', d: 'a message', sec: 3 },
    { k: 'ifs', c: 'if, while, for', d: 'messages', sec: 4 }, { k: 'new', c: 'new, static', d: 'messages to a class', sec: 6 },
    { k: 'frames', c: 'stack frames', d: 'objects you can message', sec: 7 },
    { k: 'assign', c: ':=', d: 'still special, a store', fixed: true }, { k: 'ret', c: '^', d: 'still special, a return', fixed: true }
  ];
  const flipped = Store.get('ledger', {});
  const ledgerHTML = final => LEDGER.map(r => {
    const on = !!flipped[r.k];
    const say = on ? r.d : r.fixed ? (final ? r.d : 'built in') : (final ? `built in, until section ${r.sec}` : 'built in');
    return `<li class="${on ? 'flip' : ''}${r.fixed && final ? ' keep' : ''}" data-k="${r.k}"><code>${esc(r.c)}</code><span>${esc(say)}</span></li>`;
  }).join('');
  function renderLedger(fresh) {
    $('#ledgerrows').innerHTML = ledgerHTML(false); $('#ledger-final').innerHTML = ledgerHTML(true);
    $('#mb-ledger').textContent = 'Built-ins: ' + LEDGER.filter(r => !flipped[r.k]).length;
    if (fresh) $$(`li[data-k="${fresh}"]`).forEach(li => { li.classList.add('hl'); setTimeout(() => li.classList.remove('hl'), 1800); });
  }
  function flip(k) {
    if (flipped[k]) return;
    const r = LEDGER.find(x => x.k === k);
    flipped[k] = true; Store.set('ledger', flipped); renderLedger(k);
    toast(`Off your Built-ins list: ${r.c}. In Smalltalk it's ${r.d}.`);
  }
  renderLedger();
  (function ledgerMenu() {
    const box = $('#ledger'), btn = $('#mb-ledger');
    const set = on => { box.classList.toggle('open', on); btn.setAttribute('aria-expanded', on); };
    btn.addEventListener('click', () => set(!box.classList.contains('open')));
    document.addEventListener('pointerdown', e => { if (!box.contains(e.target) && e.target !== btn) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) { set(false); btn.focus(); } });
  })();

  /* ---------- predictions ---------- */
  const guesses = Store.get('guesses', {});
  const PRED = {}, REVEAL = {};
  const qOf = {};
  function renderGuesses() {
    const box = $('#guesslist');
    const rows = Object.keys(qOf).filter(k => guesses[k] !== undefined);
    box.innerHTML = '<b>Question</b><b>You picked</b><b>What happened</b>' + (rows.length ? rows.map(k => `<span>${esc(qOf[k].q)}</span><span>${esc(guesses[k])}</span><span>${esc(qOf[k].right)}</span>`).join('') : '<span>Nothing yet.</span><span></span><span></span>');
  }
  const revealPred = id => { if (REVEAL[id]) REVEAL[id](); };
  $$('.predict').forEach(p => {
    const id = p.dataset.id, opts = p.dataset.opts.split('|'), rev = $('.reveal', p), qEl = $('.q', p);
    const qc = qEl.cloneNode(true); $$('.tiny', qc).forEach(x => x.remove());
    qOf[id] = { q: qc.textContent.replace(" A guess helps even when it's wrong.", '').trim(), right: p.dataset.right };
    const row = document.createElement('div'); row.className = 'btnrow';
    const lock = document.createElement('p'); lock.className = 'q lockin'; lock.hidden = true; lock.textContent = p.dataset.hold || '';
    const buttons = opts.map((o, i) => {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = o; b.id = 'pred-' + id + '-' + i;
      b.addEventListener('click', () => {
        if (guesses[id] !== undefined) return;
        guesses[id] = o; Store.set('guesses', guesses);
        settle(false); renderGuesses();
        if (PRED[id]) PRED[id](false);
      });
      row.appendChild(b); return b;
    });
    p.insertBefore(row, rev); p.insertBefore(lock, rev);
    REVEAL[id] = () => {
      if (guesses[id] === undefined || !rev.hidden) return;
      rev.hidden = false; lock.hidden = true;
      buttons.forEach((b, i) => { if (opts[i] === p.dataset.right && !$('small', b)) b.insertAdjacentHTML('beforeend', '<small class="ithappens">what happens</small>'); });
    };
    function settle(restored) {
      buttons.forEach((b, i) => { b.disabled = true; if (opts[i] === guesses[id]) { b.classList.add('picked'); b.disabled = false; b.setAttribute('aria-disabled', 'true'); } });
      if (p.dataset.hold && !restored) lock.hidden = false; else REVEAL[id]();
    }
    p._settle = () => { if (guesses[id] !== undefined) settle(true); };
  });
  renderGuesses();

  /* ---------- hero: Hello world by hand, then a send that answers a new object ---------- */
  (function hero() {
    const tsText = $('#herots-text'), ansCol = $('#answercol');
    const HELLO = "Transcript show: 'Hello, world'", UPPER = "'hello' asUppercase";
    /* drag a slip onto a target, or tap it; then fly it there, flash the target and run the send */
    function dragSend(slip, target, run) {
      let done = false, moved = false, sx = 0, sy = 0, drag = false;
      async function go() {
        if (done) return; done = true;
        const a = slip.getBoundingClientRect(), b = target.getBoundingClientRect();
        const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        const cur = new DOMMatrixReadOnly(getComputedStyle(slip).transform);
        if (!RM() && slip.animate) {
          slip.classList.add('moving');
          const an = slip.animate([{ transform: `translate(${cur.m41}px,${cur.m42}px)` }, { transform: `translate(${cur.m41 + dx}px,${cur.m42 + dy}px)` }], { duration: 320, easing: 'steps(8)', fill: 'forwards' });
          await an.finished.catch(() => {});
          for (let k = 0; k < 2; k++) { target.classList.add('hl'); await sleep(90); target.classList.remove('hl'); await sleep(90); }
        }
        slip.hidden = true;
        await run(true);
      }
      slip.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; drag = true; moved = false; try { slip.setPointerCapture(e.pointerId); } catch (x) { /* mouse */ } });
      slip.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (moved) slip.style.transform = `translate(${dx}px,${dy}px)`;
      });
      slip.addEventListener('pointerup', () => {
        if (!drag) return; drag = false;
        if (!moved) return;
        const a = slip.getBoundingClientRect(), b = target.getBoundingClientRect();
        const hit = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (hit) go(); else slip.style.transform = '';
      });
      slip.addEventListener('pointercancel', () => { drag = false; slip.style.transform = ''; });
      slip.addEventListener('click', () => { if (moved) { moved = false; return; } go(); });
      return { skip: () => { done = true; slip.hidden = true; } };
    }
    /* step one: the Transcript writes what show: sends it */
    async function showHello(animated) {
      const before = ST.transcript;
      ST.evaluate(HELLO, { quiet: true, vars: ST.newVars() });
      const text = ST.transcript.slice(before.length);
      ST.evaluate('Transcript cr', { quiet: true, vars: ST.newVars() });
      if (animated && !RM()) for (let i = 1; i <= text.length; i++) { tsText.textContent = text.slice(0, i); await sleep(35); }
      tsText.textContent = text;
      $('#hero-do').hidden = true; $('#hero-mid').hidden = false;
      $('#bench2').hidden = false; $('#hero-do2').hidden = false;
      if (Store.get('hero', 0) < 1) Store.set('hero', 1);
      if (animated) $('#hero-mid').focus({ preventScroll: true });
    }
    /* step two: 'hello' answers a new object and stays as it was */
    async function upper(animated) {
      const res = ST.evaluate(UPPER, { quiet: true, vars: ST.newVars() });
      $('#hero-upper').textContent = res.printed;
      ansCol.hidden = false; $('#hello-label').textContent = "still 'hello'";
      $('#hero-do2').hidden = true; $('#hero-after').hidden = false;
      Store.set('hero', 2);
      if (animated && !RM() && ansCol.animate) {
        const from = $('#hero-hello').getBoundingClientRect(), to = ansCol.getBoundingClientRect();
        await ansCol.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px)` }, { transform: 'translate(0,0)' }], { duration: 320, easing: 'steps(8)' }).finished.catch(() => {});
      }
      if (animated) $('#hero-after').focus({ preventScroll: true });
    }
    const d1 = dragSend($('#heroslip'), $('#herots'), showHello), d2 = dragSend($('#heroslip2'), $('#hero-hello'), upper);
    const was = Store.get('hero', 0), step = was === true ? 2 : was;
    if (step >= 1) { d1.skip(); showHello(false); }
    if (step >= 2) { d2.skip(); upper(false); }
  })();

  /* ---------- stage presets ---------- */
  const P = (src, extra) => Object.assign({ src }, extra || {});

  /* Section 1: tape, rail, Back and Step. Nothing else yet. */
  const st1 = new Stage($('#st1'), {
    src: "Transcript show: 'Hello, world'", labels: true, tags: true, locked: true, f: { tower: false, exprs: false, method: false, ctx: false, lens: false }, presets: [],
    onEvent: (e, st) => { if (e.t !== 'done') return; if (st.src === '2 + 3 * 4') revealPred('s1'); flip('ops'); }
  });
  const chips1 = $$('.chip[data-st="st1"]'); chips1.forEach(c => { c.disabled = true; });
  PRED.s1 = () => { st1.setLocked(false); chips1.forEach(c => { c.disabled = false; }); st1.load('2 + 3 * 4', { noLabels: true }); };

  /* Section 2: adds the class column and the expression bar */
  const notePair = 'Two instances, one method, each with its own values.';
  const OPPOSITES = 'opposites := Dictionary new. opposites at: #hot put: #cold; at: #push put: #pull; at: #stop put: #go';
  const st2 = new Stage($('#st2'), {
    src: "'hello' size", setup: OPPOSITES, emptyStart: true, locked: true, f: { method: false, ctx: false },
    presets: [P("'hello' size", { fromReceiver: true }), P('#(3 1 4 1 5) size', { fromReceiver: true }), P('opposites size', { fromReceiver: true }), P('opposites', { fromReceiver: true }),
      P('3 + 5', { fromReceiver: true }), P('2.5 + 5', { fromReceiver: true }), P('(1@2) + 5', { fromReceiver: true }), P('(1@2) x', { fromReceiver: true }), P('(7@8) x', { pair: '1@2', note: notePair, fromReceiver: true })]
  });
  const tapped2 = new Set();
  const sendTo = t => {
    if (guesses.s2 === undefined) return;
    st2.load(t + ' size', { runTo: e => e.t === 'look' && e.sel === 'size' && e.depth === 1 });
    st2.play(e => (e.t === 'look' && e.hit && e.sel === 'size' && e.depth === 1) || e.t === 'dnu');
    tapped2.add(t); if (tapped2.size === 4) $('#r2-result').hidden = false;
  };
  [['#r2-a', "'hello'"], ['#r2-b', '#(3 1 4 1 5)'], ['#r2-c', '#(3 1 4 1 5) asSet'], ['#r2-d', 'opposites']].forEach(([s, t]) => $(s).addEventListener('click', () => sendTo(t)));
  PRED.s2 = () => { st2.setLocked(false); $$('#recv2 button').forEach(b => { b.disabled = false; }); };

  /* Section 3: adds the method window and the notifier */
  const beforeLook = e => e.t === 'look';
  let proceeded = Store.get('proceeded', false);
  const showS3Done = () => { $('#s3done').hidden = false; };
  if (proceeded) showS3Done();
  const shout3 = P("'hello' shout", { runTo: beforeLook });
  const st3 = new Stage($('#st3'), {
    locked: true, src: shout3.src, f: { ctx: false }, presets: [shout3, P('#hello shout', { runTo: beforeLook }), P('3 double', { runTo: beforeLook }), P('2.5 double', { runTo: beforeLook })],
    onProceed: () => { proceeded = true; Store.set('proceeded', true); },
    onEvent: e => {
      if (e.t === 'notifier' && e.kind === 'dnu') { revealPred('s3'); flip('dnu'); }
      if (e.t === 'done') revealPred('s3');
      if (e.t === 'done' && proceeded && !e.abandoned) showS3Done();
    }
  });
  PRED.s3 = restored => { st3.setLocked(false); $('#try3').disabled = false; if (!restored) st3.play(); };
  [['#try3', shout3.src], ['#try3b', '#hello shout'], ['#try3c', '3 double'], ['#try3d', '2.5 double']].forEach(([id, src]) => $(id).addEventListener('click', () => { st3.load(src, { runTo: beforeLook }); st3.play(); }));

  /* Section 4 */
  const noteDo = 'Here <code>do:</code> is a primitive, to keep the trace short. In the real system it is Smalltalk code.';
  const st4 = new Stage($('#st4'), { src: "['hello' asUppercase]", f: { ctx: false }, presets: [P("['hello' asUppercase]"), P("['hello' asUppercase] value"), P('[3 + 4] value'), P("false ifTrue: ['yes']"), P('nil isNil'), P('3 isNil'), P('x := 0. [x < 3] whileTrue: [x := x + 1]. x'),
    P('#(3 1 4 1 5) do: [:x | Transcript print: x; cr]', { note: noteDo }), P('#(3 1 4 1 5) collect: [:x | x * x]'), P('#(3 1 4 1 5) select: [:x | x > 2]'), P('#(3 1 4 1 5) inject: 0 into: [:sum :x | sum + x]'),
    P('#(3 1 4 1 5) detect: [:x | x > 3] ifNone: [nil]'), P("'hello' select: [:c | c isVowel]"), P("'hello' collect: [:c | c asUppercase]"), P("1 to: 3 do: [:i | Transcript print: i; cr]"),
    P("3 ifTrue: ['yes']", { note: 'The real compiled form sends mustBeBoolean instead. <span class="pg">pp. 602-603</span>' })] });
  PRED.s4 = () => { $('#puzzle').hidden = false; $('#puzzle-wait').hidden = true; startHintClock(); };
  let startHintClock = () => {};
  (function puzzle() {
    const slots = { true: $('#slot-true'), false: $('#slot-false') };
    const tiles = { value: $('#tile-value'), nil: $('#tile-nil') };
    const text = { value: '^ aBlock value', nil: '^ nil' };
    const place = { true: null, false: null };
    let sel = null;
    const pmsg = $('#pmsg'), hint = $('#phint');
    function sync() {
      Object.keys(slots).forEach(k => { const v = place[k]; slots[k].textContent = v ? text[v] : ''; slots[k].classList.toggle('filled', !!v); });
      Object.keys(tiles).forEach(k => { const used = place.true === k || place.false === k; tiles[k].classList.toggle('gone', used); tiles[k].classList.toggle('sel', sel === k); });
      const full = place.true && place.false;
      $('#runp1').disabled = !full; $('#runp2').disabled = !full;
      if (!full) pmsg.hidden = true;
    }
    function put(k, t) { Object.keys(place).forEach(s => { if (place[s] === t) place[s] = null; }); place[k] = t; sel = null; sync(); }
    Object.keys(slots).forEach(k => slots[k].addEventListener('click', () => {
      if (sel) put(k, sel); else if (place[k]) { place[k] = null; sync(); }
    }));
    Object.keys(tiles).forEach(t => {
      const el = tiles[t]; let down = null, ghost = null;
      el.addEventListener('click', () => { if (el._dragged) { el._dragged = false; return; } sel = sel === t ? null : t; sync(); });
      el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; try { el.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } });
      el.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - down[0], dy = e.clientY - down[1];
        if (!ghost && Math.abs(dx) + Math.abs(dy) > 6) { ghost = true; el._dragged = true; }
        if (ghost) { el.style.transform = `translate(${dx}px,${dy}px)`; el.style.position = 'relative'; el.style.zIndex = 5; }
      });
      el.addEventListener('pointerup', e => {
        if (ghost) {
          el.style.transform = ''; el.style.zIndex = '';
          Object.keys(slots).forEach(k => { const r = slots[k].getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) put(k, t); });
        }
        down = null; ghost = null;
      });
    });
    function runIt(src) {
      const overrides = {
        'True>>ifTrue:': ST.detached('True', 'ifTrue: aBlock\n  ' + text[place.true]),
        'False>>ifTrue:': ST.detached('False', 'ifTrue: aBlock\n  ' + text[place.false])
      };
      const right = place.true === 'value';
      pmsg.hidden = right;
      if (right) { $('#s4reveal').hidden = false; Store.set('puzzle', true); hint.hidden = true; solved = true; flip('ifs'); }
      st4.load(src, { overrides, runTo: e => e.t === 'look' && e.sel === 'ifTrue:' });
      st4.play();
    }
    $('#runp1').addEventListener('click', () => runIt("3 > 0 ifTrue: ['yes']"));
    $('#runp2').addEventListener('click', () => runIt("3 < 0 ifTrue: ['yes']"));
    let solved = Store.get('puzzle', false);
    if (solved) $('#s4reveal').hidden = false;
    let timer = null;
    startHintClock = () => { if (!timer && !solved) timer = setTimeout(() => { if (!solved) hint.hidden = false; }, 60000); };
    sync();
  })();

  /* Section 5: adds the labelled context row */
  const presets5 = [P('example4 result1'), P('example4 result2'), P('example3 result3'), P('Two new result1')];
  const st5 = new Stage($('#st5'), { startMarker: true, src: 'example4 result1', presets: presets5, onEvent: (e, st) => { if (e.t === 'done' && st.src === 'example4 result3') revealPred('s5'); } });
  $('#w5a').addEventListener('click', () => st5.load('example4 result1'));
  $('#w5b').addEventListener('click', () => st5.load('example4 result2'));
  PRED.s5 = restored => { st5.setPresets(presets5.concat([P('example4 result3')]), false); if (!restored) st5.load('example4 result3'); };

  /* Section 6: the still map */
  const H = 28, ROWY = { Object: 44, Magnitude: 94, Number: 144, Integer: 194, SmallInteger: 244, Point: 310 };
  const NODES = { '3': [10, 244, 56], '1@2': [10, 310, 56] };
  Object.keys(ROWY).forEach(n => { NODES[n] = [100, ROWY[n], 120]; NODES[n + ' class'] = [270, ROWY[n], 150]; });
  Object.assign(NODES, { Behavior: [470, 44, 140], ClassDescription: [470, 94, 140], Class: [470, 144, 140], Metaclass: [630, 194, 125], 'Metaclass class': [630, 310, 125] });
  const c = n => { const [x, y, w] = NODES[n]; return { x, y, w, cx: x + w / 2, cy: y + H / 2, r: x + w, b: y + H }; };
  const line = (d, inst, cls) => `<path class="mapl${inst ? ' inst' : ''}${cls ? ' ' + cls : ''}" d="${d}" marker-end="url(#maparrow)"/>`;
  const slug = n => n.replace(/\W+/g, '_');
  (function drawMap() {
    let s = '<svg id="metamap" viewBox="0 0 760 348" role="group" aria-label="Map of instances, classes and metaclasses"><defs><marker id="maparrow" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path class="maparrow" d="M0 0L8 4L0 8Z"/></marker></defs>';
    [[10, 'Instances'], [100, 'Classes'], [270, 'Their metaclasses'], [470, 'What classes inherit']].forEach(([x, t]) => { s += `<text class="maphead" x="${x}" y="14">${t}</text>`; });
    const sup = (a, b) => { const A = c(a), B = c(b); return line(`M${A.cx} ${A.y}V${B.b}`); };
    [['Magnitude', 'Object'], ['Number', 'Magnitude'], ['Integer', 'Number'], ['SmallInteger', 'Integer'], ['Magnitude class', 'Object class'], ['Number class', 'Magnitude class'], ['Integer class', 'Number class'], ['SmallInteger class', 'Integer class'], ['ClassDescription', 'Behavior'], ['Class', 'ClassDescription']].forEach(([a, b]) => { s += sup(a, b); });
    { const A = c('Point'), O = c('Object'); s += line(`M${A.x + 12} ${A.y}V${A.y - 12}H88V${O.cy}H${O.x}`); }
    { const A = c('Point class'), O = c('Object class'); s += line(`M${A.x + 12} ${A.y}V${A.y - 12}H258V${O.cy}H${O.x}`); }
    { const A = c('Object class'), B = c('Class'); s += line(`M${A.r} ${A.cy}H445V${B.cy}H${B.x}`); }
    { const A = c('Behavior'), O = c('Object'); s += line(`M${A.cx} ${A.y}V28H${O.cx}V${O.y}`); }
    { const A = c('Metaclass'), B = c('ClassDescription'); s += line(`M${A.cx} ${A.y}V${B.cy}H${B.r}`); }
    s += line(`M${c('3').r} ${c('3').cy}H${c('SmallInteger').x}`, true);
    s += line(`M${c('1@2').r} ${c('1@2').cy}H${c('Point').x}`, true);
    Object.keys(ROWY).forEach(n => { s += line(`M${c(n).r} ${c(n).cy}H${c(n + ' class').x}`, true); });
    s += line(`M${c('SmallInteger class').r} ${c('SmallInteger class').cy}H618V${c('Metaclass').cy}H${c('Metaclass').x}`, true);
    { const A = c('Metaclass'), B = c('Metaclass class'); s += line(`M${A.x + 20} ${A.b}V${B.y}`, true, 'loop'); s += line(`M${B.r - 20} ${B.y}V${A.b}`, true, 'loop'); s += `<text class="maploop" x="${A.cx}" y="270">the loop</text>`; }
    Object.keys(NODES).forEach(n => { const k = c(n); s += `<g class="mapn${(n === '3' || n === '1@2') ? ' inst' : ''}" data-n="${esc(n)}" id="map-${slug(n)}" tabindex="0" role="button" aria-label="Ask ${esc(n)} for its class"><rect x="${k.x}" y="${k.y}" width="${k.w}" height="${H}"/><text x="${k.cx}" y="${k.cy}">${esc(n)}</text></g>`; });
    s += '</svg>';
    $('#mapwrap').innerHTML = s;
  })();
  const mapNode = n => $(`.mapn[data-n="${CSS.escape(n)}"]`);
  const clearMap = () => $$('.mapn').forEach(g => g.classList.remove('hl', 'searched'));
  const followMap = n => { const wrap = $('#mapwrap'), svg = $('#metamap'); if (!NODES[n] || wrap.scrollWidth <= wrap.clientWidth) return; wrap.scrollLeft = c(n).cx * svg.clientWidth / 760 - wrap.clientWidth / 2; };
  let trail = ['3'];
  const classVars = ST.newVars();
  const startClassRun = () => { ST.evaluate('v := 3', { vars: classVars, quiet: true }); };
  startClassRun();
  mapNode('3').classList.add('hl');
  $('#sendclass').addEventListener('click', () => {
    const name = ST.evaluate('v := v class', { vars: classVars, quiet: true }).printed;
    clearMap(); const nd = mapNode(name); if (nd) nd.classList.add('hl');
    followMap(name);
    trail.push(name); if (trail.length > 8) trail = ['...'].concat(trail.slice(-7));
    $('#trail').textContent = trail.join(' → ');
  });
  PRED.s6 = () => { $('#sendclass').disabled = false; };
  const st6 = new Stage($('#st6'), {
    src: 'OrderedCollection new', presets: [P('OrderedCollection new'), P('OrderedCollection new add: 3; add: 4; yourself'), P("'hello' class"), P("'hello' class class"), P('Point x: 1 y: 2'), P('Point new')],
    onState: s => { if (!s.chain || !Object.keys(s.floors).length) return; clearMap(); Object.keys(s.floors).forEach(n => { const g = mapNode(n); if (g) g.classList.add(s.floors[n] === 'hit' ? 'hl' : 'searched'); }); if (s.hit) followMap(s.hit); },
    onEvent: e => { if (e.t === 'done' && !e.abandoned) flip('new'); }
  });
  $$('.mapn').forEach(g => {
    const n = g.dataset.n, act = () => { st6.load(n === '1@2' ? '(1@2) class' : n + ' class'); $('#st6').scrollIntoView({ behavior: 'auto', block: 'nearest' }); };
    g.addEventListener('click', act);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });

  /* Section 7: the book's six bytes, and the stage opened at the send of center */
  const lensOn = () => { html.setAttribute('data-lens', 'on'); Store.set('lens', true); };
  if (Store.get('lens', false)) lensOn();
  const center7 = P('(100@100 corner: 200@200) center', { runTo: e => e.t === 'look' && e.sel === 'center' });
  const st7 = new Stage($('#st7'), {
    src: center7.src, lens: 'machine', f: { lens: false }, modelNote: 'This view is a simplified model. The bytes above are the real ones.',
    presets: [center7, P('thisContext receiver'), P('3 + 1.5', { note: 'Same send, a primitive tried first. Its failure just runs the method. <span class="pg">pp. 52, 612</span>' })],
    onEvent: (e, st) => { if (e.t === 'done' && st.src === 'thisContext receiver') flip('frames'); }
  });
  PRED.s7b = () => lensOn();
  (function bytes() {
    const box = $('#bytes');
    const R = [
      { b: 0, label: 'push origin', stack: ['100@100'], pg: 'p. 552', from: 'origin', d: '0000iiii push receiver variable' },
      { b: 1, label: 'push corner', stack: ['100@100', '200@200'], pg: 'p. 553', from: 'corner', d: '0000iiii push receiver variable' },
      { b: 176, label: 'send +', stack: ['300@300'], pg: 'p. 553', send: '+ 200@200', d: '176 arithmetic #0' },
      { b: 119, label: 'push 2', stack: ['300@300', '2'], pg: 'p. 554', d: '119 is 01110 111, slot 7 of the constants' },
      { b: 185, label: 'send /', stack: ['150@150'], pg: 'p. 554', send: '/ 2', d: '185 arithmetic #9' },
      { b: 124, label: 'return top', stack: [], pg: 'pp. 554, 609', ret: '150@150', d: '124 is 0111110 0' }
    ];
    box.innerHTML = `
      <div class="btnrow" style="justify-content:space-between"><span class="source7">center ^ origin + corner / 2 <span class="pg">p. 542</span></span>
        <span class="btnrow" style="gap:0"><button class="btn" id="b-lang" aria-pressed="false">Language</button><button class="btn" id="b-mach" aria-pressed="true" style="border-left:0">Machine</button></span></div>
      <div class="byterow">${R.map((r, i) => `<button class="bytecell" id="byte-${i}" data-i="${i}" aria-label="Byte ${r.b}">${r.b}</button>`).join('')}</div>
      <p class="decode" id="decode" aria-live="polite">Tap a byte for its bits.</p>
      <div class="m7">
        <div class="m7box"><h4>context</h4><dl><dt>sender</dt><dd id="c7-sender">Workspace</dd><dt>IP</dt><dd id="c7-ip">0</dd><dt>SP</dt><dd id="c7-sp">0</dd><dt>method</dt><dd>Rectangle &gt;&gt; center</dd><dt>receiver</dt><dd>100@100 corner: 200@200</dd><dt>origin</dt><dd><span class="ivcell" id="iv-origin">100@100</span></dd><dt>corner</dt><dd><span class="ivcell" id="iv-corner">200@200</span></dd></dl></div>
        <div class="m7box"><h4>stack, top at the bottom</h4><div id="c7-stack" class="stk" style="display:flex;flex-direction:column;gap:3px;min-height:64px"></div><div class="top tiny" id="c7-ret"></div></div>
        <div class="m7box"><h4>who answers this send</h4><div class="mini" id="mini"><div class="minif" id="mini-object">Object</div><div class="minif" id="mini-point">Point</div></div></div>
      </div>
      <p class="cap" id="c7-cap" aria-live="polite" style="min-height:30px">Six bytes. Nothing has run.</p>
      <div class="ctl"><button class="btn" id="b-back">Back</button><button class="btn primary" id="b-step">Step</button></div>
      <div class="slip flyer" id="b-fly" hidden></div>`;
    const predict = $('.predict[data-id="s7"]');
    box.insertBefore(predict, $('.ctl', box));
    let at = 0;
    const fly = $('#b-fly');
    function render() {
      R.forEach((r, i) => { const c = $('#byte-' + i); c.classList.toggle('done', i < at); c.classList.toggle('next', i === at); c.classList.toggle('hl', i === at - 1); });
      const stack = at === 0 ? [] : R[at - 1].stack;
      $('#c7-stack').innerHTML = stack.map(v => `<div class="cell" data-v="${esc(v)}">${esc(v)}</div>`).join('');
      $('#c7-ip').textContent = String(at); $('#c7-sp').textContent = String(stack.length);
      const last = at ? R[at - 1] : null;
      $('#c7-ret').textContent = last && last.ret ? last.ret + ' goes to the sender\'s stack.' : '';
      $('#c7-cap').innerHTML = last ? `${esc(last.b)}: ${esc(last.label)}. <span class="pg">${last.pg}</span>` : 'Six bytes. Nothing has run.';
      $('#b-back').disabled = at === 0;
      $('#b-step').disabled = at >= R.length || (at === 2 && guesses.s7 === undefined);
      $('#mini-point').classList.toggle('hl', !!(last && last.send));
      if (at >= 3) revealPred('s7');
    }
    async function step() {
      if (at >= R.length || (at === 2 && guesses.s7 === undefined)) return;
      const r = R[at];
      $('#b-step').disabled = true;
      if (r.from) {
        const f = flyEl(box, fly, $('#iv-' + r.from), $('#c7-stack'), SLIPGLYPH + esc(r.stack[r.stack.length - 1]), 320);
        if (f && f.done) await f.done;
      } else if (r.send) {
        $('#mini-point').classList.remove('hl');
        const f = flyEl(box, fly, $('#c7-stack'), $('#mini-point'), SLIPGLYPH + esc(r.send), 320);
        if (f && f.done) await f.done;
        $('#mini-point').classList.add('hl');
        if (!RM()) await sleep(220);
        const g = flyEl(box, fly, $('#mini-point'), $('#c7-stack'), SLIPGLYPH + esc(r.stack[0]), 320);
        if (g && g.done) await g.done;
      } else if (r.ret) {
        const f = flyEl(box, fly, $('#c7-stack'), $('#c7-sender'), SLIPGLYPH + esc(r.ret), 320);
        if (f && f.done) await f.done;
      }
      fly.hidden = true;
      at++; render();
      applyHighlight();
    }
    $('#b-step').addEventListener('click', step);
    $('#b-back').addEventListener('click', () => { if (at > 0) { at--; render(); } });
    R.forEach((r, i) => {
      const show = () => { $('#decode').innerHTML = `${esc(r.d)} <span class="pg">worked out from p.596</span>`; };
      const c = $('#byte-' + i); c.addEventListener('mouseenter', show); c.addEventListener('click', show); c.addEventListener('focus', show);
    });
    const lensTo = l => {
      const mach = l === 'machine';
      $('#b-lang').setAttribute('aria-pressed', !mach); $('#b-mach').setAttribute('aria-pressed', mach);
      $$('.byterow,#decode,.m7,#c7-cap,.ctl,.predict', box).forEach(x => { x.hidden = !mach; });
      st7.setLens(mach ? 'machine' : 'language');
      if (!mach) st7.load(center7.src, center7);
    };
    $('#b-lang').addEventListener('click', () => lensTo('language'));
    $('#b-mach').addEventListener('click', () => lensTo('machine'));
    PRED.s7 = () => { lensOn(); render(); };
    render();
  })();

  /* Section 8: sort each card, then watch the stack break up */
  (function cards() {
    const CARDS = [
      ['f1', 'x := 3', false, 'Stores a value. No message is sent.', 'p. 549'], ['f2', '3 + 4', true, 'A send, or a shortcut when both are SmallIntegers.', 'pp. 618-619'],
      ['f3', '^ x', false, 'Returns a value. No message is sent.', 'p. 544'], ['f4', 'true ifTrue: [...]', true, 'Means a send, and compiles to a jump.', 'p. 550'],
      ['f5', '[...] value', true, 'A send that reaches a primitive.', 'pp. 614, 619'],
      ['f6', '#(3 1 4) do: [...]', true, 'A send. The loop is the Array running your block.', 'p. 136']
    ];
    const box = $('#flips');
    const finish = () => { if (CARDS.every(k => guesses[k[0]] !== undefined)) $('#s8done').hidden = false; };
    CARDS.forEach(([id, code, sends, say, pg]) => {
      const answer = sends ? 'Message' : 'Not a message';
      qOf[id] = { q: code, right: answer };
      const el = document.createElement('div'); el.className = 'flipcard'; el.id = id;
      el.innerHTML = `<code>${esc(code)}</code><div class="btnrow"><button class="btn sm" id="${id}-yes">Message</button><button class="btn sm" id="${id}-no">Not a message</button></div><span class="fl" hidden>${esc(say)} <span class="pg">${pg}</span></span>`;
      const show = () => { el.classList.add(sends ? 'sends' : 'nosend'); $('.fl', el).hidden = false; $('.btnrow', el).hidden = true; };
      const pick = v => { guesses[id] = v; Store.set('guesses', guesses); renderGuesses(); show(); finish(); };
      $(`#${id}-yes`, el).addEventListener('click', () => pick('Message'));
      $(`#${id}-no`, el).addEventListener('click', () => pick('Not a message'));
      if (guesses[id] !== undefined) show();
      box.appendChild(el);
    });
    finish(); renderGuesses();
  })();
  /* Section 8: the stack that breaks up */
  (function stack() {
    const box = $('#stackbox'); const btn = $('#downbtn');
    const words = ['File', 'Display', 'Transcript', 'Compiler', 'Debugger', 'Process', "'hello'", '3'];
    box.innerHTML = `<div class="field">${words.map(w => `<span>${w}</span>`).join('')}</div><div class="floorband">primitives</div><div class="hwband">Hardware</div>`;
    const names = ['App', 'Language', 'Operating system'], ROWS = 8, H0 = 330 - 36 - 4;
    const LH = Math.floor(H0 / 3), RH = LH / ROWS;
    const layers = names.map((n, i) => {
      const l = document.createElement('div'); l.className = 'layer l' + i; l.style.top = (i * LH) + 'px'; l.style.height = LH + 'px';
      for (let r = 0; r < ROWS; r++) { const w = document.createElement('div'); w.className = 'rw'; w.style.top = (r * RH) + 'px'; w.style.height = (Math.ceil(RH) + 1) + 'px'; l.appendChild(w); }
      const lb = document.createElement('div'); lb.className = 'lb'; lb.textContent = n; l.appendChild(lb);
      box.appendChild(l); return l;
    });
    let down = false, busy = false;
    btn.addEventListener('click', async () => {
      if (busy) return; busy = true;
      const fast = RM();
      if (!down) {
        for (const l of layers) {
          l.classList.add('broken');
          const rows = $$('.rw', l);
          for (let r = 0; r < rows.length; r++) { rows[r].className = 'rw dith'; if (!fast) await sleep(32); }
          for (let r = 0; r < rows.length; r++) { rows[r].className = 'rw gone'; if (!fast) await sleep(32); }
        }
        btn.textContent = 'Back to the usual stack';
      } else {
        for (const l of layers.slice().reverse()) {
          const rows = $$('.rw', l).reverse();
          for (let r = 0; r < rows.length; r++) { rows[r].className = 'rw dith'; if (!fast) await sleep(24); }
          for (let r = 0; r < rows.length; r++) { rows[r].className = 'rw'; if (!fast) await sleep(24); }
          l.classList.remove('broken');
        }
        btn.textContent = 'Send it all the way down';
      }
      down = !down; busy = false;
    });
  })();

  /* Section 9: six habits */
  const BECK = '<a href="https://stephaneducasse.github.io/freebooks/BestSmalltalkPractices/Smalltalkbestpracticepatterns-BeckKent--1997--PrenticeHall--9780132852104.pdf">Beck 1997</a>';
  const ING20 = '<a href="https://smalltalkzoo.computerhistory.org/papers/EvolutionOfSmalltalk.pdf">Ingalls 2020</a>';
  const HABITS = [
    { t: 'Write the call first', p: `Send a message that doesn't exist yet and let the system stop you. Then write the method with real objects in front of you. This is common Smalltalk practice, and we found no single source for it.`, presets: [P("Object subclass: #Receipt instanceVariableNames: 'items'. Receipt new total")], extra: writeSteps },
    { t: 'Fix the running thing', p: `Non-technical users found solid black selections scary, so Ingalls changed two lines and every selection became an outline. ${ING20} The highlight style on this page comes from a method too. Change it and press Step.`, presets: [P('3 + 4')], extra: highlightEditor },
    { t: 'Ask the object', p: `A type check usually means a message is missing. Give each class its own method and you can delete the check. ${BECK}`, presets: [P("x := 'hello'. (x isKindOf: String) ifTrue: ['text'] ifFalse: [(x isKindOf: Integer) ifTrue: ['whole'] ifFalse: ['other']]"), P("x := 'hello'. x describe"), P('x := 3. x describe'), P('x := 2.5. x describe')], extra: installDescribe },
    { t: 'Name the intent', p: `Readers understand code by chunking details into bigger pieces, and named steps give them those pieces. The cost is that the real work can be harder to find at first. ${BECK}`, noStage: true, extra: receiptWall },
    { t: 'Hand over a block', p: `When two actions must pair up, keep them in one method and take a block for the middle, so callers can't forget the second half. ${BECK}`, presets: [P('d := Door new. d openDuring: [d isOpen]'), P('d isOpen')] },
    { t: 'Ask both sides', p: `When the answer depends on two kinds of object, send a second message to the argument. Each side knows its own kind. ${BECK} Press Step until <code>addInteger:</code> and you'll see the question go to the argument.`, presets: [P('3 + 1.5')] }
  ];
  const st9 = new Stage($('#st9'), { src: '3 + 4', presets: [P('3 + 4')] });
  function writeSteps(box) {
    box.innerHTML = '<ol class="steps"><li>Press Play. <code>Receipt new total</code> stops at a notifier.</li><li>Press Create, and write the method. Fill in gives a start.</li><li>Press Accept and Proceed. The answer arrives with no restart.</li></ol>';
  }
  function highlightEditor(box) {
    box.innerHTML = `<p class="m tiny">Highlight class &gt;&gt; style</p><textarea class="src" id="hl-src" aria-label="Source of Highlight class style" spellcheck="false" style="min-height:70px">${esc(ST.methodSource('Highlight class', 'style'))}</textarea>
      <div class="btnrow"><button class="btn mono" id="hl-out">#outline</button><button class="btn mono" id="hl-dit">#dither</button><button class="btn mono" id="hl-inv">#inverted</button><button class="btn" id="hl-accept">Accept</button></div><p class="tiny" id="hl-msg" hidden></p>`;
    const ta = $('#hl-src'), msg = $('#hl-msg');
    ta.addEventListener('input', () => { msg.hidden = true; });
    const accept = () => {
      const r = ST.compile('Highlight class', ta.value, true);
      if (r.error) { msg.textContent = r.error; msg.hidden = false; return; }
      saveImage();
      const s = applyHighlight();
      if (s === 'inverted' || s === 'outline' || s === 'dither') msg.hidden = true;
      else { msg.textContent = 'The page knows #inverted, #outline and #dither.'; msg.hidden = false; }
    };
    $('#hl-accept').addEventListener('click', accept);
    [['#hl-out', 'outline'], ['#hl-dit', 'dither'], ['#hl-inv', 'inverted']].forEach(([s, v]) => $(s).addEventListener('click', () => { ta.value = 'style\n  ^ #' + v; accept(); }));
  }
  function installDescribe(box) {
    box.innerHTML = `<p class="m tiny">String &gt;&gt; describe ^ 'text'<br>Integer &gt;&gt; describe ^ 'whole'<br>Object &gt;&gt; describe ^ 'other'</p><div class="btnrow"><button class="btn" id="ins-desc">Install the three methods</button></div>`;
    $('#ins-desc').addEventListener('click', e => {
      ST.compile('String', "describe\n  ^ 'text'", true); ST.compile('Integer', "describe\n  ^ 'whole'", true); ST.compile('Object', "describe\n  ^ 'other'", true); saveImage();
      e.currentTarget.textContent = 'Installed'; e.currentTarget.disabled = true;
      st9.load('x := 3. x describe', HABITS[2].presets[1]);
    });
    if (ST.selectors('String').includes('describe')) { const b = $('#ins-desc'); b.textContent = 'Installed'; b.disabled = true; }
  }
  /* A real long method whose groups slide shut into sends. */
  function receiptWall(box) {
    const GROUPS = [
      ['self printHeader', ['stream nextPutAll: shopName.', 'stream cr.', 'stream print: date.', 'stream cr.', 'stream cr.']],
      ['self printItems', ['items do: [:each |', '  stream nextPutAll: each name.', '  stream tab.', '  stream print: each price.', '  stream cr].']],
      ['self printTotal', ["stream nextPutAll: 'Total'.", 'stream tab.', 'stream print: self total.', 'stream cr']]
    ];
    box.innerHTML = `<div class="receipt" id="receipt"><div class="rpattern">printReceipt</div>${GROUPS.map(([n, l], g) => `<div class="rgroup" data-g="${g}"><button class="rname" id="rname-${g}" aria-expanded="false" hidden>${esc(n)}<small>${l.length} lines</small></button><pre class="rlines">${esc(l.join('\n'))}</pre></div>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="name-these">Name these</button><span class="tiny m" id="receipt-cap">14 lines, no names</span></div>`;
    let named = false;
    const shut = pre => { pre.hidden = true; pre.style.height = ''; };
    $('#name-these').addEventListener('click', async e => {
      const btn = e.currentTarget;
      if (!named) {
        named = true; btn.disabled = true;
        for (const g of $$('.rgroup', box)) {
          const pre = $('.rlines', g), name = $('.rname', g);
          if (!RM() && pre.animate) { await pre.animate([{ height: pre.offsetHeight + 'px' }, { height: '0px' }], { duration: 320, easing: 'steps(8)' }).finished.catch(() => {}); }
          shut(pre); name.hidden = false;
        }
        btn.disabled = false; btn.textContent = 'Show every line';
        $('#receipt-cap').textContent = '14 lines, 3 names';
      } else {
        named = false; btn.textContent = 'Name these'; $('#receipt-cap').textContent = '14 lines, no names';
        $$('.rgroup', box).forEach(g => { $('.rlines', g).hidden = false; const n = $('.rname', g); n.hidden = true; n.setAttribute('aria-expanded', 'false'); });
      }
    });
    $$('.rname', box).forEach(n => n.addEventListener('click', () => { const pre = n.nextElementSibling; pre.hidden = !pre.hidden; n.setAttribute('aria-expanded', !pre.hidden); }));
  }
  (function habits() {
    const list = $('#habits');
    const FIRST = 3;
    const moreBtn = document.createElement('button'); moreBtn.className = 'habit morehabits'; moreBtn.id = 'habit-more'; moreBtn.textContent = 'Three more';
    HABITS.forEach((h, i) => {
      const b = document.createElement('button'); b.className = 'habit'; b.id = 'habit-' + i; b.setAttribute('role', 'tab'); b.textContent = (i + 1) + '. ' + h.t;
      b.hidden = i >= FIRST;
      b.addEventListener('click', () => pick(i)); list.appendChild(b);
    });
    list.appendChild(moreBtn);
    moreBtn.addEventListener('click', () => { $$('.habit', list).forEach(b => { b.hidden = false; }); moreBtn.hidden = true; const n = $('#habit-' + FIRST); if (n) n.focus({ preventScroll: true }); });
    function pick(i) {
      $$('.habit', list).forEach(b => { const k = +b.id.split('-')[1]; b.classList.toggle('hl', k === i); if (b !== moreBtn) b.setAttribute('aria-selected', k === i); });
      const h = HABITS[i];
      $('#habitcopy').innerHTML = `<h3>${esc(h.t)}</h3><p>${h.p}</p>`;
      const ex = $('#habitextra'); ex.innerHTML = ''; ex.hidden = !h.extra; if (h.extra) h.extra(ex);
      $('#habstagewin').hidden = !!h.noStage;
      if (!h.noStage) st9.setPresets(h.presets, true);
    }
    pick(0);
  })();

  /* ---------- chips: expressions in the prose load into their section's stage ---------- */
  $$('.chip').forEach(ch => ch.addEventListener('click', () => {
    const st = STAGES.find(s => s.id === ch.dataset.st); if (!st || st.locked) return;
    const src = ch.dataset.src, pre = (st.presets || []).find(p => p.src === src);
    st.load(src, pre || (st === st1 ? { noLabels: true } : {}));
    const r = st.root.getBoundingClientRect();
    if (r.top > innerHeight - 160 || r.bottom < 60) st.root.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' });
  }));

  /* ---------- stories ---------- */
  const STORIES = [['Look at the gaps', 'gaps'], ['The bet', 'bet'], ['First answer', 'first'], ['One word', 'word'], ['Children', 'kids'], ['Offspring', 'off']];
  $('#storypick').addEventListener('click', e => showMenu(e.currentTarget, STORIES.map(([n, k]) => ({ label: n, act: () => { $$('.story').forEach(s => { s.hidden = s.id !== 'story-' + k; }); $('#storypick').textContent = 'Stories: ' + n + ' ▾'; if (k === 'gaps') drawGaps(); } }))));
  let stStory = null;
  $('#try6').addEventListener('click', () => { if (!stStory) stStory = new Stage($('#stStory'), { src: '6 factorial', presets: [P('6 factorial')] }); else stStory.load('6 factorial'); stStory.q('#stStory-step').focus({ preventScroll: true }); });
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const GAPN = [[40, 30], [120, 22], [205, 34], [285, 26], [62, 92], [148, 84], [232, 98], [292, 104], [30, 160], [112, 170], [192, 156], [272, 168]];
  const GAPL = [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [4, 8], [5, 9], [6, 10], [7, 11], [8, 9], [9, 10], [10, 11], [1, 6], [5, 10]];
  function drawGaps() {
    const cv = $('#gaps'), ctx = cv.getContext('2d'), W = cv.width, H2 = cv.height;
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink').trim(), paper = cs.getPropertyValue('--paper').trim();
    const t = (+$('#gapslider').value) / 100;
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H2); ctx.fillStyle = ink;
    const plot = (x, y, dens) => { if ((BAYER[y & 3][x & 3] + 0.5) / 16 < dens) ctx.fillRect(x, y, 1, 1); };
    GAPL.forEach(([a, b]) => {
      const [x0, y0] = GAPN[a], [x1, y1] = GAPN[b]; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) { plot(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 0.12 + t * 0.95); }
    });
    if (t > 0.02) GAPL.forEach(([a, b], i) => {
      const [x0, y0] = GAPN[a], [x1, y1] = GAPN[b], f = (t * 2.4 + i * 0.23) % 1;
      const x = Math.round(x0 + (x1 - x0) * f), y = Math.round(y0 + (y1 - y0) * f), sw = Math.round(2 + t * 3);
      ctx.fillStyle = paper; ctx.fillRect(x - sw - 1, y - sw - 1, sw * 2 + 3, sw * 2 + 1); ctx.fillStyle = ink;
      ctx.fillRect(x - sw, y - sw, sw * 2 + 1, 1); ctx.fillRect(x - sw, y + sw - 1, sw * 2 + 1, 1); ctx.fillRect(x - sw, y - sw, 1, sw * 2); ctx.fillRect(x + sw, y - sw, 1, sw * 2);
    });
    GAPN.forEach(([x, y]) => {
      const R2 = Math.round(11 - t * 6);
      ctx.fillStyle = paper; ctx.fillRect(x - R2, y - R2, R2 * 2, R2 * 2); ctx.fillStyle = ink;
      for (let i = x - R2; i < x + R2; i++) for (let j = y - R2; j < y + R2; j++) {
        const edge = i === x - R2 || i === x + R2 - 1 || j === y - R2 || j === y + R2 - 1;
        if (edge) { if (t < 0.9 || (i + j) % 2 === 0) ctx.fillRect(i, j, 1, 1); } else plot(i, j, 1.05 - t * 1.1);
      }
    });
  }
  $('#gapslider').addEventListener('input', drawGaps);
  drawGaps();

  /* ---------- Bruner's glasses ---------- */
  (function glasses() {
    const svg = $('#glasses');
    let water = 0, card = false, speech = '';
    const WIDE = { x: 50, w: 100, top: 110, bot: 190, full: 60 }, TALL = { x: 240, w: 50, top: 40, bot: 190, full: 120 };
    function draw() {
      const wideH = WIDE.full * (1 - water), tallH = TALL.full * water;
      const glass = g => `<path d="M${g.x} ${g.top}V${g.bot}H${g.x + g.w}V${g.top}" fill="none" style="stroke:var(--ink)" stroke-width="3" shape-rendering="crispEdges"/>`;
      let s = '';
      s += `<rect x="${WIDE.x}" y="${WIDE.bot - wideH}" width="${WIDE.w}" height="${wideH}" fill="url(#svgWater)" shape-rendering="crispEdges"/>`;
      s += `<rect x="${TALL.x}" y="${TALL.bot - tallH}" width="${TALL.w}" height="${tallH}" fill="url(#svgWater)" shape-rendering="crispEdges"/>`;
      s += glass(WIDE) + glass(TALL);
      if (card) s += `<rect x="222" y="26" width="86" height="172" style="fill:var(--paper);stroke:var(--ink)" stroke-width="3" shape-rendering="crispEdges"/><rect x="230" y="34" width="70" height="156" fill="url(#svgHatch)" shape-rendering="crispEdges"/>`;
      s += `<rect x="0" y="198" width="420" height="3" style="fill:var(--ink)"/>`;
      s += `<text x="20" y="-10">${esc(speech)}</text>`;
      svg.innerHTML = s;
    }
    draw();
    const set = (pour, cover, lift) => { $('#gl-pour').disabled = !pour; $('#gl-cover').disabled = !cover; $('#gl-lift').disabled = !lift; };
    $('#gl-pour').addEventListener('click', async () => {
      set(false, false, false); card = false; speech = ''; water = 0; draw();
      if (RM()) { water = 1; } else for (let i = 1; i <= 8; i++) { water = i / 8; draw(); await sleep(60); }
      speech = 'More water.'; draw(); set(false, true, false);
    });
    $('#gl-cover').addEventListener('click', () => { card = true; speech = 'The same. Where would it go?'; draw(); set(false, false, true); });
    $('#gl-lift').addEventListener('click', () => { card = false; speech = 'More water.'; draw(); set(true, false, false); });
  })();

  /* ---------- menu bar ---------- */
  const SECTIONS = [['hero', 'Smalltalk, One Message at a Time'], ['s1', '1 Ask'], ['s2', '2 It decides'], ['s3', '3 Nobody home'], ['s4', '4 No if, no for'], ['s5', '5 Who is self'], ['s6', '6 Classes answer too'], ['s7', '7 Below the objects'], ['s8', '8 The short list'], ['s9', '9 Wield it'], ['guesses', 'Your guesses'], ['tomorrow', 'Come back tomorrow'], ['stories', 'Stories'], ['short', 'Where it falls short'], ['why', 'The learning research behind this page'], ['notes', 'What this little Smalltalk leaves out'], ['sources', 'Sources and notes']];
  const cm = $('#contentsmenu'), cb = $('#mb-contents');
  const go = id => { const t = document.getElementById(id); if (!t) return; if (t.tagName === 'DETAILS') t.open = true; t.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); };
  const place = Store.get('place', null);
  function fillContents() {
    cm.innerHTML = '';
    const items = (place && place !== 'hero') ? [['__back', 'Back to where you stopped']].concat(SECTIONS) : SECTIONS;
    items.forEach(([id, n]) => { const b = document.createElement('button'); b.id = 'menu-' + id; b.textContent = n; b.addEventListener('click', () => { closeC(); go(id === '__back' ? place : id); }); cm.appendChild(b); });
  }
  const closeC = () => { cm.hidden = true; cb.setAttribute('aria-expanded', 'false'); };
  cb.addEventListener('click', () => { if (cm.hidden) { fillContents(); cm.hidden = false; cb.setAttribute('aria-expanded', 'true'); const f = cm.firstChild; if (f) f.focus({ preventScroll: true }); } else closeC(); });
  document.addEventListener('pointerdown', e => { if (!cm.hidden && !cm.contains(e.target) && e.target !== cb) closeC(); });
  cm.addEventListener('keydown', e => {
    const list = $$('button', cm), at = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { list[(at + 1) % list.length].focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { list[(at - 1 + list.length) % list.length].focus(); e.preventDefault(); }
    if (e.key === 'Escape') { closeC(); cb.focus(); }
  });
  $('#mb-reverse').addEventListener('click', () => {
    const cur = html.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next); Store.set('theme', next);
    drawGaps();
  });
  $('#mb-reset').addEventListener('click', () => {
    ST.boot(); Store.del('image');
    html.setAttribute('data-highlight', 'inverted');
    STAGES.forEach(s => { s.resetVars(); s.towerKey = ''; s.load(s.src, s.loadOpts); });
    const ta = $('#hl-src'); if (ta) ta.value = ST.methodSource('Highlight class', 'style');
    const ins = $('#ins-desc'); if (ins) { ins.disabled = false; ins.textContent = 'Install the three methods'; }
    startClassRun();
    toast('Your methods are undone. Guesses stay.');
  });
  $('#forget').addEventListener('click', () => { ['guesses', 'ledger', 'puzzle', 'proceeded', 'hero', 'lens'].forEach(k => Store.del(k)); location.reload(); });

  /* ---------- where the reader is: records only, never starts anything ---------- */
  const seen = new IntersectionObserver(en => en.forEach(e => {
    if (e.isIntersecting) Store.set('place', e.target.id);
  }), { rootMargin: '-40% 0px -50% 0px' });
  ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'].forEach(id => seen.observe(document.getElementById(id)));
  $('#skip6').addEventListener('click', e => { e.preventDefault(); go('s7'); });

  /* ---------- a real gap before the five questions ---------- */
  (function comeBack() {
    const DAY = 864e5, first = Store.get('first', null), now = Date.now();
    if (first === null) Store.set('first', now);
    const gone = first !== null && now - first >= DAY;
    if (Store.ok && !gone) {
      $('#quiz').hidden = true; $('#quizwait').hidden = false;
      $('#quiznow').addEventListener('click', () => { $('#quiz').hidden = false; $('#quizwait').hidden = true; });
    }
    if (gone) {
      const m = /^s(\d)$/.exec(place || '');
      $('#welcome').hidden = false;
      $('#welcome-text').textContent = m ? `Welcome back. Five questions, then pick up at section ${m[1]}.` : 'Welcome back. Five questions wait below.';
      $('#welcome-quiz').addEventListener('click', () => go('tomorrow'));
      $('#welcome-place').hidden = !m;
      $('#welcome-place').addEventListener('click', () => go(place));
    }
  })();

  /* ---------- restore earlier guesses, without motion ---------- */
  $$('.predict').forEach(p => p._settle());
  Object.keys(guesses).forEach(k => { if (PRED[k]) PRED[k](true); });
  st3.load(shout3.src, shout3);
  if (st3.locked && guesses.s3 !== undefined) st3.setLocked(false);

  /* every remaining control gets a stable id */
  let n = 0;
  $$('button:not([id]),input:not([id]),textarea:not([id]),select:not([id])').forEach(b => { b.id = 'ctl-' + (++n); });
  window.addEventListener('resize', () => STAGES.forEach(s => s.drawLinks()));
})();
