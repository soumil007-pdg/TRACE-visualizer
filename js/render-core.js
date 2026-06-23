/* ══════════════════════════════════════════════════════════════════════
   render-core.js ─ Core render loop + shared execution state.
   Manages: snaps, cur, prev, _finalResult, _hasResult
   Functions: render(), renderPanel(), rStmtPanel(), rCondPanel(),
              renderResultPanel(), setProgress(), showErr()
   Depends on: utils.js, renderers.js
   ══════════════════════════════════════════════════════════════════════ */

/* ── Shared execution state (written by runner.js, read by render/controls) ── */
let snaps = [];
let cur = 0;
let _callTrees = [];   // call-tree roots built by tracer; populated by runner.js

/* ── Per-variable view override: 'bars' | 'pills' (set by toggle button) ── */
const _listViewOverride = {};
window.toggleListView = function(name, currentView){
  _listViewOverride[name] = currentView === 'bars' ? 'pills' : 'bars';
  render();
};
let prev = {
  lists:{}, grids:{}, locals:{}, dicts:{}, sets:{},
  deques:{}, node_pointers:{}, linked_lists:{}, trees:{}
};
let _finalResult = null, _hasResult = false;

/* ── Call-tree cleanup ──────────────────────────────────────────────── */
/**
 * Strip wrapper roots (class constructors, non-recursive entry methods)
 * so the recursion tree shows the actual recursive function.
 *
 * Rule: a root is "real recursion" if it calls itself (any descendant
 * shares its function name). Otherwise it's a wrapper — drop it and
 * recursively promote its children to roots.
 *
 * Class constructors (`Solution()` with no children) are always dropped.
 */
function _cleanCallTrees(roots){
  function recursesItself(node, name){
    for(const c of node.children){
      if(c.func === name) return true;
      if(recursesItself(c, name)) return true;
    }
    return false;
  }
  function promote(node){
    // Solution()-style constructor with no children — always drop
    if(node.children.length === 0 && /^[A-Z]/.test(node.func||'')) return [];
    // Real recursion — keep as-is
    if(recursesItself(node, node.func)) return [node];
    // Wrapper — drop it, promote its children (recursively cleaned)
    const out = [];
    for(const c of node.children){
      for(const p of promote(c)) out.push(p);
    }
    return out;
  }
  const cleaned = [];
  for(const r of roots){
    for(const p of promote(r)) cleaned.push(p);
  }
  // Safety: if cleanup removed everything, fall back to the original trees
  return cleaned.length ? cleaned : roots;
}

/* ── Progress indicator ─────────────────────────────────────────────── */
function setProgress(i, total){
  const pct = total>0 ? ((i+1)/total)*100 : 0;
  document.getElementById('pnum').textContent = total>0
    ? `${String(i+1).padStart(3,'0')} / ${String(total).padStart(3,'0')}`
    : '— / —';
  document.getElementById('pfill').style.width = pct+'%';
  document.getElementById('topstripe-fill').style.width = pct+'%';
}

/* ── Error banner ───────────────────────────────────────────────────── */
function showErr(m){
  const e = document.getElementById('errbanner');
  e.textContent = m;
  e.classList.add('show');
}

/* ── Smart result detection ─────────────────────────────────────────── */
/**
 * Returns true if nodeId matches any node in the input trees
 * (i.e. the result is a node found within the input, not a new structure).
 * Uses the first snapshot's trees as the "input" state.
 */
function _isFoundNode(resultRoot){
  if(!snaps || !snaps.length || !resultRoot) return false;
  // Use the first snapshot that actually has trees (driver snaps may have none)
  let inputTrees = {};
  for(const s of snaps){
    if(s.trees && Object.keys(s.trees).length){ inputTrees = s.trees; break; }
  }
  function countNodes(n){ if(!n) return 0; return 1+countNodes(n.left)+countNodes(n.right); }
  function hasId(n, id){ if(!n) return false; if(n.id===id) return true; return hasId(n.left,id)||hasId(n.right,id); }

  const inputCount = Object.values(inputTrees).reduce((s,t)=>s+countNodes(t), 0);
  const resultCount = countNodes(resultRoot);
  const idExistsInInput = Object.values(inputTrees).some(t=>hasId(t, resultRoot.id));

  // "Found node" = node existed in input AND result tree has same node count as input
  // (i.e. nothing was added/removed — just returning a pointer to an existing node)
  return idExistsInInput && resultCount <= inputCount;
}

