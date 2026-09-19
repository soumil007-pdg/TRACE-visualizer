# Java Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user paste an unmodified LeetCode Java solution into TRACE and get a visualization indistinguishable in quality from the Python one.

**Architecture:** The renderers already consume a language-neutral snapshot contract. We rewrite the user's Java to print its own state at each statement, execute it on a real JVM via Judge0 (browser calls it directly, CORS is open), and parse stdout back into that same contract. We never simulate Java; a real `javac` and JVM do the work and our injected code only observes.

**Tech Stack:** Vanilla JS, no build step. `java-parser` v3.0.1 loaded as ESM from jsDelivr. Judge0 public CE instance (`language_id: 62`). CodeMirror 5 `clike` mode.

**Spec:** `docs/superpowers/specs/2026-09-19-java-support-design.md`

## Global Constraints

- **No build step.** Classic `<script>` tags with globals. The single exception is one `<script type="module">` that imports `java-parser` and assigns `window.JavaParser`.
- **Cache-bust every script tag** with `?v=N`, incrementing on each change. Forgetting this has already caused false "the fix didn't work" debugging in this project.
- **No em-dashes in any user-facing string.** Project-wide rule.
- **No emoji in UI.** Use inline SVG, matching the existing icon set.
- **`STEP_CAP = 1000`**, matching Python's tracer.
- **Python path must not change.** Any diff touching the Pyodide flow is a bug in this plan.
- **Snapshot contract is fixed.** Every card must be:
  `{ line, locals, lists, grids, dicts, sets, deques, linked_lists, trees, node_pointers, call_depth, current_call_id, max_call_id, cond, stmt }`
  and every run must return
  `{ snapshots, error, result, has_result, call_trees }`.
- **Judge0 endpoint:** `https://ce.judge0.com/submissions?base64_encoded=false&wait=true`

## Test approach

This codebase has no test framework and will not be given one. Tests are a
browser page that runs assertions and prints results to the DOM, mirroring the
existing `window.TEST` harness pattern.

Run any test by starting the local server and reading the page:

```
preview_start { name: "trace" }
navigate http://localhost:8765/dev/java-test.html
get_page_text
```

A passing run prints `ALL PASS (n)`. A failure prints `FAIL: <name>` with the
expected and actual values.

---

### Task 1: Test harness page and Judge0 client

**Files:**
- Create: `dev/java-test.html`
- Create: `js/java-runner.js`
- Modify: `.gitignore` (add nothing; `dev/` ships, it is harmless and useful)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `async judge0Run(source) -> { stdout, stderr, compileOutput, statusText, timeMs }`
  - `parseCards(stdout) -> { snapshots, result, has_result }`
  - `window.JT = { eq, ok, report }` test helpers on the page.

- [ ] **Step 1: Write the failing test**

Create `dev/java-test.html`:

```html
<!doctype html><meta charset="utf-8"><title>TRACE Java tests</title>
<pre id="out" style="font:13px ui-monospace,Menlo,monospace;padding:16px;white-space:pre-wrap"></pre>
<script src="../js/java-runner.js?v=1"></script>
<script>
const out = document.getElementById('out');
const fails = [];
let n = 0;
function eq(name, actual, expected){
  n++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) fails.push(`FAIL: ${name}\n  expected ${e}\n  actual   ${a}`);
}
function ok(name, cond, detail){ n++; if(!cond) fails.push(`FAIL: ${name}${detail?'\n  '+detail:''}`); }
function report(){
  out.textContent = fails.length ? fails.join('\n\n') : `ALL PASS (${n})`;
}
window.JT = { eq, ok, report };

(async function(){
  // parseCards turns Judge0 stdout into the snapshot contract
  const stdout = [
    '__T{"line":5,"locals":{"count":0},"grids":{},"lists":{}}',
    'some unrelated program output',
    '__T{"line":7,"locals":{"count":1},"grids":{},"lists":{}}',
    '__RESULT{3}'
  ].join('\n');
  const r = parseCards(stdout);
  eq('parseCards count', r.snapshots.length, 2);
  eq('parseCards first line', r.snapshots[0].line, 5);
  eq('parseCards ignores noise', r.snapshots[1].locals.count, 1);
  eq('parseCards result', r.result, 3);
  eq('parseCards has_result', r.has_result, true);

  // judge0Run actually executes Java
  const hello = 'public class Main{public static void main(String[] a){System.out.println(42);}}';
  const j = await judge0Run(hello);
  eq('judge0 stdout', (j.stdout||'').trim(), '42');
  eq('judge0 clean compile', j.compileOutput, null);
  ok('judge0 under 10s', j.timeMs < 10000, `took ${j.timeMs}ms`);

  report();
})();
</script>
```

- [ ] **Step 2: Run it to verify it fails**

```
preview_start { name: "trace" }
navigate http://localhost:8765/dev/java-test.html
get_page_text
```

Expected: a JS error, `judge0Run is not defined`, because `js/java-runner.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `js/java-runner.js`:

```js
/* ══════════════════════════════════════════════════════════════════════
   java-runner.js ─ Talks to Judge0 and turns its stdout back into the
   snapshot contract the renderers already consume.
   No dependency on the Python path.
   ══════════════════════════════════════════════════════════════════════ */

const JUDGE0_URL  = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';
const JUDGE0_JAVA = 62;   // Java (OpenJDK 13)

/* Submit source to a real JVM. Returns raw streams; interpreting them is
   parseCards' job. Never throws for compile/runtime errors — those come
   back in compileOutput / stderr so the caller can show them properly. */
async function judge0Run(source){
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(JUDGE0_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: source, language_id: JUDGE0_JAVA })
    });
  } catch(e){
    return { stdout:'', stderr:'', compileOutput:null,
             statusText:'Network error: ' + e.message, timeMs: performance.now()-t0 };
  }
  if(!res.ok){
    return { stdout:'', stderr:'', compileOutput:null,
             statusText:'Judge0 HTTP ' + res.status, timeMs: performance.now()-t0 };
  }
  const j = await res.json();
  return {
    stdout:        j.stdout || '',
    stderr:        j.stderr || null,
    compileOutput: j.compile_output || null,
    statusText:    (j.status && j.status.description) || 'Unknown',
    timeMs:        performance.now() - t0
  };
}

/* Java prints one __T{...} card per traced statement, plus a final
   __RESULT{...}. Anything else on stdout is the user's own println and is
   ignored here. */
