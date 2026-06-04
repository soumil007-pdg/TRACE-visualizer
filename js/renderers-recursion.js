/* ══════════════════════════════════════════════════════════════════════
   renderers-recursion.js  v3
   ─ SVG Decision Tree   : found/pruned/memo states, outcome-aware edges
   ─ Indented Call Stack : depth-indented list with spine connector
   ══════════════════════════════════════════════════════════════════════ */

/* ── Shared helpers ──────────────────────────────────────────────────── */
function _pathTo(roots, targetId){
  function walk(n, p){
    const np = [...p, n];
    if(n.id === targetId) return np;
    for(const c of n.children||[]){ const f=walk(c,np); if(f) return f; }
    return null;
  }
  for(const r of roots){ const f=walk(r,[]); if(f) return f; }
  return null;
}

function _isRecursive(roots){
  function walk(n, anc){
    if(anc.has(n.func)) return true;
    anc.add(n.func);
    for(const c of n.children||[]){ if(walk(c, new Set(anc))) return true; }
    return false;
  }
  for(const r of roots){ if(walk(r, new Set())) return true; }
  return false;
}

function _args(args, maxLen=30){
  const s = Object.entries(args||{}).map(([k,v])=>`${k}=${v}`).join(', ');
  return s.length > maxLen ? s.slice(0, maxLen)+'…' : s;
}

/* ══════════════════════════════════════════════════════════════════════
   INDENTED CALL STACK  — clean depth-indented list (unchanged — user likes it)
   ══════════════════════════════════════════════════════════════════════ */
