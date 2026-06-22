/* ══════════════════════════════════════════════════════════════════════
   parser.js ─ LeetCode input parsing engine.
   Handles every LeetCode input format automatically:
     1. key = value  (standard)
     2. key: value   (rare variant)
     3. bare values  (positional, no names)
     4. ["ClassName","method",...]\n[[], [args], ...]  (Design problems)
     5. Input: key = value  (copy-pasted with prefix)
     6. nums = [...], k = N  (comma-separated on one line)
     7. null/true/false  (converted to Python None/True/False)
     8. bare unquoted strings  (auto-quoted)
     9. variable name mismatches  (fuzzy matching: num↔nums, s↔str, etc.)
   No dependencies.
   ══════════════════════════════════════════════════════════════════════ */

/** Strip LeetCode page chrome from raw pasted text. */
function cleanRaw(raw){
  return raw.split('\n').map(l=>l.trim())
    .filter(l=>l&&!l.startsWith('Output:')&&!l.startsWith('Explanation:')
                &&!l.startsWith('Expected:')&&!l.startsWith('Note:')
                &&!/^Example\s*\d+/.test(l)&&!/^Constraints?:/.test(l))
    .map(l=>l.replace(/^Input:\s*/i,'').replace(/^Test\s*case\s*\d*:?\s*/i,'').trim())
    .filter(l=>l).join('\n');
}

/**
 * Detect Design-pattern input:
 * ["ClassName","method1","method2"]\n[[], [a1], [a2]]
 */
function detectDesign(raw){
  const lines = raw.trim().split('\n').map(l=>l.trim()).filter(l=>l);
  if(lines.length < 2) return null;
  try {
    const ops = JSON.parse(lines[0]);
    const argsRaw = JSON.parse(lines[1].replace(/\bnull\b/g,'null'));
    if(!Array.isArray(ops)||!Array.isArray(argsRaw)) return null;
    if(ops.length !== argsRaw.length) return null;
    if(typeof ops[0] !== 'string' || !ops[0][0].match(/[A-Z]/)) return null;
    if(!argsRaw.every(a=>Array.isArray(a))) return null;
    return {
      className: ops[0],
      ctorArgs: argsRaw[0],
      calls: ops.slice(1).map((m,i)=>({ method:m, args:argsRaw[i+1] }))
    };
  } catch(e) { return null; }
}

