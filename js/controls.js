/* ══════════════════════════════════════════════════════════════════════
   controls.js ─ CodeMirror editor, resizers, theme system, transport
                  buttons (Run / Step / Play), speed slider.
   Depends on: utils.js, parser.js (buildDriver, refreshP),
               templates.js (TMPL),
               render-core.js (snaps, cur, prev, render),
               runner.js (runCode, setStat)
   ══════════════════════════════════════════════════════════════════════ */

/* ── CodeMirror editor init ─────────────────────────────────────────── */
const cm = CodeMirror.fromTextArea(document.getElementById('code'), {
  mode:        'python',
  theme:       'default',
  lineNumbers: true,
  indentUnit:  4,
  tabSize:     4,
  lineWrapping:false,
  smartIndent: true,
  extraKeys: {
    // After typing "if x:" or "def f():" etc., Enter indents one level deeper.
    // Without this explicit binding CM uses a plain newline that ignores the ":"
    'Enter': 'newlineAndIndent',
    // Toggle Python comments with Cmd-/ (Mac) and Ctrl-/ (Windows / Linux).
    // Uses the comment addon — works on current line or full selection.
    'Cmd-/':  'toggleComment',
    'Ctrl-/': 'toggleComment'
  }
});
window._cm  = cm;               // shared reference for runner.js / hlLine
const tiEl  = document.getElementById('tinput');
window._tiEl = tiEl;            // shared reference for runner.js

/* ── Tab → spaces normaliser ────────────────────────────────────────────
   Python 3 hard-errors on mixed tabs + spaces. Whenever the user pastes
   code that contains tab characters, silently replace every \t with 4
   spaces so the editor and the runner always see consistent indentation.
   ─────────────────────────────────────────────────────────────────────── */
cm.on('change', (editor, change) => {
  if(change.origin !== 'paste') return;
  const val  = editor.getValue();
  if(!val.includes('\t')) return;
  const clean = val.replace(/\t/g, '    ');
  const cursor = editor.getCursor();
  editor.operation(() => {
    editor.setValue(clean);
    editor.setCursor(cursor);
  });
});

/* ── Parsed-input preview badge ─────────────────────────────────────── */
function refreshP(){
  const b = document.getElementById('pbadge');
  const g = document.getElementById('genprev');
  if(!tiEl.value.trim()){ b.className=''; b.textContent='detecting'; g.textContent=''; return; }
  const { driver, parsed } = buildDriver(cm.getValue(), tiEl.value);
  b.className   = parsed ? 'ok' : 'warn';
  b.textContent = parsed ? '✓ parsed' : '⚠ direct';
  g.textContent = driver;
}
tiEl.addEventListener('input', refreshP);
cm.on('change', refreshP);

/* ── Example template dropdown ──────────────────────────────────────── */
document.getElementById('tmpl').addEventListener('change', e=>{
  const t = TMPL[e.target.value];
  if(!t) return;
  cm.setValue(t.code);
  tiEl.value = t.input;
  refreshP();
});
// Load default example on startup
document.getElementById('tmpl').value = 'binary_search';
cm.setValue(TMPL.binary_search.code);
tiEl.value = TMPL.binary_search.input;
refreshP();

/* ── Toggle generated-driver preview ───────────────────────────────── */
let showP = false;
document.getElementById('tgl').addEventListener('click', ()=>{
  showP = !showP;
  document.getElementById('genprev').classList.toggle('hidden', !showP);
  document.getElementById('tgl').textContent = showP ? 'hide ←' : 'show →';
});

