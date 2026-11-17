/* The mini Smalltalk: tokenizer, parser, image, and a generator evaluator that yields one event per step. */
export const ST = (function () {
  'use strict';
  const FUEL = 200000, MAXD = 500;
  const BIN = '+-*/\\<>=@%&|~,';
  const PARSE_MSG = "I can't read this. Check near the marker.";

  class ParseError extends Error {
    constructor(pos, len) { super(PARSE_MSG); this.pos = pos; this.len = len || 1; }
  }

  /* ---------- tokenizer ---------- */
  function tokenize(src) {
    const toks = []; let i = 0; const n = src.length;
    const isD = c => c >= '0' && c <= '9';
    const isA = c => /[A-Za-z_]/.test(c);
    const isAN = c => /[A-Za-z0-9_]/.test(c);
    const push = (k, v, s) => toks.push({ k, v, s, e: i });
    const skipBlank = () => {
      while (i < n) {
        if (/\s/.test(src[i])) { i++; continue; }
        if (src[i] === '"') { const j = src.indexOf('"', i + 1); if (j < 0) throw new ParseError(i); i = j + 1; continue; }
        break;
      }
    };
    const readString = () => {
      const s = i; let v = ''; i++;
      for (;;) {
        if (i >= n) throw new ParseError(s);
        if (src[i] === "'") { if (src[i + 1] === "'") { v += "'"; i += 2; continue; } i++; break; }
        v += src[i++];
      }
      return v;
    };
    const readNumber = () => {
      const s = i; i++; while (i < n && isD(src[i])) i++;
      let r;
      if (src[i] === '.' && i + 1 < n && isD(src[i + 1])) {
        i++; while (i < n && isD(src[i])) i++;
        r = { lk: 'float', v: parseFloat(src.slice(s, i)) };
      } else r = { lk: 'int', v: parseInt(src.slice(s, i), 10) };
      if (i < n && isA(src[i])) throw new ParseError(s, i - s + 1);
      return r;
    };
    const readChar = () => { const s = i; if (i + 1 >= n) throw new ParseError(s); i += 2; return src[s + 1]; };
    const readBinSym = () => { const b = i; i++; if (i < n && BIN.includes(src[i]) && src[i] !== '-') i++; return src.slice(b, i); };
    const readWordSym = () => { const b = i; while (i < n && (isAN(src[i]) || src[i] === ':')) i++; return src.slice(b, i); };
    /* a literal array: numbers, strings, characters, symbols and arrays; inner symbols and arrays need no # (p. 21) */
    const readArray = () => {
      const open = i; i++;
      const items = [];
      for (;;) {
        skipBlank();
        if (i >= n) throw new ParseError(open);
        const c = src[i];
        if (c === ')') { i++; return items; }
        if (c === '(') { items.push({ lk: 'arr', v: readArray() }); continue; }
        if (c === '#') {
          if (src[i + 1] === '(') { i++; items.push({ lk: 'arr', v: readArray() }); continue; }
          i++;
          if (i < n && isA(src[i])) { items.push({ lk: 'sym', v: readWordSym() }); continue; }
          if (i < n && BIN.includes(src[i])) { items.push({ lk: 'sym', v: readBinSym() }); continue; }
          throw new ParseError(i - 1);
        }
        if (c === "'") { items.push({ lk: 'str', v: readString() }); continue; }
        if (c === '$') { items.push({ lk: 'chr', v: readChar() }); continue; }
        if (isD(c) || (c === '-' && i + 1 < n && isD(src[i + 1]))) { items.push(readNumber()); continue; }
        if (isA(c)) { items.push({ lk: 'sym', v: readWordSym() }); continue; }
        if (BIN.includes(c)) { items.push({ lk: 'sym', v: readBinSym() }); continue; }
        throw new ParseError(i);
      }
    };
    while (i < n) {
      skipBlank();
      if (i >= n) break;
      const c = src[i];
      const s = i;
      if (c === "'") { push('str', readString(), s); continue; }
      if (c === '$') { push('chr', readChar(), s); continue; }
      if (c === '#') {
        if (src[i + 1] === '(') { i++; push('arr', readArray(), s); continue; }
        i++;
        if (i < n && isA(src[i])) { push('sym', readWordSym(), s); continue; }
        if (i < n && BIN.includes(src[i])) { push('sym', readBinSym(), s); continue; }
        throw new ParseError(s);
      }
      const prev = toks[toks.length - 1];
      const valueEnd = prev && ['int', 'float', 'str', 'sym', 'chr', 'arr', 'id', ')', ']'].includes(prev.k);
      if (isD(c) || (c === '-' && i + 1 < n && isD(src[i + 1]) && !valueEnd)) {
        const r = readNumber(); push(r.lk, r.v, s);
        continue;
      }
      if (isA(c)) {
        while (i < n && isAN(src[i])) i++;
        if (src[i] === ':' && src[i + 1] !== '=') { i++; push('kw', src.slice(s, i), s); } else push('id', src.slice(s, i), s);
        continue;
      }
      if (c === ':') { if (src[i + 1] === '=') { i += 2; push('assign', ':=', s); } else { i++; push(':', ':', s); } continue; }
      if (c === '^' || c === '.' || c === ';' || c === '(' || c === ')' || c === '[' || c === ']') { i++; push(c, c, s); continue; }
      if (BIN.includes(c)) { i++; if (i < n && BIN.includes(src[i]) && src[i] !== '-') i++; push('bin', src.slice(s, i), s); continue; }
      throw new ParseError(i);
    }
    toks.push({ k: 'eof', s: n, e: n });
    return toks;
  }

  /* ---------- parser ---------- */
  const R = (n, s, e) => { n.s = s; n.e = e; n.os = s; n.oe = e; return n; };
  class Parser {
    constructor(src) { this.src = src; this.t = tokenize(src); this.p = 0; }
    get cur() { return this.t[this.p]; }
    get next() { return this.t[this.p + 1]; }
    fail(tok) { tok = tok || this.cur; if (tok.k === 'eof') { const b = Math.max(0, this.src.length - 1); throw new ParseError(b, 1); } throw new ParseError(tok.s, Math.max(1, tok.e - tok.s)); }
    expect(k) { if (this.cur.k !== k) this.fail(); return this.t[this.p++]; }
    statements(end) {
      const out = [];
      while (this.cur.k !== end && this.cur.k !== 'eof') {
        let st; const tok = this.cur;
        if (tok.k === '^') { this.p++; const x = this.expr(); st = R({ k: 'ret', x }, tok.s, x.oe); } else st = this.expr();
        out.push(st);
        if (this.cur.k === '.') { this.p++; continue; }
        break;
      }
      return out;
    }
    expr() {
      if (this.cur.k === 'id' && this.next.k === 'assign') {
        const t = this.cur; this.p += 2; const x = this.expr();
        return R({ k: 'assign', name: t.v, x }, t.s, x.oe);
      }
      return this.cascade();
    }
    cascade() {
      const first = this.keywordExpr();
      if (this.cur.k !== ';') return first;
      if (first.k !== 'send') this.fail();
      const msgs = [{ sel: first.sel, args: first.args }];
      let e = first.e;
      while (this.cur.k === ';') { this.p++; const m = this.message(); msgs.push(m); e = m.e; }
      return R({ k: 'cascade', recv: first.recv, msgs }, first.s, e);
    }
    message() {
      const t = this.cur;
      if (t.k === 'id') { this.p++; return { sel: t.v, args: [], e: t.e }; }
      if (t.k === 'bin') { this.p++; const a = this.unaryExpr(); return { sel: t.v, args: [a], e: a.oe }; }
      if (t.k === 'kw') {
        let sel = '', args = [], e = t.e;
        while (this.cur.k === 'kw') { sel += this.cur.v; this.p++; const a = this.binaryExpr(); args.push(a); e = a.oe; }
        return { sel, args, e };
      }
      this.fail();
    }
    keywordExpr() {
      const recv = this.binaryExpr();
      if (this.cur.k !== 'kw') return recv;
      let sel = ''; const args = []; let e = recv.oe; const selS = this.cur.s; let selE = this.cur.e;
      while (this.cur.k === 'kw') { sel += this.cur.v; selE = this.cur.e; this.p++; const a = this.binaryExpr(); args.push(a); e = a.oe; }
      const n = R({ k: 'send', recv, sel, args }, recv.os, e); n.selS = selS; n.selE = selE; return n;
    }
    binaryExpr() {
      let left = this.unaryExpr();
      while (this.cur.k === 'bin') {
        const t = this.cur; this.p++;
        const right = this.unaryExpr();
        left = R({ k: 'send', recv: left, sel: t.v, args: [right] }, left.os, right.oe); left.selS = t.s; left.selE = t.e;
      }
      return left;
    }
    unaryExpr() {
      let n = this.primary();
      while (this.cur.k === 'id' && this.next.k !== 'assign') {
        const t = this.cur; this.p++;
        n = R({ k: 'send', recv: n, sel: t.v, args: [] }, n.os, t.e); n.selS = t.s; n.selE = t.e;
      }
      return n;
    }
    primary() {
      const t = this.cur;
      switch (t.k) {
        case 'int': case 'float': case 'str': case 'sym': case 'chr': case 'arr': this.p++; return R({ k: 'lit', lk: t.k, v: t.v }, t.s, t.e);
        case 'id': this.p++; return R({ k: 'var', name: t.v }, t.s, t.e);
        case '(': {
          this.p++; const x = this.expr(); const c = this.expect(')');
          x.os = t.s; x.oe = c.e; return x;
        }
        case '[': return this.block();
        default: this.fail();
      }
    }
    block() {
      const open = this.expect('[');
      const params = [], temps = [];
      while (this.cur.k === ':') { this.p++; params.push(this.expect('id').v); }
      if (this.cur.k === 'bin' && this.cur.v === '|' && params.length) this.p++;
      else if (this.cur.k === 'bin' && this.cur.v === '||' && params.length) { this.p++; }
      if (this.cur.k === 'bin' && this.cur.v === '|') {
        this.p++; while (this.cur.k === 'id') { temps.push(this.cur.v); this.p++; }
        if (!(this.cur.k === 'bin' && this.cur.v === '|')) this.fail(); this.p++;
      }
      const body = this.statements(']');
      const c = this.expect(']');
      return R({ k: 'block', params, temps, body }, open.s, c.e);
    }
    doIt() {
      const body = this.statements('eof');
      if (this.cur.k !== 'eof') this.fail();
      return body;
    }
    workspace() {
      const temps = [];
      if (this.cur.k === 'bin' && this.cur.v === '||') this.p++;
      else if (this.cur.k === 'bin' && this.cur.v === '|') {
        this.p++; while (this.cur.k === 'id') { temps.push(this.cur.v); this.p++; }
        if (!(this.cur.k === 'bin' && this.cur.v === '|')) this.fail(); this.p++;
      }
      const body = this.doIt();
      body.temps = temps;
      return body;
    }
    method() {
      let sel = ''; const params = []; const t = this.cur;
      if (t.k === 'id') { sel = t.v; this.p++; }
      else if (t.k === 'bin') { sel = t.v; this.p++; params.push(this.expect('id').v); }
      else if (t.k === 'kw') { while (this.cur.k === 'kw') { sel += this.cur.v; this.p++; params.push(this.expect('id').v); } }
      else this.fail();
      const temps = [];
      if (this.cur.k === 'bin' && this.cur.v === '|') {
        this.p++; while (this.cur.k === 'id') { temps.push(this.cur.v); this.p++; }
        if (!(this.cur.k === 'bin' && this.cur.v === '|')) this.fail(); this.p++;
      }
      let prim = null;
      if (this.cur.k === 'bin' && this.cur.v === '<' && this.next.k === 'id' && this.next.v === 'primitive') {
        this.p += 2; prim = 0;
        if (this.cur.k === 'int') { prim = this.cur.v; this.p++; }
        if (!(this.cur.k === 'bin' && this.cur.v === '>')) this.fail(); this.p++;
      }
      const body = this.doIt();
      return { sel, params, temps, prim, body, src: this.src };
    }
  }

  /* ---------- objects and image ---------- */
  class O { constructor(cls, v) { this.cls = cls; this.v = v; this.iv = null; } }
  let I = null;            // the image
  const FAIL = { fail: true };

  const CLASSES = [
    ['Object', null, []], ['UndefinedObject', 'Object', []], ['Boolean', 'Object', []], ['True', 'Boolean', []], ['False', 'Boolean', []],
    ['Block', 'Object', []], ['Magnitude', 'Object', []], ['Number', 'Magnitude', []], ['Integer', 'Number', []], ['SmallInteger', 'Integer', []], ['Float', 'Number', []],
    ['Character', 'Magnitude', []], ['Point', 'Object', ['x', 'y']], ['Rectangle', 'Object', ['origin', 'corner']],
    ['Collection', 'Object', []], ['SequenceableCollection', 'Collection', []], ['ArrayedCollection', 'SequenceableCollection', []],
    ['Array', 'ArrayedCollection', []], ['String', 'ArrayedCollection', []], ['Symbol', 'String', []], ['OrderedCollection', 'SequenceableCollection', []],
    ['Set', 'Collection', []], ['Dictionary', 'Set', []], ['Association', 'Object', ['key', 'value']], ['TextCollector', 'Object', []],
    ['Message', 'Object', ['selector', 'arguments']], ['Context', 'Object', []],
    ['Behavior', 'Object', []], ['ClassDescription', 'Behavior', []], ['Class', 'ClassDescription', []], ['Metaclass', 'ClassDescription', []],
    ['Highlight', 'Object', []], ['One', 'Object', []], ['Two', 'One', []], ['Three', 'Two', []], ['Four', 'Three', []], ['Door', 'Object', ['open']]
  ];

  const arith = () => ['- aNumber', '* aNumber', '< aNumber', '> aNumber', '<= aNumber', '>= aNumber', '= aNumber']
    .map(p => p + ' <primitive>\n  ^ self error: \'not a number\'')
    .concat(['/ aNumber', '// aNumber', '\\\\ aNumber'].map(p => p + ' <primitive>\n  aNumber = 0 ifTrue: [^ self error: \'ZeroDivide\'].\n  ^ self error: \'not a number\''));

  const SOURCES = {
    'Object': [
      "class <primitive 111>\n  ^ self error: 'no class'", "== anObject <primitive 110>\n  ^ false",
      '= anObject\n  ^ self == anObject', '~= anObject\n  ^ (self = anObject) not', 'isNil\n  ^ false', 'notNil\n  ^ true', 'yourself\n  ^ self', 'species\n  ^ self class', '-> anObject\n  ^ Association key: self value: anObject',
      'printString <primitive>\n  ^ \'an object\'', 'isKindOf: aClass <primitive>\n  ^ false', 'respondsTo: aSymbol <primitive>\n  ^ false',
      'perform: aSymbol <primitive 83>\n  ^ self error: \'not a selector\'', 'perform: aSymbol with: anObject <primitive 83>\n  ^ self error: \'not a selector\'',
      'doesNotUnderstand: aMessage <primitive>\n  ^ nil', 'error: aString <primitive>\n  ^ nil'
    ],
    'UndefinedObject': ['isNil\n  ^ true', 'notNil\n  ^ false'],
    'True': ['ifTrue: aBlock\n  ^ aBlock value', 'ifFalse: aBlock\n  ^ nil', 'ifTrue: t ifFalse: f\n  ^ t value', 'ifFalse: f ifTrue: t\n  ^ t value', 'not\n  ^ false', '& aBoolean\n  ^ aBoolean', '| aBoolean\n  ^ true', 'and: aBlock\n  ^ aBlock value', 'or: aBlock\n  ^ true'],
    'False': ['ifTrue: aBlock\n  ^ nil', 'ifFalse: aBlock\n  ^ aBlock value', 'ifTrue: t ifFalse: f\n  ^ f value', 'ifFalse: f ifTrue: t\n  ^ f value', 'not\n  ^ true', '& aBoolean\n  ^ false', '| aBoolean\n  ^ aBoolean', 'and: aBlock\n  ^ false', 'or: aBlock\n  ^ aBlock value'],
    'Block': [
      "value <primitive 81>\n  ^ self error: 'wrong number of arguments'", "value: a <primitive 81>\n  ^ self error: 'wrong number of arguments'", "value: a value: b <primitive 81>\n  ^ self error: 'wrong number of arguments'",
      'numArgs <primitive>\n  ^ 0', 'whileTrue: aBlock\n  self value ifTrue: [aBlock value. self whileTrue: aBlock].\n  ^ nil'
    ],
    'Magnitude': ['max: aMagnitude\n  self > aMagnitude ifTrue: [^ self].\n  ^ aMagnitude', 'min: aMagnitude\n  self < aMagnitude ifTrue: [^ self].\n  ^ aMagnitude', 'between: low and: high\n  ^ self >= low and: [self <= high]'],
    'Number': [
      'abs\n  self < 0 ifTrue: [^ self negated].\n  ^ self', 'negated\n  ^ 0 - self', 'squared\n  ^ self * self', 'asPoint\n  ^ self @ self', '@ y\n  ^ Point x: self y: y',
      'to: stop do: aBlock\n  | i |\n  i := self.\n  [i <= stop] whileTrue: [aBlock value: i. i := i + 1]'
    ],
    'Integer': ['+ aNumber\n  ^ aNumber addInteger: self', 'factorial\n  self <= 1 ifTrue: [^ 1].\n  ^ self * (self - 1) factorial', 'timesRepeat: aBlock\n  | i |\n  i := 1.\n  [i <= self] whileTrue: [aBlock value. i := i + 1]', "asCharacter <primitive>\n  ^ self error: 'not a character code'"],
    'SmallInteger': ['+ addend <primitive 1>\n  ^ super + addend'].concat(arith()).concat(['addInteger: anInteger <primitive>\n  ^ nil', 'addFloat: aFloat <primitive>\n  ^ nil']),
    'Float': ['+ aNumber <primitive>\n  ^ aNumber addFloat: self'].concat(arith()).concat(['addInteger: anInteger <primitive>\n  ^ nil', 'addFloat: aFloat <primitive>\n  ^ nil']),
    'Point': [
      'x\n  ^ x', 'y\n  ^ y', 'asPoint\n  ^ self', 'setX: ax y: ay\n  x := ax.\n  y := ay',
      '+ delta\n  | d |\n  d := delta asPoint.\n  ^ Point x: x + d x y: y + d y', '- delta\n  | d |\n  d := delta asPoint.\n  ^ Point x: x - d x y: y - d y',
      '* delta\n  | d |\n  d := delta asPoint.\n  ^ Point x: x * d x y: y * d y', '/ delta\n  | d |\n  d := delta asPoint.\n  ^ Point x: x / d x y: y / d y',
      '= aPoint\n  (aPoint isKindOf: Point) ifFalse: [^ false].\n  ^ x = aPoint x and: [y = aPoint y]',
      'addInteger: n\n  ^ self + n', 'addFloat: n\n  ^ self + n', 'corner: aPoint\n  ^ Rectangle origin: self corner: aPoint', 'printString <primitive>\n  ^ nil'
    ],
    'Point class': ['x: ax y: ay\n  ^ self new setX: ax y: ay; yourself'],
    'Rectangle': ['origin\n  ^ origin', 'corner\n  ^ corner', 'setOrigin: o corner: c\n  origin := o.\n  corner := c', 'center\n  ^ origin + corner / 2', 'extent\n  ^ corner - origin', 'width\n  ^ corner x - origin x', 'height\n  ^ corner y - origin y'],
    'Rectangle class': ['origin: o corner: c\n  ^ self new setOrigin: o corner: c; yourself'],
    'Character': [
      'value <primitive>\n  ^ 0', 'asCharacter\n  ^ self', 'asUppercase <primitive>\n  ^ self', 'asLowercase <primitive>\n  ^ self',
      'isVowel <primitive>\n  ^ false', 'isLetter <primitive>\n  ^ false', 'isDigit <primitive>\n  ^ false',
      "< aCharacter <primitive>\n  ^ self error: 'not a character'", "> aCharacter <primitive>\n  ^ self error: 'not a character'",
      "<= aCharacter\n  ^ (self > aCharacter) not", ">= aCharacter\n  ^ (self < aCharacter) not"
    ],
    'Character class': ["value: anInteger <primitive>\n  ^ self error: 'not a character code'"],
    'Collection': [
      'collect: aBlock\n  | result |\n  result := self species new.\n  self do: [:each | result add: (aBlock value: each)].\n  ^ result',
      'select: aBlock\n  | result |\n  result := self species new.\n  self do: [:each | (aBlock value: each) ifTrue: [result add: each]].\n  ^ result',
      'reject: aBlock\n  ^ self select: [:each | (aBlock value: each) not]',
      "detect: aBlock\n  ^ self detect: aBlock ifNone: [self error: 'object is not in the collection']",
      'detect: aBlock ifNone: exceptionBlock\n  self do: [:each | (aBlock value: each) ifTrue: [^ each]].\n  ^ exceptionBlock value',
      'inject: thisValue into: binaryBlock\n  | nextValue |\n  nextValue := thisValue.\n  self do: [:each | nextValue := binaryBlock value: nextValue value: each].\n  ^ nextValue',
      'includes: anObject\n  self do: [:each | anObject = each ifTrue: [^ true]].\n  ^ false',
      'isEmpty\n  ^ self size = 0', 'notEmpty\n  ^ self isEmpty not',
      'asSet\n  | aSet |\n  aSet := Set new.\n  self do: [:each | aSet add: each].\n  ^ aSet',
      'asOrderedCollection\n  | anOrderedCollection |\n  anOrderedCollection := OrderedCollection new.\n  self do: [:each | anOrderedCollection add: each].\n  ^ anOrderedCollection',
      'asArray\n  | anArray index |\n  anArray := Array new: self size.\n  index := 0.\n  self do: [:each | index := index + 1. anArray at: index put: each].\n  ^ anArray',
      'printString <primitive>\n  ^ nil'
    ],
    'Collection class': [
      'with: anObject\n  ^ self new add: anObject; yourself', 'with: firstObject with: secondObject\n  ^ self new add: firstObject; add: secondObject; yourself',
      'with: firstObject with: secondObject with: thirdObject\n  ^ self new add: firstObject; add: secondObject; add: thirdObject; yourself'
    ],
    'SequenceableCollection': [
      "first\n  ^ self at: 1", "last\n  ^ self at: self size",
      ", aSequenceableCollection <primitive>\n  ^ self error: 'not a sequence'",
      "copyReplaceAll: oldSubCollection with: newSubCollection <primitive>\n  ^ self error: 'not a sequence'",
      "copyFrom: start to: stop <primitive>\n  ^ self error: 'index out of bounds'", 'copyWith: newElement <primitive>\n  ^ nil',
      'indexOf: anElement <primitive>\n  ^ 0', '= aSequenceableCollection <primitive>\n  ^ false'
    ],
    'ArrayedCollection': [
      'size <primitive 62>\n  ^ 0', "at: index <primitive 60>\n  ^ self error: 'index out of bounds'", "at: index put: value <primitive 61>\n  ^ self error: 'index out of bounds'",
      'do: aBlock <primitive>\n  ^ nil',
      'collect: aBlock\n  | result index |\n  result := self species new: self size.\n  index := 0.\n  self do: [:each | index := index + 1. result at: index put: (aBlock value: each)].\n  ^ result',
      'select: aBlock\n  | kept |\n  kept := OrderedCollection new.\n  self do: [:each | (aBlock value: each) ifTrue: [kept add: each]].\n  ^ self species withAll: kept'
    ],
    'ArrayedCollection class': [
      "withAll: aCollection <primitive>\n  ^ self error: 'not a collection'",
      'with: anObject\n  ^ (self new: 1) at: 1 put: anObject; yourself', 'with: firstObject with: secondObject\n  ^ (self new: 2) at: 1 put: firstObject; at: 2 put: secondObject; yourself',
      'with: firstObject with: secondObject with: thirdObject\n  ^ (self new: 3) at: 1 put: firstObject; at: 2 put: secondObject; at: 3 put: thirdObject; yourself'
    ],
    'String': [
      'size <primitive 62>\n  ^ 0', 'asUppercase <primitive>\n  ^ self', 'asLowercase <primitive>\n  ^ self', 'asSymbol <primitive>\n  ^ nil', 'asString <primitive>\n  ^ self',
      '= aString <primitive>\n  ^ false', "< aString <primitive>\n  ^ self error: 'not a string'", "> aString <primitive>\n  ^ self error: 'not a string'", 'printString <primitive>\n  ^ self'
    ],
    'Symbol': ['species\n  ^ String', 'printString <primitive>\n  ^ self'],
    'OrderedCollection': [
      'add: newObject <primitive>\n  ^ nil', 'addFirst: newObject <primitive>\n  ^ nil', "removeFirst <primitive>\n  ^ self error: 'this collection is empty'", "removeLast <primitive>\n  ^ self error: 'this collection is empty'",
      'size <primitive>\n  ^ 0', "at: index <primitive>\n  ^ self error: 'index out of bounds'", "at: index put: anObject <primitive>\n  ^ self error: 'index out of bounds'", 'do: aBlock <primitive>\n  ^ nil'
    ],
    'Set': ['add: newObject <primitive>\n  ^ nil', "remove: oldObject <primitive>\n  ^ self error: 'object is not in the collection'", 'size <primitive>\n  ^ 0', 'do: aBlock <primitive>\n  ^ nil'],
    'Dictionary': [
      "at: key <primitive>\n  ^ self error: 'key not found'", 'at: key put: value <primitive>\n  ^ nil', 'at: key ifAbsent: aBlock\n  (self includesKey: key) ifFalse: [^ aBlock value].\n  ^ self at: key',
      'includesKey: key <primitive>\n  ^ false', "removeKey: key <primitive>\n  ^ self error: 'key not found'", 'keys <primitive>\n  ^ nil',
      'add: anAssociation\n  self at: anAssociation key put: anAssociation value.\n  ^ anAssociation',
      'do: aBlock <primitive>\n  ^ nil', 'keysDo: aBlock <primitive>\n  ^ nil', 'associationsDo: aBlock <primitive>\n  ^ nil',
      'select: aBlock\n  | result |\n  result := self species new.\n  self keysDo: [:key | (aBlock value: (self at: key)) ifTrue: [result at: key put: (self at: key)]].\n  ^ result',
      'collect: aBlock\n  | result |\n  result := OrderedCollection new.\n  self do: [:each | result add: (aBlock value: each)].\n  ^ result'
    ],
    'Association': ['key\n  ^ key', 'value\n  ^ value', 'key: aKey value: anObject\n  key := aKey.\n  value := anObject', 'printString <primitive>\n  ^ nil'],
    'Association class': ['key: aKey value: anObject\n  ^ self new key: aKey value: anObject'],
    'TextCollector': [
      "show: aString <primitive>\n  ^ self error: 'not a string'", 'cr <primitive>\n  ^ self', 'tab <primitive>\n  ^ self', 'space <primitive>\n  ^ self',
      'print: anObject\n  ^ self show: anObject printString', 'nextPutAll: aString\n  ^ self show: aString', 'clear <primitive>\n  ^ self'
    ],
    'Message': ['selector\n  ^ selector', 'arguments\n  ^ arguments'],
    'Context': ['sender <primitive>\n  ^ nil', 'receiver <primitive>\n  ^ nil', 'selector <primitive>\n  ^ nil'],
    'Behavior': ["new <primitive 70>\n  ^ self error: 'cannot make one of these'", "new: anInteger <primitive 71>\n  ^ self error: 'cannot make one of these'", 'superclass <primitive>\n  ^ nil', 'name <primitive>\n  ^ nil', 'printString <primitive>\n  ^ nil', "subclass: aSymbol instanceVariableNames: aString <primitive>\n  ^ self error: 'bad class definition'"],
    'Highlight class': ['style\n  ^ #inverted'],
    'One': ['test\n  ^ 1', 'result1\n  ^ self test'],
    'Two': ['test\n  ^ 2'],
    'Three': ['result2\n  ^ self result1', 'result3\n  ^ super test'],
    'Four': ['test\n  ^ 4'],
    'Door': ['open\n  open := true', 'close\n  open := false', 'isOpen\n  ^ open == true', 'openDuring: aBlock\n  | r |\n  self open.\n  r := aBlock value.\n  self close.\n  ^ r']
  };

  const mk = {
    int: n => new O(I.g.SmallInteger, n),
    flt: n => new O(I.g.Float, n),
    num: n => Number.isInteger(n) ? mk.int(n) : mk.flt(n),
    str: s => new O(I.g.String, s),
    sym: s => { let y = I.symbols[s]; if (!y) { y = new O(I.g.Symbol, s); I.symbols[s] = y; } return y; },
    chr: ch => { let y = I.chars[ch]; if (!y) { y = new O(I.g.Character, ch); I.chars[ch] = y; } return y; },
    bool: b => b ? I.true : I.false,
    oc: list => new O(I.g.OrderedCollection, list),
    arr: list => new O(I.g.Array, list),
    set: list => new O(I.g.Set, list)
  };
  const isNum = v => v.cls === I.g.SmallInteger || v.cls === I.g.Float;
  const isInt = v => v.cls === I.g.SmallInteger;
  const isKind = (c, k) => { for (; c; c = c.superclass) if (c === k) return true; return false; };
  const isChr = v => v.cls === I.g.Character;
  /* which built-in shape an object has: str, arr, oc, set or dict (user subclasses keep their parent's shape) */
  function kindOfClass(c) {
    if (!c || c.isMeta) return null;
    if (isKind(c, I.g.String)) return 'str';
    if (isKind(c, I.g.Array)) return 'arr';
    if (isKind(c, I.g.OrderedCollection)) return 'oc';
    if (isKind(c, I.g.Dictionary)) return 'dict';
    if (isKind(c, I.g.Set)) return 'set';
    return null;
  }
  const kindOf = v => (v && v.cls && !v.isClass) ? kindOfClass(v.cls) : null;
  const isStr = v => kindOf(v) === 'str';
  const isSymbol = v => v && v.cls && isKind(v.cls, I.g.Symbol);
  const isSeq = v => { const k = kindOf(v); return k === 'str' || k === 'arr' || k === 'oc'; };
  /* the elements of any collection, as a fresh JS array */
  function elems(v) {
    switch (kindOf(v)) {
      case 'str': return v.v.split('').map(mk.chr);
      case 'arr': case 'oc': case 'set': return v.v.slice();
      case 'dict': return v.v.map(p => p[1]);
      default: return null;
    }
  }
  /* equality as the collections use it: numbers by value, strings by characters, sequences element by element */
  function eqv(a, b) {
    if (a === b) return true;
    if (isNum(a) && isNum(b)) return a.v === b.v;
    const ka = kindOf(a), kb = kindOf(b);
    if (ka === 'str' && kb === 'str') return isSymbol(a) === isSymbol(b) && !isSymbol(a) && a.v === b.v;
    if (ka && ka === kb && (ka === 'arr' || ka === 'oc')) return a.v.length === b.v.length && a.v.every((x, i) => eqv(x, b.v[i]));
    return false;
  }
  const speciesOf = v => isSymbol(v) ? I.g.String : v.cls;
  /* a new collection of a given class holding a JS list, or FAIL (a String holds only Characters) */
  function makeOf(cls, list) {
    const k = kindOfClass(cls);
    if (k === 'str') { if (!list.every(isChr)) return FAIL; const t = list.map(c => c.v).join(''); return isKind(cls, I.g.Symbol) ? mk.sym(t) : new O(cls, t); }
    if (k === 'arr' || k === 'oc') return new O(cls, list);
    if (k === 'set') { const o = new O(cls, []); list.forEach(x => { if (!o.v.some(y => eqv(x, y))) o.v.push(x); }); return hashOrder(o); }
    return FAIL;
  }
  function allIvars(c) { const out = []; const list = []; for (; c; c = c.superclass) list.unshift(c); list.forEach(k => (k.ivars || []).forEach(n => out.push(n))); return out; }

  function makeClass(name, sup, ivars) {
    const meta = { cls: I.g.Metaclass || null, name: name + ' class', superclass: sup ? sup.cls : (I.g.Class || null), methods: Object.create(null), isClass: true, isMeta: true, ivars: [], iv: null };
    const c = { cls: meta, name, superclass: sup, methods: Object.create(null), isClass: true, ivars, iv: null };
    meta.thisClass = c;
    I.g[name] = c; I.classes[name] = c; I.classes[name + ' class'] = meta;
    return c;
  }

  function compileInto(c, src) {
    const m = new Parser(src).method();
    m.owner = c; m.selector = m.sel;
    if (m.prim !== null) m.fn = PRIMS[c.name + '>>' + m.sel] || GEN[c.name + '>>' + m.sel] || null;
    m.isGen = !!GEN[c.name + '>>' + m.sel];
    return m;
  }

  function boot() {
    I = { g: Object.create(null), classes: Object.create(null), symbols: Object.create(null), chars: Object.create(null), log: [], version: (I ? I.version + 1 : 1) };
    CLASSES.forEach(([n, s, iv]) => makeClass(n, s ? I.g[s] : null, iv));
    const Obj = I.g.Object;
    Obj.cls.superclass = I.g.Class;
    Object.keys(I.classes).forEach(n => { const c = I.classes[n]; if (c.isMeta) c.cls = I.g.Metaclass; });
    I.nil = new O(I.g.UndefinedObject); I.true = new O(I.g.True); I.false = new O(I.g.False);
    Object.keys(SOURCES).forEach(cn => {
      const c = I.classes[cn];
      SOURCES[cn].forEach(src => { const m = compileInto(c, src); c.methods[m.sel] = m; });
    });
    ['One', 'Two', 'Three', 'Four'].forEach((n, i) => { I.g['example' + (i + 1)] = newInstance(I.g[n]); });
    I.g.Transcript = newInstance(I.g.TextCollector);
  }

  function newInstance(c) {
    const o = new O(c);
    const names = allIvars(c);
    if (names.length) { o.iv = Object.create(null); names.forEach(n => { o.iv[n] = I.nil; }); }
    const k = kindOfClass(c);
    if (k === 'str') o.v = '';
    else if (isKind(c, I.g.Collection)) o.v = [];
    if (isKind(c, I.g.TextCollector)) o.v = { text: '' };
    return o;
  }

  /* ---------- printing (for display; never appears in a trace) ---------- */
  const aOrAn = n => (/^[AEIOU]/.test(n) ? 'an ' : 'a ') + n;
  /* printString as the book describes it: 'hello' keeps its quotes, a Symbol prints bare (p. 101),
     a collection prints as its class name and elements (p. 218), and an Array as (1 2 3 ) without its class name (pp. 218-219) */
  /* A real Set stores by hash; small integers and characters hash to their values, so they come out in order.
     Other elements keep the order they were added. */
  function hashOrder(o) {
    const key = x => x && x.cls === I.g.SmallInteger ? x.v : x && x.cls === I.g.Character ? x.v.charCodeAt(0) : null;
    if (o.v.every(x => key(x) !== null && x.cls === o.v[0].cls)) o.v.sort((a, b) => key(a) - key(b));
    return o;
  }
  const MAXEL = 12;
  function prElems(list, d, f) {
    let out = '';
    list.slice(0, MAXEL).forEach(x => { out += f(x) + ' '; });
    if (list.length > MAXEL) out += '...etc... ';
    return out;
  }
  function pr(v, d) {
    d = d || 0;
    if (v === undefined || v === null) return '?';
    if (v === I.nil) return 'nil';
    if (v === I.true) return 'true';
    if (v === I.false) return 'false';
    if (v.isClass) return v.name;
    const c = v.cls;
    if (c === I.g.SmallInteger) return String(v.v);
    if (c === I.g.Float) return Number.isInteger(v.v) ? v.v + '.0' : String(Math.round(v.v * 1e10) / 1e10);
    if (c === I.g.Character) return '$' + v.v;
    const k = kindOfClass(c);
    if (k === 'str') return isSymbol(v) ? v.v : "'" + v.v.replace(/'/g, "''") + "'";
    if (d > 3) return '...';
    if (k === 'arr') return '(' + prElems(v.v, d, x => pr(x, d + 1)) + ')';
    if (k === 'oc' || k === 'set') return c.name + ' (' + prElems(v.v, d, x => pr(x, d + 1)) + ')';
    if (k === 'dict') return c.name + ' (' + prElems(v.v, d, p => pr(p[0], d + 1) + '->' + pr(p[1], d + 1)) + ')';
    if (isKind(c, I.g.Association)) return pr(v.iv.key, d + 1) + '->' + pr(v.iv.value, d + 1);
    if (isKind(c, I.g.Point)) return pr(v.iv.x, d + 1) + '@' + pr(v.iv.y, d + 1);
    if (isKind(c, I.g.Rectangle)) return pr(v.iv.origin, d + 1) + ' corner: ' + pr(v.iv.corner, d + 1);
    return aOrAn(c.name);
  }
  /* how an argument reads in a message slip: as you would type it, so a Symbol keeps its # */
  const lit = v => (v && isSymbol(v)) ? '#' + v.v : pr(v);
  function inspect(v) {
    const info = { p: pr(v), c: v.cls ? v.cls.name : '?', iv: [] };
    if (v.iv) Object.keys(v.iv).slice(0, 4).forEach(n => info.iv.push([n, pr(v.iv[n])]));
    return info;
  }

  /* ---------- primitives ---------- */
  const isFlt = v => v.cls === I.g.Float;
  const mkArith = (r, b, n) => (isFlt(r) || isFlt(b)) ? mk.flt(n) : mk.num(n);
  const numOp = f => (r, a) => isNum(a[0]) ? mkArith(r, a[0], f(r.v, a[0].v)) : FAIL;
  const cmpOp = f => (r, a) => isNum(a[0]) ? mk.bool(f(r.v, a[0].v)) : FAIL;
  const NUMPRIMS = {
    '-': numOp((x, y) => x - y), '*': numOp((x, y) => x * y),
    '/': (r, a) => (isNum(a[0]) && a[0].v !== 0) ? mkArith(r, a[0], r.v / a[0].v) : FAIL,
    '//': (r, a) => (isNum(a[0]) && a[0].v !== 0) ? mk.num(Math.floor(r.v / a[0].v)) : FAIL,
    '\\\\': (r, a) => (isNum(a[0]) && a[0].v !== 0) ? mkArith(r, a[0], r.v - Math.floor(r.v / a[0].v) * a[0].v) : FAIL,
    '<': cmpOp((x, y) => x < y), '>': cmpOp((x, y) => x > y), '<=': cmpOp((x, y) => x <= y), '>=': cmpOp((x, y) => x >= y),
    '=': (r, a) => mk.bool(isNum(a[0]) && r.v === a[0].v),
    'addInteger:': (r, a) => isNum(a[0]) ? mkArith(r, a[0], r.v + a[0].v) : FAIL, 'addFloat:': (r, a) => isNum(a[0]) ? mk.flt(r.v + a[0].v) : FAIL
  };
  const PRIMS = {
    'Object>>class': r => r.cls,
    'Object>>==': (r, a) => mk.bool(r === a[0] || (isNum(r) && isNum(a[0]) && r.cls === a[0].cls && r.v === a[0].v)),
    'Object>>printString': r => mk.str(pr(r)),
    'Object>>isKindOf:': (r, a) => a[0].isClass ? mk.bool(isKind(r.cls, a[0])) : FAIL,
    'Object>>respondsTo:': (r, a) => { for (let c = r.cls; c; c = c.superclass) if (c.methods[a[0].v]) return I.true; return I.false; },
    'SmallInteger>>+': (r, a) => isInt(a[0]) ? mk.int(r.v + a[0].v) : FAIL,
    'Float>>+': (r, a) => a[0].cls === I.g.Float ? mk.flt(r.v + a[0].v) : FAIL,
    'Block>>numArgs': r => mk.int(r.v.params.length),
    'Point>>printString': r => mk.str(pr(r)),
    'ArrayedCollection>>size': r => isSeq(r) ? mk.int(r.v.length) : FAIL,
    'String>>size': r => mk.int(r.v.length),
    'ArrayedCollection>>at:': (r, a) => seqAt(r, a[0]),
    'ArrayedCollection>>at:put:': (r, a) => seqAtPut(r, a[0], a[1]),
    'ArrayedCollection class>>withAll:': (r, a) => { const l = elems(a[0]); return l ? makeOf(r, l) : FAIL; },
    'SequenceableCollection>>,': (r, a) => { const l = isSeq(a[0]) ? elems(a[0]) : null; return l ? makeOf(speciesOf(r), elems(r).concat(l)) : FAIL; },
    'SequenceableCollection>>copyReplaceAll:with:': (r, a) => {
      if (!isSeq(a[0]) || !isSeq(a[1]) || !elems(a[0]).length) return FAIL;
      const src = elems(r), old = elems(a[0]), rep = elems(a[1]), out = [];
      for (let i = 0; i < src.length;) {
        if (i + old.length <= src.length && old.every((x, j) => eqv(x, src[i + j]))) { rep.forEach(x => out.push(x)); i += old.length; } else out.push(src[i++]);
      }
      return makeOf(speciesOf(r), out);
    },
    'SequenceableCollection>>copyFrom:to:': (r, a) => {
      const l = elems(r);
      if (!isInt(a[0]) || !isInt(a[1]) || a[0].v < 1 || a[1].v > l.length || a[1].v < a[0].v - 1) return FAIL;
      return makeOf(speciesOf(r), l.slice(a[0].v - 1, a[1].v));
    },
    'SequenceableCollection>>copyWith:': (r, a) => makeOf(speciesOf(r), elems(r).concat([a[0]])),
    'SequenceableCollection>>indexOf:': (r, a) => mk.int(elems(r).findIndex(x => eqv(x, a[0])) + 1),
    'SequenceableCollection>>=': (r, a) => mk.bool(r.cls === a[0].cls && eqv(r, a[0])),
    'String>>asUppercase': r => mk.str(r.v.toUpperCase()),
    'String>>asLowercase': r => mk.str(r.v.toLowerCase()),
    'String>>asSymbol': r => mk.sym(r.v),
    'String>>asString': r => isSymbol(r) ? mk.str(r.v) : r,
    'String>>=': (r, a) => mk.bool(eqv(r, a[0])),
    'String>><': (r, a) => isStr(a[0]) ? mk.bool(r.v.toLowerCase() < a[0].v.toLowerCase()) : FAIL,
    'String>>>': (r, a) => isStr(a[0]) ? mk.bool(r.v.toLowerCase() > a[0].v.toLowerCase()) : FAIL,
    'String>>printString': r => mk.str(pr(r)),
    'Symbol>>printString': r => mk.str(pr(r)),
    'Collection>>printString': r => mk.str(pr(r)),
    'Association>>printString': r => mk.str(pr(r)),
    'Character>>value': r => mk.int(r.v.codePointAt(0)),
    'Character>>asUppercase': r => mk.chr(r.v.toUpperCase()),
    'Character>>asLowercase': r => mk.chr(r.v.toLowerCase()),
    'Character>>isVowel': r => mk.bool('aeiouAEIOU'.includes(r.v)),
    'Character>>isLetter': r => mk.bool(/[A-Za-z]/.test(r.v)),
    'Character>>isDigit': r => mk.bool(/[0-9]/.test(r.v)),
    'Character>><': (r, a) => isChr(a[0]) ? mk.bool(r.v < a[0].v) : FAIL,
    'Character>>>': (r, a) => isChr(a[0]) ? mk.bool(r.v > a[0].v) : FAIL,
    'Character class>>value:': (r, a) => (isInt(a[0]) && a[0].v >= 0 && a[0].v < 0x110000) ? mk.chr(String.fromCodePoint(a[0].v)) : FAIL,
    'Integer>>asCharacter': r => (isInt(r) && r.v >= 0 && r.v < 0x110000) ? mk.chr(String.fromCodePoint(r.v)) : FAIL,
    'OrderedCollection>>add:': (r, a) => { r.v.push(a[0]); return a[0]; },
    'OrderedCollection>>addFirst:': (r, a) => { r.v.unshift(a[0]); return a[0]; },
    'OrderedCollection>>removeFirst': r => r.v.length ? r.v.shift() : FAIL,
    'OrderedCollection>>removeLast': r => r.v.length ? r.v.pop() : FAIL,
    'OrderedCollection>>size': r => mk.int(r.v.length),
    'OrderedCollection>>at:': (r, a) => seqAt(r, a[0]),
    'OrderedCollection>>at:put:': (r, a) => seqAtPut(r, a[0], a[1]),
    'Set>>add:': (r, a) => { if (kindOf(r) !== 'set') return FAIL; if (!r.v.some(x => eqv(x, a[0]))) { r.v.push(a[0]); hashOrder(r); } return a[0]; },
    'Set>>remove:': (r, a) => { const i = kindOf(r) === 'set' ? r.v.findIndex(x => eqv(x, a[0])) : -1; if (i < 0) return FAIL; r.v.splice(i, 1); return a[0]; },
    'Set>>size': r => mk.int(r.v.length),
    'Dictionary>>at:': (r, a) => { const p = r.v.find(q => eqv(q[0], a[0])); return p ? p[1] : FAIL; },
    'Dictionary>>at:put:': (r, a) => { const p = r.v.find(q => eqv(q[0], a[0])); if (p) p[1] = a[1]; else r.v.push([a[0], a[1]]); return a[1]; },
    'Dictionary>>includesKey:': (r, a) => mk.bool(r.v.some(q => eqv(q[0], a[0]))),
    'Dictionary>>removeKey:': (r, a) => { const i = r.v.findIndex(q => eqv(q[0], a[0])); if (i < 0) return FAIL; return r.v.splice(i, 1)[0][1]; },
    'Dictionary>>keys': r => mk.set(r.v.map(q => q[0])),
    'Context>>sender': r => r.v.sender ? ctxObj(r.v.sender) : I.nil,
    'Context>>receiver': r => r.v.receiver,
    'Context>>selector': r => r.v.method ? mk.sym(r.v.method.sel) : I.nil,
    'Behavior>>new': r => {
      if (r === I.g.SmallInteger || r === I.g.Float || r === I.g.True || r === I.g.False || r === I.g.UndefinedObject || r === I.g.Character || isKind(r, I.g.Symbol) || r.isMeta) return FAIL;
      return newInstance(r);
    },
    'Behavior>>new:': (r, a) => {
      if (!isInt(a[0]) || a[0].v < 0 || a[0].v > 100000 || r.isMeta || isKind(r, I.g.Symbol)) return FAIL;
      const k = kindOfClass(r), o = newInstance(r);
      if (k === 'str') o.v = ' '.repeat(a[0].v);
      else if (k === 'arr') o.v = Array.from({ length: a[0].v }, () => I.nil);
      else if (!k) return FAIL;
      return o;
    },
    'Behavior>>superclass': r => r.superclass || I.nil,
    'Behavior>>name': r => mk.str(r.name),
    'Behavior>>printString': r => mk.str(r.name),
    'Behavior>>subclass:instanceVariableNames:': (r, a) => {
      if (!isStr(a[0]) || !isStr(a[1])) return FAIL;
      return defineClass(a[0].v, r, a[1].v.trim() ? a[1].v.trim().split(/\s+/) : [], true);
    }
  };
  Object.keys(NUMPRIMS).forEach(k => { PRIMS['SmallInteger>>' + k] = NUMPRIMS[k]; PRIMS['Float>>' + k] = NUMPRIMS[k]; });
  function seqAt(r, i) {
    const k = kindOf(r);
    if (!(k === 'str' || k === 'arr' || k === 'oc') || !isInt(i) || i.v < 1 || i.v > r.v.length) return FAIL;
    return k === 'str' ? mk.chr(r.v[i.v - 1]) : r.v[i.v - 1];
  }
  function seqAtPut(r, i, x) {
    const k = kindOf(r);
    if (!(k === 'str' || k === 'arr' || k === 'oc') || !isInt(i) || i.v < 1 || i.v > r.v.length) return FAIL;
    if (k === 'str') { if (isSymbol(r) || !isChr(x)) return FAIL; r.v = r.v.slice(0, i.v - 1) + x.v + r.v.slice(i.v); }
    else r.v[i.v - 1] = x;
    return x;
  }
  function ctxObj(f) { if (!f.ctx) f.ctx = new O(I.g.Context, f); return f.ctx; }

  function defineClass(name, sup, ivars, user) {
    let c = I.g[name];
    if (c && c.isClass) { c.ivars = ivars; }
    else c = makeClass(name, sup, ivars), c.cls.cls = I.g.Metaclass;
    I.version++;
    if (user) { I.log = I.log.filter(l => !(l.k === 'c' && l.name === name)); I.log.push({ k: 'c', name, sup: sup.name, iv: ivars }); }
    return c;
  }

  /* generator primitives: they can run more Smalltalk, so they live on Run */
  const GEN = {
    'Object>>perform:': function* (r, a, f) {
      if (!isStr(a[0])) return FAIL;
      yield this.primEv(83);
      return yield* this.dispatch(r, a[0].v, [], f);
    },
    'Object>>perform:with:': function* (r, a, f) {
      if (!isStr(a[0])) return FAIL;
      yield this.primEv(83);
      return yield* this.dispatch(r, a[0].v, [a[1]], f);
    },
    'Object>>doesNotUnderstand:': function* (r, a, f) {
      const msg = a[0], sel = msg.iv.selector.v, margs = msg.iv.arguments.v;
      const cmd = yield this.ev('notifier', -1, `${pr(r)} doesNotUnderstand: ${sel}.`, { kind: 'dnu', title: `${r.cls.name} doesNotUnderstand: ${sel}`, recvClass: r.cls.name, sel, nargs: margs.length });
      if (cmd === 'proceed') return yield* this.dispatch(r, sel, margs, f);
      throw new Abandon();
    },
    'Object>>error:': function* (r, a) {
      const text = isStr(a[0]) ? a[0].v : pr(a[0]);
      yield this.ev('notifier', -1, `${pr(r)} says: ${text}.`, { kind: 'error', title: 'Error: ' + text });
      throw new Abandon();
    },
    'Block>>value': blockPrim, 'Block>>value:': blockPrim, 'Block>>value:value:': blockPrim,
    'ArrayedCollection>>do:': eachPrim(r => isSeq(r) ? elems(r) : null),
    'OrderedCollection>>do:': eachPrim(r => kindOf(r) === 'oc' ? elems(r) : null),
    'Set>>do:': eachPrim(r => kindOf(r) === 'set' ? elems(r) : null),
    'Dictionary>>do:': eachPrim(r => elems(r)),
    'Dictionary>>keysDo:': eachPrim(r => r.v.map(q => q[0])),
    'Dictionary>>associationsDo:': eachPrim(r => r.v.map(q => { const a = newInstance(I.g.Association); a.iv.key = q[0]; a.iv.value = q[1]; return a; })),
    'TextCollector>>show:': function* (r, a) { if (!isStr(a[0])) return FAIL; return yield* this.tsAppend(r, a[0].v, pr(a[0])); },
    'TextCollector>>cr': function* (r) { return yield* this.tsAppend(r, '\n', 'a new line'); },
    'TextCollector>>tab': function* (r) { return yield* this.tsAppend(r, '\t', 'a tab'); },
    'TextCollector>>space': function* (r) { return yield* this.tsAppend(r, ' ', 'a space'); },
    'TextCollector>>clear': function* (r) { r.v.text = ''; return yield* this.tsAppend(r, '', 'nothing, cleared'); }
  };
  /* do: and its relatives: the primitive sends value: to the block once per element.
     In the real system these are ordinary Smalltalk methods; here they're primitives so a trace stays short. */
  function eachPrim(list) {
    return function* (r, a, f) {
      const l = list(r);
      if (!l) return FAIL;
      yield this.primEv(0);
      for (const x of l) yield* this.dispatch(a[0], 'value:', [x], f);
      return r;
    };
  }
  function* blockPrim(b, a, f) {
    const blk = b.v;
    if (blk.params.length !== a.length) return FAIL;
    yield this.primEv(81);
    return yield* this.activateBlock(blk, a, f);
  }

  /* a literal makes a new object each time it's evaluated (characters and symbols are unique) */
  function litObj(lk, v) {
    switch (lk) {
      case 'int': return mk.int(v); case 'float': return mk.flt(v); case 'str': return mk.str(v);
      case 'chr': return mk.chr(v); case 'sym': return mk.sym(v);
      case 'arr': return mk.arr(v.map(x => litObj(x.lk, x.v)));
    }
    throw new Error('bad literal ' + lk);
  }

  /* ---------- evaluator ---------- */
  class Abandon { }
  class NLR { constructor(home, v) { this.home = home; this.v = v; } }
  class StErr { constructor(msg) { this.msg = msg; } }
  class Stop { constructor(kind) { this.kind = kind; } }

  class Frame {
    constructor(kind, method, receiver, sender, outer, home, vars) {
      this.kind = kind; this.method = method; this.receiver = receiver; this.sender = sender; this.outer = outer; this.home = home || this;
      this.vars = vars || Object.create(null); this.stack = []; this.cur = null; this.dead = false; this.ctx = null;
    }
  }
  const slipText = (sel, args) => {
    if (!args.length) return sel;
    if (!sel.includes(':')) return sel + ' ' + lit(args[0]);
    const parts = sel.split(':').filter(Boolean);
    return parts.map((p, i) => p + ': ' + lit(args[i])).join(' ');
  };
  const chainNames = c => { const a = []; for (; c; c = c.superclass) a.push(c.name); return a; };

  class Run {
    constructor(src, opts) {
      opts = opts || {};
      this.src = src; this.ov = opts.overrides || null; this.quiet = !!opts.quiet; this.fuel = opts.fuel || FUEL; this.count = 0;
      this.frames = []; this.vars = opts.vars || Object.create(null); this.maxd = opts.maxDepth || MAXD;
    }
    label(f) {
      if (f.kind === 'workspace') return 'Workspace';
      const m = f.method;
      if (f.kind === 'block') return '[ ] in ' + (m ? m.owner.name + ' >> ' + m.sel : 'Workspace');
      return m.owner.name + ' >> ' + m.sel;
    }
    snap(e) {
      const fr = this.frames, n = fr.length; if (!n) return;
      const a = fr[n - 1];
      e.total = n; e.ctxs = [];
      for (let i = Math.max(0, n - 6); i < n; i++) e.ctxs.push(this.label(fr[i]));
      const vars = [];
      Object.keys(a.vars).slice(0, 6).forEach(k => vars.push([k, pr(a.vars[k])]));
      const stsrc = a.method ? a.method.src : this.src;
      e.active = { sender: a.sender ? this.label(a.sender) : 'nil', ip: a.cur ? stsrc.slice(a.cur.s, a.cur.e).replace(/\s+/g, ' ').slice(0, 34) : 'start', method: this.label(a), receiver: pr(a.receiver), vars, stack: a.stack.slice(-6).map(v => pr(v)) };
      if (a.method) { e.m = { cls: a.method.owner.name, sel: a.method.sel, src: a.method.src, s: a.cur ? a.cur.s : -1, e: a.cur ? a.cur.e : -1 }; }
      else e.m = null;
    }
    ev(t, rail, cap, x) {
      if (++this.count > this.fuel) throw new Stop('fuel');
      const e = x || {};
      e.t = t; e.rail = rail; e.cap = cap; e.depth = this.frames.length; e.n = this.count;
      if (!this.quiet) this.snap(e);
      return e;
    }
    primEv(n) {
      const m = this.primM, who = m ? `${m.owner.name}'s ${m.sel}` : 'This';
      return this.ev('prim', 3, n ? `Run. ${who} is written in the VM. It's primitive ${n}.` : `Run. ${who} is written in the VM. It's called a primitive.`, { ok: true, primN: n });
    }

    *tsAppend(r, text, said) {
      yield this.primEv(0);
      r.v.text = (r.v.text + text).slice(-2000);
      yield this.ev('transcript', 3, `Run. The Transcript shows ${said}.`, { add: text, contents: r.v.text, global: r === I.g.Transcript });
      return r;
    }
    *main() {
      let body;
      try { body = new Parser(this.src).workspace(); }
      catch (err) {
        if (err instanceof ParseError) { yield { t: 'parseError', rail: -1, cap: err.message, pos: err.pos, len: err.len }; return; }
        throw err;
      }
      const f = new Frame('workspace', null, I.nil, null, null, null, this.vars);
      this.frames = [f];
      body.temps.forEach(t => { f.vars[t] = I.nil; });
      let value = I.nil;
      try {
        const r = yield* this.runBody(body, f);
        value = r.v;
      } catch (err) {
        this.frames = [f];
        this.fuel = Infinity;
        if (err instanceof NLR && err.home === f) value = err.v;
        else if (err instanceof Abandon) { yield this.ev('done', -1, 'Abandoned.', { abandoned: true, value: null, printed: null }); return; }
        else if (err instanceof StErr) { yield this.ev('notifier', -1, err.msg, { kind: 'error', title: err.msg }); yield this.ev('done', -1, 'Abandoned.', { abandoned: true, value: null, printed: null }); return; }
        else if (err instanceof Stop) { yield this.ev('notifier', -1, 'Stopped. Too many steps.', { kind: 'fuel', title: 'Too many steps' }); yield this.ev('done', -1, 'Abandoned.', { abandoned: true, value: null, printed: null }); return; }
        else if (err instanceof RangeError) { yield this.ev('notifier', -1, 'Stopped. Too many sends deep.', { kind: 'deep', title: 'Too many sends deep' }); yield this.ev('done', -1, 'Abandoned.', { abandoned: true, value: null, printed: null }); return; }
        else throw err;
      }
      this.fuel = Infinity;
      yield this.ev('done', -1, '', { value, printed: pr(value), info: inspect(value) });
    }

    *runBody(stmts, f) {
      let last = I.nil;
      for (const st of stmts) {
        f.cur = st;
        if (st.k === 'ret') {
          yield* this.evalNode(st.x, f);
          const v = f.stack.pop();
          if (f.kind === 'block') {
            const home = f.home;
            if (home.dead) throw new StErr("This block's method has already answered.");
            yield this.ev('nonlocal', 4, `^ inside a block. ${pr(v)} goes back to whoever sent ${home.method ? home.method.sel : 'this'}.`, { value: pr(v) });
            throw new NLR(home, v);
          }
          return { ret: true, v };
        }
        yield* this.evalNode(st, f);
        last = f.stack.pop();
      }
      return { ret: false, v: last };
    }

    readVar(name, f) {
      switch (name) {
        case 'self': case 'super': return f.receiver;
        case 'nil': return I.nil; case 'true': return I.true; case 'false': return I.false;
        case 'thisContext': return ctxObj(f);
      }
      for (let x = f; x; x = x.outer) if (name in x.vars) return x.vars[name];
      const iv = f.receiver.iv;
      if (iv && name in iv) return iv[name];
      if (name in I.g) return I.g[name];
      throw new StErr(`Nothing called ${name} here.`);
    }
    writeVar(name, f, v) {
      if (['self', 'super', 'nil', 'true', 'false', 'thisContext'].includes(name)) throw new StErr(`You can't store into ${name}.`);
      let root = f;
      for (let x = f; x; x = x.outer) { if (name in x.vars) { x.vars[name] = v; return; } root = x; }
      const iv = f.receiver.iv;
      if (iv && name in iv) { iv[name] = v; return; }
      if (root.kind === 'workspace') { root.vars[name] = v; return; }
      throw new StErr(`Nothing called ${name} here.`);
    }

    *evalNode(n, f) {
      switch (n.k) {
        case 'lit': f.stack.push(litObj(n.lk, n.v)); return;
        case 'var': f.stack.push(this.readVar(n.name, f)); return;
        case 'assign': {
          yield* this.evalNode(n.x, f);
          const v = f.stack[f.stack.length - 1];
          this.writeVar(n.name, f, v);
          yield this.ev('store', -1, `Store. ${n.name} now points at ${pr(v)}. No message here.`, { name: n.name, v: pr(v), info: f.kind === 'workspace' ? null : inspect(f.receiver) });
          return;
        }
        case 'block': {
          const blk = { node: n, params: n.params, temps: n.temps, body: n.body, frame: f, home: f.home };
          f.stack.push(new O(I.g.Block, blk));
          yield this.ev('block', -1, 'A block. Its code waits.', {});
          return;
        }
        case 'send': yield* this.evalSend(n, f); return;
        case 'cascade': yield* this.evalCascade(n, f); return;
        default: throw new Error('bad node ' + n.k);
      }
    }
    superStart(f) {
      const m = f.home.method;
      if (!m) return f.receiver.cls.superclass;
      return m.owner.superclass;
    }
    *evalSend(n, f) {
      const isSuper = n.recv.k === 'var' && n.recv.name === 'super';
      yield* this.evalNode(n.recv, f);
      const r = f.stack[f.stack.length - 1];
      const ws = f.kind === 'workspace';
      const fromSend = n.recv.k === 'send' || n.recv.k === 'cascade';
      yield this.ev('recv', 0, fromSend ? `Find receiver. It's ${pr(r)}, the answer from the last send.` : `Find receiver. It's ${pr(r)}.`, { range: ws ? [n.recv.os, n.recv.oe] : null, info: inspect(r), tags: ws ? [{ r: [n.selS, n.selE], l: 'selector' }].concat(n.args.map(a => ({ r: [a.os, a.oe], l: 'argument' }))) : null });
      for (const a of n.args) yield* this.evalNode(a, f);
      if (n.args.length) {
        const vals = f.stack.slice(-n.args.length);
        yield this.ev('arg', 1, `Evaluate arguments. ${vals.map(v => lit(v)).join(', ')}.`, {});
      }
      const args = n.args.length ? f.stack.splice(-n.args.length) : [];
      f.stack.pop();
      const v = yield* this.dispatch(r, n.sel, args, f, isSuper ? this.superStart(f) : undefined, isSuper ? f.home.method : null);
      f.stack.push(v);
      yield this.ev('answer', 4, `Answer. ${pr(v)} goes back.`, { value: pr(v), range: ws ? [n.os, n.oe] : null, info: null });
    }
    *evalCascade(n, f) {
      const isSuper = n.recv.k === 'var' && n.recv.name === 'super';
      yield* this.evalNode(n.recv, f);
      const r = f.stack[f.stack.length - 1];
      const ws = f.kind === 'workspace';
      yield this.ev('recv', 0, `Find receiver. It's ${pr(r)}.`, { range: ws ? [n.recv.os, n.recv.oe] : null, info: inspect(r) });
      let v = I.nil;
      for (const m of n.msgs) {
        for (const a of m.args) yield* this.evalNode(a, f);
        const args = m.args.length ? f.stack.splice(-m.args.length) : [];
        if (args.length) yield this.ev('arg', 1, `Evaluate arguments. ${args.map(x => lit(x)).join(', ')}.`, {});
        v = yield* this.dispatch(r, m.sel, args, f, isSuper ? this.superStart(f) : undefined, isSuper ? f.home.method : null);
        yield this.ev('answer', 4, `Answer. ${pr(v)} goes back.`, { value: pr(v), range: null });
      }
      f.stack.pop();
      f.stack.push(v);
      if (ws) yield this.ev('answer', 4, `Answer. ${pr(v)} goes back.`, { value: pr(v), range: [n.os, n.oe], cascadeEnd: true });
    }

    *dispatch(recv, sel, args, f, start, superFrom) {
      const rc = recv.cls, chain = chainNames(rc);
      const slip = slipText(sel, args);
      let c = start === undefined ? rc : start, m = null, first = true;
      const startName = c ? c.name : null;
      const fromName = superFrom ? superFrom.owner.name : null;
      while (c) {
        m = (this.ov && this.ov[c.name + '>>' + sel]) || c.methods[sel] || null;
        const lead = first && fromName ? `Look up. super: start above ${fromName}, at ${c.name}. ` : 'Look up. ';
        const cap = m ? `${lead}${c.name} has ${sel}.` : `${lead}${c.name} has no ${sel}. Go up.`;
        yield this.ev('look', 2, cap, { sel, cls: c.name, hit: !!m, chain, first, slip, start: startName, superFrom: fromName, wrapped: sel === 'doesNotUnderstand:' });
        first = false;
        if (m) break;
        c = c.superclass;
      }
      if (!m) {
        if (sel === 'doesNotUnderstand:') throw new StErr('Recursive doesNotUnderstand:.');
        yield this.ev('dnu', 2, `No match anywhere. Wrap the message and send doesNotUnderstand: to ${pr(recv)}.`, { sel, slip, chain, info: inspect(recv) });
        const msg = newInstance(I.g.Message);
        msg.iv.selector = mk.sym(sel); msg.iv.arguments = mk.arr(args.slice());
        return yield* this.dispatch(recv, 'doesNotUnderstand:', [msg], f);
      }
      return yield* this.invoke(m, recv, args, f);
    }

    *invoke(m, recv, args, f) {
      if (m.prim !== null && m.fn) {
        this.primM = m;
        const r = m.isGen ? yield* m.fn.call(this, recv, args, f) : m.fn(recv, args, this);
        if (r !== FAIL) {
          if (!m.isGen) yield this.primEv(m.prim);
          return r;
        }
        yield this.ev('prim', 3, "Run. The primitive can't do this, so its method takes over.", { ok: false });
      }
      return yield* this.activate(m, recv, args, f);
    }

    *stopDeep() {
      yield this.ev('notifier', -1, 'Stopped. Too many sends deep.', { kind: 'deep', title: 'Too many sends deep' });
      throw new Abandon();
    }

    *activate(m, recv, args, f) {
      if (this.frames.length >= this.maxd) yield* this.stopDeep();
      const nf = new Frame('method', m, recv, f, null, null);
      m.params.forEach((p, i) => { nf.vars[p] = args[i]; });
      m.temps.forEach(t => { nf.vars[t] = I.nil; });
      this.frames.push(nf);
      try {
        yield this.ev('enter', 3, `Run. ${m.owner.name} >> ${m.sel} starts. The sender waits.`, { info: inspect(recv) });
        const r = yield* this.runBody(m.body, nf);
        return r.ret ? r.v : recv;
      } catch (e) {
        if (e instanceof NLR && e.home === nf) return e.v;
        throw e;
      } finally { nf.dead = true; this.frames.pop(); }
    }

    *activateBlock(blk, args, f) {
      if (this.frames.length >= this.maxd) yield* this.stopDeep();
      const nf = new Frame('block', blk.home.method, blk.frame.receiver, f, blk.frame, blk.home);
      blk.params.forEach((p, i) => { nf.vars[p] = args[i]; });
      blk.temps.forEach(t => { nf.vars[t] = I.nil; });
      this.frames.push(nf);
      try {
        const r = yield* this.runBody(blk.body, nf);
        return r.v;
      } finally { nf.dead = true; this.frames.pop(); }
    }
  }

  /* ---------- public API ---------- */
  function compile(className, src, user) {
    const c = I.classes[className];
    if (!c) return { error: `Nothing called ${className} here.` };
    try {
      const m = compileInto(c, src);
      c.methods[m.sel] = m;
      I.version++;
      if (user) { I.log = I.log.filter(l => !(l.k === 'm' && l.cls === className && l.sel === m.sel)); I.log.push({ k: 'm', cls: className, sel: m.sel, src }); }
      return { ok: true, sel: m.sel };
    } catch (e) {
      if (e instanceof ParseError) return { error: e.message, pos: e.pos, len: e.len };
      throw e;
    }
  }
  function detached(className, src) { return compileInto(I.classes[className], src); }

  function evaluate(src, opts) {
    opts = opts || {};
    const run = new Run(src, opts);
    const g = run.main();
    const trace = [], notifiers = [];
    let cmd, out = { value: null, printed: null, trace, notifiers, parseError: null, abandoned: false };
    for (;;) {
      const n = g.next(cmd); cmd = undefined;
      if (n.done) break;
      const e = n.value;
      trace.push(e);
      if (e.t === 'parseError') { out.parseError = e; break; }
      if (e.t === 'notifier') { notifiers.push(e); cmd = opts.onNotifier ? opts.onNotifier(e) : 'abandon'; }
      if (e.t === 'done') { out.value = e.value; out.printed = e.printed; out.abandoned = !!e.abandoned; }
    }
    return out;
  }

  function highlightStyle() {
    try {
      const r = evaluate('Highlight style', { quiet: true, fuel: 2000, maxDepth: 40 });
      if (r.value && r.value.cls === I.g.Symbol) return r.value.v;
    } catch (e) { /* keep the current look */ }
    return null;
  }

  function parts(src) {
    try {
      const b = new Parser(src).workspace();
      if (b.length !== 1 || b[0].k !== 'send') return null;
      const n = b[0];
      return { recv: [n.recv.os, n.recv.oe], recvKind: n.recv.k, recvName: n.recv.name, sel: [n.selS, n.selE], args: n.args.map(a => [a.os, a.oe]), argKinds: n.args.length };
    } catch (e) { return null; }
  }

  function importLog(log) {
    (log || []).forEach(l => {
      if (l.k === 'c' && I.g[l.sup]) defineClass(l.name, I.g[l.sup], l.iv || [], true);
      if (l.k === 'm') compile(l.cls, l.src, true);
    });
  }

  boot();
  return {
    boot, Run, Parser, ParseError, evaluate, compile, detached, highlightStyle, parts, pr, inspect, importLog,
    newVars: () => Object.create(null),
    get log() { return I.log; },
    get version() { return I.version; },
    get transcript() { return I.g.Transcript.v.text; },
    classNamed: n => I.classes[n] || null,
    className: v => v.cls.name,
    selectors: n => { const c = I.classes[n]; return c ? Object.keys(c.methods) : []; },
    methodSource: (n, sel) => { const c = I.classes[n]; return c && c.methods[sel] ? c.methods[sel].src : ''; },
    chain: n => { const c = I.classes[n]; return c ? chainNames(c) : []; }
  };
})();
