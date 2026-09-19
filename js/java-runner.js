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

/* Rebuild the call forest from __CALL / __RET lines, shaped like the Python
   tracer's _roots so renderers-recursion.js can draw it unchanged. */
function buildCallTrees(stdout){
  const byId = new Map(), roots = [];
  for(const line of String(stdout).split('\n')){
    if(line.startsWith('__CALL{')){
      let c; try { c = JSON.parse(line.slice(6)); } catch(e){ continue; }
      const node = { id:c.id, fn:c.fn, depth:c.depth, args:c.args,
                     ret:undefined, children:[] };
      byId.set(c.id, node);
      const parent = c.parent != null ? byId.get(c.parent) : null;
      (parent ? parent.children : roots).push(node);
    } else if(line.startsWith('__RET{')){
      let r; try { r = JSON.parse(line.slice(5)); } catch(e){ continue; }
      const node = byId.get(r.id);
      if(node) node.ret = r.ret;
    }
  }
  return roots;
}
