/* ══════════════════════════════════════════════════════════════════════
   renderers.js ─ All data-structure visualizer functions.
   Exports (globals): rLL, rTree, rGrid, rHeap, rBars, rQueue,
     rTupleList, rIndexedPills, rBinaryList, rBoolList, rStringList,
     detectHeapVars, heapXY, HEAP_NAME, _heapVars,
     PTR_NAMES, detectRange, classifyArr
   Depends on: utils.js (esc, fv)
   ══════════════════════════════════════════════════════════════════════ */

/* ── Heap detection ─────────────────────────────────────────────────── */

/** Regex matching well-known heap variable name prefixes. */
const HEAP_NAME = /^(heap|min_heap|max_heap|minheap|maxheap|pq|priority|priority_queue|min_pq|max_pq)/i;

/**
 * Scan user code for heapq API calls and return the set of variable names
 * used as heaps (handles `self.attr` style too).
 */
function detectHeapVars(code){
  const s = new Set();
  const re = /heapq\.heap(?:push|replace|pushpop|ify|pop)\s*\(\s*(?:\w+\.)?([a-zA-Z_]\w*)/g;
  let m;
  while((m=re.exec(code)) !== null) s.add(m[1]);
  const re2 = /heapq\.n(?:largest|smallest)\s*\(\s*\w+\s*,\s*(?:\w+\.)?([a-zA-Z_]\w*)/g;
  while((m=re2.exec(code)) !== null) s.add(m[1]);
  return s;
}

/** Heap variable names detected from the current code (updated on each Run). */
let _heapVars = new Set();

/** Compute the SVG x,y position for heap node at array index i. */
function heapXY(i, W, P){
  const d = Math.floor(Math.log2(i+1));
  const pos = i - (Math.pow(2,d)-1);
  const rowSize = Math.pow(2,d);
  const x = P + (pos+0.5)*(W-P*2)/rowSize;
  const y = P + d*60 + 20;
  return [x, y];
}

/* ── Linked List ────────────────────────────────────────────────────── */
function rLL(name, ll, ptrs){
  const { nodes, cycle_to } = ll;
  if(!nodes.length)
    return `<div class="vb"><h3>Linked List&nbsp;&nbsp;${esc(name)}</h3><div class="ll-nil">None</div></div>`;
  const byId = {};
  for(const [n,nid] of Object.entries(ptrs||{})) (byId[nid]||=[]).push(n);
  const parts = nodes.map((node,i)=>{
    const pn = byId[node.id] || [];
    const ph = pn.length ? `<div class="ll-ptrs">${pn.map(n=>`<span class="ptr">${esc(n)}</span>`).join('')}</div>` : '';
    const ar = i < nodes.length-1 ? `<span class="ll-arr">→</span>` : '';
    return `<div class="ll-nw">${ph}<div class="ll-n ${pn.length?'hi':''}">${esc(fv(node.val))}</div></div>${ar}`;
  }).join('');
  const tail = cycle_to != null
    ? `<span class="ll-arr">↺</span><div class="ll-cyc">→ idx ${cycle_to}</div>`
    : `<span class="ll-arr">→</span><div class="ll-nil">None</div>`;
  return `<div class="vb"><h3>Linked List&nbsp;&nbsp;${esc(name)} <span class="sub">[${nodes.length} nodes${cycle_to!=null?', cyclic':''}]</span></h3><div class="ll-row">${parts}${tail}</div></div>`;
}

/* ── Binary Tree ────────────────────────────────────────────────────── */
function rTree(name, root, ptrs){
  let cx = { x:0 };
  function lay(node,d){ if(!node) return null; const l=lay(node.left,d+1),x=cx.x++,r=lay(node.right,d+1); return{node,x,d,l,r}; }
  const ps = [];
  function col(n){ if(!n) return; ps.push(n); col(n.l); col(n.r); }
  col(lay(root,0));
  if(!ps.length) return '';
  const byId = {};
  for(const [n,nid] of Object.entries(ptrs||{})) (byId[nid]||=[]).push(n);
  const XS=50, YS=56, R=17, P=24;
  const maxD = Math.max(...ps.map(p=>p.d)), maxX = Math.max(...ps.map(p=>p.x));
  const W=(maxX+1)*XS+P*2, H=(maxD+1)*YS+P*2;
  const edges = ps.flatMap(p=>{
    const px=P+p.x*XS+XS/2, py=P+p.d*YS+R;
    return [p.l,p.r].filter(Boolean).map(c=>`<line class="te" x1="${px}" y1="${py}" x2="${P+c.x*XS+XS/2}" y2="${P+c.d*YS+R}"/>`);
  }).join('');
  const circles = ps.map(p=>{
    const px=P+p.x*XS+XS/2, py=P+p.d*YS+R;
    const pn = byId[p.node.id] || [];
    const pt = pn.length ? `<text class="tp" x="${px}" y="${py-R-6}">${esc(pn.join(','))}</text>` : '';
    return `<g class="tn ${pn.length?'hi':''}">${pt}<circle cx="${px}" cy="${py}" r="${R}"/><text x="${px}" y="${py}">${esc(fv(p.node.val))}</text></g>`;
  }).join('');
  return `<div class="vb"><h3>Tree&nbsp;&nbsp;${esc(name)} <span class="sub">[${ps.length} nodes]</span></h3><div class="tree-wrap"><svg class="tree" width="${W}" height="${H}">${edges}${circles}</svg></div></div>`;
}

/* ── Grid ───────────────────────────────────────────────────────────── */
function rGrid(name, grid, prevGrid){
  const rows = grid.map((row,ri)=>{
    const cells = row.map((v,ci)=>{
      const pv = prevGrid?.[ri]?.[ci];
      const changed = pv !== undefined && pv !== v;
      let cls = 'gc ';
      if(v===0||v==='0') cls+='zero';
      else if(v===1||v==='1') cls+='one';
      else if(typeof v==='number'&&v<0) cls+='neg';
      else cls+='other';
      if(changed) cls+=' changed';
      return `<div class="${cls}">${esc(fv(v))}</div>`;
    }).join('');
    return `<div class="grid-row">${cells}</div>`;
  }).join('');
  return `<div class="vb"><h3>Grid&nbsp;&nbsp;${esc(name)} <span class="sub">[${grid.length}×${grid[0]?.length||0}]</span></h3><div class="grid-wrap">${rows}</div></div>`;
}

/* ── Heap (array-backed binary tree) ────────────────────────────────── */
function rHeap(name, arr, pArr){
  if(!arr.length)
    return `<div class="vb"><h3>Heap&nbsp;&nbsp;${esc(name)} <span class="sub">[0 nodes · empty]</span></h3><div class="empty">(empty)</div></div>`;

  const isTuple = arr.length>0 && Array.isArray(arr[0]);
  const prio = v => Array.isArray(v) ? v[0] : v;
  // Detect max-heap only for tuple heaps (first element negative) — never flip raw numbers
  const isTupleMaxHeap = isTuple && arr.length>0 && typeof prio(arr[0])==='number' && prio(arr[0])<0;
  const isMaxHeap = isTupleMaxHeap;
  const topLabel = isMaxHeap ? 'max' : 'min';

  // Display label: always show raw stored values
  const nodeLabel = v => {
    if(Array.isArray(v)) return `(${v.map(fv).join(',')})`;
    return fv(v);
  };

  const n = arr.length;
  const maxD = Math.floor(Math.log2(n));
  const cols = Math.pow(2, maxD);
  const nodeW = isTuple ? Math.max(60, Math.max(...arr.map(v=>nodeLabel(v).length))*7+16) : 52;
  const W = Math.max(320, cols*nodeW+48);
  const H = (maxD+1)*66+56;
  const R = isTuple ? 22 : 19, P = 28;

  let edges = '';
  for(let i=1; i<n; i++){
    const [px,py] = heapXY(Math.floor((i-1)/2), W, P);
    const [cx,cy] = heapXY(i, W, P);
    edges += `<line class="te" x1="${px}" y1="${py}" x2="${cx}" y2="${cy}"/>`;
  }
  let circles = '';
  for(let i=0; i<n; i++){
    const [x,y] = heapXY(i, W, P);
    const prevVal = pArr && pArr[i];
    const changed = prevVal !== undefined && JSON.stringify(prevVal) !== JSON.stringify(arr[i]);
    const rootLbl = i===0 ? `<text class="tp" x="${x}" y="${y-R-7}">${topLabel}</text>` : '';
    const lbl = nodeLabel(arr[i]);
    let textEl;
    if(isTuple && Array.isArray(arr[i]) && arr[i].length>1){
      const p=fv(arr[i][0]), rest=arr[i].slice(1).map(fv).join(',');
      textEl = `<text x="${x}" y="${y-5}" font-size="10" font-weight="900" text-anchor="middle" dominant-baseline="auto">${esc(p)}</text>`
              +`<text x="${x}" y="${y+8}" font-size="9" text-anchor="middle" dominant-baseline="auto" opacity=".75">${esc(rest)}</text>`;
    } else {
      textEl = `<text x="${x}" y="${y}">${esc(lbl)}</text>`;
    }
    circles += `<g class="tn ${changed?'hi':''}">${rootLbl}<circle cx="${x}" cy="${y}" r="${R}"/>${textEl}</g>`;
  }
  const topRaw = isTuple && Array.isArray(arr[0]) ? nodeLabel(arr[0]) : fv(arr[0]);
  const heapKind = isMaxHeap ? 'max-heap' : 'min-heap';
  const sub = `[${n} nodes · top=${topRaw} · ${heapKind}]`;
  const hdrKind = isMaxHeap ? 'Heap (max)' : 'Heap (min)';
  return `<div class="vb"><h3>${hdrKind}&nbsp;&nbsp;${esc(name)} <span class="sub">${sub}</span></h3><div class="tree-wrap"><svg class="tree" width="${W}" height="${H}">${edges}${circles}</svg></div></div>`;
}

/* ── Smart array classification ─────────────────────────────────────── */

/** Regex matching variable names that are typically array pointers/indices. */
const PTR_NAMES = /^(left|right|lo|hi|low|high|start|end|l|r|i|j|p|q|ptr|mid|begin|slow|fast|head|tail|front|back|k|a|b|s|e|top|bot|anchor|runner|curr|nxt)$/i;

/**
 * Detect pointer variables that point into arr.
 * Returns null if no pointers found, else { ptrs, lo, hi }.
 */
function detectRange(arr, scalars){
  const ptrs = {};
  for(const [k,v] of Object.entries(scalars)){
    if(typeof v==='number' && Number.isInteger(v) && v>=0 && v<arr.length && PTR_NAMES.test(k))
      (ptrs[v]||(ptrs[v]=[])).push(k);
  }
  const idxs = Object.keys(ptrs).map(Number).sort((a,b)=>a-b);
  if(!idxs.length) return null;
  return { ptrs, lo:idxs[0], hi:idxs[idxs.length-1] };
}

/** Classify an array into a rendering style. */
function classifyArr(name, arr, scalars){
  if(!arr.length) return 'bars';
  if(arr.every(x=>typeof x==='boolean')) return 'bool';
  if(arr.some(x=>typeof x==='string')) return 'string';
  if(arr.every(x=>typeof x==='number')){
    if(arr.every(x=>x===0||x===1)) return 'binary';
    if(detectRange(arr, scalars)) return 'indexed';
    return 'bars';
  }
  return 'bars';
}

/* ── Indexed pills (two-pointer / sliding window) ───────────────────── */
function rIndexedPills(name, arr, scalars, pArr){
  if(!arr.length)
    return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)}</h3><div class="empty">(empty)</div></div>`;
  const rng = detectRange(arr, scalars);
  const lo=rng?.lo??-1, hi=rng?.hi??-1, ptrs=rng?.ptrs??{};
  const cols = arr.map((v,i)=>{
    const inWin=lo>=0&&i>=lo&&i<=hi, atPtr=!!ptrs[i], ch=pArr[i]!==v;
    const labels=(ptrs[i]||[]).map(n=>`<span class="idx-ptr">${esc(n)}</span>`).join('');
    let cls='idx-cell'+(inWin?' in-win':'')+(atPtr?' at-ptr':'')+(ch?' ch':'');
    return `<div class="idx-item"><div class="idx-ptrlabels">${labels}</div><div class="${cls}">${esc(fv(v))}</div><div class="idx-label">${i}</div></div>`;
  }).join('');
  const winNote=lo>=0&&lo!==hi?`<span class="sub">window [${lo}…${hi}]</span>`:'';
  return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)} <span class="sub">[${arr.length}]</span>&nbsp;${winNote}</h3><div class="idx-row">${cols}</div></div>`;
}