/* ── Result panel ───────────────────────────────────────────────────── */
function renderResultPanel(result, hasResult){
  const panel = document.getElementById('result-panel');
  const body  = document.getElementById('result-body');
  if(!hasResult){ panel.classList.remove('show'); return; }
  panel.classList.add('show');

  if(result === null){
    body.innerHTML = `<span class="rp-none">None</span>`; return;
  }
  if(typeof result !== 'object' || result === null){
    body.innerHTML = `<span class="rp-scalar">${esc(String(result))}</span>`; return;
  }
  // ── TreeNode / ListNode results: reuse the existing variable renderers ──
  if(result && result.__kind__==='tree' && result.root){
    // Smart detection: if the returned node's id already exists in the input
    // tree (first snapshot), this is a "found node" result (e.g. LCA, search)
    // — show just the value. Otherwise it's a new/modified tree — show fully.
    if(_isFoundNode(result.root)){
      body.innerHTML = `<span class="rp-scalar" title="Node found in input tree">${esc(String(result.root.val))}</span>`;
    } else {
      body.innerHTML = rTree('result', result.root, {});
    }
    return;
  }
  if(result && result.__kind__==='list' && Array.isArray(result.nodes)){
    body.innerHTML = rLL('result', { nodes:result.nodes, cycle_to:result.cycle_to }, {}); return;
  }
  if(Array.isArray(result) && result.every(x=>!Array.isArray(x)&&typeof x!=='object')){
    if(result.length===0){ body.innerHTML=`<span class="rp-scalar">[ ]</span>`; return; }
    const items = result.map((v,i)=>`<div class="rp-item"><span class="rp-pill">${esc(String(v))}</span><span class="rp-idx">${i}</span></div>`);
    body.innerHTML = items.reduce((acc,item,i)=>acc+(i>0?'<span class="rp-sep">,</span>':'')+item,'');
    return;
  }
  if(Array.isArray(result) && result.every(x=>Array.isArray(x))){
    const rows = result.map(row=>`<div style="display:flex;gap:4px">${row.map(v=>`<span class="rp-pill" style="min-width:28px;text-align:center">${esc(String(v))}</span>`).join('')}</div>`).join('');
    body.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px">${rows}</div>`;
    return;
  }
  if(Array.isArray(result)){
    const items = result.map((v,i)=>`<div class="rp-item"><span class="rp-pill">${esc(JSON.stringify(v))}</span><span class="rp-idx">${i}</span></div>`);
    body.innerHTML = items.reduce((acc,item,i)=>acc+(i>0?'<span class="rp-sep">,</span>':'')+item,'');
    return;
  }
  if(typeof result === 'object'){
    const rows = Object.entries(result).slice(0,20).map(([k,v])=>`<div class="rp-item"><span class="rp-pill" style="font-size:11px"><b>${esc(k)}</b>: ${esc(String(v))}</span></div>`);
    body.innerHTML = rows.join('<span class="rp-sep">,</span>');
    return;
  }
  body.innerHTML = `<span class="rp-raw">${esc(JSON.stringify(result))}</span>`;
}

