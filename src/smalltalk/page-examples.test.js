/* Runs every expression the page offers (chips, stage presets, hero and section 2 sends) through the engine.
   Each must parse and finish without a notifier, unless it's one the page means to stop. Key answers are checked. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ST } from './engine.js';
const here = import.meta.dirname;
const body = readFileSync(here + '/../pages/smalltalk/index.astro', 'utf8');
const app = readFileSync(here + '/app.js', 'utf8');
let pass = 0, fail = 0;
const failures = [];
const ok = (name, c, info) => { if (c) pass++; else { fail++; failures.push(info === undefined ? name : `${name} => ${info}`); } };
const unhtml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const OPPOSITES = (/const OPPOSITES = '([^']*)'/.exec(app) || [])[1];
ok('section 2 setup found', !!OPPOSITES);

const srcs = new Set();
for (const m of body.matchAll(/data-src="([^"]*)"/g)) srcs.add(unhtml(m[1]));
for (const m of app.matchAll(/P\("((?:[^"\\]|\\.)*)"/g)) srcs.add(m[1].replace(/\\'/g, "'"));
for (const m of app.matchAll(/P\('((?:[^'\\]|\\.)*)'/g)) srcs.add(m[1]);
for (const m of app.matchAll(/src: "((?:[^"\\]|\\.)*)"/g)) srcs.add(m[1]);
for (const m of app.matchAll(/src: '((?:[^'\\]|\\.)*)'/g)) srcs.add(m[1]);
for (const m of app.matchAll(/\.load\('((?:[^'\\]|\\.)*)'/g)) srcs.add(m[1]);
["'hello'", '#(3 1 4 1 5)', '#(3 1 4 1 5) asSet', 'opposites'].forEach(r => srcs.add(r + ' size'));
srcs.add("Transcript show: 'Hello, world'"); srcs.add("'hello' asUppercase");
/* the page means these to stop at a notifier */
const STOPS = { "'hello' shout": 'String doesNotUnderstand: shout', '#hello shout': 'Symbol doesNotUnderstand: shout', '3 double': 'SmallInteger doesNotUnderstand: double',
  '2.5 double': 'Float doesNotUnderstand: double', "3 ifTrue: ['yes']": 'SmallInteger doesNotUnderstand: ifTrue:', 'x := 3. x describe': 'SmallInteger doesNotUnderstand: describe',
  'x := 2.5. x describe': 'Float doesNotUnderstand: describe', "x := 'hello'. x describe": 'String doesNotUnderstand: describe' };
const isStop = s => s in STOPS || /Receipt new total/.test(s);
/* presets that rely on an earlier one in the same stage */
const BEFORE = { 'd isOpen': 'd := Door new. d openDuring: [d isOpen]' };
const run = s => { ST.boot(); const vars = ST.newVars(); ST.evaluate(OPPOSITES, { vars, quiet: true }); if (BEFORE[s]) ST.evaluate(BEFORE[s], { vars, quiet: true }); return ST.evaluate(s, { vars }); };

ok('found the page\'s expressions', srcs.size >= 60, srcs.size);
for (const s of srcs) {
  let r; try { r = run(s); } catch (e) { ok(s, false, 'threw ' + e.message); continue; }
  ok('parses: ' + s, !r.parseError);
  if (isStop(s)) ok('stops: ' + s, r.notifiers.length > 0 && (!(s in STOPS) || r.notifiers[0].title === STOPS[s]), r.notifiers[0] && r.notifiers[0].title);
  else ok('runs: ' + s, !r.notifiers.length && !r.abandoned && r.printed !== null, r.notifiers[0] && r.notifiers[0].title);
}

/* the answers the copy promises */
const WANT = {
  "Transcript show: 'Hello, world'": 'a TextCollector', "'hello' asUppercase": "'HELLO'",
  "'hello' size": '5', "'hello' , ' world'": "'hello world'", "'hello' copyReplaceAll: 'l' with: 'L'": "'heLLo'", '2 + 3 * 4': '20', '2 + (3 * 4)': '14',
  "'hello' size + 'world' size": '10', "'hello' , ' world' copyReplaceAll: 'o' with: '0'": "'hell0 w0rld'", '3 squared + 1 max: 20': '20',
  '#(3 1 4 1 5) size': '5', '#(3 1 4 1 5) asSet size': '4', 'opposites size': '3', 'opposites': 'Dictionary (hot->cold push->pull stop->go )',
  "['hello' asUppercase] value": "'HELLO'", '1 to: 3 do: [:i | Transcript print: i; cr]': '1', '#(3 1 4 1 5) collect: [:x | x * x]': '(9 1 16 1 25 )', '#(3 1 4 1 5) select: [:x | x > 2]': '(3 4 5 )',
  '#(3 1 4 1 5) inject: 0 into: [:sum :x | sum + x]': '14', '#(3 1 4 1 5) detect: [:x | x > 3] ifNone: [nil]': '4', "'hello' select: [:c | c isVowel]": "'eo'",
  "'hello' collect: [:c | c asUppercase]": "'HELLO'", '#(3 1 4 1 5) do: [:x | Transcript print: x; cr]': '(3 1 4 1 5 )', 'x := 0. [x < 3] whileTrue: [x := x + 1]. x': '3',
  'OrderedCollection new': 'OrderedCollection ()', 'OrderedCollection new add: 3; add: 4; yourself': 'OrderedCollection (3 4 )', "'hello' class": 'String', "'hello' class class": 'String class',
  'example4 result1': '4', 'example4 result2': '4', 'example4 result3': '2', '(100@100 corner: 200@200) center': '150@150', '#(3 1 4) collect: [:x | x * 2]': '(6 2 8 )', '6 factorial': '720'
};
for (const [s, want] of Object.entries(WANT)) { const r = run(s); ok('answer: ' + s, r.printed === want, r.printed); }
ok('every promised answer is on the page', Object.keys(WANT).filter(s => !srcs.has(s) && s !== '#(3 1 4) collect: [:x | x * 2]').length === 0, Object.keys(WANT).filter(s => !srcs.has(s)).join(' | '));