/* ── Binary (0/1) list ──────────────────────────────────────────────── */
function rBinaryList(name, arr, scalars, pArr){
  if(!arr.length)
    return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)}</h3><div class="empty">(empty)</div></div>`;
  const rng = detectRange(arr, scalars);
  const lo=rng?.lo??-1, hi=rng?.hi??-1, ptrs=rng?.ptrs??{};
  const cols = arr.map((v,i)=>{
    const inWin=lo>=0&&i>=lo&&i<=hi, atPtr=!!ptrs[i], ch=pArr[i]!==v;
    const labels=(ptrs[i]||[]).map(n=>`<span class="idx-ptr">${esc(n)}</span>`).join('');
    let cls=`bin-cell ${v===1?'bin-1':'bin-0'}${inWin?' in-win':''}${atPtr?' at-ptr':''}${ch?' ch':''}`;
    return `<div class="idx-item"><div class="idx-ptrlabels">${labels}</div><div class="${cls}">${v}</div><div class="idx-label">${i}</div></div>`;
  }).join('');
  return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)} <span class="sub">[${arr.length} · binary]</span></h3><div class="idx-row">${cols}</div></div>`;
}

/* ── Bool (True/False) list ─────────────────────────────────────────── */
function rBoolList(name, arr, pArr){
  if(!arr.length)
    return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)}</h3><div class="empty">(empty)</div></div>`;
  const cols = arr.map((v,i)=>{
    const ch = pArr[i] !== v;
    return `<div class="idx-item"><div class="idx-ptrlabels"></div><div class="bool-cell ${v?'bool-t':'bool-f'}${ch?' ch':''}">${v?'T':'F'}</div><div class="idx-label">${i}</div></div>`;
  }).join('');
  return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)} <span class="sub">[${arr.length} · bool]</span></h3><div class="idx-row">${cols}</div></div>`;
}