function parseCards(stdout){
  const snapshots = [];
  let result = null, has_result = false;
  for(const line of String(stdout).split('\n')){
    if(line.startsWith('__T')){
      try { snapshots.push(JSON.parse(line.slice(3))); }
      catch(e){ /* a truncated final card (output cap) is not fatal */ }
    } else if(line.startsWith('__RESULT')){
      try { result = JSON.parse(line.slice(9, -1)); has_result = true; }
      catch(e){ /* leave has_result false */ }
    }
  }
  return { snapshots, result, has_result };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Reload `http://localhost:8765/dev/java-test.html` and read the page.
Expected: `ALL PASS (6)`.

- [ ] **Step 5: Commit**

```bash
git add dev/java-test.html js/java-runner.js
git commit -m "Add Judge0 client and snapshot card parser"
```

---

### Task 2: Java preamble with type-aware serializer

**Files:**
- Create: `js/java-preamble.js`
- Modify: `dev/java-test.html` (add assertions)

**Interfaces:**
- Consumes: `judge0Run`, `parseCards` from Task 1.
- Produces: global `const JAVA_PREAMBLE` — a Java source string defining
  `__t(int line, Object... kv)`, `__ser(Object)`, `ListNode`, `TreeNode`,
  `__buildList(int[])`, `__buildTree(Integer[])`, and `__RESULT` printing.

**Why classification happens in Java, not JS:** Java knows static types
exactly. `char[][]` is unambiguously a grid; `HashMap` is unambiguously a dict.
Python has to guess by duck-typing. Doing it Java-side produces *better*
bucketing than the Python path, with no ambiguity.

- [ ] **Step 1: Write the failing test**

Append inside the async IIFE in `dev/java-test.html`, before `report()`:

```js
  // the preamble must classify values into the renderer's buckets
  const prog = JAVA_PREAMBLE + `
public class Main {
  public static void main(String[] args){
    int[] arr = {1,2,3};
    char[][] g = {{'1','0'},{'0','1'}};
    java.util.Map<String,Integer> m = new java.util.HashMap<>();
    m.put("a", 1);
    java.util.Set<Integer> s = new java.util.HashSet<>();
    s.add(7);
    __t(4, "arr", arr, "g", g, "m", m, "s", s, "total", 9);
    System.out.println("__RESULT{" + __ser(9) + "}");
  }
}`;
  const jr = await judge0Run(prog);
  ok('preamble compiles', jr.compileOutput === null, 'compile said: ' + jr.compileOutput);
  const pc = parseCards(jr.stdout);
  eq('one card emitted', pc.snapshots.length, 1);
  const c = pc.snapshots[0];
  eq('int went to locals',   c.locals.total, 9);
  eq('int[] went to lists',  c.lists.arr, [1,2,3]);
  eq('char[][] went to grids', c.grids.g, [['1','0'],['0','1']]);
  eq('Map went to dicts',    c.dicts.m, {a:1});
  eq('Set went to sets',     c.sets.s, [7]);
  eq('result parsed',        pc.result, 9);
```

Add the script tag to the page head, above `java-runner.js`:

```html
<script src="../js/java-preamble.js?v=1"></script>
```

- [ ] **Step 2: Run it to verify it fails**

Expected: `JAVA_PREAMBLE is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Create `js/java-preamble.js`:

```js
/* ══════════════════════════════════════════════════════════════════════
   java-preamble.js ─ Java source prepended to every user program.
   Mirrors the Python PREAMBLE in tracer.js: helper types plus the
   serializer that buckets values into the renderer's categories.
   ══════════════════════════════════════════════════════════════════════ */

const JAVA_PREAMBLE = `
import java.util.*;

class ListNode {
  int val; ListNode next;
  ListNode(){} ListNode(int v){val=v;} ListNode(int v,ListNode n){val=v;next=n;}
}
class TreeNode {
  int val; TreeNode left, right;
  TreeNode(){} TreeNode(int v){val=v;} TreeNode(int v,TreeNode l,TreeNode r){val=v;left=l;right=r;}
}

class __Tracer {
  static int steps = 0;
  static final int CAP = 1000;

  static String esc(String s){
    StringBuilder b = new StringBuilder();
    for(char c : s.toCharArray()){
      if(c=='"') b.append("\\\\\\"");
      else if(c=='\\\\') b.append("\\\\\\\\");
      else if(c=='\\n') b.append("\\\\n");
      else if(c<32) b.append(String.format("\\\\u%04x",(int)c));
      else b.append(c);
    }
    return b.toString();
  }

  /* Which renderer bucket does this value belong in?
     Java's static types make this unambiguous. */
  static String bucket(Object o){
    if(o instanceof int[][] || o instanceof char[][] ||
       o instanceof String[][] || o instanceof boolean[][]) return "grids";
    if(o instanceof int[] || o instanceof char[] || o instanceof String[] ||
       o instanceof boolean[] || o instanceof long[] || o instanceof double[]) return "lists";
    if(o instanceof Deque) return "deques";
    if(o instanceof Map) return "dicts";
    if(o instanceof Set) return "sets";
    if(o instanceof List) return "lists";
    if(o instanceof ListNode) return "linked_lists";
    if(o instanceof TreeNode) return "trees";
    return "locals";
  }

  static String ser(Object o){
    if(o == null) return "null";
    if(o instanceof Boolean || o instanceof Integer || o instanceof Long) return o.toString();
    if(o instanceof Double || o instanceof Float){
      double d = ((Number)o).doubleValue();
      if(Double.isNaN(d) || Double.isInfinite(d)) return "null";
      return o.toString();
    }
    if(o instanceof Character || o instanceof String) return "\\"" + esc(o.toString()) + "\\"";

    if(o instanceof int[]){ int[] a=(int[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if(o instanceof char[]){ char[] a=(char[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(","); b.append("\\"").append(esc(String.valueOf(a[i]))).append("\\""); }
      return b.append("]").toString(); }
    if(o instanceof boolean[]){ boolean[] a=(boolean[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if(o instanceof long[]){ long[] a=(long[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if(o instanceof double[]){ double[] a=(double[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if(o instanceof Object[]){ Object[] a=(Object[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(","); b.append(ser(a[i])); } return b.append("]").toString(); }

    if(o instanceof ListNode){
      StringBuilder b=new StringBuilder("["); ListNode p=(ListNode)o; int guard=0; boolean f=true;
      while(p!=null && guard++<200){ if(!f)b.append(","); f=false; b.append(p.val); p=p.next; }
      return b.append("]").toString();
    }
    if(o instanceof TreeNode){
      /* level order with nulls, matching build_tree in the Python preamble */
      StringBuilder b=new StringBuilder("["); ArrayDeque<TreeNode> q=new ArrayDeque<>();
      q.add((TreeNode)o); boolean f=true; int guard=0;
      while(!q.isEmpty() && guard++<200){
        TreeNode t=q.poll(); if(!f)b.append(","); f=false;
        if(t==null){ b.append("null"); continue; }
        b.append(t.val); q.add(t.left); q.add(t.right);
      }
      return b.append("]").toString();
    }

    if(o instanceof Map){ StringBuilder b=new StringBuilder("{"); boolean f=true;
      for(Object e : ((Map<?,?>)o).entrySet()){
        Map.Entry<?,?> en=(Map.Entry<?,?>)e; if(!f)b.append(","); f=false;
        b.append("\\"").append(esc(String.valueOf(en.getKey()))).append("\\":").append(ser(en.getValue()));
      } return b.append("}").toString(); }

    if(o instanceof Collection){ StringBuilder b=new StringBuilder("["); boolean f=true;
      for(Object x : (Collection<?>)o){ if(!f)b.append(","); f=false; b.append(ser(x)); }
      return b.append("]").toString(); }

    return "\\"" + esc(String.valueOf(o)) + "\\"";
  }

  /* One card per traced statement. kv is name,value,name,value,... */
  static void t(int line, Object... kv){
    if(steps++ >= CAP) return;
    Map<String,StringBuilder> buckets = new LinkedHashMap<>();
    for(String k : new String[]{"locals","lists","grids","dicts","sets","deques","linked_lists","trees"})
      buckets.put(k, new StringBuilder());
    for(int i=0;i+1<kv.length;i+=2){
      String name = String.valueOf(kv[i]); Object val = kv[i+1];
      StringBuilder b = buckets.get(bucket(val));
      if(b.length()>0) b.append(",");
      b.append("\\"").append(esc(name)).append("\\":").append(ser(val));
    }
    StringBuilder o = new StringBuilder("__T{\\"line\\":").append(line);
    for(Map.Entry<String,StringBuilder> e : buckets.entrySet())
      o.append(",\\"").append(e.getKey()).append("\\":{").append(e.getValue()).append("}");
    o.append(",\\"node_pointers\\":{},\\"call_depth\\":0,\\"cond\\":null,\\"stmt\\":null}");
    System.out.println(o);
  }
}

/* short aliases the instrumenter injects */
class __H {
  static ListNode buildList(int[] v){
    if(v==null||v.length==0) return null;
    ListNode head=new ListNode(v[0]), p=head;
    for(int i=1;i<v.length;i++){ p.next=new ListNode(v[i]); p=p.next; }
    return head;
  }
  static TreeNode buildTree(Integer[] v){
    if(v==null||v.length==0||v[0]==null) return null;
    TreeNode root=new TreeNode(v[0]); ArrayDeque<TreeNode> q=new ArrayDeque<>();
    q.add(root); int i=1;
    while(!q.isEmpty() && i<v.length){
      TreeNode n=q.poll();
      if(i<v.length && v[i]!=null){ n.left=new TreeNode(v[i]); q.add(n.left); } i++;
      if(i<v.length && v[i]!=null){ n.right=new TreeNode(v[i]); q.add(n.right); } i++;
    }
    return root;
  }
}
`;

/* the instrumenter emits __t(...) and __ser(...); alias them to the class */
const JAVA_PREAMBLE_ALIASES = `
  static void __t(int line, Object... kv){ __Tracer.t(line, kv); }
  static String __ser(Object o){ return __Tracer.ser(o); }
`;
```

- [ ] **Step 4: Run the test to verify it passes**

Reload the test page. Expected: `ALL PASS (13)`.

If `compile said:` shows an error, the JS-string escaping of the Java source is
wrong. Check backslash counts: `\\\\n` in the JS template literal produces `\\n`
in Java source, which Java reads as an escaped newline in its own string.

- [ ] **Step 5: Commit**

```bash
git add js/java-preamble.js dev/java-test.html
git commit -m "Add Java preamble with type-aware value serializer"
```

---

### Task 3: Vertical slice — hardcoded Java renders in the real UI

This is the earliest point the work is visible. It proves the whole pipeline
before any parsing work exists.

**Files:**
- Modify: `index.html` (add script tags)
- Create: `dev/java-slice.html`

**Interfaces:**
- Consumes: `JAVA_PREAMBLE`, `JAVA_PREAMBLE_ALIASES`, `judge0Run`, `parseCards`.
- Produces: proof only. No new API.

- [ ] **Step 1: Write the failing test**

Create `dev/java-slice.html` — a hand-instrumented Number of Islands whose
snapshots are asserted to match the known-correct grid sequence:

```html
<!doctype html><meta charset="utf-8"><title>Java vertical slice</title>
<pre id="out" style="font:13px ui-monospace,Menlo,monospace;padding:16px;white-space:pre-wrap">running…</pre>
<script src="../js/java-preamble.js?v=1"></script>
<script src="../js/java-runner.js?v=1"></script>
<script>
(async function(){
  const out = document.getElementById('out');
  const src = JAVA_PREAMBLE + `
public class Main {
${JAVA_PREAMBLE_ALIASES}
  static int count = 0;
  static void dfs(char[][] g,int r,int c){
    if(r<0||r>=g.length||c<0||c>=g[0].length) return;
    if(g[r][c]!='1') return;
    g[r][c]='2';
    __t(7,"r",r,"c",c,"grid",g);
    dfs(g,r+1,c); dfs(g,r-1,c); dfs(g,r,c+1); dfs(g,r,c-1);
  }
  public static void main(String[] a){
    char[][] grid = {{'1','1','0','0','0'},{'1','1','0','0','0'},
                     {'0','0','1','0','0'},{'0','0','0','1','1'}};
    for(int r=0;r<grid.length;r++)
      for(int c=0;c<grid[0].length;c++)
        if(grid[r][c]=='1'){ count++; dfs(grid,r,c); }
    __t(16,"count",count,"grid",grid);
    System.out.println("__RESULT{" + __ser(count) + "}");
  }
}`;
  const jr = await judge0Run(src);
  if(jr.compileOutput){ out.textContent = "COMPILE FAILED:\n" + jr.compileOutput; return; }
  const pc = parseCards(jr.stdout);
  const fails = [];
  if(pc.result !== 3) fails.push(`result was ${pc.result}, expected 3`);
  if(pc.snapshots.length !== 9) fails.push(`got ${pc.snapshots.length} cards, expected 9`);
  const first = pc.snapshots[0];
  if(!first.grids || !first.grids.grid) fails.push('first card has no grid bucket');
  const last = pc.snapshots[pc.snapshots.length-1];
  const flat = (last.grids.grid||[]).flat().join('');
  if(flat !== '22000220000020000022') fails.push('final grid wrong: ' + flat);
  out.textContent = fails.length
    ? 'FAIL\n' + fails.join('\n')
    : `ALL PASS\ncards: ${pc.snapshots.length}  result: ${pc.result}  ${Math.round(jr.timeMs)}ms`;
})();
</script>
```

- [ ] **Step 2: Run it to verify it fails**

Navigate to `http://localhost:8765/dev/java-slice.html`.
Expected initially: a mismatch on card count or final grid, because the exact
numbers above must be confirmed against a real run. **Record the real values
and correct the assertions before proceeding** — do not weaken the assertion to
make it pass. A wrong expectation here is the same mistake made three times on
the Python stress tests; the app was right each time.

- [ ] **Step 3: Wire the scripts into the app**

In `index.html`, immediately before `js/runner.js`:

```html
<script src="js/java-preamble.js?v=1"></script>  <!-- JAVA_PREAMBLE               -->
<script src="js/java-runner.js?v=1"></script>    <!-- judge0Run, parseCards       -->
```

- [ ] **Step 4: Prove it renders in the real app**

In the browser console on `http://localhost:8765/index.html`:

```js
const jr = await judge0Run(/* the src from dev/java-slice.html */);
const pc = parseCards(jr.stdout);
snaps = pc.snapshots; cur = 0; render(); updCtrl();
```

Expected: the grid panel draws the 4x5 board and stepping works. Screenshot it.

- [ ] **Step 5: Commit**

```bash
git add dev/java-slice.html index.html
git commit -m "Prove Java-to-renderer pipeline end to end with a vertical slice"
```

---

### Task 4: Java parser loader and scope tracker

**Files:**
- Create: `js/java-instrument.js`
- Modify: `index.html` (module shim for java-parser)
- Modify: `dev/java-test.html`

**Interfaces:**
- Consumes: `window.JavaParser` (set by the module shim).
- Produces:
  - `parseJava(src) -> { cst, error }`
  - `localsAtLine(cst) -> Map<number, string[]>` — every local variable name
    in scope at each 1-based source line, which is the only question the
    instrumenter needs answered.

- [ ] **Step 1: Write the failing test**

Append to `dev/java-test.html`:

```js
  const jsrc = `public class Solution {
  public int numIslands(char[][] grid) {
    int rows = grid.length, cols = grid[0].length;
    int count = 0;
    for (int r = 0; r < rows; r++) { count++; }
    return count;
  }
}`;
  const pj = parseJava(jsrc);
  ok('java parses', pj.error === null, String(pj.error));
  const la = localsAtLine(pj.cst);
  ok('line 4 sees rows/cols/count', ['rows','cols','count'].every(v => (la.get(4)||[]).includes(v)),
     'got ' + JSON.stringify(la.get(4)));
  ok('param grid is in scope', (la.get(4)||[]).includes('grid'), 'got ' + JSON.stringify(la.get(4)));
  ok('loop var r scoped to line 5', (la.get(5)||[]).includes('r'), 'got ' + JSON.stringify(la.get(5)));
  ok('loop var r NOT in scope at line 6', !(la.get(6)||[]).includes('r'), 'got ' + JSON.stringify(la.get(6)));
```

- [ ] **Step 2: Run it to verify it fails**

Expected: `parseJava is not defined`.

- [ ] **Step 3: Add the module shim**

In `index.html`, before the classic script tags:

```html
<!-- java-parser is native ESM; expose it as a global so the classic
     scripts below can use it without a build step -->
<script type="module">
  import * as JavaParser from 'https://cdn.jsdelivr.net/npm/java-parser@3.0.1/+esm';
  window.JavaParser = JavaParser;
  window.dispatchEvent(new Event('java-parser-ready'));
</script>
```

Add the same shim to `dev/java-test.html`, and await it before asserting:

```js
  if(!window.JavaParser) await new Promise(r => addEventListener('java-parser-ready', r, {once:true}));
```

- [ ] **Step 4: Write the minimal implementation**

Create `js/java-instrument.js`:

```js
/* ══════════════════════════════════════════════════════════════════════
   java-instrument.js ─ Rewrites the user's Java so it prints its own
   state. Only needs to answer "which locals are live at line N" — the
   JVM supplies all meaning, so no Java semantics live here.
   Depends on: window.JavaParser (ESM shim in index.html)
   ══════════════════════════════════════════════════════════════════════ */

function parseJava(src){
  if(!window.JavaParser) return { cst:null, error:'Java parser not loaded yet' };
  try { return { cst: window.JavaParser.parse(src), error:null }; }
  catch(e){ return { cst:null, error: e.message || String(e) }; }
}

/* Walk the CST collecting declarations with the line they appear on and the
   block depth they belong to, then project that into "what is visible at
   line N". Chevrotain tokens carry startLine, which is all we need. */
function localsAtLine(cst){
  const decls = [];   // { name, line, endLine }
  const blocks = [];  // stack of { startLine, endLine }

  function firstToken(node){
    let best = null;
    (function dig(n){
      if(!n || typeof n !== 'object') return;
      if(typeof n.startLine === 'number'){
        if(!best || n.startLine < best) best = n.startLine;
      }
      for(const k in n.children || {}) (n.children[k]||[]).forEach(dig);
      if(Array.isArray(n)) n.forEach(dig);
    })(node);
    return best;
  }
  function lastToken(node){
    let best = null;
    (function dig(n){
      if(!n || typeof n !== 'object') return;
      if(typeof n.endLine === 'number'){
        if(!best || n.endLine > best) best = n.endLine;
      }
      for(const k in n.children || {}) (n.children[k]||[]).forEach(dig);
      if(Array.isArray(n)) n.forEach(dig);
    })(node);
    return best;
  }

  (function walk(n, scopeEnd){
    if(!n || typeof n !== 'object') return;

    // a block or for-statement opens a new scope
    let myEnd = scopeEnd;
    if(n.name === 'block' || n.name === 'basicForStatement' ||
       n.name === 'enhancedForStatement'){
      myEnd = lastToken(n) || scopeEnd;
    }

    if(n.name === 'variableDeclaratorId' && n.children && n.children.Identifier){
      const tok = n.children.Identifier[0];
      decls.push({ name: tok.image, line: tok.startLine, endLine: myEnd || Infinity });
    }

    for(const k in n.children || {}) (n.children[k]||[]).forEach(c => walk(c, myEnd));
  })(cst, Infinity);

  // project into per-line visibility
  const maxLine = decls.reduce((m,d) => Math.max(m, d.endLine === Infinity ? d.line : d.endLine), 0);
  const out = new Map();
  for(let ln = 1; ln <= maxLine + 1; ln++){
    const live = decls.filter(d => d.line <= ln && ln <= d.endLine).map(d => d.name);
    out.set(ln, [...new Set(live)]);
  }
  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Reload `dev/java-test.html`. Expected: `ALL PASS (17)`.

If the scoping assertions fail, print the raw `decls` array and compare against
the CST node names in the java-parser output. Node names differ between Java
versions; trust the actual CST over this plan's guesses and fix the node names.

- [ ] **Step 6: Commit**

```bash
git add js/java-instrument.js index.html dev/java-test.html
git commit -m "Add Java parser loader and per-line scope tracker"
```

---

### Task 5: Statement injection

**Files:**
- Modify: `js/java-instrument.js`
- Modify: `dev/java-test.html`

**Interfaces:**
- Consumes: `parseJava`, `localsAtLine`.
- Produces: `instrumentJava(src) -> { code, error, unsupported }` where `code`
  is the rewritten Java, `error` is a string or null, and `unsupported` is an
  array of construct names found (`['streams']`, `['threads']`, …).

- [ ] **Step 1: Write the failing test**

```js
  const inst = instrumentJava(jsrc);
  ok('instrument succeeds', inst.error === null, String(inst.error));
  ok('injects a trace call', /__t\(\d+,/.test(inst.code), 'no __t call found');
  ok('preserves original code', inst.code.includes('int count = 0'), 'original line lost');
  ok('no unsupported in plain code', inst.unsupported.length === 0,
     JSON.stringify(inst.unsupported));

  const streamy = 'public class Solution{ public int f(java.util.List<Integer> l){ return l.stream().mapToInt(Integer::intValue).sum(); } }';
  const si = instrumentJava(streamy);
  ok('detects streams', si.unsupported.includes('streams'), JSON.stringify(si.unsupported));
```

- [ ] **Step 2: Run it to verify it fails**

Expected: `instrumentJava is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Append to `js/java-instrument.js`:

```js
/* Constructs we cannot trace line-by-line. Detected up front so the app can
   say so plainly instead of drawing a wrong picture. */
const JAVA_UNSUPPORTED = [
  { name:'streams', re:/\.stream\s*\(\s*\)|\.parallelStream\s*\(\s*\)|Collectors\./ },
  { name:'lambdas', re:/->\s*[{(]|::\w/ },
  { name:'threads', re:/\bnew\s+Thread\b|\bExecutorService\b|\bsynchronized\b|\bRunnable\b/ },
  { name:'reflection', re:/\bClass\.forName\b|\.getDeclaredMethod\b|\bjava\.lang\.reflect\b/ },
  { name:'file or network IO', re:/\bnew\s+File\b|\bFileReader\b|\bSocket\b|\bURL\b/ }
];

function detectUnsupported(src){
  return JAVA_UNSUPPORTED.filter(u => u.re.test(src)).map(u => u.name);
}

/* Inject __t(line, "name", name, ...) after each statement-ending line.
   Line-based rather than CST-rewriting: the CST gives us scope, and the
   source gives us where statements end. That keeps the user's code byte
   identical, which matters because line numbers drive the editor highlight. */
function instrumentJava(src){
  const unsupported = detectUnsupported(src);
  const { cst, error } = parseJava(src);
  if(error) return { code:null, error, unsupported };

  const live = localsAtLine(cst);
  const lines = src.split('\n');
  const out = [];

  for(let i = 0; i < lines.length; i++){
    const raw = lines[i];
    const ln  = i + 1;
    out.push(raw);

    const t = raw.trim();
    // only trace real statements: skip blanks, comments, declarations,
    // block punctuation, and control headers (their body lines get traced)
    if(!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    if(!t.endsWith(';')) continue;
    if(/^(import|package)\b/.test(t)) continue;
    if(/^(return|break|continue)\b/.test(t)) continue;   // nothing to show after

    const vars = (live.get(ln) || []);
    if(!vars.length) continue;

    const indent = raw.match(/^\s*/)[0];
    const kv = vars.map(v => `"${v}", ${v}`).join(', ');
    out.push(`${indent}__t(${ln}, ${kv});`);
  }

  return { code: out.join('\n'), error:null, unsupported };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Reload `dev/java-test.html`. Expected: `ALL PASS (22)`.

- [ ] **Step 5: Commit**

```bash
git add js/java-instrument.js dev/java-test.html
git commit -m "Inject trace calls into Java source after each statement"
```

---

### Task 6: Driver builder

**Files:**
- Create: `js/java-driver.js`
- Modify: `dev/java-test.html`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `buildJavaDriver(userCode, inputText) -> { driver, error }` where
  `driver` is a Java `main` body that declares the inputs and calls the
  solution method.

The input box format is identical to Python's, `name = value` per line, because
that is what LeetCode prints and what the existing `parser.js` already accepts.

- [ ] **Step 1: Write the failing test**

```js
  const d1 = buildJavaDriver(jsrc, 'grid = [["1","0"],["0","1"]]');
  ok('driver built', d1.error === null, String(d1.error));
  ok('declares char[][]', /char\[\]\[\]\s+grid\s*=/.test(d1.driver), d1.driver);
  ok('calls the method', /numIslands\(\s*grid\s*\)/.test(d1.driver), d1.driver);
  ok('prints result', d1.driver.includes('__RESULT'), d1.driver);

  const d2 = buildJavaDriver('public class Solution{ public int f(int[] nums, int t){ return 0; } }',
                             'nums = [2,7,11]\nt = 9');
  ok('int[] inferred', /int\[\]\s+nums\s*=\s*\{2,7,11\}/.test(d2.driver.replace(/\s+/g,'')) ||
     /int\[\]nums=\{2,7,11\}/.test(d2.driver.replace(/\s+/g,'')), d2.driver);
  ok('two args passed', /f\(\s*nums\s*,\s*t\s*\)/.test(d2.driver), d2.driver);
```

- [ ] **Step 2: Run it to verify it fails**

Expected: `buildJavaDriver is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Create `js/java-driver.js`:

```js
/* ══════════════════════════════════════════════════════════════════════
   java-driver.js ─ Turns the test input box into a Java main().
   Mirrors buildDriver() in parser.js. The input format is identical to
   the Python side because it is LeetCode's own format.
   ══════════════════════════════════════════════════════════════════════ */

/* Read the solution's single public method: its name and parameter types. */
function javaSignature(src){
  const m = src.match(/public\s+([\w<>\[\]\, ]+?)\s+(\w+)\s*\(([^)]*)\)\s*\{/);
  if(!m) return null;
  const params = m[3].trim()
    ? m[3].split(',').map(p => {
        const parts = p.trim().split(/\s+/);
        return { type: parts.slice(0, -1).join(' '), name: parts[parts.length - 1] };
      })
    : [];
  return { returnType: m[1].trim(), method: m[2], params };
}

/* Render a JS value as a Java literal of the given declared type. */
function javaLiteral(type, value){
  const t = type.replace(/\s+/g, '');
  if(t === 'char[][]' || t === 'String[][]'){
    const inner = t === 'char[][]' ? "'" : '"';
    return '{' + value.map(row =>
      '{' + row.map(c => inner + c + inner).join(',') + '}').join(',') + '}';
  }
  if(t === 'int[][]')  return '{' + value.map(r => '{' + r.join(',') + '}').join(',') + '}';
  if(t === 'int[]' || t === 'long[]' || t === 'double[]') return '{' + value.join(',') + '}';
  if(t === 'char[]')   return '{' + value.map(c => "'" + c + "'").join(',') + '}';
  if(t === 'String[]') return '{' + value.map(s => JSON.stringify(s)).join(',') + '}';
  if(t === 'String')   return JSON.stringify(value);
  if(t === 'char')     return "'" + value + "'";
  if(t === 'boolean')  return String(value);
  if(t === 'ListNode') return '__H.buildList(new int[]{' + value.join(',') + '})';
  if(t === 'TreeNode') return '__H.buildTree(new Integer[]{' +
    value.map(v => v === null ? 'null' : v).join(',') + '})';
  if(t.startsWith('List<')) return 'new ArrayList<>(Arrays.asList(' +
    value.map(v => typeof v === 'string' ? JSON.stringify(v) : v).join(',') + '))';
  return String(value);
}

function buildJavaDriver(userCode, inputText){
  const sig = javaSignature(userCode);
  if(!sig) return { driver:null, error:'Could not find a public method in your Solution class.' };

  const vals = {};
  for(const line of String(inputText).split('\n')){
    const m = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/);
    if(!m) continue;
    try { vals[m[1]] = JSON.parse(m[2].replace(/'/g, '"')); }
    catch(e){ vals[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
  }

  const decls = [];
  for(const p of sig.params){
    if(!(p.name in vals))
      return { driver:null, error:`Test input is missing a value for "${p.name}".` };
    const lit = javaLiteral(p.type, vals[p.name]);
    const isArrayInit = /^\{/.test(lit);
    decls.push(isArrayInit
      ? `    ${p.type} ${p.name} = new ${p.type}${lit};`
      : `    ${p.type} ${p.name} = ${lit};`);
  }

  const call = `new Solution().${sig.method}(${sig.params.map(p => p.name).join(', ')})`;
  const body = sig.returnType === 'void'
    ? `    ${call};\n    System.out.println("__RESULT{null}");`
    : `    ${sig.returnType} __r = ${call};\n    System.out.println("__RESULT{" + __ser(__r) + "}");`;

  return { driver: decls.join('\n') + '\n' + body, error:null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Reload `dev/java-test.html`. Expected: `ALL PASS (28)`.

- [ ] **Step 5: Commit**

```bash
git add js/java-driver.js dev/java-test.html
git commit -m "Build a Java main() from the test input box"
```

---

### Task 7: Language switch and runCode dispatch

**Files:**
- Create: `js/lang.js`
- Modify: `index.html`, `js/runner.js`, `js/controls.js`, `js/templates.js`

**Interfaces:**
- Consumes: `instrumentJava`, `buildJavaDriver`, `JAVA_PREAMBLE`,
  `JAVA_PREAMBLE_ALIASES`, `judge0Run`, `parseCards`.
- Produces:
  - `window.LANG` — `'python'` or `'java'`
  - `setLang(l)` — persists, swaps the editor mode, swaps templates
  - `async runJavaSource(userCode, inputText)` -> the same object shape `runCode()` produces
  - `async runCodeJava()` -> the Java branch of `runCode()`, updates `snaps` and calls `render()`

- [ ] **Step 1: Write the failing test**

Add to `dev/java-test.html` an end-to-end assertion that goes from raw user
source all the way to snapshots, with no hand-written `__t` calls:

```js
  const userJava = `public class Solution {
  public int numIslands(char[][] grid) {
    int rows = grid.length;
    int cols = grid[0].length;
    int count = 0;
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        if (grid[r][c] == '1') {
          count = count + 1;
          floodFill(grid, r, c, rows, cols);
        }
      }
    }
    return count;
  }
  void floodFill(char[][] g, int r, int c, int rows, int cols) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (g[r][c] != '1') return;
    g[r][c] = '2';
    floodFill(g, r+1, c, rows, cols);
    floodFill(g, r-1, c, rows, cols);
    floodFill(g, r, c+1, rows, cols);
    floodFill(g, r, c-1, rows, cols);
  }
}`;
  const e2e = await runJavaSource(userJava,
    'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]');
  ok('e2e no error', !e2e.error, String(e2e.error));
  eq('e2e result', e2e.result, 3);
  ok('e2e produced snapshots', e2e.snapshots.length > 5, `only ${e2e.snapshots.length}`);
  ok('e2e found the grid', e2e.snapshots.some(s => s.grids && s.grids.grid), 'no grid bucket anywhere');
```

- [ ] **Step 2: Run it to verify it fails**

Expected: `runJavaSource is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Create `js/lang.js`:

```js
/* ══════════════════════════════════════════════════════════════════════
   lang.js ─ Which language the editor is in, and the Java run pipeline.
   Python continues to run through runCode() in runner.js untouched.
   ══════════════════════════════════════════════════════════════════════ */

window.LANG = (window.Store && Store.get('lang')) || 'python';

/* Assemble preamble + instrumented user code + driver, run it, parse it. */
async function runJavaSource(userCode, inputText){
  const inst = instrumentJava(userCode);
  if(inst.error)
    return { snapshots:[], error:'Java parse error: ' + inst.error,
             result:null, has_result:false, call_trees:[], unsupported:[] };
  if(inst.unsupported.length)
    return { snapshots:[], error:null, result:null, has_result:false,
             call_trees:[], unsupported: inst.unsupported };

  const drv = buildJavaDriver(userCode, inputText);
  if(drv.error)
    return { snapshots:[], error:drv.error, result:null, has_result:false,
             call_trees:[], unsupported:[] };

  const source = JAVA_PREAMBLE + '\n' +
    inst.code.replace(/public\s+class\s+Solution/, 'class Solution') + '\n' +
    'public class Main {\n' + JAVA_PREAMBLE_ALIASES +
    '  public static void main(String[] args) {\n' + drv.driver + '\n  }\n}\n';

  const jr = await judge0Run(source);
  if(jr.compileOutput)
    return { snapshots:[], error:'Java compile error:\n' + jr.compileOutput,
             result:null, has_result:false, call_trees:[], unsupported:[] };
  if(jr.stderr)
    return { snapshots:[], error:jr.stderr, result:null, has_result:false,
             call_trees:[], unsupported:[] };

  const pc = parseCards(jr.stdout);
  return { snapshots:pc.snapshots, error:null, result:pc.result,
           has_result:pc.has_result, call_trees:[], unsupported:[] };
}

function setLang(l){
  window.LANG = l;
  if(window.Store) Store.set('lang', l);
  if(window._cm) window._cm.setOption('mode', l === 'java' ? 'text/x-java' : 'python');
  if(window.refreshTemplates) window.refreshTemplates();
}
```

Note the `public class Solution` to `class Solution` rewrite: Java allows only
one public top-level class per file, and `Main` holds that slot.

- [ ] **Step 4: Run the test to verify it passes**

Reload `dev/java-test.html`. Expected: `ALL PASS (32)`.

- [ ] **Step 5: Wire it into the app**

In `js/runner.js`, at the top of `runCode()`:

```js
async function runCode(){
  if(window.LANG === 'java') return runCodeJava();
  if(!pyodide) return;
  // ... existing Python body unchanged
```

And add, after `runCode`:

```js
/* Java path: same shape as runCode(), different engine. */
async function runCodeJava(){
  setStat('Compiling…', null);
  document.getElementById('errbanner').classList.remove('show');
  document.getElementById('result-panel').classList.remove('show');

  const res = await runJavaSource(window._cm.getValue(), window._tiEl.value);

  if(res.unsupported.length){
    setStat('Not traceable', 'err');
    showErr('Tracing does not support ' + res.unsupported.join(' or ') +
            ' yet. Everything else in your code is supported.');
    return;
  }
  if(res.error){ setStat('Error','err'); showErr(res.error); return; }
  if(!res.snapshots.length){ setStat('No steps','err'); return; }

  snaps        = res.snapshots;
  _finalResult = res.result;
  _hasResult   = res.has_result;
  _callTrees   = res.call_trees;
  cur  = 0;
  prev = { lists:{}, grids:{}, locals:{}, dicts:{}, sets:{}, deques:{},
           node_pointers:{}, linked_lists:{}, trees:{} };
  render();
  setStat(snaps.length + ' steps', 'ready');
  updCtrl();
}
```

- [ ] **Step 6: Add the language selector**

In `index.html`, in the header next to the example selector:

```html
<select id="lang-sel" title="Language">
  <option value="python">Python</option>
  <option value="java">Java</option>
</select>
```

In `js/controls.js`, after the CodeMirror setup:

```js
const langSel = document.getElementById('lang-sel');
langSel.value = window.LANG;
langSel.addEventListener('change', () => setLang(langSel.value));
if(window.LANG === 'java') cm.setOption('mode', 'text/x-java');
```

Add the CodeMirror clike mode to `index.html` beside the python mode:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/clike/clike.min.js"></script>
```

Bump every changed script's `?v=` number.

- [ ] **Step 7: Verify in the real app**

Start the server, open the app, switch the selector to Java, paste the
Number of Islands Java from Step 1, paste the grid input, hit RUN.
Expected: the grid renders and stepping works. Screenshot it.

- [ ] **Step 8: Commit**

```bash
git add js/lang.js js/runner.js js/controls.js index.html dev/java-test.html
git commit -m "Add language switch and wire the Java run pipeline into the app"
```

---

### Task 8: Call trees for the recursion panel

**Files:**
- Modify: `js/java-preamble.js`, `js/java-instrument.js`, `js/lang.js`
- Modify: `dev/java-test.html`

**Interfaces:**
- Consumes: everything above.
- Produces: `runJavaSource` now returns a populated `call_trees`, and each
  snapshot carries `call_depth` and `current_call_id`.

The Python tracer builds `_roots` from `call`/`return` events. Java gets the
same by injecting enter/exit calls at method boundaries.

- [ ] **Step 1: Write the failing test**

```js
  const ct = await runJavaSource(userJava,
    'grid = [["1","1","0"],["0","1","0"],["0","0","1"]]');
  ok('call_trees populated', ct.call_trees.length > 0, 'call_trees was empty');
  ok('depth varies', new Set(ct.snapshots.map(s => s.call_depth)).size > 1,
     'every snapshot had the same call_depth');
```

- [ ] **Step 2: Run it to verify it fails**

Expected: `call_trees was empty`.

- [ ] **Step 3: Add enter/exit tracking to the preamble**

In `js/java-preamble.js`, inside `__Tracer`:

```java
  static int depth = 0;
  static int nextId = 1;
  static ArrayDeque<Integer> stack = new ArrayDeque<>();

  static void enter(String fn, Object... kv){
    int id = nextId++;
    StringBuilder args = new StringBuilder();
    for(int i=0;i+1<kv.length;i+=2){
      if(args.length()>0) args.append(",");
      args.append("\\"").append(esc(String.valueOf(kv[i]))).append("\\":").append(ser(kv[i+1]));
    }
    System.out.println("__CALL{\\"id\\":" + id + ",\\"fn\\":\\"" + esc(fn) +
      "\\",\\"depth\\":" + depth + ",\\"parent\\":" +
      (stack.isEmpty() ? "null" : stack.peek()) + ",\\"args\\":{" + args + "}}");
    stack.push(id); depth++;
  }
  static void exit(Object ret){
    if(!stack.isEmpty()){
      System.out.println("__RET{\\"id\\":" + stack.pop() + ",\\"ret\\":" + ser(ret) + "}");
    }
    if(depth>0) depth--;
  }
```

Change `t()` to emit the live depth and id:

```java
    o.append(",\\"node_pointers\\":{},\\"call_depth\\":").append(depth)
     .append(",\\"current_call_id\\":").append(stack.isEmpty() ? "null" : stack.peek())
     .append(",\\"cond\\":null,\\"stmt\\":null}");
```

Add the aliases in `JAVA_PREAMBLE_ALIASES`:

```java
  static void __enter(String fn, Object... kv){ __Tracer.enter(fn, kv); }
  static void __exit(Object r){ __Tracer.exit(r); }
```

- [ ] **Step 4: Inject enter/exit at method boundaries**

In `instrumentJava`, detect method declarations and wrap. Add before the main
line loop:

```js
  // method signature lines, so we can inject __enter after the opening brace
  const methodRe = /^\s*(?:public|private|protected|static|final|\s)*[\w<>\[\],\s]+\s+(\w+)\s*\(([^)]*)\)\s*\{\s*$/;
```

and inside the loop, after `out.push(raw)`:

```js
    const mm = raw.match(methodRe);
    if(mm && mm[1] !== 'main'){
      const ps = mm[2].trim()
        ? mm[2].split(',').map(p => p.trim().split(/\s+/).pop())
        : [];
      const kv = ps.map(p => `"${p}", ${p}`).join(', ');
      out.push(`${raw.match(/^\s*/)[0]}  __enter("${mm[1]}"${kv ? ', ' + kv : ''});`);
      continue;
    }
```

Handle `return` by emitting `__exit` before it, replacing the earlier skip:

```js
    if(/^return\b/.test(t)){
      const expr = t.replace(/^return\s*/, '').replace(/;$/, '');
      out.pop();                                   // drop the raw return
      out.push(`${raw.match(/^\s*/)[0]}__exit(${expr || 'null'});`);
      out.push(raw);
      continue;
    }
```

- [ ] **Step 5: Assemble call_trees in JS**

In `js/lang.js`, extend the parse step:

```js
  const pc = parseCards(jr.stdout);
  const call_trees = buildCallTrees(jr.stdout);
  return { snapshots:pc.snapshots, error:null, result:pc.result,
           has_result:pc.has_result, call_trees, unsupported:[] };
```

Add to `js/java-runner.js`:

```js
/* Rebuild the call forest from __CALL / __RET lines, shaped like the
   Python tracer's _roots so renderers-recursion.js can draw it unchanged. */
function buildCallTrees(stdout){
  const byId = new Map(), roots = [];
  for(const line of String(stdout).split('\n')){
    if(line.startsWith('__CALL')){
      let c; try { c = JSON.parse(line.slice(6)); } catch(e){ continue; }
      const node = { id:c.id, fn:c.fn, depth:c.depth, args:c.args,
                     ret:undefined, children:[] };
      byId.set(c.id, node);
      const parent = c.parent != null ? byId.get(c.parent) : null;
      (parent ? parent.children : roots).push(node);
    } else if(line.startsWith('__RET')){
      let r; try { r = JSON.parse(line.slice(5)); } catch(e){ continue; }
      const node = byId.get(r.id);
      if(node) node.ret = r.ret;
    }
  }
  return roots;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Reload `dev/java-test.html`. Expected: `ALL PASS (34)`.

Then confirm visually: run the Java Number of Islands in the app and check the
recursion tree panel draws, matching what Python draws for the same algorithm.

- [ ] **Step 7: Commit**

```bash
git add js/java-preamble.js js/java-instrument.js js/java-runner.js js/lang.js dev/java-test.html
git commit -m "Emit Java call trees so the recursion panel renders"
```

---

### Task 9: Java templates

**Files:**
- Modify: `js/templates.js`
- Modify: `js/controls.js`

**Interfaces:**
- Consumes: `window.LANG`.
- Produces: `window.refreshTemplates()` repopulating the `#tmpl` selector for
  the active language.

- [ ] **Step 1: Write the failing test**

This one is visual, not unit-testable in isolation. The check is: switch to
Java in the app, and the template dropdown lists Java templates whose code
compiles. Verify by loading each template and hitting RUN.

- [ ] **Step 2: Add Java templates**

In `js/templates.js`, add a parallel map. Start with exactly three, each
chosen to exercise a different renderer:

```js
const TMPL_JAVA = {
  grid_islands: {
    label: 'Grid · Number of Islands',
    code: `public class Solution {
  public int numIslands(char[][] grid) {
    int rows = grid.length;
    int cols = grid[0].length;
    int count = 0;
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        if (grid[r][c] == '1') {
          count = count + 1;
          dfs(grid, r, c, rows, cols);
        }
      }
    }
    return count;
  }
  void dfs(char[][] g, int r, int c, int rows, int cols) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (g[r][c] != '1') return;
    g[r][c] = '2';
    dfs(g, r+1, c, rows, cols);
    dfs(g, r-1, c, rows, cols);
    dfs(g, r, c+1, rows, cols);
    dfs(g, r, c-1, rows, cols);
  }
}`,
    input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]'
  },
  array_twosum: {
    label: 'Array · Two Sum',
    code: `public class Solution {
  public int[] twoSum(int[] nums, int target) {
    java.util.Map<Integer,Integer> seen = new java.util.HashMap<>();
    for (int i = 0; i < nums.length; i++) {
      int need = target - nums[i];
      if (seen.containsKey(need)) {
        return new int[]{seen.get(need), i};
      }
      seen.put(nums[i], i);
    }
    return new int[]{};
  }
}`,
    input: 'nums = [2,7,11,15]\ntarget = 9'
  },
  list_reverse: {
    label: 'Linked List · Reverse',
    code: `public class Solution {
  public ListNode reverseList(ListNode head) {
    ListNode prev = null;
    ListNode cur = head;
    while (cur != null) {
      ListNode nxt = cur.next;
      cur.next = prev;
      prev = cur;
      cur = nxt;
    }
    return prev;
  }
}`,
    input: 'head = [1,2,3,4,5]'
  }
};
```

