/* ══════════════════════════════════════════════════════════════════════
   lang.js ─ Which language the editor is in, plus the Java run pipeline.
   Python keeps running locally through runCode() in runner.js, untouched.
   Depends on: java-instrument.js, java-driver.js, java-preamble.js,
               java-runner.js
   ══════════════════════════════════════════════════════════════════════ */

window.LANG = (window.Store && Store.get('lang')) || 'python';

/* Assemble preamble + instrumented user code + generated main(), run it on
   a real JVM, and parse the output back into the snapshot contract.
   Returns the same shape the Python path produces. */
async function runJavaSource(userCode, inputText){
  const empty = { snapshots:[], error:null, result:null, has_result:false,
                  call_trees:[], unsupported:[] };

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
    return Object.assign({}, empty, { error: 'Java compile error\n' + _tidyJavac(jr.compileOutput) });
  if(jr.stderr)
    return Object.assign({}, empty, { error: _tidyTrace(jr.stderr) });
  if(!jr.stdout && jr.statusText && !/Accepted/i.test(jr.statusText))
    return Object.assign({}, empty, { error: jr.statusText });

  const pc = parseCards(jr.stdout);
  return { snapshots: pc.snapshots, error: null, result: pc.result,
           has_result: pc.has_result, call_trees: buildCallTrees(jr.stdout),
           unsupported: [] };
}

/* javac reports line numbers in the assembled file, which includes our
   preamble and is meaningless to the user. Strip those so the message
   points at what they actually wrote. */
function _tidyJavac(out){
  return String(out).split('\n')
    .map(l => l.replace(/^Main\.java:\d+:\s*/, ''))
    .filter(l => l.trim() && !/^\s*\^\s*$/.test(l))
    .slice(0, 6).join('\n');
}

function _tidyTrace(err){
  return String(err).split('\n').filter(l => !/__Tracer|__H\.|at Main\.main/.test(l))
    .slice(0, 6).join('\n');
}

function setLang(l){
  window.LANG = l;
  if(window.Store) Store.set('lang', l);
  if(window._cm) window._cm.setOption('mode', l === 'java' ? 'text/x-java' : 'python');
  document.body.classList.toggle('lang-java', l === 'java');
  if(window.refreshTemplates) window.refreshTemplates();
  if(window.setStat) setStat(l === 'java' ? 'Java ready' : 'Ready', 'ready');
}