/* ── String list ────────────────────────────────────────────────────── */
function rStringList(name, arr, scalars, pArr){
  if(!arr.length)
    return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)}</h3><div class="empty">(empty)</div></div>`;
  const rng = detectRange(arr, scalars);
  const lo=rng?.lo??-1, hi=rng?.hi??-1, ptrs=rng?.ptrs??{};
  const cols = arr.map((v,i)=>{
    const inWin=lo>=0&&i>=lo&&i<=hi, atPtr=!!ptrs[i], ch=pArr[i]!==v;
    const labels=(ptrs[i]||[]).map(n=>`<span class="idx-ptr">${esc(n)}</span>`).join('');
    let cls=`str-cell${inWin?' in-win':''}${atPtr?' at-ptr':''}${ch?' ch':''}`;
    return `<div class="idx-item"><div class="idx-ptrlabels">${labels}</div><div class="${cls}">${esc(fv(v))}</div><div class="idx-label">${i}</div></div>`;
  }).join('');
  return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)} <span class="sub">[${arr.length}]</span></h3><div class="idx-row">${cols}</div></div>`;
}

/* ── Bar chart (sorting / pure-comparison arrays) ───────────────────── */
function rBars(name, arr, scalars, pArr){
  if(!arr.length)
    return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)}</h3><div class="empty">(empty)</div></div>`;
  const ptrs = {};
  for(const [k,v] of Object.entries(scalars))
    if(typeof v==='number' && Number.isInteger(v) && v>=0 && v<arr.length)
      (ptrs[v]||=[]).push(k);
  const num = arr.filter(x=>typeof x==='number');
  let lo=0, hi=1;
  if(num.length){ lo=Math.min(...num,0); hi=Math.max(...num,1); if(hi===lo) hi=lo+1; }
  const cols = arr.map((v,i)=>{
    const h = typeof v==='number' ? Math.max(4, Math.round(((v-lo)/(hi-lo))*124)) : 32;
    const ph = (ptrs[i]||[]).map(n=>`<span class="ptr arr">${esc(n)}</span>`).join('');
    return `<div class="bc"><div class="bp">${ph}</div><div class="bar ${pArr[i]!==v?'ch':''}" style="height:${h}px;"></div><div class="bv">${esc(fv(v))}</div><div class="bi">${i}</div></div>`;
  }).join('');
  return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)} <span class="sub">[${arr.length}]</span></h3><div class="list-row">${cols}</div></div>`;
}

