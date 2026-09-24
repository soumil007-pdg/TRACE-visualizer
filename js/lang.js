/* ══════════════════════════════════════════════════════════════════════
   lang.js ─ Which language the editor is in, plus the Java run pipeline.
   Python keeps running locally through runCode() in runner.js, untouched.
   Depends on: java-instrument.js, java-driver.js, java-preamble.js,
               java-runner.js
   ══════════════════════════════════════════════════════════════════════ */

window.LANG = (window.Store && Store.get('lang')) || 'python';

/* PriorityQueue variables, so renderers.js draws them as heaps. Plays the
   role detectHeapVars() plays for heapq in Python. */
function detectJavaHeapVars(code){
  const s = new Set();
  const re = /\b([A-Za-z_$][\w$]*)\s*=\s*new\s+PriorityQueue\b/g;
  let m;
  while((m = re.exec(code)) !== null) s.add(m[1]);
  return s;
}

/* Insertions never add a newline, so javac's line N is the user's line
   N minus the preamble's height. Rewrite Main.java:N into the user's own
   numbering so errors point at code they wrote. */
function _preambleLines(){ return (JAVA_PREAMBLE + '\n').split('\n').length - 1; }

function _mapJavaLines(msg, userLines){
  const off = _preambleLines();
  return String(msg).replace(/Main\.java:(\d+)/g, (all, n) => {
    const u = +n - off;
    return (u >= 1 && u <= userLines) ? 'line ' + u : all;
  });
}

function _tidyJavac(out, userLines){
  return _mapJavaLines(out, userLines).split('\n')
    .map(l => l.replace(/^line (\d+):\s*error:\s*/, 'Line $1: '))
    .filter(l => l.trim() && !/^\s*\^\s*$/.test(l) && !/^\d+ errors?$/.test(l.trim()))
    .slice(0, 6).join('\n');
}

function _tidyTrace(err, userLines){
  const lines = _mapJavaLines(err, userLines).split('\n');
  const head = (lines[0] || '').replace(/^Exception in thread "main"\s*/, '')
                                 .replace(/^java\.lang\./, '');
  const at = lines.find(l => /\bat Solution\b.*\(line \d+\)/.test(l));
  const m = at && at.match(/at Solution\.(\w+)\(line (\d+)\)/);
  return m ? `${head}\n  at line ${m[2]} in ${m[1]}()` : head;
}

/* Assemble preamble + instrumented user code + generated main(), run it on
   a real JVM, and parse the output back into the snapshot contract.
   Returns the same shape the Python path produces. As in Python, a run
   that crashes or hits the step cap still returns the trace up to that
   point, alongside the error. */
async function runJavaSource(userCode, inputText){
  const empty = { snapshots:[], error:null, result:null, has_result:false,
                  call_trees:[], unsupported:[] };
  const userLines = String(userCode).split('\n').length;

  const inst = instrumentJava(userCode);
  if(inst.unsupported.length)
    return Object.assign({}, empty, { unsupported: inst.unsupported });
  if(inst.error)
    return Object.assign({}, empty, { error: 'Java syntax error: ' + inst.error });

  const drv = buildJavaDriver(userCode, inputText);
  if(drv.error) return Object.assign({}, empty, { error: drv.error });

  // Java allows one public top-level class per file, and Main holds that slot.
  const solution = inst.code.replace(/\bpublic\s+(class|interface|enum)\s/g, '$1 ');

  const source = JAVA_PREAMBLE + '\n' + solution + '\n' +
    'public class Main {\n' +
    '  public static void main(String[] args) {\n' + drv.driver + '\n  }\n}\n';

  const jr = await judge0Run(source);

  if(jr.compileOutput)
    return Object.assign({}, empty, { error: 'Java compile error\n' + _tidyJavac(jr.compileOutput, userLines) });

  const pc = parseCards(jr.stdout);
  const snapshots = postProcessJava(pc.snapshots, inst.sids, detectJavaHeapVars(userCode));

  let error = null;
  if(/^__CAP$/m.test(jr.stdout))
    error = 'Step cap reached (1000 steps), possible infinite loop';
  else if(jr.stderr)
    error = _tidyTrace(jr.stderr, userLines);
  else if(!pc.has_result && /time limit/i.test(jr.statusText || ''))
    error = 'Time limit exceeded';
  else if(!jr.stdout && jr.statusText && !/Accepted/i.test(jr.statusText))
    error = jr.statusText;

  return { snapshots, error, result: pc.result, has_result: pc.has_result,
           call_trees: buildCallTrees(jr.stdout), unsupported: [] };
}

/* ── Choosing a language ──────────────────────────────────────────────
   Every visit starts at the split-screen front page (#front). Picking a
   side calls enterLang, which restores that language's own last session;
   the header chip brings the front page back to switch. */

window._langEntered = false;   // pro-ui.js does not autosave before this

