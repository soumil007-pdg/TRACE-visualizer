/* ══════════════════════════════════════════════════════════════════════
   java-runner.js ─ Talks to Judge0 and turns its stdout back into the
   snapshot contract the renderers already consume.
   No dependency on the Python path.
   ══════════════════════════════════════════════════════════════════════ */

const JUDGE0_URL  = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';
const JUDGE0_JAVA = 62;   // Java (OpenJDK 13)

/* Submit source to a real JVM. Returns the raw streams; interpreting them is
   parseCards' job. Never throws for compile/runtime errors — those come back
   in compileOutput / stderr so the caller can surface them properly. */
async function judge0Run(source){
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(JUDGE0_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: source, language_id: JUDGE0_JAVA })
    });
  } catch(e){
    return { stdout:'', stderr:null, compileOutput:null,
             statusText:'Network error: ' + e.message, timeMs: performance.now()-t0 };
  }
  if(!res.ok){
    return { stdout:'', stderr:null, compileOutput:null,
             statusText:'Judge0 HTTP ' + res.status, timeMs: performance.now()-t0 };
  }
  const j = await res.json();
  return {
    stdout:        j.stdout || '',
    stderr:        j.stderr || null,
    compileOutput: j.compile_output || null,
    statusText:    (j.status && j.status.description) || 'Unknown',
    timeMs:        performance.now() - t0
  };
}

/* Java prints one __T{...} card per traced statement, plus a final
   __RESULT{...}. Anything else on stdout is the user's own println and is
   ignored here. */
function parseCards(stdout){
  const snapshots = [];
  let result = null, has_result = false;
  for(const line of String(stdout).split('\n')){
    if(line.startsWith('__T{')){
      try { snapshots.push(JSON.parse(line.slice(3))); }
      catch(e){ /* a truncated final card (output cap) is not fatal */ }
    } else if(line.startsWith('__RESULT{')){
      try { result = JSON.parse(line.slice(9, -1)); has_result = true; }
      catch(e){ /* leave has_result false */ }
    }
  }
  return { snapshots, result, has_result };
}

/* Java-flavoured repr for call-stack args, return values and the statement
   panel, in the same role as Python's repr() in tracer.js. */
function _jrepr(v){
  if(v === null || v === undefined) return 'null';
  if(typeof v === 'boolean' || typeof v === 'number') return String(v);
  if(typeof v === 'string') return v.length === 1 ? "'" + v + "'" : '"' + v + '"';
  if(Array.isArray(v)) return '[' + v.map(_jrepr).join(', ') + ']';
  if(typeof v === 'object'){
    if(typeof v.__repr__ === 'string') return v.__repr__;
    if(v.__kind__ === 'list') return _jrepr((v.nodes || []).map(n => n.val));
    return '{' + Object.entries(v).map(([k, x]) => k + '=' + _jrepr(x)).join(', ') + '}';
  }
  return String(v);
}

/* One argument in a call-stack / recursion-tree label, same rule as
   _arepr in tracer.js: short values in full, long containers by shape. */
function _jarg(v){
  const r = _jrepr(v);
  if(r.length <= 22) return r;
  if(Array.isArray(v) && v.length && v.every(x => Array.isArray(x))) return v.length + '\u00d7' + v[0].length;
  if(Array.isArray(v)) return '[' + v.length + ' items]';
  if(v && typeof v === 'object' && typeof v.__repr__ !== 'string') return '{' + Object.keys(v).length + ' keys}';
  return r.slice(0, 21) + '\u2026';
}

/* Rebuild the call forest from __CALL / __RET lines.

   The node shape is NOT ours to choose: renderers-recursion.js reads
   .func / .args / .ctx / .return_val / .returned / .is_memo / .children,
   and args and return_val are repr STRINGS (it calls .trim() on them).
   Truncation lengths match tracer.js: 22 for args, 40 for return values. */