- [ ] **Step 3: Make the selector language-aware**

Verified in the existing code: `TMPL` entries are `{ code, input }` with **no
`label` field**, and the `<option>` labels are hardcoded in `index.html:99-109`.
So do not try to generate the Python options; capture them once and swap.

In `js/controls.js`, replacing the existing static wiring:

```js
/* The Python options are authored in index.html. Snapshot that markup on
   load so switching languages can restore it verbatim. */
const PY_TMPL_OPTIONS = document.getElementById('tmpl').innerHTML;

window.refreshTemplates = function(){
  const sel = document.getElementById('tmpl');
  if(window.LANG === 'java'){
    sel.innerHTML = '<option value="blank">Blank (paste your own)</option>' +
      Object.entries(TMPL_JAVA)
        .map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('');
    sel.value = 'grid_islands';
  } else {
    sel.innerHTML = PY_TMPL_OPTIONS;
    sel.value = 'binary_search';
  }
  sel.dispatchEvent(new Event('change'));
};
```

And change the existing handler at `js/controls.js:64` to read the active
language's map instead of `TMPL` directly:

```js
document.getElementById('tmpl').addEventListener('change', e=>{
  const src = window.LANG === 'java' ? TMPL_JAVA : TMPL;
  const t = src[e.target.value];
  if(!t) return;
  cm.setValue(t.code);
  tiEl.value = t.input;
  refreshP();
});
```

