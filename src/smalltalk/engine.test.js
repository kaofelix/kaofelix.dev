/* Interpreter tests: each expression's printString, plus traces and notifiers. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ST } from './engine.js';

let pass = 0, fail = 0;
const failures = [];
const eq = (name, got, want) => { if (got === want) pass++; else { fail++; failures.push(`${name} => got ${got}, want ${want}`); } };
const v = (s, o) => ST.evaluate(s, Object.assign({ vars: ST.newVars() }, o || {}));
const T = (s, want) => { let r; try { r = v(s); } catch (e) { fail++; failures.push(`${s} threw ${e}`); return; } eq(s, r.printed, want); };

T('3 + 4', '7'); T('2 + 3 * 4', '20'); T('2 + (3 * 4)', '14'); T('3 squared + 1', '10'); T('3 + 4 max: 10', '10');
T('3 factorial', '6'); T('3 max: 4', '4'); T('true ifTrue: [1] ifFalse: [2]', '1');
{ const r = v('3 + 1.5'); eq('3 + 1.5', r.printed, '4.5');
  eq('prim fail in trace', r.trace.some(e => e.t === 'prim' && e.ok === false), true);
  eq('addInteger: in trace', r.trace.some(e => e.t === 'look' && e.sel === 'addInteger:'), true); }
T('1@2 + 5', '6@7'); T('3 + (1@2)', '4@5');
{ const r = v("'hi' + 5"); eq("'hi' + 5 notifier", r.notifiers[0] && r.notifiers[0].title, 'String doesNotUnderstand: +'); }
{ const r = v('3 foo'); eq('3 foo dnu', r.notifiers[0] && r.notifiers[0].kind, 'dnu'); }
{ const r = v('3 + + ]'); eq('parse error', r.parseError && r.parseError.cap, "I can't read this. Check near the marker."); }
{ const r = v('fred + 1'); eq('unknown', r.notifiers[0] && r.notifiers[0].title, 'Nothing called fred here.'); }
{ let restarts = 0; const r = v('3 double', { onNotifier: e => { eq('double notifier', e.sel, 'double'); ST.compile('SmallInteger', 'double\n  ^ self * 2', true); return 'proceed'; } });
  eq('3 double after proceed', r.printed, '6'); eq('one recv at top', r.trace.filter(e => e.t === 'recv' && e.range).length, 1); ST.boot(); }
T("true ifTrue: ['yes']", "'yes'"); T("false ifTrue: ['yes']", 'nil'); T('6 factorial', '720');
T('(100@100 corner: 200@200) center', '150@150');
T('example3 test', '2'); T('example4 result1', '4'); T('example4 result2', '4'); T('example3 result3', '2'); T('example4 result3', '2'); T('Two new result1', '2');
T('3 class', 'SmallInteger'); T('3 class = SmallInteger', 'true'); T('3 class class', 'SmallInteger class'); T('3 class class class', 'Metaclass');
T('Metaclass class class', 'Metaclass'); T('Object class superclass', 'Class'); T('Point class superclass', 'Object class');
T('x := 0. [x < 3] whileTrue: [x := x + 1]. x', '3');
T('OrderedCollection new add: 1; add: 2; add: 3; yourself', 'OrderedCollection (1 2 3 )');
T('3 perform: #+ with: 4', '7'); T('thisContext sender', 'nil');
{ ST.compile('Object', 'forever\n  ^ self forever'); const r = v('3 forever'); eq('too deep', r.notifiers[0] && r.notifiers[0].kind, 'deep'); eq('too deep cap', r.notifiers[0].cap, 'Stopped. Too many sends deep.'); ST.boot(); }
{ ST.compile('Object', 'early\n  #(a) size.\n  true ifTrue: [^ 5].\n  ^ 6'); }
{ ST.boot(); ST.compile('Object', 'early\n  true ifTrue: [^ 5].\n  ^ 6'); T('3 early', '5'); ST.boot(); }
T('7 / 2', '3.5'); T('nil isNil', 'true'); T('3 isNil', 'false'); T('2.5 + 5', '7.5'); T('(1@2) x', '1'); T('Point new', 'nil@nil'); T('Point x: 1 y: 2', '1@2');
T('(OrderedCollection new add: 1; add: 2; yourself) collect: [:e | e * 2]', 'OrderedCollection (2 4 )');
T('(OrderedCollection new add: 1; add: 2; yourself) inject: 0 into: [:a :e | a + e]', '3');
T('d := Door new. d openDuring: [d isOpen]', 'true'); T('d := Door new. d openDuring: [d isOpen]. d isOpen', 'false');
T('thisContext receiver', 'nil'); T('(x := 3) describe2. 1', null);
T("'abc' , 'de'", "'abcde'"); T('#foo', 'foo'); T('3 - -1', '4'); T('3-1', '2'); T('3 > 0 ifTrue: [1]', '1');
T('3 between: 1 and: 5', 'true'); T('-3 abs', '3');
{ const r = v('Object subclass: #Receipt instanceVariableNames: \'items\'. Receipt new total'); eq('Receipt dnu', r.notifiers[0] && r.notifiers[0].title, 'Receipt doesNotUnderstand: total'); ST.boot(); }

/* review fixes */
T('2.5 * 2', '5.0'); T('(2.5 * 2) class', 'Float'); T('2.5 - 0.5', '2.0'); T('(3.0 / 1.0) class', 'Float'); T('1.5 + 1.5', '3.0'); T('6 / 2', '3'); T('(6 / 2) class', 'SmallInteger'); T('3 + 1.5', '4.5'); T('1 + 0.5 + 0.5', '2.0'); T('(1 + 1.0) class', 'Float'); T('-7 // 2', '-4');
T('| x | x := 3. x', '3'); T('|| 4', '4'); T('| a b | a := 1. b := 2. a + b', '3');
{ const r = v('16r1F'); eq('radix is a parse error', !!r.parseError, true); } { const r = v('1e3'); eq('exponent is a parse error', !!r.parseError, true); }
{ const r = v('3 / 0'); eq('zero divide', r.notifiers[0] && r.notifiers[0].title, 'Error: ZeroDivide'); }
{ const r = v('3 / (1@2)'); eq('non-number divide', r.notifiers[0] && r.notifiers[0].title, 'Error: not a number'); }
{ ST.boot(); ST.compile('Three', 'casc\n  ^ super test; test'); T('example4 casc', '2'); ST.boot(); }
{ const r = v('example4 result3'); eq('super caption', r.trace.some(e => e.cap === 'Look up. super: start above Three, at Two. Two has test.'), true); }
{ const r = v('2 + 3 * 4'); eq('answer becomes receiver', r.trace.some(e => e.cap === "Find receiver. It's 5, the answer from the last send."), true); eq('primitive named', r.trace.some(e => /SmallInteger's \+ is written in the VM\. It's primitive 1\./.test(e.cap)), true); }
eq('highlight', ST.highlightStyle(), 'inverted');
{ const r = ST.evaluate('1 foo: 2', {quiet:true}); eq('kw dnu', r.notifiers[0].sel, 'foo:'); }
{ const t0 = Date.now(); const r = v('x := 0. [x < 100] whileTrue: [x := x + 1]. x'); console.log('while100', r.printed, r.trace.length, 'events', Date.now() - t0, 'ms'); }