function buildCallTrees(stdout){
  const byId = new Map(), roots = [], stack = [], seen = new Set();
  for(const line of String(stdout).split('\n')){
    if(line.startsWith('__CALL{')){
      let c; try { c = JSON.parse(line.slice(6)); } catch(e){ continue; }
      const args = {}, akey = {};
      for(const k in (c.args || {})){
        akey[k] = _jrepr(c.args[k]).slice(0, 22);   // memo key, as before
        args[k] = _jarg(c.args[k]);                  // what the label shows
      }
      // memo detection mirrors tracer.js: same (func, args) seen before
      const memoKey = c.fn + '|' + JSON.stringify(Object.entries(akey).sort());
      const is_memo = seen.has(memoKey);
      seen.add(memoKey);
      const node = { id: c.id, func: c.fn, args, ctx: {}, depth: c.depth,
                     return_val: null, returned: false, children: [], is_memo };
      byId.set(c.id, node);
      const parent = c.parent != null ? byId.get(c.parent) : null;
      (parent ? parent.children : roots).push(node);
      stack.push(node);
    } else if(line.startsWith('__RET{')){
      let r; try { r = JSON.parse(line.slice(5)); } catch(e){ continue; }
      const node = byId.get(r.id);
      if(node){ node.return_val = _jrepr(r.ret).slice(0, 40); node.returned = true; }
      if(stack.length && stack[stack.length - 1].id === r.id) stack.pop();
    }
  }
  return roots;
}

/* ── Condition and statement panels, derived after the run ─────────────
   tracer.js re-evaluates a condition with eval() and gives up whenever it
   contains a call, since evaluating twice could change state. The Java
   side never re-evaluates anything. Control flow already answers the
   question: an if was TRUE exactly when the next card in the same frame
   lands inside its then-branch, and a loop condition was TRUE exactly when
   it lands inside the body. Statement effects come from diffing the state
   before a statement with the next card in the same frame. */

const _STRUCTS = ['lists','grids','dicts','sets','deques'];

function _diffMulti(a, b){
  // elements in b that are not matched in a, compared by value
  const pool = a.map(x => JSON.stringify(x));
  const out = [];
  for(const x of b){
    const k = JSON.stringify(x), i = pool.indexOf(k);
    if(i >= 0) pool.splice(i, 1); else out.push(x);
  }
  return out;
}

function _deriveStmt(pre, post, text, heapNames){
  if(!post) return null;
  const rows = [];
  const t = String(text).replace(/;\s*$/, '').trim();
  const word = n => new RegExp('(^|[^\\w$.])' + n.replace(/\$/g, '\\$') + '\\b').test(t);
  let target = null;

  const am = t.match(/^(?:(?:final\s+)?[\w$.<>\[\], ?]+\s+)?([A-Za-z_$][\w$]*)\s*(=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>>=|>>=)\s*([\s\S]+)$/);
  const im = t.match(/^(\+\+|--)\s*([A-Za-z_$][\w$]*)$|^([A-Za-z_$][\w$]*)\s*(\+\+|--)$/);
  let expr = null;
  if(am){
    target = am[1];
    expr = am[2] === '=' ? am[3].trim() : `${am[1]} ${am[2].slice(0, -1)} ${am[3].trim()}`;
  } else if(im){
    target = im[2] || im[3];
    const op = im[1] || im[4];
    expr = `${target} ${op === '++' ? '+' : '-'} 1`;
  }
  if(target){
    const where = ['locals', ..._STRUCTS, 'linked_lists', 'trees'].find(b => post[b] && target in post[b]);
    if(where){
      let v = post[where][target];
      if(where === 'linked_lists' && v && v.nodes) v = v.nodes.map(n => n.val);
      rows.push({ type:'assign', var: target, expr, result: _jrepr(v).slice(0, 60) });
    }
  }

  for(const b of _STRUCTS){
    for(const name in (post[b] || {})){
      if(name === target || !word(name)) continue;
      const before = (pre[b] || {})[name], after = post[b][name];
      if(before === undefined || JSON.stringify(before) === JSON.stringify(after)) continue;

      if(b === 'grids'){
        outer: for(let r = 0; r < after.length; r++)
          for(let c = 0; c < (after[r] || []).length; c++)
            if(!before[r] || JSON.stringify(before[r][c]) !== JSON.stringify(after[r][c])){
              rows.push({ type:'dict_set', dict: name, key: `${r}][${c}`, value: _jrepr(after[r][c]) });
              break outer;
            }
      } else if(b === 'dicts'){
        for(const k in after){
          if(!(k in before)){ rows.push({ type:'dict_set', dict: name, key: k, value: _jrepr(after[k]) }); break; }
          if(JSON.stringify(before[k]) !== JSON.stringify(after[k])){
            rows.push({ type:'dict_update', dict: name, key: k, value: _jrepr(after[k]) }); break;
          }
        }
      } else {
        const A = Array.isArray(before) ? before : [], B = Array.isArray(after) ? after : [];
        const added = _diffMulti(A, B), removed = _diffMulti(B, A);
        const heapish = b === 'deques' || heapNames.has(name);
        if(A.length === B.length && b === 'lists' && !heapNames.has(name)){
          const i = B.findIndex((x, k) => JSON.stringify(x) !== JSON.stringify(A[k]));
          if(i >= 0) rows.push({ type:'dict_set', dict: name, key: String(i), value: _jrepr(B[i]) });
        } else if(added.length && !removed.length){
          rows.push(heapish ? { type:'heappush', heap: name, value: _jrepr(added[0]) }
                            : { type:'list_append', list: name, value: _jrepr(added[0]) });
        } else if(removed.length && !added.length){
          rows.push({ type:'heappop', heap: name, top: _jrepr(removed[0]) });
        }
      }
    }
  }
  return rows.length ? rows.slice(0, 3) : null;
}