/* ── Deque / Queue renderer ─────────────────────────────────────────── */
function rQueue(name, arr, pArr){
  const head = `<div class="vb"><h3>Queue&nbsp;&nbsp;${esc(name)} <span class="sub">[${arr.length} items]</span></h3>`;
  if(!arr.length)
    return head + `<div class="queue-wrap"><div class="queue-empty">(empty)</div></div></div>`;
  const prevLen = pArr.length;
  const cells = arr.map((v,i)=>{
    const isFront=i===0, isNew=i>=prevLen, changed=!isNew&&pArr[i]!==v;
    let cls = 'queue-cell';
    if(isFront) cls += ' q-front';
    else if(isNew) cls += ' q-new';
    else if(changed) cls += ' q-ch';
    return `<div class="${cls}"><span>${esc(fv(v))}</span><span class="queue-idx">${i}</span></div>`;
  }).join('');
  const frontSide = `<div class="queue-side"><span class="queue-side-label">dequeue</span><span class="queue-side-arrow">←</span><span class="queue-side-label">front</span></div>`;
  const backSide  = `<div class="queue-side"><span class="queue-side-label">back</span><span class="queue-side-arrow">←</span><span class="queue-side-label">enqueue</span></div>`;
  return head + `<div class="queue-wrap">${frontSide}<div class="queue-cells">${cells}</div>${backSide}</div></div>`;
}