function rCallStack(callTrees, currentCallId, callDepth){
  if(!callDepth || callDepth < 1) return null;
  const path = _pathTo(callTrees, currentCallId);
  if(!path || !path.length) return null;

  const rows = path.map((n, i) => {
    const isActive = n.id === currentCallId;
    // Only show return value once the function has LEFT the active call path.
    // Every node in the call stack is currently executing — none have truly
    // returned yet in the replay, even if the final trace recorded them.
    const retHtml  = '';

    return `<div class="csl-row${isActive ? ' csl-active' : ''}" style="--d:${i}">
      <div class="csl-spine">
        ${i > 0 ? `<div class="csl-vline"></div>` : ''}
        <div class="csl-dot${isActive ? ' csl-dot-active' : ''}"></div>
      </div>
      <div class="csl-card">
        <span class="csl-depth">${n.depth}</span>
        <span class="csl-fn">${esc(n.func)}</span>
        <span class="csl-ag">(${esc(_args(n.args, 28))})</span>
        ${retHtml}
        ${isActive ? '<span class="csl-badge">▶ ACTIVE</span>' : ''}
      </div>
    </div>`;
  });

  return `<div class="vb csl-panel">
    <h3>Call Stack&nbsp;&nbsp;<span class="sub">depth&nbsp;${callDepth}</span></h3>
    <div class="csl-frames">${rows.join('')}</div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════
   SVG DECISION TREE  — polished 2-D layout with state-aware nodes
   ══════════════════════════════════════════════════════════════════════ */

const _T = {
  NW:  158,  // node card width
  NH:   44,  // node card height
  HG:   20,  // horizontal gap between siblings
  VG:   70,  // vertical gap (includes space for edge label)
  PAD:  24,  // outer padding
  RX:    8,  // corner radius
};

/* ── Detect if any call-tree node carries closure-list context ── */
function _hasArrayCtx(roots){
  function check(n){
    if(n.ctx && Object.values(n.ctx).some(v => Array.isArray(v))) return true;
    return (n.children||[]).some(check);
  }
  return roots.some(check);
}

/* ── Measure text width (monospace estimate: ~0.6× font-size per char) ── */
function _textW(str, fz){ return Math.ceil(String(str).length * fz * 0.62); }

/* ── Annotate each node with its own required card width (_nw) ──
   Called after LOD + _T are set, before _calcW.
   NW_min = _T.NW (the LOD tier minimum). */
function _annotateNodeWidths(roots, argFn, retMaxLen, fz, rfz, hPad){
  function walk(n){
    const argText = argFn(n.args);
    const retText = (n.return_val != null) ? `→ ${String(n.return_val).slice(0, retMaxLen)}` : '';
    const argW    = _textW(argText, fz);
    const retW    = retText ? _textW(retText, rfz) : 0;
    // icon takes ~10px, left accent bar ~3px, left pad ~8px, right pad ~8px
    const needed  = Math.max(argW, retW) + hPad;
    n._nw = Math.max(_T.NW, needed);
    (n.children || []).forEach(walk);
  }
  roots.forEach(walk);
}

/* ── Layout: subtree widths (bottom-up), using per-node _nw ── */
function _calcW(node){
  const ch = node.children || [];
  const nw = (node._nw || _T.NW) + _T.HG;
  if(!ch.length){ node._w = nw; return; }
  ch.forEach(_calcW);
  node._w = Math.max(nw, ch.reduce((s,c) => s+c._w, 0));
}

/* ── Layout: absolute positions (top-down) ── */
function _assignPos(node, cx, cy){
  node._cx = cx; node._cy = cy;
  const ch = node.children || [];
  if(!ch.length) return;
  const total = ch.reduce((s,c) => s+c._w, 0);
  let x = cx - total/2;
  // Use the parent's actual card height for vertical spacing
  const nh = _T.NH;
  ch.forEach(c => { _assignPos(c, x + c._w/2, cy + nh + _T.VG); x += c._w; });
}

/* ── Collect all nodes + edges ── */
function _collect(roots){
  const nodes=[], edges=[];
  function walk(n, parent){
    if(parent) edges.push([parent, n]);
    nodes.push(n);
    (n.children||[]).forEach(c => walk(c, n));
  }
  roots.forEach(r => walk(r, null));
  return { nodes, edges };
}

/* ── Canvas size ── */
function _dims(roots){
  let maxX=0, maxY=0;
  function walk(n){
    const nw = n._nw || _T.NW;
    maxX = Math.max(maxX, n._cx + nw/2 + _T.PAD);
    maxY = Math.max(maxY, n._cy + _T.NH  + _T.PAD);
    (n.children||[]).forEach(walk);
  }
  roots.forEach(walk);
  return { w: Math.max(maxX, 300), h: maxY };
}

/* ── Escape helper (make sure esc is available; fallback if not) ── */
const _esc = typeof esc === 'function' ? esc
  : s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* ── Return-value classifiers for found / pruned ── */
function _isTruthyReturn(rv){
  if(!rv) return false;
  const t = rv.trim();
  if(t === 'True') return true;
  if((t.startsWith('[') || t.startsWith('(')) && t !== '[]' && t !== '()') return true;
  if(t.startsWith("'") && t.length > 2) return true;
  if(t.startsWith('"') && t.length > 2) return true;
  if(/^\d+$/.test(t) && parseInt(t) > 0) return true;
  return false;
}
function _isFalsyReturn(rv){
  if(!rv) return false;
  const t = rv.trim();
  return t === 'False' || t === '0';  // NOT None — None leaves stay 'done'
}

/* ── Per-node state classifier ──
   maxCallId = highest call_id assigned by the tracer at the current step.
   A node with id > maxCallId hasn't been called yet → 'pending' (hidden). */
function _nodeState(n, currentCallId, activeIds, maxCallId){
  if(maxCallId != null && n.id > maxCallId) return 'pending';
  const isActive = n.id === currentCallId;
  const onPath   = activeIds.has(n.id);
  const isLeaf   = (n.children || []).length === 0;
  const isMemo   = !!n.is_memo;
  // "Returned by now" = either marker says returned OR we've moved past it
  // (id < currentCallId and not on active stack means we're done with it).
  const isDone   = n.returned && !onPath && !isActive;
  if(isActive) return 'active';
  if(isMemo && !onPath && !isActive) return 'memo';
  if(onPath)   return 'path';
  if(isDone && isLeaf && _isTruthyReturn(n.return_val)) return 'found';
  if(isDone && isLeaf && _isFalsyReturn(n.return_val))  return 'pruned';
  if(isDone)   return 'done';
  return 'pending';
}

/* ── Edge label: what changed from parent → child ── */
function _edgeLabel(parent, child){
  const pa = parent.args || {}, ca = child.args || {};
  const diffs = [];
  for(const k of Object.keys(ca)){
    if(String(pa[k]) !== String(ca[k])){
      const sk = k.length > 4 ? k.slice(0,2) : k;    // abbreviate long keys
      const v  = String(ca[k]).slice(0, 9);
      diffs.push(`${sk}=${v}`);
    }
  }
  if(!diffs.length) return '';
  return diffs.slice(0,2).join(', ');
}

/* ── Compact args: full key=value pairs, no truncation ── */
function _compactArgs(args){
  const entries = Object.entries(args || {});
  if(!entries.length) return '';
  const scalars = entries.filter(([,v]) => !String(v).startsWith('['));
  const src = scalars.length ? scalars : entries.slice(0,1);
  return src.map(([k,v]) => `${k}=${String(v)}`).join(', ');
}

/* ── Medium-LOD args: values only, no key= prefix (e.g. "Tree(5)") ── */
function _mediumArgs(args){
  const entries = Object.entries(args || {});
  if(!entries.length) return '';
  const scalars = entries.filter(([,v]) => !String(v).startsWith('['));
  const src = scalars.length ? scalars : entries.slice(0,1);
  return src.slice(0,2).map(([,v]) => String(v).slice(0,10)).join(' ');
}

/* ── Tiny-LOD essential value: strips wrappers like Tree(5)→5 ── */
function _essentialValue(args){
  const entries = Object.entries(args || {});
  if(!entries.length) return '';
  let v = String(entries[0][1]);
  // Strip constructor wrappers: Tree(5) → 5, ListNode(3) → 3, Optional[X](7) → 7
  const m = v.match(/^[A-Za-z_][\w]*(?:\[[^\]]*\])?\(([^)]+)\)$/);
  if(m) v = m[1];
  return v.slice(0, 6);
}

/* ── Main SVG tree renderer ── */
function rSVGTree(callTrees, currentCallId, maxCallId){
  if(!callTrees || !callTrees.length) return null;

  const withArrays = _hasArrayCtx(callTrees);

  // ── Level-of-Detail tiers ──────────────────────────────────────────────
  // Both rectangle size AND content density change with zoom:
  //   tiny    : 36×26 — only essential value, e.g. "5"
  //   compact : 76×32 — essential value + small state icon
  //   medium  : 120×40 — values without keys, e.g. "Tree(5)"
  //   full    : 158×48 — full args + return, e.g. "node=Tree(5)"  "→ None"
  //   rich    : 200×60 — bigger fonts, more room for ctx & return
  if(typeof window._svgTreeZoom !== 'number') window._svgTreeZoom = 1;
  const zoom = Math.max(0.25, Math.min(2.5, window._svgTreeZoom));
  let lod;
  if(zoom < 0.4)       lod = 'tiny';
  else if(zoom < 0.7)  lod = 'compact';
  else if(zoom < 1.15) lod = 'medium';
  else if(zoom < 1.8)  lod = 'full';
  else                 lod = 'rich';

  const LOD = {
    tiny:    { NW:36,  NH:26, fz:9,    rfz:7.5, hg:6,  vg:32, rx:5, showRet:false, showIcon:false, centerText:true  },
    compact: { NW:76,  NH:32, fz:9.5,  rfz:8,   hg:10, vg:42, rx:6, showRet:false, showIcon:true,  centerText:true  },
    medium:  { NW:120, NH:40, fz:10,   rfz:8.5, hg:14, vg:56, rx:7, showRet:true,  showIcon:true,  centerText:false },
    full:    { NW:158, NH:48, fz:10.5, rfz:9,   hg:20, vg:72, rx:8, showRet:true,  showIcon:true,  centerText:false },
    rich:    { NW:210, NH:62, fz:12,   rfz:10,  hg:28, vg:92, rx:10,showRet:true,  showIcon:true,  centerText:false },
  };
  const L = LOD[lod];

  // With closure-list context (ctx arrays shown as cells), node needs more room
  _T.NW = withArrays ? Math.max(L.NW + 50, 180) : L.NW;
  _T.NH = withArrays ? Math.max(L.NH + 26, 56)  : L.NH;
  _T.HG = L.hg;
  _T.VG = withArrays ? Math.round(L.vg * 1.15) : L.vg;
  _T.RX = L.rx;

  // Build the arg-text function matching current LOD
  const _argFn = (args) => {
    if(lod === 'tiny' || lod === 'compact') return _essentialValue(args);
    if(lod === 'medium') return _mediumArgs(args);
    return _compactArgs(args);
  };

  // Annotate each node with its content-driven width, then layout
  const retMaxLen = lod === 'rich' ? 18 : 14;
  const hPad = 30; // left accent + left pad + right pad + icon
  _annotateNodeWidths(callTrees, _argFn, retMaxLen, L.fz, L.rfz, hPad);

  let startX = _T.PAD;
  callTrees.forEach(r => {
    _calcW(r);
    _assignPos(r, startX + r._w/2, _T.PAD);
    startX += r._w;
  });

  const { w, h }         = _dims(callTrees);
  const { nodes, edges } = _collect(callTrees);

  const activePath = _pathTo(callTrees, currentCallId) || [];
  const activeIds  = new Set(activePath.map(n => n.id));

  // Stash active node's center for auto-scroll (read by render-core after innerHTML set)
  let _ax = null, _ay = null;
  nodes.forEach(n => { if(n.id === currentCallId){ _ax = n._cx; _ay = n._cy + _T.NH/2; } });

  // Stable ID prefix so defs don't clash if somehow re-rendered
  const uid = 'svgt';

  // ── Theme-aware palette ──────────────────────────────────────────────────
  const isLight = document.documentElement.dataset.theme === 'light';
  const P = isLight ? {
    eA:'#00897b', eF:'#16a34a', eP:'#dc2626', eM:'#b45309', eDef:'rgba(70,40,180,0.55)',
    gL:'rgba(0,0,0,0.06)', gT:'rgba(60,60,120,0.3)',
    fA:['#00897b','0.55'], fPS:['#5c35c2','0.3'], fF:['#16a34a','0.6'], fP:['#dc2626','0.5'], fM:['#b45309','0.55'],
    S:{
      active: {bg:'rgba(0,160,130,0.32)', stroke:'#00897b',              sw:3,  acc:'#00897b',op:1,   f:`filter="url(#svgt-glow)"`},
      path:   {bg:'rgba(99,55,200,0.10)', stroke:'rgba(80,40,200,0.75)', sw:2,  acc:'#5c35c2',op:0.5, f:`filter="url(#svgt-pshadow)"`},
      found:  {bg:'rgba(22,163,74,0.15)', stroke:'#16a34a',              sw:2.5,acc:'#16a34a',op:0.8, f:`filter="url(#svgt-gfound)"`},
      pruned: {bg:'rgba(220,38,38,0.09)', stroke:'rgba(200,30,30,0.6)',  sw:1.5,acc:'#dc2626',op:0.65,f:`filter="url(#svgt-gpruned)"`},
      memo:   {bg:'rgba(180,110,0,0.11)', stroke:'rgba(160,90,0,0.7)',   sw:2,  acc:'#b45309',op:0.7, f:`filter="url(#svgt-gmemo)"`},
      done:   {bg:'rgba(22,163,74,0.07)', stroke:'rgba(22,163,74,0.35)', sw:1.5,acc:'#16a34a',op:0.4, f:''},
      pending:{bg:'rgba(0,0,0,0.025)',    stroke:'rgba(0,0,0,0.09)',     sw:1,  acc:'rgba(80,80,110,0.2)',op:0,  f:''},
    },
    dot:{active:'#00897b',path:'#5c35c2',found:'#16a34a',pruned:'#dc2626',memo:'#b45309',done:'#16a34a',pending:'rgba(100,100,130,0.35)'},
    dotN:(st)=>st==='pending'?'rgba(70,70,100,0.4)':'#fff',
    fn:{active:'#004d40',path:'#3d1a9b',found:'#14532d',pruned:'#991b1b',memo:'#78350f',done:'#14532d',pending:'rgba(60,60,100,0.45)'},
    arg:(st)=>st==='pending'?'rgba(60,60,100,0.35)':'rgba(10,10,30,0.90)',
    ret:(st)=>st==='found'?'#16a34a':st==='pruned'?'#dc2626':'#16a34a',
    bA:['#00897b','#fff'], bF:['rgba(22,163,74,0.18)','#16a34a'],
    bP:['rgba(220,38,38,0.14)','#dc2626'], bM:['rgba(180,110,0,0.16)','#b45309'], bD:['rgba(22,163,74,0.15)','#16a34a'],
    cHi:(st)=>st==='active'?'rgba(0,137,123,0.4)':st==='path'?'rgba(80,40,200,0.25)':st==='done'?'rgba(22,163,74,0.3)':'rgba(80,40,200,0.15)',
    cDf:'rgba(0,0,0,0.04)', cDS:'rgba(0,0,0,0.08)', cDT:'rgba(30,30,60,0.7)',
  } : {
    eA:'#00c9a7', eF:'#22c55e', eP:'#ef4444', eM:'#fbbf24', eDef:'#8b5cf6',
    gL:'rgba(255,255,255,0.06)', gT:'rgba(180,170,220,0.5)',
    fA:['#00c9a7','0.45'], fPS:['#8b5cf6','0.25'], fF:['#22c55e','0.5'], fP:['#ef4444','0.4'], fM:['#fbbf24','0.45'],
    S:{
      active: {bg:'rgba(0,201,167,0.38)',  stroke:'#00c9a7',               sw:3,  acc:'#00c9a7',op:1,   f:`filter="url(#svgt-glow)"`},
      path:   {bg:'rgba(139,92,246,0.14)', stroke:'rgba(139,92,246,0.85)', sw:2,  acc:'#a78bfa',op:0.45,f:`filter="url(#svgt-pshadow)"`},
      found:  {bg:'rgba(34,197,94,0.18)',  stroke:'#22c55e',               sw:2.5,acc:'#22c55e',op:0.8, f:`filter="url(#svgt-gfound)"`},
      pruned: {bg:'rgba(239,68,68,0.12)',  stroke:'rgba(239,68,68,0.65)',  sw:1.5,acc:'#ef4444',op:0.65,f:`filter="url(#svgt-gpruned)"`},
      memo:   {bg:'rgba(251,191,36,0.15)', stroke:'rgba(251,191,36,0.75)', sw:2,  acc:'#fbbf24',op:0.7, f:`filter="url(#svgt-gmemo)"`},
      done:   {bg:'rgba(74,222,128,0.08)', stroke:'rgba(74,222,128,0.38)', sw:1.5,acc:'#4ade80',op:0.4, f:''},
      pending:{bg:'rgba(255,255,255,0.03)',stroke:'rgba(255,255,255,0.10)',sw:1,  acc:'rgba(140,140,175,0.22)',op:0,  f:''},
    },
    dot:{active:'#00c9a7',path:'#a78bfa',found:'#22c55e',pruned:'#ef4444',memo:'#fbbf24',done:'#4ade80',pending:'rgba(140,140,175,0.3)'},
    dotN:(st)=>st==='pending'?'rgba(180,180,200,0.35)':'#fff',
    fn:{active:'#00ffd5',path:'#d8b4fe',found:'#bbf7d0',pruned:'#fecaca',memo:'#fef08a',done:'#bbf7d0',pending:'rgba(160,160,195,0.45)'},
    arg:(st)=>st==='pending'?'rgba(140,140,170,0.4)':'rgba(240,240,255,0.96)',
    ret:(st)=>st==='found'?'#22c55e':st==='pruned'?'#fca5a5':'#4ade80',
    bA:['#00c9a7','#0a0a0a'], bF:['rgba(34,197,94,0.22)','#22c55e'],
    bP:['rgba(239,68,68,0.18)','#ef4444'], bM:['rgba(251,191,36,0.20)','#fbbf24'], bD:['rgba(74,222,128,0.18)','#4ade80'],
    cHi:(st)=>st==='active'?'rgba(139,92,246,0.55)':st==='path'?'rgba(139,92,246,0.35)':st==='done'?'rgba(0,201,167,0.35)':'rgba(139,92,246,0.18)',
    cDf:'rgba(255,255,255,0.055)', cDS:'rgba(255,255,255,0.09)', cDT:'rgba(210,210,245,0.65)',
  };

  const NH = _T.NH, RX = _T.RX;

  /* ── SVG defs: markers + filters ── */
  const defs = `<defs>
    <marker id="${uid}-aa" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 Z" fill="${P.eA}"/>
    </marker>
    <marker id="${uid}-am" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 Z" fill="${P.eDef}"/>
    </marker>
    <marker id="${uid}-af" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 Z" fill="${P.eF}"/>
    </marker>
    <marker id="${uid}-ap" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 Z" fill="${P.eP}"/>
    </marker>
    <marker id="${uid}-amemo" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 Z" fill="${P.eM}"/>
    </marker>
    <filter id="${uid}-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="11" flood-color="${P.fA[0]}" flood-opacity="${P.fA[1]}"/>
    </filter>
    <filter id="${uid}-pshadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${P.fPS[0]}" flood-opacity="${P.fPS[1]}"/>
    </filter>
    <filter id="${uid}-gfound" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="${P.fF[0]}" flood-opacity="${P.fF[1]}"/>
    </filter>
    <filter id="${uid}-gpruned" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${P.fP[0]}" flood-opacity="${P.fP[1]}"/>
    </filter>
    <filter id="${uid}-gmemo" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${P.fM[0]}" flood-opacity="${P.fM[1]}"/>
    </filter>
  </defs>`;

  /* ── Depth guide rails ── */
  const depthY = new Map();
  nodes.forEach(n => { if(!depthY.has(n.depth)) depthY.set(n.depth, n._cy); });

  const guides = [...depthY.entries()].map(([d, y]) => {
    const midY = y + NH / 2;
    return `<line x1="${_T.PAD + 16}" y1="${midY}" x2="${w - _T.PAD}" y2="${midY}"
      stroke="${P.gL}" stroke-width="1" stroke-dasharray="3,12"/>
    <text x="${_T.PAD + 4}" y="${midY + 4}"
      style="font:600 8px monospace" fill="${P.gT}" text-anchor="middle">${d}</text>`;
  }).join('');

  /* ── Bezier edges — coloured by child outcome + label ── */
  const edgeSVG = edges.map(([p, c]) => {
    const x1 = p._cx, y1 = p._cy + NH;
    const x2 = c._cx, y2 = c._cy;
    const midY = (y1 + y2) / 2;
    const onActive = activeIds.has(p.id) && activeIds.has(c.id);
    const childSt  = _nodeState(c, currentCallId, activeIds, maxCallId);

    let stroke, sw, opacity, mid;
    if(childSt==='pending')    { stroke=P.eDef; sw=1;   opacity=0;    mid=`${uid}-am`; }
    else if(onActive)          { stroke=P.eA;   sw=2;   opacity=0.85; mid=`${uid}-aa`; }
    else if(childSt==='found') { stroke=P.eF;   sw=1.5; opacity=0.45; mid=`${uid}-af`; }
    else if(childSt==='pruned'){ stroke=P.eP;   sw=1.5; opacity=0.35; mid=`${uid}-ap`; }
    else if(childSt==='memo')  { stroke=P.eM;   sw=1.5; opacity=0.45; mid=`${uid}-amemo`; }
    else                       { stroke=P.eDef; sw=1.5; opacity=0.22; mid=`${uid}-am`; }

    // Pending edges (and their labels) are completely hidden — no orphaned
    // text floating in empty space where a future child will eventually appear.
    if(childSt === 'pending'){
      return `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}"
        stroke="${stroke}" stroke-width="${sw}" fill="none" opacity="0"
        visibility="hidden"/>`;
    }

    const lx = Math.round((x1 + x2) / 2);
    const ly = Math.round(midY);
    const label = _edgeLabel(p, c);
    const labelBg   = isLight ? 'rgba(250,250,255,0.92)' : 'rgba(18,18,30,0.88)';
    const labelFill = onActive ? stroke : (isLight ? 'rgba(40,40,80,0.75)' : 'rgba(180,180,220,0.75)');

    const labelSVG = label ? `
      <rect x="${lx - 26}" y="${ly - 7}" width="52" height="13" rx="4" fill="${labelBg}"/>
      <text x="${lx}" y="${ly + 3}" text-anchor="middle"
        style="font:700 7px/1 monospace" fill="${labelFill}">${_esc(label)}</text>` : '';

    return `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}"
         stroke="${stroke}" stroke-width="${sw}" fill="none" opacity="${opacity}"
         stroke-linecap="round" marker-end="url(#${mid})"/>` + labelSVG;
  }).join('');

  /* ── Node cards ── */
  const nodeSVG = nodes.map(n => {
    const NW = n._nw || _T.NW;  // per-node content-driven width
    const x = n._cx - NW / 2;
    const y = n._cy;

    const isActive = n.id === currentCallId;
    const state    = _nodeState(n, currentCallId, activeIds, maxCallId);
    const isDone   = n.returned;
    const S        = P.S[state];

    // ── Array-slice cells (only when closure list detected) ──────────────
    const ctxList  = Object.entries(n.ctx || {}).find(([,v]) => Array.isArray(v));
    const idxEntry = ctxList
      ? Object.entries(n.args || {}).find(([,v]) => { const i=parseInt(v); return !isNaN(i) && i>=0 && i<=ctxList[1].length; })
      : null;
    const showCells  = !!(ctxList && withArrays);
    const sliceStart = idxEntry ? Math.max(0, parseInt(idxEntry[1])) : 0;
    const MAX_CELLS  = 7;
    const slice      = showCells ? ctxList[1].slice(sliceStart, sliceStart + MAX_CELLS) : [];
    const hasMore    = showCells && (ctxList[1].length - sliceStart > MAX_CELLS);
    const CW=24, CH=20, CY=28, CX0=10, CG=2;

    const cellsSVG = slice.map((v, i) => {
      const cx     = CX0 + i*(CW+CG);
      const isElem = i === 0 && slice.length > 1;
      const cellBg     = isElem ? P.cHi(state) : P.cDf;
      const cellStroke = isElem ? S.acc : P.cDS;
      const textCol    = isElem ? '#fff' : P.cDT;
      return `<rect x="${cx}" y="${CY}" width="${CW}" height="${CH}" rx="3"
        fill="${cellBg}" stroke="${cellStroke}" stroke-width="1"/>
      <text x="${cx+CW/2}" y="${CY+CH/2+4}" text-anchor="middle"
        style="font:700 7.5px/1 monospace" fill="${textCol}">${_esc(String(v))}</text>`;
    }).join('') + (hasMore
      ? `<text x="${CX0+slice.length*(CW+CG)+3}" y="${CY+CH/2+4}"
          style="font:400 8px/1 monospace" fill="${P.gT}">…</text>` : '');

    // ── LOD-aware text content ───────────────────────────────────────────
    // tiny/compact → only essential value (e.g. "5")
    // medium      → values without key prefix (e.g. "Tree(5)")
    // full/rich   → full key=value pairs (e.g. "node=Tree(5)")
    let argText;
    if(lod === 'tiny' || lod === 'compact') argText = _essentialValue(n.args);
    else if(lod === 'medium')               argText = _mediumArgs(n.args);
    else                                    argText = _compactArgs(n.args);

    const retStr = (L.showRet && isDone && !activeIds.has(n.id) && n.return_val != null)
      ? `→ ${_esc(String(n.return_val).slice(0, lod === 'rich' ? 18 : 14))}` : '';
    const hasRet = !!retStr;

    const argFill = P.arg(state);
    const retFill = P.ret(state);

    // Tiny state indicator (skip in tiny mode — no room)
    const stateIcon = {
      active:'●', path:'●', found:'✓', pruned:'✗', memo:'⚡', done:'·', pending:'·'
    }[state];
    const iconFill = {
      active:P.eA, path:isLight?'#5c35c2':'#a78bfa', found:P.eF, pruned:P.eP,
      memo:P.eM, done:isLight?'rgba(22,163,74,0.6)':'rgba(74,222,128,0.5)',
      pending:isLight?'rgba(80,80,110,0.25)':'rgba(140,140,175,0.3)'
    }[state];

    // Position the text — centered for tiny/compact, left-aligned otherwise
    const tx = L.centerText ? NW/2 : 11;
    const anchor = L.centerText ? 'text-anchor="middle"' : '';
    const textY = showCells ? 20 : (hasRet ? NH/2 - 4 : NH/2 + L.fz/3);
    const retY  = showCells ? NH - 8 : NH/2 + L.fz + 2;
    const iconX = L.centerText ? NW - 8 : NW - 7;

    const hideAttr = state === 'pending' ? ' visibility="hidden"' : '';
    return `<g transform="translate(${x},${y})" opacity="${S.op}"${hideAttr} ${S.f}>
  <rect width="${NW}" height="${NH}" rx="${RX}" fill="${S.bg}" stroke="${S.stroke}" stroke-width="${S.sw}"/>
  <rect width="${lod==='tiny'?2:3}" height="${NH}" rx="${RX}" fill="${S.acc}" opacity="0.9"/>
  ${showCells ? cellsSVG : ''}
  <text x="${tx}" y="${textY}" ${anchor} style="font:700 ${L.fz}px/1 monospace" fill="${argFill}">${_esc(argText)}</text>
  ${hasRet ? `<text x="${tx}" y="${retY}" ${anchor} fill="${retFill}" style="font:700 ${L.rfz}px/1 monospace">${retStr}</text>` : ''}
  ${L.showIcon ? `<text x="${iconX}" y="${Math.max(10, L.fz+1)}" text-anchor="middle" style="font:700 ${Math.min(L.fz, 9)}px/1 monospace" fill="${iconFill}">${stateIcon}</text>` : ''}
