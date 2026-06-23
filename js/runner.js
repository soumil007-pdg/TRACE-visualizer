/* ══════════════════════════════════════════════════════════════════════
   runner.js ─ Pyodide initialisation, status indicator, line highlight,
                and the runCode() entry point.
   Depends on: tracer.js (TRACER), parser.js (buildDriver),
               renderers.js (_heapVars, detectHeapVars),
               render-core.js (snaps, cur, prev, _finalResult, _hasResult,
                               render, showErr, setProgress),
               controls.js (cm, tiEl, updCtrl)  — called at runtime only
   ══════════════════════════════════════════════════════════════════════ */

/* ── Status indicator (header dot + label) ──────────────────────────── */
const statEl = document.getElementById('status');
const stxt   = document.getElementById('stxt');

function setStat(t, k){
  stxt.textContent = t;
  statEl.className = k || '';
}

/* ── CodeMirror line highlight ──────────────────────────────────────── */
let _aLH = null;  // currently active line handle

function hlLine(n, inDrv){
  if(_aLH){ window._cm.removeLineClass(_aLH,'background','hl'); _aLH=null; }
  if(inDrv || !n) return;
  const lh = window._cm.getLineHandle(n-1);
  if(lh){
    window._cm.addLineClass(lh,'background','hl');
    _aLH = lh;
    window._cm.scrollIntoView({ line:n-1, ch:0 }, 80);
  }
}

/* ── Pyodide runtime ────────────────────────────────────────────────── */
let pyodide = null;

async function initPyodide(){
  pyodide = await loadPyodide({ indexURL:'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
  await pyodide.runPythonAsync(TRACER);
  setStat('Ready','ready');
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('run').disabled = false;
}

/* ── Operation counter (for complexity curve fitting) ───────────────────
   Runs user code + a scaled driver through the lightweight count_ops Python
   path (no snapshot building). Returns { ops, depth, error }. Used by
   complexity.js to measure growth across input sizes. ─────────────────── */
async function countOps(code, inputText){
  if(!pyodide) return { ops:0, depth:0, error:'no runtime' };
  const rawCode = code.replace(/\t/g, '    ');
  let driver;
  try { driver = buildDriver(rawCode, inputText).driver; }
  catch(e){ return { ops:0, depth:0, error:'driver: '+String(e) }; }
  pyodide.globals.set('_u', rawCode);
  pyodide.globals.set('_d', driver);
  try {
    const raw = await pyodide.runPythonAsync('count_ops(_u,_d)');
    return JSON.parse(raw);
  } catch(e){
    return { ops:0, depth:0, error:String(e) };
  }
}
window.countOps = countOps;

/* ── Run pipeline ───────────────────────────────────────────────────── */
async function runCode(){
  if(!pyodide) return;
  setStat('Running…', null);
  document.getElementById('errbanner').classList.remove('show');
  document.getElementById('result-panel').classList.remove('show');

  // ── Live mode: snapshot where we are RIGHT NOW before overwriting ────
  // We'll use this to find the divergence point after the new trace runs.
  const _liveSnapsBefore = snaps.slice();   // shallow copy of old trace
  const _liveCurBefore   = cur;             // step we were looking at

  // Only clear gutter markers in non-live mode.  In live mode we keep the
  // old markers around so a failed run doesn't visually wipe them — they
  // get replaced atomically when the new run succeeds.
  if(!window._liveOn && window._markExecutedLines) window._markExecutedLines([]);

  // Detect heap var names from user code before running
  _heapVars = detectHeapVars(window._cm.getValue());

  // Normalise tabs → 4 spaces before running so mixed-indentation code
  // doesn't cause Python's "inconsistent use of tabs and spaces" SyntaxError.
  const rawCode = window._cm.getValue().replace(/\t/g, '    ');
  const { driver } = buildDriver(rawCode, window._tiEl.value);
  pyodide.globals.set('_u', rawCode);
  pyodide.globals.set('_d', driver);

  let raw;
  try {
    raw = await pyodide.runPythonAsync('run_trace(_u,_d)');
  } catch(e){
    setStat('Error','err');
    showErr(String(e));
    // Tier 2 (live): keep the previous visualization frozen — we already
    // skipped the gutter wipe above, and `snaps` / `#vc` are untouched.
    return;
  }

  const res = JSON.parse(raw);
  const newSnaps = res.snapshots || [];

  if(!newSnaps.length){
    setStat('No steps','err');
    if(res.error) showErr(res.error);
    if(!window._liveOn){
      // Manual RUN with no traceable lines — show the friendly empty state
      snaps = newSnaps;
      document.getElementById('vc').innerHTML =
        '<div class="empty">No executable lines traced.\nVerify your test input matches the method signature.</div>';
      updCtrl();
    }
    // In live mode: don't touch snaps or #vc — frozen view stays put.
    return;
  }

  snaps = newSnaps;
  if(res.error) showErr(res.error);
  _finalResult  = res.result ?? null;
  _hasResult    = res.has_result ?? false;
  _callTrees    = res.call_trees || [];
  window._svgTreeZoomManual = false;
  if(window.clearComplexity) window.clearComplexity();

  cur  = 0;
  prev = { lists:{}, grids:{}, locals:{}, dicts:{}, sets:{}, deques:{},
           node_pointers:{}, linked_lists:{}, trees:{} };
  render();
  setStat(snaps.length + ' steps', 'ready');
  updCtrl();

  // Mobile: after a successful run, hand the whole screen to the trace so the
  // visualization is what the user sees (code editor collapses; "← Edit code"
  // brings it back). Harmless on desktop — CSS only acts below 880px.
  if(window.innerWidth <= 880) document.body.classList.add('mobile-trace-view');

  // Usage analytics — fire-and-forget, never blocks the app
  if(window.Analytics) Analytics.track('code_run', {
    steps: snaps.length,
    had_error: !!res.error,
    live: !!window._liveOn,
    code_len: rawCode.length
  });

  // Mark executed lines in the gutter (turns their numbers accent-colored + clickable)
  if(window._markExecutedLines) window._markExecutedLines(snaps);

  // Live mode: sweep from the divergence point so the user sees the
  // algorithm *evolve* from where it last was, not replay from scratch.
  if(window._liveOn && window._liveAutoPlay && snaps.length > 1){
    let startFrom = 0;

    if(_liveSnapsBefore.length > 0){
      // Walk both traces in parallel and find the first step where they differ.
      // We compare line number + locals — cheap enough for typical trace lengths.
      const compareLen = Math.min(_liveSnapsBefore.length, snaps.length);
      let divIdx = compareLen; // default: identical up to the shorter trace's end

      for(let i = 0; i < compareLen; i++){
        const o = _liveSnapsBefore[i];
        const n = snaps[i];
        if(o.line !== n.line ||
           JSON.stringify(o.locals) !== JSON.stringify(n.locals)){
          divIdx = i;
          break;
        }
      }

      // Start 2 steps before divergence for a moment of "recognisable context",
      // but never jump further forward than where the user already was.
      startFrom = Math.max(0, Math.min(divIdx - 2, _liveCurBefore));
    }

    window._liveAutoPlay(startFrom);
  }
}