/* literals: characters, symbols, literal arrays (pp. 20-21) */
T('$a', '$a'); T('$a class', 'Character'); T("$'", "$'"); T('$  class', 'Character'); T('$a == $a', 'true');
T('#foo class', 'Symbol'); T('#at:put:', 'at:put:'); T('#+', '+'); T('#foo == #foo', 'true'); T('#foo size', '3');
T('#(1 2 3)', '(1 2 3 )'); T('#(1 2 3) class', 'Array'); T('#()', '()'); T('#(3 1 4 1 5) size', '5');
T("#(9 'nine' $9 nine (0 'zero' $0 () 'e' $f))", "(9 'nine' $9 nine (0 'zero' $0 () 'e' $f ) )");
T('#(1 -2 3.5 #foo bar at:put: + #(4))', '(1 -2 3.5 foo bar at:put: + (4 ) )');
T('#(1 2) = #(1 2)', 'true'); T('#(1 2) = #(2 1)', 'false'); T('#(1 2) == #(1 2)', 'false');
{ const r = v('#(1 2'); eq('open literal array', !!r.parseError, true); } { const r = v('$'); eq('lone $', !!r.parseError, true); }
T('3-#(1) size', '2'); T("'a' , 'b' size printString", "'a1'");
/* printString */
T("'hello'", "'hello'"); T("'it''s'", "'it''s'"); T("'hello' printString", "'''hello'''"); T('3 printString', "'3'"); T('#foo printString', "'foo'");
T('$a printString', "'$a'"); T('#(1 $a) printString', "'(1 $a )'"); T("(1 -> 2) printString", "'1->2'");
T('#(1 2 3 4 5 6 7 8 9 10 11 12 13 14)', '(1 2 3 4 5 6 7 8 9 10 11 12 ...etc... )');
/* the three kinds of message, on strings */
T("'hello' size", '5'); T("'hello' , ' world'", "'hello world'"); T("'hello' copyReplaceAll: 'l' with: 'L'", "'heLLo'");
T("'hello' , ' world' copyReplaceAll: 'o' with: '0'", "'hell0 w0rld'");
T("'hello' asUppercase", "'HELLO'"); T("s := 'hello'. s asUppercase. s", "'hello'"); T("'HeLLo' asLowercase", "'hello'");
T("'hello' at: 1", '$h'); T("'hello' first", '$h'); T("'hello' last", '$o');
T("s := 'hello' copyFrom: 1 to: 5. s at: 1 put: $j. s", "'jello'"); T("'hello' indexOf: $l", '3'); T("'hello' copyFrom: 2 to: 4", "'ell'");
T("'hello' includes: $e", 'true'); T("'hello' includes: $z", 'false'); T("'hello' isEmpty", 'false'); T("'' isEmpty", 'true');
T("'hello' asSymbol", 'hello'); T("'hello' asSymbol class", 'Symbol'); T("#hello asString", "'hello'"); T("'abc' < 'abd'", 'true'); T("'abc' = 'abc'", 'true'); T("'abc' == 'abc'", 'false');
T("'hello' class", 'String'); T("'hello' class superclass", 'ArrayedCollection'); T('#foo class superclass', 'String');
T("#hello , '!'", "'hello!'"); T("(#hello , '!') class", 'String');
{ const r = v('#hello at: 1 put: $j'); eq('symbol is read-only', r.notifiers[0] && r.notifiers[0].title, 'Error: index out of bounds'); }
{ const r = v("'abc' at: 9"); eq('string bounds', r.notifiers[0] && r.notifiers[0].title, 'Error: index out of bounds'); }
{ const r = v("'abc' at: 1 put: 3"); eq('string holds characters', !!r.notifiers.length, true); }
T("'hello' collect: [:c | c asUppercase]", "'HELLO'"); T("'hello' select: [:c | c isVowel]", "'eo'"); T("'hello' detect: [:c | c isVowel] ifNone: [nil]", '$e');
T("'hello' inject: 0 into: [:n :c | n + 1]", '5'); T("'hello' asSet size", '4'); T("'hello' asSet", 'Set ($e $h $l $o )'); T("'hello' reject: [:c | c isVowel]", "'hll'");
/* characters */
T('$a value', '97'); T('97 asCharacter', '$a'); T('Character value: 65', '$A'); T('$a asUppercase', '$A'); T('$e isVowel', 'true'); T('$b isVowel', 'false');
T('$a < $b', 'true'); T('$a max: $z', '$z'); T('$3 isDigit', 'true'); T('$a isLetter', 'true');
/* arrays and iteration */
T('#(3 1 4) collect: [:x | x * x]', '(9 1 16 )'); T('#(3 1 4 1 5) collect: [:x | x * x]', '(9 1 16 1 25 )'); T('#(3 1 4 1 5) select: [:x | x > 2]', '(3 4 5 )');
T('#(3 1 4 1 5) reject: [:x | x > 2]', '(1 1 )'); T('#(3 1 4 1 5) inject: 0 into: [:sum :x | sum + x]', '14'); T('#(3 1 4 1 5) detect: [:x | x > 3] ifNone: [nil]', '4');
T('#(3 1 4 1 5) detect: [:x | x > 9] ifNone: [nil]', 'nil'); T("#(3 1 4 1 5) detect: [:x | x > 9] ifNone: ['none']", "'none'");
{ const r = v('#(3 1 4) detect: [:x | x > 9]'); eq('detect: error', r.notifiers[0] && r.notifiers[0].title, 'Error: object is not in the collection'); }
T('sum := 0. #(3 1 4 1 5) do: [:x | sum := sum + x]. sum', '14'); T('#(3 1 4) do: [:x | x]', '(3 1 4 )');
T('#(3 1 4) , #(1 5)', '(3 1 4 1 5 )'); T('#(3 1 4) includes: 4', 'true'); T('#(3 1 4) at: 2', '1');
T('a := Array new: 3. a at: 2 put: 7. a', '(nil 7 nil )'); T('(Array new: 2) size', '2'); T('#(3 1 4) asOrderedCollection', 'OrderedCollection (3 1 4 )');
T("#(3 1 4) copyReplaceAll: #(1) with: #(9 9)", '(3 9 9 4 )'); T('#(1 2) copyWith: 3', '(1 2 3 )'); T('#(3 1 4) isEmpty', 'false'); T('#(3 1 4 1 5) asSet', 'Set (1 3 4 5 )');
T('Array with: 1 with: 2', '(1 2 )'); T("(String new: 2) size", '2'); T('#(3 1 4) first', '3'); T('#(3 1 4) last', '4'); T('#(3 1 4) indexOf: 4', '3');
T('#($h $i) asArray', '($h $i )'); T("'hi' asArray", '($h $i )'); T("'hello' asOrderedCollection removeFirst", '$h');
{ const r = v('#(1 2) do: 3'); eq('do: needs a block', r.notifiers[0] && r.notifiers[0].title, 'SmallInteger doesNotUnderstand: value:'); }
{ const r = v('#(1 2) collect: [:x | x * 2]'); eq('collect: sends value:', r.trace.filter(e => e.t === 'look' && e.sel === 'value:' && e.hit).length >= 2, true);
  eq('do: is a primitive here', r.trace.some(e => e.t === 'prim' && /ArrayedCollection's do: is written in the VM/.test(e.cap)), true); }
{ const r = v("#(1 2) size"); eq('Array size found in ArrayedCollection', r.trace.some(e => e.t === 'look' && e.cls === 'ArrayedCollection' && e.hit && e.sel === 'size'), true); }
/* OrderedCollection */
T('OrderedCollection new', 'OrderedCollection ()'); T('c := OrderedCollection new. c add: 3. c add: 4. c', 'OrderedCollection (3 4 )'); T('OrderedCollection new add: 3', '3');
T('c := OrderedCollection new. c add: 3; add: 4; addFirst: 1. c', 'OrderedCollection (1 3 4 )'); T('(OrderedCollection new add: 3; add: 4; yourself) removeLast', '4');
T('(OrderedCollection new add: 3; add: 4; yourself) select: [:x | x > 3]', 'OrderedCollection (4 )');
T('(OrderedCollection new add: 3; add: 4; yourself) at: 2', '4'); T('OrderedCollection new class', 'OrderedCollection');
{ const r = v('OrderedCollection new removeFirst'); eq('empty removeFirst', r.notifiers[0] && r.notifiers[0].title, 'Error: this collection is empty'); }
T('(OrderedCollection with: 5 with: 6) size', '2');
/* Set */
T('s := Set new. s add: 3; add: 3; add: 4. s', 'Set (3 4 )'); T('s := Set new. s add: 3; add: 3; add: 4. s size', '2'); T("s := Set new. s add: 'a'; add: 'a'. s size", '1');
T('(#(3 1 4 1 5) asSet collect: [:x | x \\\\ 2]) size', '2'); T('(#(3 1 4 1 5) asSet select: [:x | x > 3]) class', 'Set'); T('(Set new add: 3; yourself) includes: 3', 'true');
{ const r = v('Set new remove: 3'); eq('set remove missing', r.notifiers[0] && r.notifiers[0].title, 'Error: object is not in the collection'); }
{ const r = v("'hello' reversed"); eq('reversed is not in the book', r.notifiers[0] && r.notifiers[0].title, 'String doesNotUnderstand: reversed'); }
/* Dictionary (opposites from p. 149) */
const OPP = "opposites := Dictionary new. opposites at: #hot put: #cold; at: #push put: #pull; at: #stop put: #go. ";
T(OPP + 'opposites size', '3'); T(OPP + 'opposites at: #hot', 'cold'); T(OPP + 'opposites', 'Dictionary (hot->cold push->pull stop->go )');
T(OPP + 'opposites includes: #cold', 'true'); T(OPP + 'opposites includes: #hot', 'false'); T(OPP + 'opposites includesKey: #hot', 'true');
T(OPP + 'opposites at: #stop put: #start. opposites at: #stop', 'start'); T(OPP + 'opposites at: #warm ifAbsent: [0]', '0'); T(OPP + 'opposites keys size', '3');
T(OPP + 'opposites keys class', 'Set'); T(OPP + "opposites removeKey: #hot. opposites size", '2'); T(OPP + 'n := 0. opposites keysDo: [:k | n := n + 1]. n', '3');
T(OPP + "(opposites select: [:x | x == #go]) size", '1'); T(OPP + 'opposites add: (Association key: #top value: #bottom). opposites at: #top', 'bottom');
T("d := Dictionary new. d at: 'rent' put: 700. d", "Dictionary ('rent'->700 )"); T("d := Dictionary new. d at: 'rent' put: 700. d at: 'rent'", '700');
T(OPP + 'n := 0. opposites associationsDo: [:a | n := n + 1]. n', '3'); T('(#a -> 3) value', '3'); T('(#a -> 3) key', 'a');
{ const r = v('Dictionary new at: #x'); eq('missing key', r.notifiers[0] && r.notifiers[0].title, 'Error: key not found'); }
/* the same message, four receivers (section 2) */
{ const vars = ST.newVars(); ST.evaluate(OPP, { vars, quiet: true });
  const sz = s => { const r = ST.evaluate(s, { vars }); return [r.printed, r.trace.filter(e => e.t === 'look' && e.hit && e.sel === 'size' && e.depth === 1).map(e => e.cls)[0]]; };
  eq('string size', sz("'hello' size").join(' '), '5 String'); eq('array size', sz('#(3 1 4 1 5) size').join(' '), '5 ArrayedCollection');
  eq('set size', sz('#(3 1 4 1 5) asSet size').join(' '), '4 Set'); eq('dict size', sz('opposites size').join(' '), '3 Set'); }
/* Transcript */
{ ST.boot(); const r = v("Transcript show: 'Hello, world'"); eq('show: answers the Transcript', r.printed, 'a TextCollector'); eq('transcript text', ST.transcript, 'Hello, world');
  eq('transcript event', r.trace.some(e => e.t === 'transcript' && e.contents === 'Hello, world' && e.global), true);
  v('Transcript cr; show: 3 printString; tab; show: #x; space; print: 4'); eq('transcript cascade', ST.transcript, 'Hello, world\n3\tx 4');
  v('Transcript clear'); eq('clear', ST.transcript, ''); v('#(3 1 4) do: [:x | Transcript print: x; cr]'); eq('do: into transcript', ST.transcript, '3\n1\n4\n');
  const r2 = v('Transcript show: 3'); eq('show: needs a string', r2.notifiers[0] && r2.notifiers[0].title, 'Error: not a string');
  T('Transcript class', 'TextCollector'); ST.boot(); eq('boot clears transcript', ST.transcript, ''); }
/* doesNotUnderstand, then the method is written and the send resumes (section 3) */
{ const r = v("'hello' shout", { onNotifier: e => { eq('shout notifier', e.title, 'String doesNotUnderstand: shout'); ST.compile('String', "shout\n  ^ self asUppercase , '!'", true); return 'proceed'; } });
  eq('shout after proceed', r.printed, "'HELLO!'"); T('#hello shout', "'HELLO!'"); ST.boot(); }
{ const r = v("'hello' shout"); eq('shout dnu', r.notifiers[0] && r.notifiers[0].title, 'String doesNotUnderstand: shout'); }
{ const r = v("3 foo: #bar"); eq('slip shows # for a symbol', r.trace.some(e => e.t === 'look' && e.slip === 'foo: #bar'), true); }
/* classes are objects (section 6) */
T("'hello' class class", 'String class'); T('OrderedCollection class', 'OrderedCollection class'); T('Set superclass', 'Collection'); T('Dictionary superclass', 'Set');
{ const r = v('Symbol new'); eq('no Symbol new', r.notifiers[0] && r.notifiers[0].title, 'Error: cannot make one of these'); }
{ const r = v("OrderedCollection subclass: #Pile instanceVariableNames: ''. Pile new add: 3; yourself"); eq('subclass of OrderedCollection', r.printed, 'Pile (3 )'); ST.boot(); }

test('the interpreter answers like Smalltalk-80', () => {
  assert.equal(fail, 0, `${fail} of ${pass + fail} checks failed:\n${failures.join('\n')}`);
});
