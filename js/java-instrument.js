/* ══════════════════════════════════════════════════════════════════════
   java-instrument.js ─ Rewrites the user's Java so it prints its own
   state, then hands back a table describing every card it can emit.

   Insertions are made at exact CST character offsets, never by line, and
   none contain a newline, so javac line numbers stay aligned with the
   user's source (see _mapJavaLines in lang.js).

   What gets inserted, mirroring what Python's sys.settrace reports:
     before each statement        __Tracer.t(line, sid, vars…);
     at each loop-condition check __Tracer.c(line, sid, vars…) && (cond)
     around each method body      __Tracer.enter(…); try { … } finally { __Tracer.exit(); }
     on each return value         return __Tracer.ret(expr);
     around braceless bodies      { card; stmt }

   Node names and child keys were read off a real CST with
   dev/cst-probe.html (java-parser 3.0.1), not guessed.
   Depends on: window.JavaParser (ESM shim in index.html)
   ══════════════════════════════════════════════════════════════════════ */

/* Constructs a trace cannot show faithfully. Lambdas and streams are NOT in
   this list: their bodies are simply left untraced, like a Python list
   comprehension, while the statements around them trace normally. */
const JAVA_UNSUPPORTED = [
  { name:'threads',            re:/\bnew\s+Thread\b|\bExecutorService\b|\bsynchronized\b|\bimplements\s+Runnable\b/ },
  { name:'reflection',         re:/\bClass\.forName\b|\.getDeclaredMethod\b|\bjava\.lang\.reflect\b/ },
  { name:'file or network IO', re:/\bnew\s+File\b|\bFileReader\b|\bSocket\b|\bnew\s+URL\b/ }
];

function detectUnsupported(src){
  return JAVA_UNSUPPORTED.filter(u => u.re.test(src)).map(u => u.name);
}

function parseJava(src){
  if(!window.JavaParser) return { cst:null, error:'Java parser is still loading' };
  try { return { cst: window.JavaParser.parse(src), error:null }; }
  catch(e){
    const m = (e && e.message) ? e.message.split('\n')[0] : String(e);
    return { cst:null, error:m };
  }
}

const _isTok = n => !!n && typeof n.image === 'string' && typeof n.startOffset === 'number';
const _ch    = (n, k, i = 0) => (n && n.children && n.children[k]) ? n.children[k][i] : undefined;
const _all   = (n, k) => (n && n.children && n.children[k]) || [];
const _so    = n => _isTok(n) ? n.startOffset : n.location.startOffset;
const _eo    = n => _isTok(n) ? n.endOffset   : n.location.endOffset;   // inclusive
const _line  = n => _isTok(n) ? n.startLine   : n.location.startLine;

/* The concrete statement inside a `statement` wrapper node. */
function _inner(st){
  const c = (st && st.children) || {};
  if(c.ifStatement)    return { kind:'if',    node:c.ifStatement[0] };
  if(c.whileStatement) return { kind:'while', node:c.whileStatement[0] };
  if(c.forStatement){
    const f = c.forStatement[0].children;
    return f.basicForStatement ? { kind:'for',     node:f.basicForStatement[0] }
                               : { kind:'foreach', node:f.enhancedForStatement[0] };
  }
  if(c.labeledStatement) return { kind:'label', node:c.labeledStatement[0] };
  if(c.statementWithoutTrailingSubstatement){
    const w = c.statementWithoutTrailingSubstatement[0].children;
    const k = Object.keys(w)[0];
    const map = { block:'block', doStatement:'do', returnStatement:'return',
                  emptyStatement:'empty', switchStatement:'switch' };
    return { kind: map[k] || 'stmt', node: w[k][0] };
  }
  return { kind:'stmt', node:st };
}

/* Look through labels: `outer: for (…)` is a loop. */
function _innerDeep(st){
  let k = _inner(st);
  while(k.kind === 'label') k = _inner(_ch(k.node, 'statement'));
  return k;
}
const _isLoop = kind => kind === 'while' || kind === 'for' || kind === 'do';

/* Literally-true conditions must not be wrapped: javac treats while(true)
   and for(;;) as never completing normally, and a wrapped condition would
   make a method ending in one fail with "missing return statement". */
const _constTrue = src => /^\s*true\s*$/.test(src);

const _PRIM = /^(int|long|short|byte|char|float|double)$/;