`TMPL_JAVA` entries therefore carry a `label` (Python's do not, and are not
given one, so the Python path stays untouched).

- [ ] **Step 4: Verify each template runs**

In the app, switch to Java, then load and RUN each of the three templates.
Expected: grid renders for islands, list plus dict for two sum, linked list
for reverse. Screenshot each.

- [ ] **Step 5: Commit**

```bash
git add js/templates.js js/controls.js
git commit -m "Add Java templates covering grid, array and linked list renderers"
```

---

### Task 10: Differential test harness against Python

**Files:**
- Create: `dev/java-diff.html`
- Create: `dev/cases.js`

**Interfaces:**
- Consumes: `runJavaSource`, plus the Python path via Pyodide.
- Produces: `window.DIFF = { run, runAll, results }` and a JSON results dump.

Python is the oracle. The same algorithm is written twice and the meaningful
output compared. Line numbers and raw step counts are deliberately excluded,
because Java's boilerplate and loop forms legitimately differ.

- [ ] **Step 1: Define the case format**

Create `dev/cases.js`:

```js
/* Each case is one algorithm expressed twice, plus the LeetCode answer. */
const DIFF_CASES = [
  {
    name: 'Number of Islands',
    slug: 'number-of-islands',
    input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
    expected: 3,
    python: `class Solution:
    def numIslands(self, grid):
        rows, cols = len(grid), len(grid[0])
        count = 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == '1':
                    count += 1
                    self.dfs(grid, r, c, rows, cols)
        return count
    def dfs(self, g, r, c, rows, cols):
        if r < 0 or r >= rows or c < 0 or c >= cols: return
        if g[r][c] != '1': return
        g[r][c] = '2'
        self.dfs(g, r+1, c, rows, cols); self.dfs(g, r-1, c, rows, cols)
        self.dfs(g, r, c+1, rows, cols); self.dfs(g, r, c-1, rows, cols)`,
    java: `public class Solution {
  public int numIslands(char[][] grid) {
    int rows = grid.length;
    int cols = grid[0].length;
    int count = 0;
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        if (grid[r][c] == '1') {
          count = count + 1;
          dfs(grid, r, c, rows, cols);
        }
      }
    }
    return count;
  }
  void dfs(char[][] g, int r, int c, int rows, int cols) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (g[r][c] != '1') return;
    g[r][c] = '2';
    dfs(g, r+1, c, rows, cols); dfs(g, r-1, c, rows, cols);
    dfs(g, r, c+1, rows, cols); dfs(g, r, c-1, rows, cols);
  }
}`
  }
];
```