/* ── List-of-tuples (compact table) ─────────────────────────────────── */
function rTupleList(name, arr, pArr){
  if(!arr.length)
    return `<div class="vb"><h3>List&nbsp;&nbsp;${esc(name)}</h3><div class="empty">(empty)</div></div>`;
  const cols = arr[0].length;
  const rows = arr.map((tup,i)=>{
    const prev = pArr[i];
    const changed = !prev || JSON.stringify(prev) !== JSON.stringify(tup);
    const cells = tup.map(v=>`<td style="border:1.5px solid var(--ink);padding:3px 8px;font-family:var(--mono);font-size:11px;">${esc(fv(v))}</td>`).join('');
    return `<tr style="${changed?'background:rgba(0,201,167,.14);':''}">${cells}</tr>`;
  }).join('');
  return `<div class="vb"><h3>List of Tuples&nbsp;&nbsp;${esc(name)} <span class="sub">[${arr.length} items · ${cols}-tuple]</span></h3><div style="overflow-x:auto"><table style="border-collapse:collapse;font-family:var(--mono);font-size:11px;">${rows}</table></div></div>`;
}

/* ── Deep nested structures (JSON tree) ──────────────────────────────── */
function rNestedTree(name, val, depth=0, maxDepth=8){
  if(depth > maxDepth) return `<span style="color:var(--gray);">...</span>`;
  const type = Array.isArray(val) ? 'array' : typeof val === 'object' ? 'object' : typeof val;

  if(val === null) return `<span style="color:var(--gray);">null</span>`;
  if(typeof val !== 'object') return `<span style="color:var(--accent);">${esc(String(val).substring(0, 40))}</span>`;

  if(Array.isArray(val)){
    if(val.length === 0) return `<span style="color:var(--gray);">[ ]</span>`;
    if(val.length > 20){
      const shown = val.slice(0, 20).map((v,i) => `<div style="margin-left:12px;padding:2px 0;">${i}: ${rNestedTree('', v, depth+1, maxDepth)}</div>`).join('');
      return `<details><summary style="color:var(--accent);cursor:pointer;user-select:none;">[${val.length} items]</summary><div style="margin-left:8px;">${shown}<div style="margin-left:12px;color:var(--gray);">... +${val.length-20} more</div></div></details>`;
    }
    const items = val.map((v,i) => `<div style="margin-left:12px;padding:2px 0;">${i}: ${rNestedTree('', v, depth+1, maxDepth)}</div>`).join('');
    return `<details open><summary style="color:var(--accent);cursor:pointer;user-select:none;">[${val.length}]</summary><div style="margin-left:8px;">${items}</div></details>`;
  }

  const keys = Object.keys(val).slice(0, 50);
  if(keys.length === 0) return `<span style="color:var(--gray);">{{ }}</span>`;
  if(Object.keys(val).length > keys.length){
    const items = keys.map(k => `<div style="margin-left:12px;padding:2px 0;"><span style="color:var(--green);">${esc(k)}</span>: ${rNestedTree('', val[k], depth+1, maxDepth)}</div>`).join('');
    return `<details><summary style="color:var(--accent);cursor:pointer;user-select:none;">{{ ${keys.length}+ keys }}</summary><div style="margin-left:8px;">${items}<div style="margin-left:12px;color:var(--gray);">... +${Object.keys(val).length - keys.length} more keys</div></div></details>`;
  }
  const items = keys.map(k => `<div style="margin-left:12px;padding:2px 0;"><span style="color:var(--green);">${esc(k)}</span>: ${rNestedTree('', val[k], depth+1, maxDepth)}</div>`).join('');
  return `<details open><summary style="color:var(--accent);cursor:pointer;user-select:none;">{{ ${keys.length} keys }}</summary><div style="margin-left:8px;">${items}</div></details>`;
}

