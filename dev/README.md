# dev/

Development harnesses. Not loaded by `index.html` and not part of the
deploy path; they are opened directly with the local server running.

| file | what it does |
|---|---|
| `java-test.html` | Unit suite for the Java pipeline. Open it and read the page: prints `ALL PASS (n)` or the failures. |
| `cases.js` | Differential test cases, each algorithm written in both languages, plus the comparison logic. An ES module, imported at runtime so no dev code ships in `index.html`. |
| `cst-probe.html` | Dumps java-parser's CST node names and line spans. Used to verify node names rather than guess them. |

## Running the differential suite

Start the server, open `index.html`, and in the console:

```js
const M = await import('/dev/cases.js');
window.runPy = async c => { window.LANG='python';
  window._cm.setValue(c.python); window._tiEl.value = c.input;
  await runCode();
  return { snapshots: snaps.slice(), result: _finalResult, call_trees: (_callTrees||[]).slice() }; };

for(const c of M.DIFF_CASES){
  const py = await runPy(c);
  const jv = await runJavaSource(c.java, c.input);
  console.log(c.name, M.compare(py, jv));
}
```

Python is the oracle: Java is correct when its meaningful output matches
Python's for the same algorithm. Line numbers and raw step counts are
deliberately not compared, since Java's boilerplate and loop forms are not
statement-for-statement equal to Python's.
