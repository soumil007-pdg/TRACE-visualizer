# dev/

Development harnesses. Not loaded by `index.html`; opened directly with the
local server running (`.claude/launch.json`, server name `trace`).

| file | what it checks |
|---|---|
| `java-test.html` | Unit suite for the Java pipeline. Open it and read the page: `ALL PASS (n)` or the failures. |
| `feel.js` | **Step-for-step parity with Python.** Each case is one algorithm in both languages with matching `@tag` comments. At every step it compares what the user actually sees, via the renderer's own `computeDispS`: highlighted statement, variable values, structures, node pointers, call depth/id, TRUE/FALSE badge. Call trees must match node for node. |
| `torture.js` | Awkward Java (labels, do-while, `while(true)`, `for(;;)`, switch, try/catch, inner classes, lambdas, streams, anonymous classes, overflow, step cap, runtime and compile errors). Each must compile, return the right answer, and pass trace invariants. |
| `hard.js` | Ten LeetCode hard problems in Java, expected answers computed in Python first. |
| `cst-probe.html` | Dumps java-parser's real CST node names and offsets. Read node names here instead of guessing them. |

## Running

The suites are ES modules loaded into the app page, so no dev code ships in
`index.html`. From the console on `index.html`:

```js
const F = await import('/dev/feel.js'), T = await import('/dev/torture.js');
window.runPy = async c => { window.LANG = 'python';
  window._cm.setValue(c.python); window._tiEl.value = c.input; await runCode();
  return { snapshots: snaps.slice(), result: _finalResult, call_trees: (_callTrees || []).slice() }; };

for (const c of F.FEEL_CASES) {                       // parity
  const r = F.compareFeel(await runPy(c), await runJavaSource(c.java, c.input), c);
  console.log(r.problems.length ? 'DIFF' : 'SAME', c.name, r.steps, r.problems);
}
for (const c of T.TORTURE) {                          // torture + invariants
  const r = await runJavaSource(c.java, c.input);
  console.log(c.name, r.result, r.error, T.checkInvariants(r, c.java));
}
```

Run a few cases per call: each Java case is a real JVM round trip (~2s).

## Known, intended differences from Python

- **Block scoping.** Python locals live for the whole function; Java's end with
  their block. A variable declared inside a loop body is gone at the loop
  header in Java and still shown in Python. `feel.js` only accepts this when
  the Java source really declares the name in a nested block.
- **Lambda bodies are not traced.** Python steps into a sort key lambda on
  every comparison; Java leaves comparators and stream lambdas untraced, as
  they run inside library code O(n log n) times.
- **HashMap / HashSet order** is Java's hash order, not insertion order. True
  to Java; `feel.js` compares them order-insensitively.
