/* ══════════════════════════════════════════════════════════════════════
   java-instrument.js ─ Rewrites the user's Java so it prints its own
   state. Only has to answer "which locals are live at line N" — the JVM
   supplies all meaning, so no Java semantics live here.
   Depends on: window.JavaParser (ESM shim in index.html)
   ══════════════════════════════════════════════════════════════════════ */

/* Constructs we cannot trace line by line. Detected up front so the app can
   say so plainly instead of drawing a wrong picture. */
const JAVA_UNSUPPORTED = [
  { name:'streams',           re:/\.stream\s*\(\s*\)|\.parallelStream\s*\(\s*\)|Collectors\./ },
  { name:'lambdas',           re:/->\s*[{(\w"']|::\w/ },
  { name:'threads',           re:/\bnew\s+Thread\b|\bExecutorService\b|\bsynchronized\b|\bRunnable\b/ },
  { name:'reflection',        re:/\bClass\.forName\b|\.getDeclaredMethod\b|\bjava\.lang\.reflect\b/ },
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

/* Smallest and largest line touched by a subtree. Chevrotain puts
   startLine/endLine on tokens, so this walks down to them. */
function _span(node){
  let lo = Infinity, hi = -Infinity;
  (function dig(n){
    if(!n || typeof n !== 'object') return;
    if(typeof n.startLine === 'number' && n.startLine < lo) lo = n.startLine;
    if(typeof n.endLine   === 'number' && n.endLine   > hi) hi = n.endLine;
    for(const k in n.children || {}) (n.children[k] || []).forEach(dig);
  })(node);
  return { lo, hi };
}

function _has(node, name){
  let found = false;
  (function dig(n){
    if(found || !n || typeof n !== 'object') return;
    if(n.name === name){ found = true; return; }
    for(const k in n.children || {}) (n.children[k] || []).forEach(dig);
  })(node);
  return found;
}

/* Node names verified against java-parser 3.0.1 by dev/cst-probe.html.
   These open a new variable scope. */
const SCOPE_NODES = new Set([
  'block', 'basicForStatement', 'enhancedForStatement', 'methodDeclaration',
  'constructorDeclaration', 'catchClause', 'switchBlock'
]);

/* Every declaration with the line it appears on and the line its scope ends.
   A declaration is visible from its own line until its enclosing scope closes. */
function collectDecls(cst){
  const decls = [];
  (function walk(n, scopeEnd){
    if(!n || typeof n !== 'object') return;
    let end = scopeEnd;
    if(n.name && SCOPE_NODES.has(n.name)){
      const s = _span(n);
      if(s.hi > -Infinity) end = s.hi;
    }
    if(n.name === 'variableDeclaratorId' && n.children && n.children.Identifier){
      const tok = n.children.Identifier[0];
      decls.push({ name: tok.image, line: tok.startLine, end });
    }
    for(const k in n.children || {}) (n.children[k] || []).forEach(c => walk(c, end));
  })(cst, Infinity);
  return decls;
}

/* Which names are live at an injection point placed just after line L?
   scopeEnd must be strictly greater than L: a loop variable whose scope ends
   on the loop's closing brace is NOT in scope on the line after it. */
function liveAt(decls, L){
  const names = [];
  for(const d of decls) if(d.line <= L && d.end > L) names.push(d.name);
  return [...new Set(names)];
}

/* Safe places to inject. Using blockStatement spans rather than "any line
   ending in a semicolon" matters: a braceless `for (…) sum += a[i];` would
   otherwise get __t(i) emitted after the loop, where i is out of scope, and
   a multi-line `return` would get code injected after it, which Java rejects
   as unreachable. blockStatements are always inside braces. */
function injectionPoints(cst){
  const pts = [];
  (function walk(n){
    if(!n || typeof n !== 'object') return;
    if(n.name === 'blockStatement'){
      const s = _span(n);
      // never inject after a return / break / continue: unreachable code
      if(!_has(n,'returnStatement') && !_has(n,'breakStatement') &&
         !_has(n,'continueStatement') && s.hi > -Infinity){
        pts.push(s.hi);
      }
    }
    for(const k in n.children || {}) (n.children[k] || []).forEach(walk);
  })(cst);
  return [...new Set(pts)].sort((a,b) => a - b);
}

/* Methods we wrap with __enter/__exit so the recursion panel has a call tree. */
function methodSpans(cst){
  const out = [];
  (function walk(n){
    if(!n || typeof n !== 'object') return;
    if(n.name === 'methodDeclaration'){
      let name = null, params = [];
      (function dig(x, inParams){
        if(!x || typeof x !== 'object') return;
        if(x.name === 'methodDeclarator' && x.children && x.children.Identifier)
          name = name || x.children.Identifier[0].image;
        if(x.name === 'formalParameter') inParams = true;
        if(inParams && x.name === 'variableDeclaratorId' && x.children && x.children.Identifier)
          params.push(x.children.Identifier[0].image);
        for(const k in x.children || {}) (x.children[k] || []).forEach(c => dig(c, inParams));
      })(n, false);
      const s = _span(n);
      if(name) out.push({ name, params, from:s.lo, to:s.hi });
    }
    for(const k in n.children || {}) (n.children[k] || []).forEach(walk);
  })(cst);
  return out;
}

/* Calls are emitted fully qualified as __Tracer.x(). The user's code can sit
   in any class, and a short alias defined in Main would not be visible from
   Solution. Qualifying costs nothing and always resolves.

   Rewrite the source. The user's own lines are never modified, only
   appended to, so line numbers in the emitted cards still point at the
   original code and the editor highlight lands correctly. */
function instrumentJava(src){
  const unsupported = detectUnsupported(src);
  const { cst, error } = parseJava(src);
  if(error) return { code:null, error, unsupported };

  const decls   = collectDecls(cst);
  const points  = new Set(injectionPoints(cst));
  const methods = methodSpans(cst);
  const lines   = src.split('\n');

  // line -> the method whose body opens there, for __enter
  const openAt = new Map();
  for(const m of methods) openAt.set(m.from, m);

  const out = [];
  for(let i = 0; i < lines.length; i++){
    const raw = lines[i], ln = i + 1;
    out.push(raw);
    const indent = (raw.match(/^\s*/) || [''])[0];

    const m = openAt.get(ln);
    if(m && /\{\s*$/.test(raw)){
      const kv = m.params.map(p => `"${p}", ${p}`).join(', ');
      out.push(`${indent}  __Tracer.enter("${m.name}"${kv ? ', ' + kv : ''});`);
      continue;
    }

    if(points.has(ln)){
      const vars = liveAt(decls, ln);
      if(vars.length){
        const kv = vars.map(v => `"${v}", ${v}`).join(', ');
        out.push(`${indent}__Tracer.t(${ln}, ${kv});`);
      }
    }
  }

  return { code: out.join('\n'), error:null, unsupported };
}