function instrumentJava(src){
  const unsupported = detectUnsupported(src);
  const { cst, error } = parseJava(src);
  if(error) return { code:null, error, unsupported, sids:[] };

  const text  = n => src.slice(_so(n), _eo(n) + 1);
  const ins   = [];                       // { pos, pri, text }
  const add   = (pos, pri, t) => ins.push({ pos, pri, text:t });
  const sids  = [];
  const newSid = info => { sids.push(info); return sids.length - 1; };

  /* ── Pass 1: declarations, their scopes, and regions left untraced ── */
  const SCOPES = new Set(['block','basicForStatement','enhancedForStatement',
    'methodDeclaration','constructorDeclaration','catchClause','switchBlock','lambdaExpression']);
  const decls = [];      // { name, at, scopeEnd, init, final, type, dims, idEnd, skip }
  const skips = [];      // [so, eo] lambdas and classes declared inside methods
  const blockStmts = []; // { so, eo, text }
  const handledIds = new Set();

  (function walk(n, scopeEnd, inMethod, inSkip, parent){
    if(!n || typeof n !== 'object' || _isTok(n)) return;
    let end = SCOPES.has(n.name) ? _eo(n) : scopeEnd;
    let meth = inMethod || n.name === 'methodDeclaration' || n.name === 'constructorDeclaration';
    let skip = inSkip;
    if(n.name === 'lambdaExpression' || (n.name === 'classBody' && inMethod)){
      skip = true; skips.push([_so(n), _eo(n)]);
    }

    if(n.name === 'blockStatement' && !skip)
      blockStmts.push({ so:_so(n), eo:_eo(n), text:text(n) });

    if(n.name === 'localVariableDeclaration'){
      const isForEach = parent === 'enhancedForStatement';
      const type = text(_ch(n, 'localVariableType')).trim();
      const isFinal = _all(n, 'variableModifier').some(m => /\bfinal\b/.test(text(m)));
      for(const vd of _all(_ch(n, 'variableDeclaratorList'), 'variableDeclarator')){
        const idN = _ch(vd, 'variableDeclaratorId'), tok = _ch(idN, 'Identifier');
        handledIds.add(tok.startOffset);
        decls.push({ name: tok.image, at: tok.startOffset, scopeEnd: end,
          init: isForEach || !!_ch(vd, 'variableInitializer'),
          final: isFinal, type, dims: !!_ch(idN, 'dims'), idEnd: _eo(idN), skip });
      }
    } else if(n.name === 'variableDeclaratorId' && meth){
      /* Only method-scoped names: parameters, catch and lambda params.
         Class fields are excluded. Python does not show self.x either, and
         a nested class's field would otherwise be read, unresolvable, from
         Solution's own methods. */
      const tok = _ch(n, 'Identifier');
      if(tok && !handledIds.has(tok.startOffset))
        decls.push({ name: tok.image, at: tok.startOffset, scopeEnd: end, init: true,
                     final: false, type: '', dims: false, idEnd: _eo(n), skip });
    }

    for(const k in n.children || {})
      for(const c of n.children[k] || []) walk(c, end, meth, skip, n.name);
  })(cst, Infinity, false, false, null);

  const inSkip = pos => skips.some(([a, b]) => pos >= a && pos <= b);

  /* Names a lambda or local class reads from the enclosing method must stay
     effectively final, so they never get a default initializer added. */
  const captured = new Set();
  (function walk(n){
    if(!n || typeof n !== 'object') return;
    if(_isTok(n)){ if(n.tokenType && n.tokenType.name === 'Identifier' && inSkip(n.startOffset)) captured.add(n.image); return; }
    for(const k in n.children || {}) for(const c of n.children[k] || []) walk(c);
  })(cst);

  /* A local declared without an initializer (`int best;`) is unassigned
     until some statement assigns it, and javac rejects reading it before
     that. We give it a default initializer, which cannot change behaviour
     (the original already compiled, so it is never read unassigned), and we
     keep it out of cards until the first statement that assigns it, which
     is also when Python would first show it. */
  for(const d of decls){
    if(d.init){ d.visibleFrom = d.at + 1; continue; }
    if(d.final || captured.has(d.name)){ d.visibleFrom = Infinity; continue; }
    const esc = d.name.replace(/\$/g, '\\$');
    const re = new RegExp('(^|[^\\w.$])' + esc + '\\s*(=(?!=)|[-+*/%&|^]=|<<=|>>>?=|\\+\\+|--)|(\\+\\+|--)\\s*' + esc + '\\b');
    const first = blockStmts.filter(b => b.so > d.at && b.so <= d.scopeEnd && re.test(b.text))
                            .sort((a, b) => a.so - b.so)[0];
    d.visibleFrom = first ? first.eo + 1 : Infinity;
    const init = (d.dims || /\[\]/.test(d.type)) ? 'null'
               : _PRIM.test(d.type) ? '0' : d.type === 'boolean' ? 'false' : 'null';
    add(d.idEnd + 1, 5, ' = ' + init);
  }

  const liveAt = pos => {
    const out = [];
    for(const d of decls){
      if(d.skip) continue;
      if(pos >= d.visibleFrom && pos <= d.scopeEnd && !out.includes(d.name)) out.push(d.name);
    }
    return out;
  };
  const kvAt = pos => liveAt(pos).map(v => `, "${v}", ${v}`).join('');

  /* ── Pass 2: insertions ── */
  function card(pos, line, info, pri){
    const sid = newSid(Object.assign({ line, pos }, info));
    add(pos, pri, `__Tracer.t(${line}, ${sid}${kvAt(pos)});`);
    return sid;
  }
  /* Re-terminate the card just added: in a for update clause it is one item
     of an expression list, so `;` becomes a separator. */
  function _patchLastCard(after, before){
    const i = ins[ins.length - 1];
    i.text = (before || '') + i.text.replace(/;$/, after);
  }

  function describe(st, extra){
    const k = _innerDeep(st);
    if(k.kind === 'if'){
      const then_ = _ch(k.node, 'statement', 0);
      return Object.assign({ kind:'if', cond: text(_ch(k.node, 'expression')).trim(),
                             thenR: [_so(then_), _eo(then_)] }, extra);
    }
    if(k.kind === 'for'){
      const e = _ch(k.node, 'expression'), body = _ch(k.node, 'statement');
      return Object.assign({ kind:'for', cond: e ? text(e).trim() : 'true',
                             bodyR: [_so(body), _eo(body)] }, extra);
    }
    if(k.kind === 'foreach'){
      const v = _ch(k.node, 'localVariableDeclaration'), e = _ch(k.node, 'expression');
      return Object.assign({ kind:'foreach', cond: (text(v) + ' : ' + text(e)).replace(/\s+/g, ' ').trim() }, extra);
    }
    if(k.kind === 'return') return Object.assign({ kind:'return', text: text(st).trim() }, extra);
    return Object.assign({ kind:'stmt', text: text(st).trim() }, extra);
  }

  /* Braceless branch or loop body: `if (x) y();` becomes `if (x) { card; y(); }`.
     Without the braces there is nowhere to put the card, and without the
     card the if's TRUE branch is invisible. Adding braces never changes
     meaning, and a declaration cannot legally be a braceless body. */
  function wrapBody(st, extra, header){
    if(!st) return;
    const k = _innerDeep(st);
    if(k.kind === 'block' || k.kind === 'empty') return;
    if(k.kind === 'while' || k.kind === 'do' || k.kind === 'foreach') return;  // they card themselves
    const pos = _so(st);
    add(pos, 20, '{ ');
    if(header) card(pos, header.line, header, 21);
    card(pos, _line(st), describe(st, extra), 22);
    add(_eo(st) + 1, 3, ' }');
  }

  /* while / do: card at every condition check, or at the top of each
     iteration when the condition is a literal true (see _constTrue). */
  function loopCard(loopNode, kind, keywordTok, expr, emptyCondPos, body){
    const line = _line(keywordTok);
    const bodyR = body ? [_so(body), _eo(body)] : null;
    const condSrc = expr ? text(expr).trim() : '';
    const info = { kind, cond: condSrc || 'true', bodyR };
    if(expr && !_constTrue(condSrc)){
      const pos = _so(expr);
      const sid = newSid(Object.assign({ line, pos }, info));
      add(pos, 40, `__Tracer.c(${line}, ${sid}${kvAt(pos)}) && (`);
      add(_eo(expr) + 1, 2, ')');
      return;
    }
    // literal-true loop: card at the start of each iteration instead
    const bk = body && _innerDeep(body);
    if(bk && bk.kind === 'block'){
      const lc = _ch(bk.node, 'LCurly');
      card(lc.endOffset + 1, line, info, 15);
    }
  }

  (function walk(n){
    if(!n || typeof n !== 'object' || _isTok(n)) return;
    /* Lambdas and classes declared inside a method are left untouched:
       a card there would read the enclosing method's locals, which a lambda
       may only capture when they are effectively final. */
    if(n.location && inSkip(n.location.startOffset)) return;
    {

    if(n.name === 'methodDeclaration' || n.name === 'constructorDeclaration'){
      const isCtor = n.name === 'constructorDeclaration';
      const body = isCtor ? _ch(n, 'constructorBody') : _ch(_ch(n, 'methodBody'), 'block');
      if(body){
        let name;
        if(isCtor){
          const sd = _ch(_ch(n, 'constructorDeclarator'), 'simpleTypeName');
          name = sd ? text(sd).trim() : 'constructor';
        } else {
          name = _ch(_ch(_ch(n, 'methodHeader'), 'methodDeclarator'), 'Identifier').image;
        }
        const params = [];
        (function dig(x, inParams){
          if(!x || typeof x !== 'object' || _isTok(x)) return;
          if(x.name === 'formalParameterList') inParams = true;
          if(inParams && x.name === 'variableDeclaratorId') params.push(_ch(x, 'Identifier').image);
          if(x.name === 'block' || x.name === 'constructorBody') return;
          for(const k in x.children || {}) for(const c of x.children[k] || []) dig(c, inParams);
        })(n, false);
        const kv = params.map(p => `, "${p}", ${p}`).join('');
        const eci = isCtor ? _ch(body, 'explicitConstructorInvocation') : null;
        const openAt = eci ? _eo(eci) + 1 : _ch(body, 'LCurly').endOffset + 1;
        add(openAt, 10, `__Tracer.enter("${name}"${kv}); try {`);
        add(_ch(body, 'RCurly').startOffset, 4, `} finally { __Tracer.exit(); }`);
      }
    }

    if(n.name === 'blockStatement'){
      const st = _ch(n, 'statement');
      if(_ch(n, 'localVariableDeclarationStatement')){
        card(_so(n), _line(n), { kind:'stmt', text: text(n).trim() }, 30);
      } else if(st){
        const k = _innerDeep(st);
        /* Python's for line fires once before the first item is taken, then
           once per iteration. A basic for gets that first card here and the
           rest at its update clause. while and do card at their condition,
           enhanced for at the top of each iteration. */
        if(k.kind === 'for')
          card(_so(n), _line(k.node), describe(st), 30);
        else if(!_isLoop(k.kind) && k.kind !== 'foreach' && k.kind !== 'empty' && k.kind !== 'block')
          card(_so(n), _line(n), describe(st), 30);
      }
      // class / interface declarations inside a method get no card
    }

    if(n.name === 'ifStatement'){
      wrapBody(_ch(n, 'statement', 0));
      const els = _ch(n, 'statement', 1);
      if(els){
        const ek = _innerDeep(els);
        wrapBody(els, ek.kind === 'if' ? { elseIf: true } : undefined);
      }
    }

    if(n.name === 'whileStatement'){
      const body = _ch(n, 'statement');
      loopCard(n, 'while', _ch(n, 'While'), _ch(n, 'expression'), null, body);
      wrapBody(body);
    }
    if(n.name === 'basicForStatement'){
      /* The header card goes at the START of the update clause:
             for (int c = 0; c < n; __Tracer.t(…), c++)
         That is where Python's for line fires: after the body, before the
         next value is taken. Carding the condition instead would run after
         c++, so the step before it would already show the next c.
         No condition is wrapped, so for(;;) stays a constant-true loop. */
      const body = _ch(n, 'statement');
      const e = _ch(n, 'expression');
      const line = _line(_ch(n, 'For'));
      const info = { kind:'for', cond: e ? text(e).trim() : 'true', bodyR: [_so(body), _eo(body)] };
      const upd = _ch(n, 'forUpdate');
      if(upd) card(_so(upd), line, info, 30), _patchLastCard(', ');
      else    card(_ch(n, 'Semicolon', 1).endOffset + 1, line, info, 30), _patchLastCard('', ' ');
      wrapBody(body);
    }
    if(n.name === 'enhancedForStatement'){
      /* Header card at the top of each iteration, like Python's for line. */
      const body = _ch(n, 'statement');
      const v = _ch(n, 'localVariableDeclaration'), e = _ch(n, 'expression');
      const info = { kind:'foreach', cond: (text(v) + ' : ' + text(e)).replace(/\s+/g, ' ').trim(),
                     line: _line(_ch(n, 'For')) };
      const bk = _innerDeep(body);
      if(bk.kind === 'block') card(_ch(bk.node, 'LCurly').endOffset + 1, info.line, info, 15);
      else if(bk.kind === 'empty') {}
      else if(_isLoop(bk.kind) || bk.kind === 'foreach'){
        add(_so(body), 20, '{ ');
        card(_so(body), info.line, info, 21);
        add(_eo(body) + 1, 3, ' }');
      }
      else wrapBody(body, undefined, info);
    }
    if(n.name === 'doStatement'){
      const body = _ch(n, 'statement');
      loopCard(n, 'do', _ch(n, 'While'), _ch(n, 'expression'), null, body);
      wrapBody(body);
    }

    if(n.name === 'returnStatement'){
      const e = _ch(n, 'expression');
      if(e){ add(_so(e), 50, '__Tracer.ret('); add(_eo(e) + 1, 1, ')'); }
    }
    }

    for(const k in n.children || {}) for(const c of n.children[k] || []) walk(c);
  })(cst);

  /* Apply left to right. At one offset, closes (low pri) land before opens,
     and among opens the method's try precedes any card. */
  ins.sort((a, b) => a.pos - b.pos || a.pri - b.pri);
  let out = '', at = 0;
  for(const i of ins){ out += src.slice(at, i.pos) + i.text; at = i.pos; }
  out += src.slice(at);

  return { code: out, error: null, unsupported, sids };
}