function _sameState(a, b){   // kept for tests
  for(const k of ['locals', ..._STRUCTS, 'linked_lists', 'trees'])
    if(JSON.stringify(a[k] || {}) !== JSON.stringify(b[k] || {})) return false;
  return true;
}

function postProcessJava(snaps, sids, heapNames){
  heapNames = heapNames || new Set();
  const info = s => (s.sid >= 0 && sids[s.sid]) || null;
  const pos  = s => { const i = info(s); return i ? i.pos : -1; };

  // next card belonging to the same call frame
  const next = new Array(snaps.length).fill(-1);
  const last = new Map();
  for(let i = snaps.length - 1; i >= 0; i--){
    const id = snaps[i].current_call_id;
    if(last.has(id)) next[i] = last.get(id);
    last.set(id, i);
  }

  for(let i = 0; i < snaps.length; i++){
    const s = snaps[i], inf = info(s);
    if(!inf) continue;
    const n = next[i] >= 0 ? snaps[next[i]] : null;
    const into = r => !!(n && r && pos(n) >= r[0] && pos(n) <= r[1]);
    if(inf.kind === 'if'){
      const r = into(inf.thenR);
      s.cond = { kw: inf.elseIf ? 'else if' : 'if', expr: inf.cond, result: r, raw: String(r), loop: false };
    } else if(inf.kind === 'while' || inf.kind === 'for' || inf.kind === 'do'){
      const r = into(inf.bodyR);
      s.cond = { kw: inf.kind === 'for' ? 'for' : 'while', expr: inf.cond, result: r, raw: String(r), loop: false };
    } else if(inf.kind === 'foreach'){
      s.cond = { kw: 'for', expr: inf.cond, result: null, raw: '', loop: true };
    } else if(inf.kind === 'stmt'){
      s.stmt = _deriveStmt(s, n, inf.text, heapNames);
    }
  }

  /* Python's rule, exactly: sys.settrace fires a line event when a frame
     moves to a different line, or jumps back to the start of one (a loop
     re-entering). So a frame gets one step per line visit, however many
     statements that line holds:
         if (x) { start = lo; end = j + 1; }      one step, not three
         dfs(a); dfs(b);                          one step, even with dfs(a)'s
                                                  whole subtree in between
     A Java card is dropped when its frame is still on the same line, unless
     it is a loop header, which is the backward jump. Its statement-panel
     rows are folded into the step that stays. */
  const HEADER = new Set(['for', 'while', 'do', 'foreach']);
  const lastLine = new Map(), lastKept = new Map();
  const out = [];
  for(const s of snaps){
    const id = s.current_call_id, inf = info(s);
    const header = inf && HEADER.has(inf.kind);
    if(!header && lastLine.get(id) === s.line){
      const k = lastKept.get(id);
      if(s.stmt) k.stmt = (k.stmt || []).concat(s.stmt).slice(0, 3);
      continue;
    }
    out.push(s);
    lastLine.set(id, s.line);
    lastKept.set(id, s);
  }
  return out;
}
