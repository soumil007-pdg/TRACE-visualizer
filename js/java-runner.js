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

/* Rebuild the call forest from __CALL / __RET lines.

   The node shape is NOT ours to choose: renderers-recursion.js reads
   .func / .args / .ctx / .return_val / .returned / .is_memo / .children,
   and args values are repr STRINGS (Python truncates them to 22 chars),
   not raw values. Match tracer.js:409-410 exactly or the panel renders
   "undefined" and the tree comes out empty. */
function _argRepr(v){
  if(typeof v === 'string') return "'" + v + "'";
  if(v === null) return 'None';
  if(v === true) return 'True';
  if(v === false) return 'False';
  if(Array.isArray(v)) return JSON.stringify(v).slice(0, 22);
  return String(v).slice(0, 22);
}

function buildCallTrees(stdout){
  const byId = new Map(), roots = [], stack = [], seen = new Set();
  for(const line of String(stdout).split('\n')){
    if(line.startsWith('__CALL{')){
      let c; try { c = JSON.parse(line.slice(6)); } catch(e){ continue; }

      const args = {};
      for(const k in (c.args || {})) args[k] = _argRepr(c.args[k]);

      // memo detection mirrors tracer.js: same (func, args) seen before
      const memoKey = c.fn + '|' + JSON.stringify(Object.entries(args).sort());
      const is_memo = seen.has(memoKey);
      seen.add(memoKey);

      const node = {
        id: c.id, func: c.fn, args, ctx: {}, depth: c.depth,
        return_val: null, returned: false, children: [], is_memo
      };
      byId.set(c.id, node);
      const parent = stack.length ? stack[stack.length - 1] : null;
      (parent ? parent.children : roots).push(node);
      stack.push(node);

    } else if(line.startsWith('__RET{')){
      let r; try { r = JSON.parse(line.slice(5)); } catch(e){ continue; }
      const node = byId.get(r.id);
      if(node){ node.return_val = r.ret; node.returned = true; }
      if(stack.length && stack[stack.length - 1].id === r.id) stack.pop();
    }
  }
  return roots;
}