/* ── Statement panel ────────────────────────────────────────────────── */
function rStmtPanel(stmts){
  if(!stmts || !stmts.length) return null;
  const rows = stmts.map(st=>{
    if(st.type==='assign')
      return `<div class="stmt-row"><span class="stmt-kw">compute</span><span class="stmt-src">${esc(st.var)} = ${esc(st.expr)}</span><span class="stmt-arr">→</span><span class="stmt-val">${esc(st.result)}</span></div>`;
    if(st.type==='heappush')
      return `<div class="stmt-row"><span class="stmt-kw">push</span><span class="stmt-src">into <b>${esc(st.heap)}</b></span><span class="stmt-arr">→</span><span class="stmt-val">${esc(st.value)}</span></div>`;
    if(st.type==='heappop'){
      const topDisp = st.top && st.top!=='empty' ? esc(st.top) : 'top element';
      return `<div class="stmt-row"><span class="stmt-kw">pop</span><span class="stmt-src">from <b>${esc(st.heap)}</b></span><span class="stmt-arr">→</span><span class="stmt-val">${topDisp} removed</span></div>`;
    }
    if(st.type==='list_append')
      return `<div class="stmt-row"><span class="stmt-kw">append</span><span class="stmt-src">into <b>${esc(st.list)}</b></span><span class="stmt-arr">→</span><span class="stmt-val">${esc(st.value)}</span></div>`;
    if(st.type==='list_extend')
      return `<div class="stmt-row"><span class="stmt-kw">extend</span><span class="stmt-src"><b>${esc(st.list)}</b> +=</span><span class="stmt-arr">→</span><span class="stmt-val">${esc(st.value)}</span></div>`;
    if(st.type==='dict_set')
      return `<div class="stmt-row"><span class="stmt-kw">set</span><span class="stmt-src"><b>${esc(st.dict)}</b>[${esc(st.key)}]</span><span class="stmt-arr">→</span><span class="stmt-val">${esc(st.value)}</span></div>`;
    if(st.type==='dict_update')
      return `<div class="stmt-row"><span class="stmt-kw">update</span><span class="stmt-src"><b>${esc(st.dict)}</b>[${esc(st.key)}]</span><span class="stmt-arr">→</span><span class="stmt-val">${esc(st.value)}</span></div>`;
    return '';
  }).join('');
  return `<div class="stmt-panel">${rows}</div>`;
}

/* ── Condition panel ────────────────────────────────────────────────── */
function rCondPanel(cond){
  if(!cond) return null;
  if(cond.loop)
    return `<div class="cond-panel cond-loop"><span class="cond-kw">for</span><span class="cond-expr">${esc(cond.expr)}</span><span class="cond-badge">LOOP</span></div>`;
  if(cond.result===null) return null;
  const cls   = cond.result ? 'cond-t' : 'cond-f';
  const badge = cond.result ? '✓ TRUE' : '✗ FALSE';
  return `<div class="cond-panel ${cls}"><span class="cond-kw">${esc(cond.kw)}</span><span class="cond-expr">${esc(cond.expr)}</span><span class="cond-badge">${badge}</span></div>`;
}

/** Check if a value is deeply nested (contains objects/arrays) */
function hasDeepNesting(val, depth=0){
  if(depth > 1) return true;
  if(typeof val !== 'object' || val === null) return false;
  if(Array.isArray(val)){
    return val.some(x => typeof x === 'object' && x !== null);
  } else {
    return Object.values(val).some(x => typeof x === 'object' && x !== null);
  }
}