function _isDictOfLists(val){
  if(Array.isArray(val) || typeof val !== 'object' || val === null) return false;
  const keys = Object.keys(val);
  if(keys.length === 0) return false;
  return keys.every(k => Array.isArray(val[k]) && val[k].every(v => v === null || typeof v !== 'object'));
}

function _rDictOfLists(name, val, pVal){
  const pObj = (pVal && typeof pVal === 'object' && !Array.isArray(pVal)) ? pVal : {};
  const rows = Object.entries(val).map(([k, arr]) => {
    const pArr = pObj[k] || [];
    const pills = arr.map((v, i) => {
      const isNew = i >= pArr.length || pArr[i] !== v;
      return `<span class="nl-pill${isNew ? ' nl-new' : ''}">${esc(fv(v))}</span>`;
    }).join('');
    const keyChanged = !pObj[k] || JSON.stringify(pObj[k]) !== JSON.stringify(arr);
    return `<div class="nl-row${keyChanged ? ' nl-ch' : ''}"><span class="nl-key">${esc(k)}</span><span class="nl-arrow">→</span><div class="nl-vals">${pills || '<span class="nl-empty">[ ]</span>'}</div></div>`;
  }).join('');
  return `<div class="vb"><h3>Adjacency&nbsp;&nbsp;${esc(name)}</h3><div class="nl-grid">${rows}</div></div>`;
}

function rNested(name, val, pVal){
  if(_isDictOfLists(val)) return _rDictOfLists(name, val, pVal);
  const changed = !pVal || JSON.stringify(pVal) !== JSON.stringify(val);
  const bg = changed ? 'background:rgba(0,201,167,.08);' : '';
  const tree = rNestedTree(name, val, 0, 8);
  return `<div class="vb" style="${bg}"><h3>Nested Data&nbsp;&nbsp;${esc(name)}</h3><div style="font-family:var(--mono);font-size:12px;padding:10px;overflow-x:auto;max-height:400px;overflow-y:auto;">${tree}</div></div>`;
}