</g>`;
  }).join('');

  // ── Pinch-zoom: trackpad pinch fires wheel + ctrlKey ────────────────────
  // Layout-only zoom: node W/H and font size stay constant; only gaps scale.
  // Scroll continuity is handled by render-core's proportional preservation,
  // so we just update the zoom value and trigger a re-render.
  if(!window._svgtPinchAttached){
    window._svgtPinchAttached = true;
    let zoomRAF = 0;
    document.addEventListener('wheel', function(e){
      if(!e.ctrlKey) return;
      const host = e.target.closest && e.target.closest('.svgt-scroll');
      if(!host) return;
      e.preventDefault();
      const z0 = window._svgTreeZoom || 1;
      const dz = -e.deltaY * 0.008;
      const z1 = Math.max(0.25, Math.min(2.5, z0 + dz));
      if(Math.abs(z1 - z0) < 0.001) return;
      window._svgTreeZoom = z1;
      if(zoomRAF) cancelAnimationFrame(zoomRAF);
      zoomRAF = requestAnimationFrame(() => {
        zoomRAF = 0;
        if(typeof render === 'function') render();
      });
    }, { passive: false });
  }

  return `<div class="vb svgt-panel">
    <h3 style="display:flex;align-items:center;gap:6px">
      Recursion Tree&nbsp;&nbsp;<span class="sub">active path highlighted</span>
      <span style="margin-left:auto;font:600 9px/1 monospace;color:var(--muted);
        background:var(--ink);border:1px solid var(--gray);border-radius:4px;
        padding:3px 7px;letter-spacing:.04em">pinch · ${(zoom*100).toFixed(0)}% · ${lod}</span>
    </h3>
    <div class="svgt-scroll">
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"
           xmlns="http://www.w3.org/2000/svg" style="display:block">
        ${defs}
        ${guides}
        ${edgeSVG}
        ${nodeSVG}
      </svg>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════
   Combined entry point
   ══════════════════════════════════════════════════════════════════════ */
function rRecursionPanels(callTrees, currentCallId, callDepth, maxCallId){
  if(!callTrees || !callTrees.length) return null;
  if(callDepth < 1)                   return null;
  if(!_isRecursive(callTrees))        return null;

  const stackHtml = rCallStack(callTrees, currentCallId, callDepth);
  const treeHtml  = rSVGTree(callTrees, currentCallId, maxCallId);

  if(!stackHtml && !treeHtml) return null;
  return (stackHtml || '') + (treeHtml || '');
}