/* ── Single-variable panel dispatcher ──────────────────────────────── */
function renderPanel(n, s){
  if(s.deques && s.deques[n] !== undefined)
    return rQueue(n, s.deques[n], prev.deques[n]||[]);
  if(s.linked_lists && s.linked_lists[n])
    return rLL(n, s.linked_lists[n], s.node_pointers);
  if(s.trees && s.trees[n])
    return rTree(n, s.trees[n], s.node_pointers);
  if(s.grids && s.grids[n])
    return rGrid(n, s.grids[n], prev.grids[n]||null);
  if(s.lists && s.lists[n] !== undefined){
    const a=s.lists[n], pA=prev.lists[n]||[], locs=s.locals||{};
    // ── Heap check must come before deep-nesting, since heap tuples are nested arrays ──
    const isHeapVar = HEAP_NAME.test(n) || _heapVars.has(n);
    const isHeap = isHeapVar && a.every(x=>typeof x==='number'||Array.isArray(x));
    if(isHeap){
      // dispS is already the post-execution state, so 'a' reflects the heap after this line ran
      return rHeap(n, a, pA);
    }
    // ── Check for deep nesting (arrays of arrays, etc.) ──
    if(hasDeepNesting(a)){
      return rNested(n, a, pA);
    }
    const hasTuples = a.length>0 && Array.isArray(a[0]);
    if(hasTuples) return rTupleList(n, a, pA);
    const kind = classifyArr(n, a, locs);
    if(kind==='binary')  return rBinaryList(n, a, locs, pA);
    if(kind==='bool')    return rBoolList(n, a, pA);
    if(kind==='string')  return rStringList(n, a, locs, pA);
    // Numeric lists: auto-pick bars or pills, but let user override via toggle
    const autoView = kind === 'indexed' ? 'pills' : 'bars';
    const activeView = _listViewOverride[n] || autoView;
    const html = activeView === 'pills' ? rIndexedPills(n, a, locs, pA) : rBars(n, a, locs, pA);
    const nextLabel = activeView === 'bars' ? '⊞ pills' : '▦ bars';
    const btn = `<button class="view-tgl" title="Switch view" onclick="toggleListView('${n.replace(/'/g,"\\'")}','${activeView}')">${nextLabel}</button>`;
    return html.replace('</h3>', btn + '</h3>');
  }
  if(s.dicts && s.dicts[n] !== undefined){
    const d=s.dicts[n], pv=prev.dicts[n]||{};
    // ── Check for deep nesting in dicts ──
    if(hasDeepNesting(d)){
      return rNested(n, d, pv);
    }
    const rows = Object.entries(d).map(([k,v])=>`<tr><td class="k">${esc(k)}</td><td class="${pv[k]!==v?'ch':''}">${esc(fv(v))}</td></tr>`).join('')
               || '<tr><td colspan="2" style="color:var(--gray)">(empty)</td></tr>';
    return `<div class="vb"><h3>Dict&nbsp;&nbsp;${esc(n)}</h3><table class="dt"><tbody>${rows}</tbody></table></div>`;
  }
  if(s.sets && s.sets[n] !== undefined){
    const sv=s.sets[n], ps=new Set(prev.sets[n]||[]);
    // ── Check for deep nesting in sets ──
    if(hasDeepNesting(sv)){
      return rNested(n, sv, ps);
    }
    const pills = sv.length===0
      ? '<span style="color:var(--gray)">(empty)</span>'
      : sv.map(v=>`<span class="sp ${!ps.has(v)?'add':''}">${esc(fv(v))}</span>`).join('');
    return `<div class="vb"><h3>Set&nbsp;&nbsp;${esc(n)}</h3><div>${pills}</div></div>`;
  }
  return null;
}