- [ ] **Step 2: Write the comparison**

Create `dev/java-diff.html` with the comparison logic:

```js
/* Reduce a run to the things that must match across languages. */
function fingerprint(run){
  const structs = new Set();
  const stateSeq = [];
  for(const s of run.snapshots){
    for(const bucket of ['lists','grids','dicts','sets','deques','linked_lists','trees']){
      for(const name in (s[bucket] || {})){
        structs.add(bucket);
        const sig = bucket + ':' + name + '=' + JSON.stringify(s[bucket][name]);
        if(stateSeq[stateSeq.length-1] !== sig) stateSeq.push(sig);
      }
    }
  }
  return {
    result: run.result,
    structures: [...structs].sort(),
    hasCallTree: (run.call_trees || []).length > 0,
    stateSeq
  };
}

function compare(py, jv){
  const a = fingerprint(py), b = fingerprint(jv);
  const diffs = [];
  if(JSON.stringify(a.result) !== JSON.stringify(b.result))
    diffs.push(`result: python ${JSON.stringify(a.result)} vs java ${JSON.stringify(b.result)}`);
  if(a.structures.join() !== b.structures.join())
    diffs.push(`structures: python [${a.structures}] vs java [${b.structures}]`);
  if(a.hasCallTree !== b.hasCallTree)
    diffs.push(`call tree: python ${a.hasCallTree} vs java ${b.hasCallTree}`);
  if(a.stateSeq.join('|') !== b.stateSeq.join('|')){
    const i = a.stateSeq.findIndex((x,k) => x !== b.stateSeq[k]);
    diffs.push(`state sequence diverges at ${i}:\n    python ${a.stateSeq[i]}\n    java   ${b.stateSeq[i]}`);
  }
  return diffs;
}
```