{ const r = run('#(3 1 4 1 5) asSet'); ok('Set prints in hash order', r.printed === 'Set (1 3 4 5 )', r.printed); }
/* the hero writes Hello, world into the Transcript */
{ ST.boot(); ST.evaluate("Transcript show: 'Hello, world'", { quiet: true, vars: ST.newVars() }); ok('hero transcript', ST.transcript === 'Hello, world', ST.transcript); }
{ ST.boot(); run('#(3 1 4 1 5) do: [:x | Transcript print: x; cr]'); ok('do: transcript', ST.transcript === '3\n1\n4\n1\n5\n', JSON.stringify(ST.transcript)); }

/* section 2: four receivers, three methods; Dictionary uses Set's */
{ const found = {};
  ["'hello'", '#(3 1 4 1 5)', '#(3 1 4 1 5) asSet', 'opposites'].forEach(t => { const r = run(t + ' size'); found[t] = r.trace.filter(e => e.t === 'look' && e.hit && e.sel === 'size' && e.depth === 1).map(e => e.cls)[0]; });
  ok('section 2 methods', JSON.stringify(found) === JSON.stringify({ "'hello'": 'String', '#(3 1 4 1 5)': 'ArrayedCollection', '#(3 1 4 1 5) asSet': 'Set', opposites: 'Set' }), JSON.stringify(found)); }

/* section 3: write shout, proceed, and the Symbol finds it */
{ ST.boot(); const vars = ST.newVars();
  const r = ST.evaluate("'hello' shout", { vars, onNotifier: () => { ST.compile('String', "shout\n  ^ self asUppercase , '!'", true); return 'proceed'; } });
  ok('shout proceeds', r.printed === "'HELLO!'", r.printed);
  ok('symbol shout', ST.evaluate('#hello shout', { vars }).printed === "'HELLO!'");
  const r2 = ST.evaluate('2.5 double', { vars, onNotifier: () => { ST.compile('Number', 'double\n  ^ self * 2', true); return 'proceed'; } });
  ok('2.5 double on Number', r2.printed === '5.0', r2.printed); ok('3 double on Number', ST.evaluate('3 double', { vars }).printed === '6'); }

/* section 4 puzzle: the two methods, both ways round */
{ ST.boot();
  const ov = (t, f) => ({ 'True>>ifTrue:': ST.detached('True', 'ifTrue: aBlock\n  ' + t), 'False>>ifTrue:': ST.detached('False', 'ifTrue: aBlock\n  ' + f) });
  ok('puzzle right', ST.evaluate("3 > 0 ifTrue: ['yes']", { vars: ST.newVars(), overrides: ov('^ aBlock value', '^ nil') }).printed === "'yes'");
  ok('puzzle right, false', ST.evaluate("3 < 0 ifTrue: ['yes']", { vars: ST.newVars(), overrides: ov('^ aBlock value', '^ nil') }).printed === 'nil');
  ok('puzzle backwards', ST.evaluate("3 > 0 ifTrue: ['yes']", { vars: ST.newVars(), overrides: ov('^ nil', '^ aBlock value') }).printed === 'nil'); }

/* section 9: describe, once installed */
{ ST.boot(); ST.compile('String', "describe\n  ^ 'text'"); ST.compile('Integer', "describe\n  ^ 'whole'"); ST.compile('Object', "describe\n  ^ 'other'");
  ok('describe', ['x := \'hello\'. x describe', 'x := 3. x describe', 'x := 2.5. x describe'].map(s => ST.evaluate(s, { vars: ST.newVars() }).printed).join(' ') === "'text' 'whole' 'other'"); }

/* section 6: the class loop */
{ ST.boot(); const vars = ST.newVars(); ST.evaluate('v := 3', { vars, quiet: true }); const seen = [];
  for (let i = 0; i < 5; i++) seen.push(ST.evaluate('v := v class', { vars, quiet: true }).printed);
  ok('class loop', seen.join(' ') === 'SmallInteger SmallInteger class Metaclass Metaclass class Metaclass', seen.join(' ')); }


test('every expression on the page runs and answers right', () => {
  assert.equal(fail, 0, `${fail} of ${pass + fail} checks failed:\n${failures.join('\n')}`);
});