/* ── Pick the best post-execution snapshot for display ──────────────── */
function computeDispS(cur){
  const s = snaps[cur];
  if(cur + 1 >= snaps.length) return s;
  const n1 = snaps[cur + 1];

  // ── Driver step: show the next user-frame's initial state ──
  if(s.filename === '<driver>')
    return n1.filename === '<user>' ? n1 : s;

  // ── User step, same file: n1 is post-execution, use it directly ──
  //    But if n1 lost data structures (entered a helper function), carry
  //    forward from the nearest snap that had them so panels don't vanish.
  if(n1.filename === s.filename){
    const _dsCount = (x) => Object.keys(x.grids||{}).length + Object.keys(x.lists||{}).length +
      Object.keys(x.dicts||{}).length + Object.keys(x.sets||{}).length +
      Object.keys(x.trees||{}).length + Object.keys(x.linked_lists||{}).length;
    const n1c = _dsCount(n1);
    if(n1c === 0){
      // n1 is in a helper frame with no structures — find the nearest prior snap that had them
      let donor = null;
      for(let i = cur; i >= Math.max(0, cur - 5); i--){
        if(_dsCount(snaps[i]) > 0){ donor = snaps[i]; break; }
      }
      if(donor){
        return {
          ...n1,
          lists:         { ...(donor.lists||{}) },
          dicts:         { ...(donor.dicts||{}) },
          sets:          { ...(donor.sets||{}) },
          deques:        { ...(donor.deques||{}) },
          grids:         { ...(donor.grids||{}) },
          linked_lists:  { ...(donor.linked_lists||{}) },
          trees:         { ...(donor.trees||{}) },
          node_pointers: { ...(donor.node_pointers||{}) },
          _var_order:    donor._var_order || n1._var_order,
        };
      }
    }
    return n1;
  }

  // ── Frame boundary (last line of a user method, returning to driver).
  //    n1 is the driver snap (no self.*).  Peek further for the next user
  //    frame — its state already reflects the completed method's mutations.
  //    Keep s's locals so variable chips still show the current frame.  ──
  for(let i = cur + 2; i <= Math.min(cur + 3, snaps.length - 1); i++){
    const ni = snaps[i];
    if(ni.filename === '<user>'){
      return {
        ...s,                                         // keep locals / var_order
        lists:         { ...(ni.lists         || {}) },
        dicts:         { ...(ni.dicts         || {}) },
        sets:          { ...(ni.sets          || {}) },
        deques:        { ...(ni.deques        || {}) },
        linked_lists:  { ...(ni.linked_lists  || {}) },
        trees:         { ...(ni.trees         || {}) },
        grids:         { ...(ni.grids         || {}) },
        node_pointers: { ...(ni.node_pointers || {}) },
        _var_order:    ni._var_order || s._var_order,
      };
    }
  }
  return s; // nothing useful ahead — keep pre-execution state
}