function setLang(l, opts){
  opts = opts || {};
  window.LANG = l;
  if(window.Store) Store.set('lang', l);
  if(window._cm) window._cm.setOption('mode', l === 'java' ? 'text/x-java' : 'python');
  // body carries it for the RUN / chip rules (front.css); <html> carries it
  // for the language themes, whose derived tokens are computed on <html>
  for(const el of [document.body, document.documentElement]){
    el.classList.toggle('lang-java',   l === 'java');
    el.classList.toggle('lang-python', l !== 'java');
  }
  if(window._cm) window._cm.refresh();
  if(window.refreshTemplates) window.refreshTemplates(opts.loadDefault !== false);
  _syncRunButton();
}

/* RUN says which language it will run, in that language's colour, and is
   usable as soon as that language can run: Java at once, Python once
   Pyodide has loaded (the loading overlay shows until then). */
function _syncRunButton(){
  const java  = window.LANG === 'java';
  const ready = java || (typeof pyodide !== 'undefined' && !!pyodide);
  const run = document.getElementById('run');
  if(run) run.disabled = !ready;
  const label = document.getElementById('run-label');
  if(label) label.textContent = java ? 'RUN JAVA' : 'RUN PYTHON';
  const name = document.querySelector('#lang-chip .lc-name');
  if(name) name.textContent = java ? 'Java' : 'Python';
  // what the solution can use without importing anything
  const hint = document.getElementById('code-hint');
  if(hint) hint.textContent = java ? 'ListNode · TreeNode · java.util.* · auto-imported'
                                   : 'ListNode · TreeNode · Optional · auto-available';
  document.getElementById('loading').classList.toggle('hidden', ready);
  if(window.setStat) setStat(java ? 'Java ready' : (ready ? 'Ready' : 'Loading…'), ready ? 'ready' : null);
}

/* seed = { code, input } from a shared link; otherwise the language's own
   last session, or its default template on a first visit. */
function enterLang(l, seed){
  if(window._langEntered && l === window.LANG && !seed){ hideFront(l); return; }

  const code  = seed ? seed.code  : Store.get(l === 'java' ? 'lastCode.java'  : 'lastCode');
  const input = seed ? seed.input : Store.get(l === 'java' ? 'lastInput.java' : 'lastInput');
  const has   = typeof code === 'string' && code.trim().length > 0;

  window._langEntered = false;             // a template load must not overwrite saved code
  setLang(l, { loadDefault: !has });
  if(has){
    window._cm.setValue(code);
    window._tiEl.value = typeof input === 'string' ? input : '';
    if(window.refreshP) refreshP();
  }
  window._langEntered = true;
  _syncRunButton();
  if(window.fitTestInput) fitTestInput();
  hideFront(l);
  if(window._maybeAutoOnboard) window._maybeAutoOnboard();
  // a shared Java link that points at a step runs straight away;
  // Python waits for Pyodide (runner.js)
  if(l === 'java' && window._pendingStep != null) runCode();
}

function showFront(){
  if(window._saveNow) window._saveNow();   // flush before the language can change
  const f = document.getElementById('front');
  f.hidden = false;
  f.removeAttribute('data-chosen');
  void f.offsetWidth;                      // restart the fade from visible
  f.classList.remove('fp-out');
  document.documentElement.classList.add('front-open');
}

function hideFront(l){
  const f = document.getElementById('front');
  document.documentElement.classList.remove('front-open');
  if(f.hidden) return;
  f.dataset.chosen = l;
  f.classList.add('fp-out');
  setTimeout(() => { if(f.classList.contains('fp-out')) f.hidden = true; }, 480);
}

document.querySelectorAll('#front .fp-side').forEach(b =>
  b.addEventListener('click', () => enterLang(b.dataset.lang)));
document.getElementById('lang-chip').addEventListener('click', showFront);
// Esc returns to the app unchanged when the front page was opened to switch
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && window._langEntered && !document.getElementById('front').hidden)
    hideFront(window.LANG);
});

/* ── Light / dark ──────────────────────────────────────────────────────
   Each language has a light and a dark version (themes.css). The head
   script picks the starting mode before first paint; this switches it.
   Until someone chooses, the app keeps following the computer's setting. */
function setMode(m, remember){
  document.documentElement.dataset.theme = m;
  if(remember){ try { localStorage.setItem('mode', m); } catch(e){} }
  if(window._cm) window._cm.refresh();
  // the recursion tree reads its colours at render time
  if(typeof snaps !== 'undefined' && snaps.length && typeof render === 'function') render();
}
function toggleMode(){
  setMode(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
}
window.toggleMode = toggleMode;
document.getElementById('btn-mode').addEventListener('click', toggleMode);
document.getElementById('m-mode').addEventListener('click', () => {
  toggleMode();
  const d = document.getElementById('mobile-drawer'); if(d) d.classList.remove('show');
});
if(window.matchMedia){
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const follow = e => { let saved = null; try { saved = localStorage.getItem('mode'); } catch(_){}
                        if(saved !== 'light' && saved !== 'dark') setMode(e.matches ? 'dark' : 'light', false); };
  if(mq.addEventListener) mq.addEventListener('change', follow);
}