/** Infer whether a parameter is a linked list, tree, or grid from hints and code context. */
function inferType(nm, hint, code){
  if(/ListNode/i.test(hint)) return 'LL';
  if(/TreeNode/i.test(hint)) return 'TR';
  if(/List\s*\[\s*List/i.test(hint)) return 'GR';
  if(/ListNode/.test(code)) return 'LL';
  if(/TreeNode/.test(code)) return 'TR';
  const llr = new RegExp(`\\b(${nm}|curr|prev|slow|fast|node|head|tail)\\s*\\.\\s*next\\b`);
  if(llr.test(code)) return 'LL';
  const trr = new RegExp(`\\b(${nm}|root|node)\\s*\\.\\s*(left|right)\\b`);
  if(trr.test(code)) return 'TR';
  const n = nm.toLowerCase();
  if(['head','node','curr','prev','slow','fast','start','tail','l1','l2','list1','list2','node1','node2'].includes(n)) return 'LL';
  if(['root','tree','node'].includes(n)) return 'TR';
  if(['grid','board','matrix','image','picture','dungeon','maze','rooms','heights','graph'].includes(n)) return 'GR';
  return null;
}

/** Return 'GR' if value string looks like a 2D list, else null. */
function shapeOf(v){ return /^\[\s*\[/.test(v.trim()) ? 'GR' : null; }

/**
 * Parse method signature from code.
 * Prefers the first def that is DIRECTLY inside class Solution.
 *
 * Uses indentation depth rather than character ranges — immune to the
 * "last nested class range swallows everything after it" bug.
 *
 * Handles all patterns:
 *   • Helper class before Solution   (class DSU: … class Solution:)
 *   • Helper class after Solution    (class Solution: … class DSU:)
 *   • Nested class inside Solution   (class Solution:\n    class DSU:)
 *   • Nested class LAST inside Sol.  (same — now works correctly)
 */
function parseSig(code){
  // ── Locate class Solution: and measure its direct-child indent level ──
  const solMatch = /^class\s+Solution\b[^\n]*/m.exec(code);
  const hasSol   = !!solMatch;
  let solStart = hasSol ? solMatch.index : -1;

  // Direct members of Solution are indented by exactly N spaces.
  // Detect N by finding the first non-empty, non-comment indented line
  // that immediately follows class Solution:.
  let solMemberIndent = -1;
  if(hasSol){
    const afterSol = code.slice(solStart + solMatch[0].length);
    const first = /^([ \t]+)\S/m.exec(afterSol);
    if(first) solMemberIndent = first[1].replace(/\t/g, '    ').length;
  }

  // ── Scan every def with its leading whitespace ────────────────────────
  const re = /^([ \t]*)def\s+(\w+)\s*\(([^)]*)\)/gm;
  let m, best = null, solM = null;

  while((m = re.exec(code)) !== null){
    if(m[2] === '__init__') continue;

    // Normalise tabs → 4 spaces for indent comparison
    const indent = m[1].replace(/\t/g, '    ').length;

    const ps = [];
    for(const seg of m[3].split(',')){
      const s = seg.trim();
      if(!s || s === 'self') continue;
      const ci=s.indexOf(':'), ei=s.indexOf('='), ne=ci>0?ci:(ei>0?ei:s.length);
      const nm = s.slice(0,ne).trim();
      let th = '';
      if(ci>0){ const a=s.slice(ci+1); th=(a.indexOf('=')>0?a.slice(0,a.indexOf('=')):a).trim(); }
      if(nm) ps.push({ name:nm, type:th });
    }
    const entry = { name:m[2], params:ps };
    if(!best) best = entry;

    if(hasSol){
      // Must appear AFTER class Solution: in the file
      if(m.index <= solStart) continue;
      // Must be at exactly the direct-member indent level
      // (deeper = inside a nested class; shallower = outside Solution)
      if(solMemberIndent > 0 && indent === solMemberIndent && !solM)
        solM = entry;
    } else {
      // No Solution class — just grab the very first def
      if(!solM) solM = entry;
    }
  }
  return solM || best;
}

/** Split "a = 1, b = [2,3]" on top-level commas before assignments. */
function splitTopLevel(str){
  const parts = [];
  let depth=0, cur='', inStr=false, sc='';
  for(let i=0; i<str.length; i++){
    const c = str[i];
    if(!inStr && (c==='"'||c==="'")){ inStr=true; sc=c; cur+=c; }
    else if(inStr && c===sc && str[i-1]!=='\\'){ inStr=false; cur+=c; }
    else if(!inStr && (c==='['||c==='('||c==='{')){ depth++; cur+=c; }
    else if(!inStr && (c===']'||c===')'||c==='}')){ depth--; cur+=c; }
    else if(!inStr && depth===0 && c===','){
      if(/^\s*[a-zA-Z_]\w*(\[\])?\s*[=:]/.test(str.slice(i+1))){ parts.push(cur.trim()); cur=''; }
      else cur += c;
    } else cur += c;
  }
  if(cur.trim()) parts.push(cur.trim());
  return parts;
}

/**
 * Normalise a value string:
 * null→None, true→True, false→False, unquoted bare word→"word"
 */
function lcPy(s){
  if(typeof s !== 'string') return String(s);
  s = s.trim();
  s = s.replace(/\bnull\b/g,'None').replace(/\btrue\b/g,'True').replace(/\bfalse\b/g,'False');
  // bare unquoted single word that's not a Python literal or number → treat as string
  if(/^[a-zA-Z][a-zA-Z0-9_]*$/.test(s) && !['None','True','False'].includes(s))
    s = `"${s}"`;
  return s;
}

/** Parse LeetCode input into { vars: {name: valueStr}, pos: [valueStr] }. */
function parseLCI(raw){
  const vars = {}, pos = [];
  // Join multi-line values where "varname =" appears alone and value is on next line(s)
  const rawLines = raw.split('\n');
  const joined = [];
  let i = 0;
  while(i < rawLines.length){
    const t = rawLines[i].trim();
    if(/^[a-zA-Z_]\w*\s*=\s*$/.test(t)){
      let combined = t, depth = 0;
      i++;
      while(i < rawLines.length){
        const next = rawLines[i].trim();
        i++;
        if(!next) continue;
        combined += ' ' + next;
        for(const c of next){ if(c==='['||c==='('||c==='{') depth++; else if(c===']'||c===')'||c==='}') depth--; }
        if(depth <= 0) break;
      }
      joined.push(combined);
    } else { joined.push(t); i++; }
  }
  for(const line of joined){
    let t = line.trim();
    if(!t || t.startsWith('#')) continue;
    // Handle "key: value" (colon-style, only at line start, only before obvious value)
    t = t.replace(/^([a-zA-Z_]\w*)\s*:\s*(?=[\[{\d"'\-])/, '$1 = ');
    for(let seg of splitTopLevel(t)){
      seg = seg.trim().replace(/^([a-zA-Z_]\w*?)(\[\])+/,'$1');
      const eq = seg.indexOf('=');
      if(eq>0){
        const lhs=seg.slice(0,eq).trim();
        let rhs=seg.slice(eq+1).trim().replace(/,\s*$/, ''); // strip trailing comma (LeetCode multi-param artifact)
        if(/^[a-zA-Z_]\w*$/.test(lhs)){ vars[lhs]=rhs; continue; }
      }
      if(seg) pos.push(seg);
    }
  }
  return { vars, pos };
}

/** Synonym table for fuzzy variable matching. */
const SYNONYMS = {
  nums:   ['num','numbers','arr','array','integers','vals','values','list','data','elements'],
  s:      ['str','string','word','text','input','chars','ch'],
  t:      ['target','str2','string2','t2','word2'],
  target: ['t','goal','val','value'],
  root:   ['tree','node','r'],
  head:   ['node','list','l'],
  grid:   ['matrix','board','map','g','picture','image'],
  k:      ['n','count','times','freq','num'],
  n:      ['k','size','length','count','total'],
  strs:   ['words','strings','arr','list'],
  words:  ['strs','strings','arr','list'],
};

/** Fuzzy variable matching: paramName → best matching value in vars. */
function smartMatch(paramName, vars){
  if(Object.prototype.hasOwnProperty.call(vars, paramName)) return vars[paramName];
  const lo = paramName.toLowerCase();
  // Case-insensitive exact
  for(const [k,v] of Object.entries(vars)) if(k.toLowerCase()===lo) return v;
  // Plural/singular
  const flip = lo.endsWith('s') ? lo.slice(0,-1) : lo+'s';
  for(const [k,v] of Object.entries(vars)) if(k.toLowerCase()===flip) return v;
  // Synonym table
  const syns = (SYNONYMS[lo]||[]);
  for(const syn of syns) for(const [k,v] of Object.entries(vars)) if(k.toLowerCase()===syn) return v;
  // Reverse synonym lookup
  for(const [canonical,synList] of Object.entries(SYNONYMS)){
    if(synList.includes(lo)){
      for(const [k,v] of Object.entries(vars)) if(k.toLowerCase()===canonical) return v;
    }
  }
  return null;
}

/**
 * Build a Python driver script from the solution code and raw user input.
 * Returns { driver: string, parsed: boolean }.
 */
function buildDriver(sol, rawOrig){
  if(!rawOrig.trim()) return { driver:'', parsed:false };
  if(/Solution\s*\(\s*\)/.test(rawOrig)||/build_linked_list|build_tree/.test(rawOrig))
    return { driver:rawOrig, parsed:false };

  const raw = cleanRaw(rawOrig);

  // ── Design Pattern: ["ClassName","method",...]\n[[], [args], ...] ──
  const design = detectDesign(raw);
  if(design){
    const { className, ctorArgs, calls } = design;
    function toPy(x){
      if(x===null) return 'None';
      if(x===true) return 'True';
      if(x===false) return 'False';
      if(typeof x==='string') return JSON.stringify(x);
      if(typeof x==='number') return String(x);
      if(Array.isArray(x)) return `[${x.map(toPy).join(', ')}]`;
      if(typeof x==='object') return '{'+Object.entries(x).map(([k,v])=>`${JSON.stringify(k)}: ${toPy(v)}`).join(', ')+'}';
      return String(x);
    }
    const pyArgs = a => a.map(toPy).join(', ');
    const lines = [`obj = ${className}(${pyArgs(ctorArgs)})`];
    for(const { method, args } of calls){
      lines.push(`_result = obj.${method}(${pyArgs(args)})`);
    }
    if(calls.length===0) lines.push('_result = None');
    return { driver:lines.join('\n'), parsed:true };
  }

  const meth = parseSig(sol);
  const { vars, pos } = parseLCI(raw);
  const lines = [], args = [];

  if(meth){
    const usedPos = new Set();
    // First pass: record which param names resolve to a tree (list value → build_tree)
    // so later TreeNode params with bare ints can use find_node(treeVar, val).
    // Require the type hint to explicitly say TreeNode to avoid false positives on
    // params like val:int in tree problems where TreeNode appears in code globally.
    const treeVarName = (()=>{
      for(let i=0; i<meth.params.length; i++){
        const { name, type } = meth.params[i];
        let rv = smartMatch(name, vars);
        if(rv==null) continue;
        const hintIsTreeNode = /TreeNode/i.test(type);
        if(!hintIsTreeNode) continue;
        const inf = inferType(name, type, sol) || shapeOf(rv);
        if(inf==='TR' && /^\[/.test(rv.trim())) return name;
      }
      return null;
    })();

    for(let i=0; i<meth.params.length; i++){
      const { name, type } = meth.params[i];
      let rv = smartMatch(name, vars);
      if(rv==null){
        for(let pi=0; pi<pos.length; pi++){
          if(!usedPos.has(pi)){ rv=pos[pi]; usedPos.add(pi); break; }
        }
      }
      if(rv==null){ args.push('None'); continue; }
      const inf = inferType(name, type, sol) || shapeOf(rv);
      let expr;
      if(inf==='LL'){
        const posVar = smartMatch('pos', vars);
        expr = posVar!=null
          ? `build_linked_list(${lcPy(rv)}, pos=${lcPy(posVar)})`
          : `build_linked_list(${lcPy(rv)})`;
      } else if(inf==='TR'){
        // Only treat as a tree if the type hint EXPLICITLY says TreeNode.
        // inferType() can return 'TR' just because TreeNode appears in the code body
        // (e.g. val:int in insertIntoBST), so we must check the hint first.
        const trimmed = rv.trim();
        const hintIsTreeNode = /TreeNode/i.test(type);
        if(!hintIsTreeNode){
          // Type hint says something else (e.g. int) — pass as plain value
          expr = lcPy(rv);
        } else if(treeVarName && treeVarName !== name && /^-?\d+$/.test(trimmed)){
          // TreeNode param with bare int value → find the node in the already-built tree
          expr = `find_node(${treeVarName}, ${trimmed})`;
        } else {
          expr = `build_tree(${lcPy(rv)})`;
        }
      } else {
        expr = lcPy(rv);
      }
      lines.push(`${name} = ${expr}`);
      args.push(name);
    }
    const hc = /class\s+Solution\b/.test(sol);
    lines.push(`_result = ${hc?'Solution().':''}${meth.name}(${args.join(', ')})`);
  } else {
    // No recognisable method — just emit all assignments verbatim
    for(const [k,v] of Object.entries(vars)){ if(k==='pos') continue; lines.push(`${k} = ${lcPy(v)}`); }
    for(const v of pos) lines.push(lcPy(v));
  }
  return { driver:lines.join('\n'), parsed:true };
}
