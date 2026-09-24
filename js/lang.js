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

function setLang(l){
  window.LANG = l;
  if(window.Store) Store.set('lang', l);
  if(window._cm) window._cm.setOption('mode', l === 'java' ? 'text/x-java' : 'python');
  document.body.classList.toggle('lang-java', l === 'java');
  if(window.refreshTemplates) window.refreshTemplates();
  if(window.setStat) setStat(l === 'java' ? 'Java ready' : 'Ready', 'ready');
}