- [ ] **Step 3: Run the first case**

Navigate to `http://localhost:8765/dev/java-diff.html`.
Expected on the first attempt: divergences. **Read each one and decide whether
Java is wrong or the comparison is too strict.** A legitimate difference is
Python storing grid cells as `"1"` strings while Java stores `char` — if both
serialize to `"1"`, they match; if not, fix the Java serializer, not the test.

- [ ] **Step 4: Commit**

```bash
git add dev/java-diff.html dev/cases.js
git commit -m "Add differential harness comparing Java against Python"
```

---

### Task 11: Scale the differential suite

**Files:**
- Modify: `dev/cases.js`
- Create: `dev/results.json` (generated)

- [ ] **Step 1: Add the coverage set, roughly 40 cases**

Chosen for renderer and language coverage, not problem count. Each entry needs
the same five fields as Task 10's case. Pull problem, input, and expected
output from the LeetCode problem page; write both solutions.

Minimum coverage required before declaring Phase 1 done:

| Renderer or feature | Example problem |
|---|---|
| 2D grid | Number of Islands, Rotting Oranges, Flood Fill |
| 1D array | Two Sum, Max Subarray, Move Zeroes |
| HashMap | Group Anagrams, Two Sum |
| HashSet | Contains Duplicate, Longest Consecutive Sequence |
| Deque / queue | Rotting Oranges, Sliding Window Maximum |
| Linked list | Reverse List, Merge Two Lists, Linked List Cycle |
| Binary tree | Max Depth, Level Order, Invert Tree |
| Recursion + memo | Climbing Stairs, House Robber, Fibonacci |
| String building | Longest Palindrome, Reverse Words |
| Sorting | Merge Intervals, Meeting Rooms |
| char arithmetic | Valid Anagram, Roman to Integer |