/* ── Resizers (horizontal: left↔right, vertical: code↔input) ───────── */
(function(){
  const hr   = document.getElementById('hr');
  const main = document.getElementById('main');
  const left = document.getElementById('left');
  let hd = false;

  hr.addEventListener('mousedown', e=>{
    hd=true; hr.classList.add('act'); document.body.classList.add('dh'); e.preventDefault();
  });
  document.addEventListener('mousemove', e=>{
    if(!hd) return;
    const r = main.getBoundingClientRect();
    left.style.width = Math.min(Math.max(e.clientX-r.left, 200), r.width-260) + 'px';
    if(window._cm) window._cm.refresh();
  });
  document.addEventListener('mouseup', ()=>{
    if(!hd) return;
    hd=false; hr.classList.remove('act'); document.body.classList.remove('dh');
  });

  const vr = document.getElementById('vr');
  const lt = document.getElementById('left-top');
  const lb = document.getElementById('left-bot');
  let vd=false, sy, sth, sbh;

  vr.addEventListener('mousedown', e=>{
    vd=true; vr.classList.add('act'); document.body.classList.add('dv');
    sy=e.clientY; sth=lt.getBoundingClientRect().height; sbh=lb.getBoundingClientRect().height;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e=>{
    if(!vd) return;
    const d = e.clientY - sy;
    lt.style.flex='none'; lt.style.height=Math.max(80,sth+d)+'px';
    lb.style.height=Math.max(60,sbh-d)+'px';
    if(window._cm) window._cm.refresh();
  });
  document.addEventListener('mouseup', ()=>{
    if(!vd) return;
    vd=false; vr.classList.remove('act'); document.body.classList.remove('dv');
  });
})();

/* ── Theme system ───────────────────────────────────────────────────── */
const DARK_THEMES = new Set(['dark','night','dusk','ember']);
(function(){
  const swatches  = document.querySelectorAll('.tsw');
  const toggleBtn = document.getElementById('themetgl');
  let cur = localStorage.getItem('theme') || 'light';

  function applyTheme(t){
    cur = t;
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
    swatches.forEach(s=>s.classList.toggle('active', s.dataset.t===t));
    const isDark = DARK_THEMES.has(t);
    toggleBtn.textContent = isDark ? '☀' : '🌙';
    toggleBtn.title = isDark ? 'Switch to light' : 'Switch to dark';
    if(window._cm){
      const bg = isDark
        ? (t==='night'?'#020817':t==='dusk'?'#0f172a':t==='ember'?'#242933':'#0a0a0a')
        : '#fdfcf8';
      window._cm.getWrapperElement().style.background = bg;
      window._cm.refresh();
    }
  }

  swatches.forEach(s=>s.addEventListener('click', ()=>applyTheme(s.dataset.t)));
  toggleBtn.addEventListener('click', ()=>applyTheme(DARK_THEMES.has(cur)?'light':'dark'));
  applyTheme(cur);
})();

/* ── Transport buttons ──────────────────────────────────────────────── */
const btnRun  = document.getElementById('run');
const btnSB   = document.getElementById('sb');
const btnSF   = document.getElementById('sf');
const btnPlay = document.getElementById('play');
const speedEl = document.getElementById('speed');
let playing = false, _pt = null;

function updCtrl(){
  const has = snaps.length > 0;
  btnSB.disabled   = !has || cur === 0;
  btnSF.disabled   = !has || cur >= snaps.length-1;
  btnPlay.disabled = !has;
  // Play/pause icon is drawn in CSS via the `.on` class — no glyph swapping.
  btnPlay.classList.toggle('on', playing);
}

function reRender(idx){
  if(idx > 0){
    const p = snaps[idx-1];
    prev = {
      lists:        { ...p.lists },
      grids:        JSON.parse(JSON.stringify(p.grids||{})),
      locals:       { ...p.locals },
      dicts:        { ...p.dicts },
      sets:         { ...p.sets },
      deques:       { ...p.deques||{} },
      node_pointers:{ ...p.node_pointers },
      linked_lists: { ...p.linked_lists||{} },
      trees:        { ...p.trees||{} }
    };
  } else {
    prev = { lists:{}, grids:{}, locals:{}, dicts:{}, sets:{},
             deques:{}, node_pointers:{}, linked_lists:{}, trees:{} };
  }
  cur = idx;
  render();
  updCtrl();
}

function startPlay(){
  if(!snaps.length) return;
  playing = true;
  updCtrl();
  const ms   = () => Math.max(40, 1050 - parseInt(speedEl.value)*50);
  const tick = () => {
    if(!playing) return;
    if(cur >= snaps.length-1){ stopPlay(); return; }
    reRender(cur+1);
    _pt = setTimeout(tick, ms());
  };
  _pt = setTimeout(tick, ms());
}

function stopPlay(){
  playing = false;
  if(_pt){ clearTimeout(_pt); _pt=null; }
  updCtrl();
}

/* ── Live auto-play (suggestion #5) ─────────────────────────────────
   Called by runner.js after a live-mode trace completes.
   Sweeps from step 0 → last step at high speed so the user sees the
   algorithm "flash through", then settles at the final state.
   ─────────────────────────────────────────────────────────────────── */
const LIVE_STEP_MS = 80; // ms per step during live sweep

// startFrom: step index to begin the sweep from (0 = full replay, N = mid-trace)
window._liveAutoPlay = function(startFrom = 0){
  if(!snaps.length) return;
  stopPlay(); // cancel any normal play in progress

  reRender(Math.max(0, Math.min(startFrom, snaps.length - 1)));

  let _lt = null;
  function tick(){
    if(!window._liveOn){ clearTimeout(_lt); return; } // live turned off mid-sweep
    if(cur >= snaps.length - 1){ updCtrl(); return; }  // reached end — settle here
    reRender(cur + 1);
    _lt = setTimeout(tick, LIVE_STEP_MS);
  }
  _lt = setTimeout(tick, LIVE_STEP_MS);
};

btnRun.addEventListener('click',  ()=>{ stopPlay(); runCode(); });
btnSB.addEventListener('click',   ()=>{ if(cur>0) reRender(cur-1); });
btnSF.addEventListener('click',   ()=>{ if(cur<snaps.length-1) reRender(cur+1); });
btnPlay.addEventListener('click', ()=>{ if(playing) stopPlay(); else startPlay(); });

/* ── Live mode ──────────────────────────────────────────────────────
   When active, re-runs the trace 1 s after the user stops typing.
   A pulsing dot on the button shows the debounce countdown.

   Tier 1 — silent skip: if the code is OBVIOUSLY mid-typing
     (unclosed brackets, trailing `:` with no body, dangling comma, etc.)
     just don't run.  No error banner, no flash.  Viz stays frozen.
   Tier 2 — runtime errors (handled in runner.js) keep the viz frozen
     and only show the error banner.
   ─────────────────────────────────────────────────────────────────── */
const liveBtnEl = document.getElementById('live-btn');
window._liveOn = false;
let _liveTimer = null;

// Quick syntactic completeness heuristic — runs in <1 ms even on large code
function _isLikelyIncomplete(code){
  // Strip strings + comments first to avoid false positives on a `#` inside a
  // string or a `:` inside a comment etc.
  const stripped = code
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/'''[\s\S]*?'''/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/#[^\n]*/g, '');

  // Unbalanced brackets → we're mid-expression
  let depth = 0;
  for(const ch of stripped){
    if(ch === '(' || ch === '[' || ch === '{') depth++;
    else if(ch === ')' || ch === ']' || ch === '}'){
      depth--;
      if(depth < 0) return true;        // syntax broken; user is still editing
    }
  }
  if(depth > 0) return true;            // unclosed (), [], {}

  // Last non-empty line ends with a continuation char → user is still typing
  const lines = stripped.split('\n');
  let last = '';
  for(let i = lines.length - 1; i >= 0; i--){
    const t = lines[i].trim();
    if(t){ last = t; break; }
  }
  if(/[:,\\(\[{]\s*$/.test(last)) return true;

  return false;
}
window._isLikelyIncomplete = _isLikelyIncomplete;  // exposed for tests/debug

function _liveSchedule(){
  if(!window._liveOn) return;
  liveBtnEl.classList.add('pending');
  clearTimeout(_liveTimer);
  _liveTimer = setTimeout(()=>{
    liveBtnEl.classList.remove('pending');
    if(!window._liveOn) return;
    // Tier 1: skip silently if the code is clearly mid-typing
    if(_isLikelyIncomplete(cm.getValue())) return;
    runCode();
  }, 1000);
}

liveBtnEl.addEventListener('click', ()=>{
  window._liveOn = !window._liveOn;
  liveBtnEl.classList.toggle('on', window._liveOn);
  document.body.classList.toggle('live-active', window._liveOn);
  if(!window._liveOn){
    clearTimeout(_liveTimer);
    liveBtnEl.classList.remove('pending');
  } else {
    Toast.show('Live mode on — reruns 1 s after you stop typing', 'success', 2000);
  }
});

// Hook into the existing CM change listener
cm.on('change', _liveSchedule);

speedEl.addEventListener('input', ()=>{
  document.getElementById('sval').textContent = speedEl.value + '×';
  Store.set('speed', speedEl.value);
});

/* ── Indent guide overlay ───────────────────────────────────────────── */
// Features:
//   1. Per-line guide count based on actual indent depth
//   2. Blank lines inherit depth from surrounding block (continuous guides)
//   3. Active block guide brightens when cursor is inside that indent level
const INDENT = 4;

// Measure char width once (cached)
function _getCharW(){
  if(cm._charW) return cm._charW;
  const tmp = document.createElement('span');
  tmp.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:700 13px/1 "JetBrains Mono",monospace';
  tmp.textContent = 'x';
  document.body.appendChild(tmp);
  cm._charW = tmp.getBoundingClientRect().width;
  document.body.removeChild(tmp);
  return cm._charW;
}

// Count leading spaces of a line
function _lineSpaces(text){
  let s = 0;
  while(s < text.length && text[s] === ' ') s++;
  return s;
}

// For blank lines: look at prev + next non-blank lines and take the min depth
// so the guide runs through blank lines within a block but stops at block end.
function _blankLineDepth(editor, lineNo){
  const total = editor.lineCount();
  let prevD = 0, nextD = 0;
  for(let i = lineNo - 1; i >= 0; i--){
    const t = editor.getLine(i);
    if(t && t.trim()){ prevD = Math.floor(_lineSpaces(t) / INDENT); break; }
  }
  for(let i = lineNo + 1; i < total; i++){
    const t = editor.getLine(i);
    if(t && t.trim()){ nextD = Math.floor(_lineSpaces(t) / INDENT); break; }
  }
  return Math.min(prevD, nextD);
}

// Get the active indent level: how many complete INDENT-levels deep the cursor is
function _activeLevels(editor){
  const cursor = editor.getCursor();
  const line   = editor.getLine(cursor.line) || '';
  // Use the cursor column, not just line indent, so mid-line cursor works too
  return Math.floor(Math.min(cursor.ch, _lineSpaces(line)) / INDENT);
}

cm.on('renderLine', function(editor, line, el){
  const lineNo = editor.getLineNumber(line);
  const text   = line.text;
  const isBlank = !text.trim();

  const levels = isBlank
    ? _blankLineDepth(editor, lineNo)
    : Math.floor(_lineSpaces(text) / INDENT);

  if(levels === 0) return;

  const content = el.querySelector('.CodeMirror-line') || el;
  content.style.position = 'relative';
  const charW = _getCharW();
  const activeLevel = _activeLevels(editor);
  const isDark = ['dark','night','dusk','ember'].includes(
    document.documentElement.dataset.theme
  );

  for(let i = 1; i <= levels; i++){
    const isActive = i === activeLevel;
    const mark = document.createElement('span');
    mark.className = 'cm-indent-guide' + (isActive ? ' cm-indent-guide-active' : '');
    mark.style.cssText = [
      `left:${i * INDENT * charW}px`,
      'position:absolute',
      'top:0',
      'bottom:0',
      'width:1px',
      'pointer-events:none',
      `background:${isActive
        ? (isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.30)')
        : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)')
      }`
    ].join(';');
    content.appendChild(mark);
  }
});

// Refresh guides on change and cursor movement (for active highlight).
// cursorActivity uses requestAnimationFrame so CodeMirror's built-in
// scroll-to-cursor runs first in the current frame, then guides repaint
// in the next — no interference with keyboard selection scrolling.
cm.on('change', () => { cm._charW = null; cm.refresh(); });
let _guidRaf = null;
cm.on('cursorActivity', () => {
  if(_guidRaf) cancelAnimationFrame(_guidRaf);
  _guidRaf = requestAnimationFrame(() => { cm.refresh(); _guidRaf = null; });
});
setTimeout(() => cm.refresh(), 150);

/* ── Line-click jump ─────────────────────────────────────────────────
   After a trace runs, executed line numbers turn accent-colored.
   Clicking any of them jumps the visualiser to the LAST snapshot
   where that line executed, and the existing .ch / diff-highlight
   shows exactly what changed at that step.
   ─────────────────────────────────────────────────────────────────── */
let _execLineHandles = []; // track handles we've classed, for cleanup

/**
 * Mark/unmark executed lines in the CM gutter.
 * Called by runner.js after a run completes (or with [] to clear).
 */
window._markExecutedLines = function(snapList){
  // Remove previous markers
  _execLineHandles.forEach(lh => {
    try { cm.removeLineClass(lh, 'gutter', 'exec-line'); } catch(e){}
  });
  _execLineHandles = [];

  if(!snapList || !snapList.length) return;

  // Collect unique 1-indexed line numbers that ran in user code
  const lines = new Set();
  snapList.forEach(s => {
    if(s.filename === '<user>' && s.line) lines.add(s.line);
  });

  lines.forEach(lineNo => {
    const lh = cm.getLineHandle(lineNo - 1); // CM is 0-indexed
    if(lh){
      cm.addLineClass(lh, 'gutter', 'exec-line');
      _execLineHandles.push(lh);
    }
  });
};

/**
 * gutterClick fires when the user clicks the line-number gutter area.
 * lineNo is 0-indexed (CM convention).
 */
cm.on('gutterClick', function(editor, lineNo){
  if(!snaps.length) return;
  const clickedLine = lineNo + 1; // convert to 1-indexed (matches snap.line)

  // Find the LAST snapshot that executed this line in user code
  let targetIdx = -1;
  for(let i = snaps.length - 1; i >= 0; i--){
    if(snaps[i].line === clickedLine && snaps[i].filename === '<user>'){
      targetIdx = i;
      break;
    }
  }
  if(targetIdx === -1) return; // line never executed — ignore click

  stopPlay();
  reRender(targetIdx);

  // Flash the line briefly so the user sees where they landed
  const lh = cm.getLineHandle(lineNo);
  if(lh){
    cm.addLineClass(lh, 'background', 'line-jump-flash');
    setTimeout(() => {
      try { cm.removeLineClass(lh, 'background', 'line-jump-flash'); } catch(e){}
    }, 600);
  }

  Toast.show(`Jumped to step ${targetIdx + 1} / ${snaps.length}  ·  line ${clickedLine}`, 'success', 1800);
});