/* ── Main render function ───────────────────────────────────────────── */
function render(){
  if(!snaps.length) return;
  const s = snaps[cur];

  /* sys.settrace fires the 'line' event BEFORE a line executes, so snaps[cur]
     holds pre-execution state.  computeDispS() finds the best post-execution
     state: same-frame next snap, or (at function boundaries) the next user
     frame's initial state which already carries the completed method's effects. */
  const dispS = computeDispS(cur);

  // hlLine is defined in runner.js (loaded before render-core.js is first called)
  hlLine(s.line, s.filename==='<driver>');
  document.getElementById('lineid').textContent =
    (s.filename==='<driver>'?'DRIVER':'CODE') + ' · LINE ' + String(s.line).padStart(2,'0');
  setProgress(cur, snaps.length);

  // Mobile sticky line header — the editor is hidden in full-screen trace mode,
  // so we pin the EXACT source line being executed at this step right above the
  // visualization. Updates as the user steps forward / back.
  const _mlh = document.getElementById('mobile-line-head');
  if(_mlh){
    if(s.filename === '<driver>'){
      _mlh.innerHTML = '<span class="mlh-num">DRV</span><span class="mlh-src">driver setup</span>';
    } else {
      let _src = '';
      try { _src = window._cm ? (window._cm.getLine(s.line-1) || '').trim() : ''; } catch(e){}
      _mlh.innerHTML = '<span class="mlh-num">L'+s.line+'</span><span class="mlh-src">'+esc(_src)+'</span>';
    }
  }

  // ── Sticky exec header — always visible at top while scrolling ──
  const execParts = [];
  const sp = rStmtPanel(s.stmt);
  if(sp) execParts.push(sp);
  const cp = rCondPanel(s.cond);
  if(cp) execParts.push(cp);
  if(!sp && !cp && s.filename === '<user>' && s.line){
    const rawLine = (window._cm ? window._cm.getLine(s.line - 1) : '') || '';
    const trimmed = rawLine.trim();
    if(trimmed){
      execParts.push(`<div class="cond-panel cond-exec"><span class="cond-kw">line&nbsp;${s.line}</span><span class="cond-expr">${esc(trimmed)}</span></div>`);
    }
  }
  document.getElementById('exec-head').innerHTML = execParts.join('');

  const out = [];

  // ── 3. Variables — chip strip or history trail ───────────────────────
  //    For scalar-only problems (DP, counters, math) every variable shows
  //    a trail of its past distinct values so the evolution is visible:
  //       prev1:  1  →  2  →  3  →  [5]
  //    Falls back to the plain chip strip for the first couple of steps.
  const sc = Object.entries(dispS.locals||{});
  if(sc.length){
    // A value is "scalar" if it's a primitive — not a list/dict/object
    const isScalar = v => v === null || typeof v !== 'object';

    // Build distinct-value history for each scalar variable up to cur
    const histories = {};
    let hasAnyHistory = false;
    for(const [k, v] of sc){
      if(!isScalar(v)){ histories[k] = null; continue; }
      const hist = [];
      let last = undefined;
      for(let i = 0; i <= cur && i < snaps.length; i++){
        const locs = snaps[i].locals;
        if(!locs || !(k in locs)) continue;
        const sv = locs[k];
        if(sv !== last){ hist.push(sv); last = sv; }
      }
      // The history above is built from PRE-execution snapshots, but the chip
      // beside it shows the POST-execution value (dispS, via look-ahead). Those
      // two are one step out of sync, so on the exact line that changes a var
      // the trail lagged a step (showed "11" alone, then "16 → 11" next step).
      // Append the current post-exec value so old→new shows on the right line.
      if(v !== last) hist.push(v);
      histories[k] = hist;
      if(hist.length > 1) hasAnyHistory = true;
    }

    if(hasAnyHistory){
      // Trail layout — one row per variable
      const rows = sc.map(([k, v]) => {
        const ch   = prev.locals[k] !== v;
        const hist = histories[k];

        if(!hist || hist.length <= 1){
          // Variable hasn't evolved yet — show plain chip aligned in trail grid
          return `<div class="var-row">
            <span class="var-lbl">${esc(k)}</span>
            <div class="var-trail">
              <span class="chip ${ch?'ch':''}">${esc(fv(v))}</span>
            </div>
          </div>`;
        }

        // past = all distinct values before current, capped at 6 for space
        const past       = hist.slice(0, -1).slice(-6);
        const totalPast  = past.length;
        const trailHTML  = past.map((pv, i) => {
          // Fade older values: earliest = 0.18 opacity, just-before-current = 0.60
          const t   = totalPast > 1 ? i / (totalPast - 1) : 1;
          const opc = (0.18 + t * 0.42).toFixed(2);
          return `<span class="trail-pill" style="opacity:${opc}">${esc(fv(pv))}</span><span class="trail-sep">→</span>`;
        }).join('');

        return `<div class="var-row">
          <span class="var-lbl">${esc(k)}</span>
          <div class="var-trail">
            ${trailHTML}
            <span class="chip ${ch?'ch':''}">${esc(fv(v))}</span>
          </div>
        </div>`;
      }).join('');

      out.push(`<div class="vb"><h3>Variables</h3><div class="var-history">${rows}</div></div>`);
    } else {
      // First few steps — no history yet, keep the familiar chip strip
      const chips = sc.map(([k,v])=>{
        const ch = prev.locals[k] !== v;
        return `<span class="chip ${ch?'ch':''}"><span class="k">${esc(k)}</span>&nbsp;=&nbsp;${esc(fv(v))}</span>`;
      }).join('');
      out.push(`<div class="vb"><h3>Variables</h3><div class="chips">${chips}</div></div>`);
    }
  }

  // Recursion panels — call stack + tree (only when recursion detected)
  if(_callTrees.length && s.current_call_id != null){
    // Strip wrapper roots that aren't real recursion (e.g. class Solution()
    // constructor, or non-recursive entry methods like insertIntoBST that
    // just delegate to a helper). Keep a root only if it recurses itself
    // (any descendant shares its function name) — otherwise promote its
    // children to roots. This makes the recursion tree show the actual
    // recursive function, not the LeetCode-style wrapper boilerplate.
    const cleanedTrees = _cleanCallTrees(_callTrees);
    const rtp = rRecursionPanels(cleanedTrees, s.current_call_id, s.call_depth || 0, s.max_call_id || 0);
    if(rtp) out.push(rtp);
  }

  // Data structures in CODE ORDER (_var_order) — from post-execution state
  const varOrder = dispS._var_order || s._var_order || [];
  const rendered = new Set();
  for(const n of varOrder){
    if(rendered.has(n)) continue;
    const p = renderPanel(n, dispS);
    if(p){ out.push(p); rendered.add(n); }
  }

  // Any structures NOT in var_order (driver-frame vars, edge cases)
  const allNonScalar = [
    ...Object.keys(dispS.linked_lists||{}),
    ...Object.keys(dispS.trees||{}),
    ...Object.keys(dispS.grids||{}),
    ...Object.keys(dispS.lists||{}),
    ...Object.keys(dispS.dicts||{}),
    ...Object.keys(dispS.sets||{}),
    ...Object.keys(dispS.deques||{})
  ];
  for(const n of allNonScalar){
    if(rendered.has(n)) continue;
    const p = renderPanel(n, dispS);
    if(p){ out.push(p); rendered.add(n); }
  }

  // Complexity growth panel — shown at the top of the trace while complexity
  // mode is active, with a live operation counter that tracks the current step.
  if(window.isComplexityActive && window.isComplexityActive() && window.renderComplexityPanel){
    const cxPanel = window.renderComplexityPanel(cur);
    if(cxPanel) out.unshift(cxPanel);
  }

  if(!out.length) out.push('<div class="empty">No visualizable state at this step.</div>');

  // Save tree viewport BEFORE innerHTML wipes it. Use proportional position
  // so it still makes sense if the layout dims/expands (pinch zoom changes
  // scrollWidth/scrollHeight; absolute scrollLeft would land in the wrong spot).
  const _prevScroll = document.querySelector('.svgt-scroll');
  const _savedPropX = (_prevScroll && _prevScroll.scrollWidth  > 0)
    ? _prevScroll.scrollLeft / _prevScroll.scrollWidth  : 0;
  const _savedPropY = (_prevScroll && _prevScroll.scrollHeight > 0)
    ? _prevScroll.scrollTop  / _prevScroll.scrollHeight : 0;

  document.getElementById('vc').innerHTML = out.join('');

  // Restore the same proportional position after the new layout commits.
  requestAnimationFrame(() => {
    const scroll = document.querySelector('.svgt-scroll');
    if(!scroll) return;
    scroll.scrollLeft = _savedPropX * scroll.scrollWidth;
    scroll.scrollTop  = _savedPropY * scroll.scrollHeight;
  });

  // Result panel: only on the very last snapshot
  const isLast = cur === snaps.length-1;
  if(isLast && _hasResult) renderResultPanel(_finalResult, true);
  else document.getElementById('result-panel').classList.remove('show');

  // Complexity button: available on any step (>2 steps). Complexity mode
  // stays on while scrubbing so the live op counter can track the step.
  const cxBtn = document.getElementById('cx-btn');
  if(cxBtn){
    if(snaps.length > 2){
      cxBtn.style.display = '';
      cxBtn.classList.toggle('on', !!(window.isComplexityActive && window.isComplexityActive()));
      cxBtn.onclick = function(){
        if(window.isComplexityActive && window.isComplexityActive()){
          window.clearComplexity();
          render();
        } else {
          window.showComplexity(snaps, window._cm ? window._cm.getValue() : '');
        }
      };
    } else {
      cxBtn.style.display = 'none';
      if(window.clearComplexity) window.clearComplexity();
    }
  }

  // Save post-execution state for diff highlighting on next render
  prev = {
    lists:       { ...dispS.lists },
    grids:       JSON.parse(JSON.stringify(dispS.grids||{})),
    locals:      { ...dispS.locals },
    dicts:       { ...dispS.dicts },
    sets:        { ...dispS.sets },
    deques:      { ...dispS.deques||{} },
    node_pointers:{ ...dispS.node_pointers },
    linked_lists:{ ...dispS.linked_lists||{} },
    trees:       { ...dispS.trees||{} }
  };
}
