/* ══════════════════════════════════════════════════════════════════════
   complexity.js — Post-run time & space complexity analysis.
   Uses actual trace data (snaps) + code structure to produce
   complexity annotations overlaid directly on the code editor.
   ══════════════════════════════════════════════════════════════════════ */

(function(){

  let _cxWidgets = [];
  let _cxMarks = [];
  let _cxActive = false;
  let _cxData = null;     // empirical result: { points, fit, n0, kind, ... }
  let _cxSnaps = null;    // snaps reference for the live op counter
  let _cxToken = 0;       // guards against stale async measurements
  let _cxTotalEl = null;  // TOTAL COMPLEXITY footer (rebuilt after fit)

  /* ══════════════════════════════════════════════════════════════════
     EMPIRICAL ENGINE — measure operation growth across input sizes,
     then fit the curve. The single-run heuristic stays the instant
     preview; this is the proof.
     ══════════════════════════════════════════════════════════════════ */

  // Parse a Python-ish literal string ("[1,2,3]", "'abc'", "5") into a JS value.
  function _pyValToJS(str){
    if(str == null) return null;
    let s = String(str).trim().replace(/,\s*$/, '');
    try {
      const j = s.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true')
                 .replace(/\bFalse\b/g, 'false').replace(/'/g, '"');
      return JSON.parse(j);
    } catch(e){
      const num = Number(s);
      if(!isNaN(num)) return num;
      return s.replace(/^['"]|['"]$/g, '');
    }
  }

  // Find the primary (largest) collection among parsed vars + its shape.
  function _primaryCollection(vars){
    let best = null;
    for(const [name, raw] of Object.entries(vars)){
      const v = _pyValToJS(raw);
      let kind = null, size = 0;
      if(typeof v === 'string'){ kind = 'string'; size = v.length; }
      else if(Array.isArray(v)){
        size = v.length;
        if(v.length && Array.isArray(v[0])){
          const all2 = v.every(r => Array.isArray(r) && r.length === 2 && r.every(x => typeof x === 'number'));
          kind = all2 ? 'edges' : 'grid';
        } else {
          kind = 'array';
        }
      }
      if(kind && size > (best ? best.size : 0)) best = { name, kind, value: v, size };
    }
    return best;
  }

  // Regenerate the input text with the primary collection scaled to size n.
  // Returns new input text, or null if the input can't be safely scaled.
  function _scaleInput(rawInput, n){
    if(typeof parseLCI !== 'function') return null;
    let parsed;
    try { parsed = parseLCI(rawInput); } catch(e){ return null; }
    const vars = parsed.vars || {};
    // Linked-list / tree / Design inputs aren't safely scalable here.
    const txt = rawInput.toLowerCase();
    if(/listnode|treenode|^\s*\[\s*"/.test(txt)) return null;
    const prim = _primaryCollection(vars);
    if(!prim) return null;

    function ri(lo, hi){ return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
    let genVal;
    if(prim.kind === 'array'){
      const strElems = prim.value.length && typeof prim.value[0] === 'string';
      const arr = [];
      for(let i = 0; i < n; i++) arr.push(strElems ? `"${String.fromCharCode(97 + ri(0,25))}"` : ri(0, n));
      genVal = `[${arr.join(',')}]`;
    } else if(prim.kind === 'string'){
      let s = '';
      for(let i = 0; i < n; i++) s += String.fromCharCode(97 + ri(0,25));
      genVal = `"${s}"`;
    } else if(prim.kind === 'grid'){
      const side = Math.max(2, Math.round(Math.sqrt(n)));
      const pool = (prim.value[0] && typeof prim.value[0][0] === 'string') ? ['"1"','"0"'] : null;
      const rows = [];
      for(let r = 0; r < side; r++){
        const row = [];
        for(let c = 0; c < side; c++) row.push(pool ? pool[ri(0,1)] : ri(0,1));
        rows.push(`[${row.join(',')}]`);
      }
      genVal = `[${rows.join(',')}]`;
    } else if(prim.kind === 'edges'){
      const edges = [];
      for(let i = 1; i < n; i++) edges.push(`[${ri(0,i-1)},${i}]`);
      genVal = `[${edges.join(',')}]`;
    } else return null;

    // Rebuild input: primary scaled, scalars adjusted, others kept verbatim.
    const lines = [];
    for(const [name, raw] of Object.entries(vars)){
      if(name === prim.name){ lines.push(`${name} = ${genVal}`); continue; }
      const v = _pyValToJS(raw);
      if(typeof v === 'number' && /^(n|m|k|v|e|size|count|len|length|target|goal|sum)$/i.test(name)){
        if(/^(n|m|v|size|count|len|length)$/i.test(name)){
          // size-like scalar tracks the collection size
          lines.push(`${name} = ${prim.kind === 'grid' ? Math.max(2, Math.round(Math.sqrt(n))) : n}`);
        } else if(/^(target|goal|sum)$/i.test(name)){
          // target-like: force out-of-range so search/scan hits its WORST case
          // (no early exit) — this is what the asymptotic curve should reflect.
          lines.push(`${name} = ${n * 10 + 7}`);
        } else {
          lines.push(`${name} = ${Math.min(v, n - 1)}`);   // k stays in-range
        }
      } else {
        lines.push(`${name} = ${raw}`);
      }
    }
    return lines.join('\n');
  }

  // Measure (n, ops) across input sizes via the fast count_ops path.
  async function measureGrowth(code, rawInput){
    if(typeof window.countOps !== 'function') return { points: [], scalable: false };
    const probe = _scaleInput(rawInput, 16);
    if(probe == null) return { points: [], scalable: false };
    const sizes = [8, 16, 32, 64, 128];
    const points = [];
    for(const n of sizes){
      const inp = _scaleInput(rawInput, n);
      if(inp == null) continue;
      const r = await window.countOps(code, inp);
      if(r && !r.error && r.ops > 0) points.push({ n, ops: r.ops, depth: r.depth || 0 });
    }
    return { points, scalable: points.length >= 3 };
  }

  // Fit (n, ops) to a known curve by lowest coefficient-of-variation of ops/f(n).
  function fitCurve(points){
    if(!points || points.length < 3) return null;
    const maxN = Math.max(...points.map(p => p.n));
    const cands = [
      { name: 'O(1)',       f: n => 1 },
      { name: 'O(log n)',   f: n => Math.log2(n) },
      { name: 'O(n)',       f: n => n },
      { name: 'O(n log n)', f: n => n * Math.log2(n) },
      { name: 'O(n²)',      f: n => n * n },
    ];
    if(maxN <= 25) cands.push({ name: 'O(2ⁿ)', f: n => Math.pow(2, n) });

    let best = null;
    for(const c of cands){
      const ratios = points.map(p => p.ops / c.f(p.n));
      const mean = ratios.reduce((a,b) => a+b, 0) / ratios.length;
      if(mean <= 0 || !isFinite(mean)) continue;
      const variance = ratios.reduce((a,r) => a + (r-mean)*(r-mean), 0) / ratios.length;
      const cv = Math.sqrt(variance) / mean;
      if(!best || cv < best.cv) best = { name: c.name, f: c.f, k: mean, cv };
    }
    if(!best) return null;
    return { complexity: best.name, confidence: Math.max(0, Math.min(1, 1 - best.cv)), k: best.k, f: best.f };
  }

  // Honest "n" label by problem shape.
  function _nLabel(kind){
    if(kind === 'grid')   return 'R×C cells';
    if(kind === 'string') return 'string length';
    if(kind === 'edges')  return 'V + E';
    return 'n elements';
  }

  // Best-effort optimality hint from a small pattern table.
  function _optimalityHint(code, fitName, blocks){
    const c = code.toLowerCase();
    const nested = blocks.some(b => b.parent !== null);
    // sorting via compare-swap nested loops
    if(nested && /\b(arr|nums|a)\s*\[\s*\w+\s*\]\s*[<>]/.test(c) && /=\s*\w+\s*\[\s*\w+/.test(c))
      return { text: 'Looks like a comparison sort — optimal is O(n log n)', optimal: fitName === 'O(n log n)' };
    // linear scan with a dict/set (two-sum style)
    if(/(dict|\{\}|set\(|seen|hashmap|defaultdict|counter)/.test(c) && (fitName === 'O(n)'))
      return { text: 'Single pass with a hash map — already optimal', optimal: true };
    if(fitName === 'O(log n)')
      return { text: 'Logarithmic — already optimal for search', optimal: true };
    return null;
  }


  function analyzeComplexity(snaps, code, inputSize){
    if(!snaps || !snaps.length) return null;

    const lines = code.split('\n');
    const n = inputSize || _guessN(snaps);

    const lineHits = {};
    let maxDepth = 0;
    for(const s of snaps){
      if(s.filename !== '<user>') continue;
      lineHits[s.line] = (lineHits[s.line] || 0) + 1;
      if(s.call_depth > maxDepth) maxDepth = s.call_depth;
    }

    const maxSizes = {};
    for(const s of snaps){
      for(const [name, arr] of Object.entries(s.lists || {}))
        maxSizes[name] = Math.max(maxSizes[name] || 0, arr.length);
      for(const [name, d] of Object.entries(s.dicts || {}))
        maxSizes[name] = Math.max(maxSizes[name] || 0, Object.keys(d).length);
      for(const [name, sv] of Object.entries(s.sets || {}))
        maxSizes[name] = Math.max(maxSizes[name] || 0, sv.length);
      for(const [name, g] of Object.entries(s.grids || {}))
        if(g && g.length) maxSizes[name] = Math.max(maxSizes[name] || 0, g.length * (g[0]?.length || 1));
      for(const [name, d] of Object.entries(s.deques || {}))
        maxSizes[name] = Math.max(maxSizes[name] || 0, (d?.length || 0));
    }

    // Classify lines
    const lineInfo = {};
    for(const [ln, hits] of Object.entries(lineHits)){
      const src = (lines[ln - 1] || '').trim();
      if(!src || src.startsWith('#') || src === '') continue;
      const info = { hits, complexity: null };
      if(n > 0){
        const ratio = hits / n;
        if(ratio > n * 0.7)      info.complexity = 'O(n²)';
        else if(ratio > 0.7)     info.complexity = 'O(n)';
        else if(hits <= 2)        info.complexity = 'O(1)';
        else if(n > 4 && hits <= Math.log2(n) * 2) info.complexity = 'O(log n)';
        else                      info.complexity = 'O(n)';
      }
      lineInfo[ln] = info;
    }

    // Overall time
    let overallTime = 'O(1)';
    const maxHits = Math.max(...Object.values(lineHits));
    if(n > 0){
      if(maxHits > n * n * 0.5)       overallTime = 'O(n²)';
      else if(maxHits > n * 0.7)       overallTime = 'O(n)';
      else if(n > 4 && maxHits <= Math.log2(n) * 2 + 1) overallTime = 'O(log n)';
      else if(maxHits > 2)             overallTime = 'O(n)';
    }
    if(maxDepth > 1 && n > 0){
      const callIds = new Set();
      for(const s of snaps) if(s.current_call_id != null) callIds.add(s.current_call_id);
      const calls = callIds.size;
      if(calls > n * n * 0.5) overallTime = 'O(n²)';
      else if(n >= 8 && calls > Math.pow(2, Math.min(n, 20)) * 0.8) overallTime = 'O(2ⁿ)';
    }

    // Identify which container names are method parameters (input, not aux).
    let paramNames = new Set();
    try {
      if(typeof parseSig === 'function'){
        const sig = parseSig(code);
        if(sig && sig.params) for(const p of sig.params) paramNames.add(p.name);
      }
    } catch(e){}

    // Overall space — auxiliary (created inside) drives the headline;
    // input space is reported separately so an in-place algo reads O(1) aux.
    const spaceItems = [];
    let overallSpace = 'O(1)';   // auxiliary only
    for(const [name, size] of Object.entries(maxSizes)){
      if(size === 0) continue;
      let sc = 'O(1)';
      if(n > 0){
        if(size >= n * n * 0.5) sc = 'O(n²)';
        else if(size >= n * 0.5) sc = 'O(n)';
      }
      const isInput = paramNames.has(name);
      spaceItems.push({ name, maxSize: size, complexity: sc, isInput });
      if(!isInput && _cmpOrder(sc) > _cmpOrder(overallSpace)) overallSpace = sc;
    }
    if(maxDepth > 1){
      const stackC = (n > 0 && maxDepth >= n * 0.5) ? 'O(n)' : 'O(log n)';
      spaceItems.push({ name: 'call stack', maxSize: maxDepth, complexity: stackC, isInput: false });
      if(_cmpOrder(stackC) > _cmpOrder(overallSpace)) overallSpace = stackC;
    }

    // Detect loop/block ranges for bracket annotations
    const blocks = _detectBlocks(lines, lineHits, n);

    return { n, overallTime, overallSpace, totalSteps: snaps.length,
             maxDepth, lineInfo, lineHits, spaceItems, blocks };
  }

  function _cmpOrder(c){
    const order = {'O(1)':0,'O(log n)':1,'O(n)':2,'O(n log n)':3,'O(n²)':4,'O(2ⁿ)':5};
    return order[c] ?? 2;
  }

  function _detectBlocks(lines, lineHits, n){
    const loops = [];
    for(let i = 0; i < lines.length; i++){
      const src = lines[i];
      const trimmed = src.trim();
      if(!trimmed) continue;
      if(!/^(for |while )/.test(trimmed)) continue;

      const indent = src.search(/\S/);
      let end = i;
      for(let j = i + 1; j < lines.length; j++){
        const jt = lines[j].trim();
        if(!jt) continue;
        if(lines[j].search(/\S/) <= indent) break;
        end = j;
      }

      const ln = i + 1;
      const hits = lineHits[ln] || 0;
      let own = 'O(1)';
      if(n > 0 && hits > 0){
        if(n > 4 && hits <= Math.log2(n) * 2) own = 'O(log n)';
        else if(hits / n > 0.5) own = 'O(n)';
        else own = 'O(n)';
      }

      loops.push({ startLine: i, endLine: end, hits, indent, own, parent: null, combined: own, explain: '' });
    }

    // Detect nesting: find parent for each loop
    for(let i = 0; i < loops.length; i++){
      for(let j = i - 1; j >= 0; j--){
        if(loops[j].indent < loops[i].indent &&
           loops[i].startLine > loops[j].startLine &&
           loops[i].startLine <= loops[j].endLine){
          loops[i].parent = j;
          break;
        }
      }
    }

    // Build combined complexity and explanation
    for(const loop of loops){
      if(loop.parent !== null){
        const p = loops[loop.parent];
        loop.combined = _multiply(p.combined, loop.own);
        loop.explain = `${p.combined} × ${loop.own} = ${loop.combined}`;
      } else {
        loop.explain = `runs ${loop.hits}× ≈ ${loop.own}`;
      }
    }

    return loops;
  }

  function _multiply(a, b){
    const order = {'O(1)':0,'O(log n)':1,'O(n)':2,'O(n log n)':3,'O(n²)':4,'O(2ⁿ)':5};
    const names = ['O(1)','O(log n)','O(n)','O(n log n)','O(n²)','O(2ⁿ)'];
    const ai = order[a] ?? 0, bi = order[b] ?? 0;
    return names[Math.min(ai + bi, 5)] || 'O(n²)';
  }

  function _guessN(snaps){
    let maxN = 0;
    function countTree(n){ if(!n) return 0; return 1 + countTree(n.left) + countTree(n.right); }
    function countLL(n){ let c=0; const seen=new Set(); while(n&&!seen.has(n.id)){seen.add(n.id);c++;n=n.next;} return c; }
    for(const s of snaps){
      for(const arr of Object.values(s.lists || {}))
        if(arr.length > maxN) maxN = arr.length;
      for(const g of Object.values(s.grids || {}))
        if(g && g.length > maxN) maxN = g.length;
      for(const d of Object.values(s.dicts || {}))
        { const k = Object.keys(d).length; if(k > maxN) maxN = k; }
      for(const sv of Object.values(s.sets || {}))
        if(sv.length > maxN) maxN = sv.length;
      for(const t of Object.values(s.trees || {}))
        { const c = countTree(t); if(c > maxN) maxN = c; }
      for(const ll of Object.values(s.linked_lists || {}))
        { const c = countLL(ll); if(c > maxN) maxN = c; }
    }
    return maxN;
  }

  // ── Clear all complexity overlays from the editor ──
  function clearComplexity(){
    const cm = window._cm;
    if(!cm) return;
    _cxWidgets.forEach(w => { try { cm.removeLineWidget(w); } catch(e){} });
    _cxWidgets = [];
    _cxMarks.forEach(m => { try { m.clear(); } catch(e){} });
    _cxMarks = [];
    for(let i = 0; i < cm.lineCount(); i++){
      cm.removeLineClass(i, 'wrap', 'cx-hi-line');
      cm.removeLineClass(i, 'wrap', 'cx-hi-hot');
    }
    _cxTotalEl = null;
    _cxActive = false;
  }

  // ── Overlay complexity annotations on the code editor ──
  function showComplexity(snaps, code){
    const cm = window._cm;
    if(!cm || !snaps || !snaps.length) return;

    clearComplexity();

    const result = analyzeComplexity(snaps, code);
    if(!result) return;
    _cxActive = true;

    function _inlineTag(lineNum, html){
      const el = document.createElement('span');
      el.className = 'cx-itag';
      el.innerHTML = html;
      const lineLen = cm.getLine(lineNum)?.length || 0;
      const mark = cm.setBookmark({line: lineNum, ch: lineLen}, {widget: el, insertLeft: false});
      _cxMarks.push(mark);
    }

    // ── Summary banner (rebuildable: heuristic first, fitted after measure) ──
    const summaryEl = document.createElement('div');
    summaryEl.className = 'cx-overlay-summary';
    _renderBanner(summaryEl, result, null);
    _cxWidgets.push(cm.addLineWidget(0, summaryEl, { above: true, noHScroll: true }));

    // ── Kick off empirical measurement (async, non-blocking) ──
    const myToken = ++_cxToken;
    const inputText = (window._tiEl && window._tiEl.value) || '';
    _cxSnaps = snaps;
    _cxData = null;
    measureGrowth(code, inputText).then(({ points, scalable }) => {
      if(myToken !== _cxToken || !_cxActive) return;   // stale / closed
      const fit = scalable ? fitCurve(points) : null;
      const prim = (function(){ try { return _primaryCollection(parseLCI(inputText).vars || {}); } catch(e){ return null; } })();
      _cxData = {
        points, fit, scalable,
        kind: prim ? prim.kind : 'array',
        heuristicTime: result.overallTime,
        overallSpace: result.overallSpace,
        spaceItems: result.spaceItems,
        blocks: result.blocks,
        hint: fit ? _optimalityHint(code, fit.complexity, result.blocks) : null,
        n0: result.n,
        totalSteps: result.totalSteps,
      };
      _renderBanner(summaryEl, result, _cxData);
      if(_cxTotalEl) _renderTotal(_cxTotalEl, result, _cxData);
      if(typeof render === 'function') render();   // surface the growth panel
    }).catch(() => {});

    // ── Build per-line reasoning, then render reference-style callouts ──
    const codeLines = code.split('\n');
    const ann = {};                              // 0-based line -> { kind, cx, why }
    const place = (ln, a) => { if(ln >= 0 && !(ln in ann)) ann[ln] = a; };

    // 1. Loops → TIME reasoning (+ highlight the loop body)
    let firstLoopLine = Infinity;
    for(const block of result.blocks){
      firstLoopLine = Math.min(firstLoopLine, block.startLine);
      for(let i = block.startLine; i <= block.endLine; i++){
        cm.addLineClass(i, 'wrap', 'cx-hi-line');
        if(_cmpOrder(block.combined) >= _cmpOrder('O(n²)')) cm.addLineClass(i, 'wrap', 'cx-hi-hot');
      }
      const cx = block.parent !== null ? block.combined : block.own;
      const src = (codeLines[block.startLine] || '').trim();
      let why;
      if(block.parent !== null){
        why = `nested loop · ${block.explain}`;
      } else {
        const tp = /^while\s*\(?\s*([a-z]\w*)\s*[<>]=?\s*([a-z]\w*)/i.exec(src);
        const conv = tp && new RegExp(`\\b(${tp[1]}|${tp[2]})\\s*[+\\-]=`).test(code);
        if(conv) why = `two pointers converge — each element processed once (≤ ${block.hits} steps)`;
        else     why = `loop body runs ${block.hits}× ≈ ${cx}`;
      }
      place(block.startLine, { kind:'time', cx, why });
    }

    // 2. Auxiliary space / recursion → SPACE reasoning on the creating line
    const spaceAnnotated = new Set();
    for(const sp of result.spaceItems){
      if(sp.name === 'call stack'){
        for(let i = 0; i < codeLines.length; i++){
          const m = codeLines[i].match(/^\s*def\s+(\w+)/);
          if(m && !spaceAnnotated.has(i)){
            const fnName = m[1];
            if(codeLines.slice(i+1).join('\n').includes(fnName + '(')){
              place(i, { kind:'space', cx:sp.complexity, why:`recursion stack — max call depth ${sp.maxSize}` });
              spaceAnnotated.add(i);
              break;
            }
          }
        }
        continue;
      }
      const esc = sp.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      for(let i = 0; i < codeLines.length; i++){
        if(new RegExp('\\b' + esc + '\\s*=').test(codeLines[i]) && !spaceAnnotated.has(i)){
          const note = sp.maxSize >= result.n * 0.5 ? `grows with input (≈${sp.maxSize})` : `holds ${sp.maxSize}`;
          place(i, { kind:'space', cx:sp.complexity,
                     why: sp.isInput ? `input · ${sp.name} ${note}` : `allocates ${sp.name} — ${note}` });
          spaceAnnotated.add(i);
          break;
        }
      }
    }

    // 3. Per-statement micro-reasons: in-place swaps, array reads, scalar inits
    for(const lnStr of Object.keys(result.lineHits)){
      const ln0 = (+lnStr) - 1;
      if(ln0 in ann) continue;
      const src = (codeLines[ln0] || '').trim();
      if(!src || src.startsWith('#')) continue;
      // tuple swap with subscripts both sides → in-place, O(1) space
      if(/\w+\s*\[[^\]]*\]\s*,\s*\w+\s*\[[^\]]*\]\s*=\s*\w+\s*\[[^\]]*\]\s*,/.test(src)){
        place(ln0, { kind:'space', cx:'O(1)', why:'in-place swap — no auxiliary array' });
        continue;
      }
      if(/^(def |class |return\b|if |elif |else|for |while )/.test(src)) continue;
      // x = arr[i]  → O(1) array access (read)
      if(/^[a-z_]\w*\s*=\s*[a-z_]\w*\s*\[[^\]]*\]\s*$/i.test(src)){
        place(ln0, { kind:'time', cx:'O(1)', why:'array access — constant time' });
        continue;
      }
      // scalar init before the first loop:  l = 0  /  r = len(arr) - 1
      if(ln0 < firstLoopLine && /^[a-z_]\w*\s*=\s*[^=]/i.test(src) && !/[\[\{]/.test((src.split('=')[1] || ''))){
        place(ln0, { kind:'time', cx:'O(1)', why:'allocation — constant time & space' });
        continue;
      }
    }

    // 4. Render callout cards
    for(const lnStr of Object.keys(ann)){
      const a = ann[lnStr];
      const hot = _cmpOrder(a.cx) >= _cmpOrder('O(n²)');
      _inlineTag(+lnStr,
        `<span class="cx-co cx-co-${a.kind}${hot ? ' cx-co-hot' : ''}">` +
          `<span class="cx-co-badge">${a.cx}</span>` +
          `<span class="cx-co-why">${a.why}</span>` +
        `</span>`);
    }

    // 5. TOTAL COMPLEXITY footer below the last line of code
    let lastLine = codeLines.length - 1;
    while(lastLine > 0 && !codeLines[lastLine].trim()) lastLine--;
    const totalEl = document.createElement('div');
    totalEl.className = 'cx-total';
    _renderTotal(totalEl, result, null);
    _cxTotalEl = totalEl;
    _cxWidgets.push(cm.addLineWidget(lastLine, totalEl, { noHScroll: true }));

    cm.refresh();
  }

  // ── TOTAL COMPLEXITY verdict footer (rebuilt with the fitted result) ──
  function _renderTotal(el, result, data){
    const t = (data && data.fit) ? data.fit.complexity : result.overallTime;
    const s = result.overallSpace;
    el.innerHTML =
      `<span class="cx-total-lbl">TOTAL COMPLEXITY →</span>` +
      `<span class="cx-total-pair"><span class="cx-total-k">TIME</span>` +
        `<span class="cx-total-t">${t}</span></span>` +
      `<span class="cx-total-sep">|</span>` +
      `<span class="cx-total-pair"><span class="cx-total-k">SPACE</span>` +
        `<span class="cx-total-s">${s}</span></span>`;
  }

  // ── Banner: heuristic-only, or fitted (asymptotic + this-run) after measure ──
  function _renderBanner(el, result, data){
    const nLbl = data ? _nLabel(data.kind) : 'n';
    let html =
      `<span class="cx-ov-lbl cx-ov-t">TIME</span>`;

    if(data && data.fit){
      const asy = data.fit.complexity;
      const run = data.heuristicTime;
      html += `<span class="cx-ov-val cx-ov-t">${asy}</span>`;
      html += `<span class="cx-ov-why">fitted · ${Math.round(data.fit.confidence*100)}% conf</span>`;
      if(run && run !== asy) html += `<span class="cx-ov-why">· ${run} this run</span>`;
    } else {
      html += `<span class="cx-ov-val cx-ov-t">${result.overallTime}</span>`;
      html += `<span class="cx-ov-why">${data && !data.scalable ? 'measured at 1 size' : 'measuring…'}</span>`;
    }

    html += `<span class="cx-ov-sep">|</span>`;
    html += `<span class="cx-ov-lbl cx-ov-s">SPACE</span>`;
    html += `<span class="cx-ov-val cx-ov-s">${result.overallSpace}</span>`;
    html += `<span class="cx-ov-why">aux · ${nLbl}=${result.n}</span>`;
    if(data && data.hint){
      html += `<span class="cx-ov-hint ${data.hint.optimal ? 'cx-ok-hint' : ''}">${data.hint.text}</span>`;
    }
    html += `<span class="cx-ov-meta">${result.totalSteps} steps</span>`;
    html += `<button class="cx-ov-close" title="Close">✕</button>`;
    el.innerHTML = html;
    const close = el.querySelector('.cx-ov-close');
    if(close) close.addEventListener('click', clearComplexity);
  }

  // ── Growth-curve panel for #vc (proof + live operation counter) ──
  // Called by render-core on every step while complexity mode is active.
  function renderComplexityPanel(cur){
    if(!_cxData || !_cxData.scalable || !_cxData.fit) return '';
    const { points, fit, kind, n0 } = _cxData;
    const esc = window.esc || (s => String(s));

    // Live ops so far = count of <user> line events up to cur.
    let opsNow = 0, opsTotal = 0;
    if(_cxSnaps){
      for(let i = 0; i < _cxSnaps.length; i++){
        if(_cxSnaps[i].filename === '<user>'){
          opsTotal++;
          if(i <= cur) opsNow++;
        }
      }
    }
    const pct = opsTotal ? Math.round((opsNow / opsTotal) * 100) : 0;

    // SVG plot
    const W = 460, H = 200, padL = 46, padR = 14, padT = 16, padB = 30;
    const maxN = Math.max(...points.map(p => p.n));
    const maxOps = Math.max(...points.map(p => p.ops));
    const sx = v => padL + (v / maxN) * (W - padL - padR);
    const sy = v => H - padB - (v / maxOps) * (H - padT - padB);

    // fitted curve path
    let path = '';
    for(let i = 0; i <= 50; i++){
      const n = (maxN / 50) * i;
      if(n < 1) continue;
      const y = Math.min(maxOps, fit.k * fit.f(n));
      path += (path ? ' L' : 'M') + sx(n).toFixed(1) + ',' + sy(y).toFixed(1);
    }
    const dots = points.map(p =>
      `<circle cx="${sx(p.n).toFixed(1)}" cy="${sy(p.ops).toFixed(1)}" r="3.5" class="cx-pt"/>`
    ).join('');

    // axis labels — y: 0 at bottom, max near top (nudged down to clear the title)
    const yTicks =
      `<text x="${padL-6}" y="${sy(0)+3}" class="cx-axis" text-anchor="end">0</text>` +
      `<text x="${padL-6}" y="${padT+11}" class="cx-axis" text-anchor="end">${maxOps.toLocaleString()}</text>`;
    const xTicks = [Math.min(...points.map(p=>p.n)), maxN].map(v =>
      `<text x="${sx(v)}" y="${H-padB+16}" class="cx-axis" text-anchor="middle">${v}</text>`).join('');

    return `<div class="vb cx-growth">
      <h3>Complexity Proof&nbsp;&nbsp;<span class="cx-growth-fit">${esc(fit.complexity)}</span>
        <span class="cx-growth-conf">${Math.round(fit.confidence*100)}% fit · measured at ${points.length} sizes</span></h3>
      <svg viewBox="0 0 ${W} ${H}" class="cx-growth-svg" preserveAspectRatio="xMidYMid meet">
        <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" class="cx-axis-line"/>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" class="cx-axis-line"/>
        <path d="${path}" class="cx-fit-line" fill="none"/>
        ${dots}
        ${yTicks}${xTicks}
        <text x="${(W)/2}" y="${H-4}" class="cx-axis-title" text-anchor="middle">${esc(_nLabel(kind))} →</text>
      </svg>
      <div class="cx-counter">
        <span class="cx-counter-lbl">operations this run</span>
        <span class="cx-counter-val">${opsNow.toLocaleString()} / ${opsTotal.toLocaleString()}</span>
        <div class="cx-counter-bar"><div class="cx-counter-fill" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }

  window.analyzeComplexity = analyzeComplexity;
  window.showComplexity = showComplexity;
  window.clearComplexity = clearComplexity;
  window.renderComplexityPanel = renderComplexityPanel;
  window.isComplexityActive = function(){ return _cxActive; };

})();