- [ ] **Step 2: Make the harness resumable**

The suite will not finish in one sitting. Persist after each case:

```js
async function runAll(){
  const done = JSON.parse(localStorage.getItem('diffResults') || '{}');
  for(const c of DIFF_CASES){
    if(done[c.name]) continue;
    const py = await runPythonCase(c);
    const jv = await runJavaSource(c.java, c.input);
    done[c.name] = { diffs: compare(py, jv), at: Date.now() };
    localStorage.setItem('diffResults', JSON.stringify(done));
  }
  return done;
}
```

- [ ] **Step 3: Run and triage**

Run the suite, then read only the failures. For each, determine whether Java is
wrong or the expectation is. Fix Java; never weaken an assertion to get green.

- [ ] **Step 4: Scale to volume**

Once the coverage set is fully green, extend toward the larger set, weighted
toward easy and medium. Hard problems mostly exceed `STEP_CAP` and are useful
only for confirming the app degrades gracefully, not for correctness.

- [ ] **Step 5: Commit**

```bash
git add dev/cases.js
git commit -m "Expand differential suite to full renderer coverage"
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: language
selection (7), instrumenter (4, 5), preamble (2), driver (6), Judge0 client
(1), call trees (8), unsupported detection (5 and 7), differential testing
(10, 11). The vertical slice (3) is extra, added so the work is visible early.

**Fixed during self-review:**

- Task 7's interface block named a `runJava()` that appears nowhere else; the
  real names are `runJavaSource()` and `runCodeJava()`.
- Task 9 assumed `TMPL` entries carry a `label`. Checked the source: they are
  `{ code, input }` and the dropdown labels live in `index.html:99-109`. Task 9
  now snapshots that markup instead of regenerating it.

**Known soft spots, to confirm during execution rather than assume:**

1. `localsAtLine` guesses at java-parser's CST node names (`variableDeclaratorId`,
   `basicForStatement`). The spike confirmed `variableDeclaratorId` exists; the
   scope-boundary node names are unverified. Task 4 Step 5 says to trust the
   real CST over this plan.
2. Line-based injection in Task 5 will not handle statements spanning multiple
   lines, or single-line `if (x) doThing();` bodies. Both are common in real
   LeetCode Java. If Task 5's tests expose this, the fix is to switch injection
   from line-based to CST-offset-based, which is a larger change and should be
   raised before proceeding.
3. `__exit` injection in Task 8 assumes `return` appears on its own line. Early
   `return` inside a one-line `if` will be missed, leaving the call tree
   unbalanced.
