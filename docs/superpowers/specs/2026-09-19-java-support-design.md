# Java support for TRACE

Date: 2026-09-19
Status: approved for planning

## Objective

Run Java in TRACE and produce a visualization **indistinguishable in quality
from the Python one**. Same grid, same recursion tree, same stepping, same
variable history. A user who switches language should notice only that their
code is Java.

Python is the reference implementation. "Correct" is defined as "matches what
Python produces for the same algorithm", not as an abstract standard.

## Success criteria

1. A LeetCode Java solution, pasted unmodified, traces and renders.
2. For the same algorithm, Java's meaningful output matches Python's:
   same structures detected, same sequence of structure states, same result.
3. Unsupported constructs produce an honest message, never a wrong picture.
4. Python behaviour is completely unchanged.

## Why this is cheap: the existing split

The renderers are already language-neutral. `render-core.js`, `renderers.js`
and `renderers-recursion.js` contain zero references to Python or Pyodide.
They consume only this contract, emitted today by `js/tracer.js`:

```
per snapshot:
  { line, filename, locals, lists, grids, dicts, sets, deques,
    linked_lists, trees, node_pointers, _var_order,
    call_depth, current_call_id, max_call_id, cond, stmt }

per run:
  { snapshots, error, result, has_result, call_trees }
```

**The entire project is: emit that same JSON from Java.** Everything
downstream then works untouched.

Reused as-is (~2,100 lines): all renderers, `controls.js`, `pro-ui.js`,
storage, shortcuts, onboarding, the complexity UI.

## Approach: instrument + real JVM (option D)

Rejected alternatives and why:

- **Hand-written Java interpreter in JS.** ~3,000-4,500 lines and can never be
  100% correct. Would keep live mode instant, which is its only advantage.
- **CheerpJ (JVM in WASM, in-browser).** Still requires the same source
  instrumentation, and adds a 30MB payload plus a commercial licence that
  conflicts with monetisation. Strictly worse.
- **Server-side JDWP debugger.** Correct but slow (thousands of round trips)
  and requires running our own sandbox.

Chosen: rewrite the user's Java to print its own state, then execute it on a
real JVM. Correct by construction, because a real `javac` and JVM do the work;
our injected code only observes.

### Verified by spike (2026-09-19)

- Judge0 public instance executes Java 15, `language_id: 62`.
- Instrumented Number of Islands: compiled clean, ran in 71ms, returned 13
  parseable snapshot cards, correct result of 3, grid mutations captured.
- Round trip 1.45s typical.
- CORS is `access-control-allow-origin: *`, so the **browser calls Judge0
  directly**. No backend of ours, no sandbox to secure, no hosting cost.
- 20 consecutive submissions, zero throttling, ~1.45s each. 350 test problems
  is roughly 8.5 minutes of network time.
- Piston is not an option: its public API became whitelist-only 2026-02-15.

## Architecture

```
Java source ─► instrumenter ─► instrumented source ─► Judge0 (real JVM)
                                                          │
                                        stdout: __T{...} cards
                                                          ▼
                                       card parser ─► snapshots[]
                                                          ▼
                                    EXISTING renderers, untouched
```

### New components

| File | Purpose | Est. |
|---|---|---|
| `js/java-instrument.js` | Parse Java, track live locals per statement, inject `__t(line, name, value, ...)` calls and method enter/exit hooks. The core of the project. | 600-900 |
| `js/java-preamble.js` | Java source injected into every run: `ListNode`, `TreeNode`, builders, and the JSON serializer. Mirrors the Python `PREAMBLE`. | ~250 (Java) |
| `js/java-driver.js` | Test input box → a Java `main()`. Mirrors `buildDriver()` in `parser.js`. | ~300 |
| `js/java-runner.js` | Submit to Judge0, poll, parse `__T` cards into `snaps`, map `compile_output` onto the existing error banner. | ~150 |

### Modified components

- `js/controls.js:12` — CodeMirror `mode` becomes dynamic (`python` / `text/x-java`).
- `js/runner.js` — `runCode()` dispatches on the active language.
- `js/templates.js` — a Java template set alongside the Python one.
- `index.html` — load the CodeMirror `clike` mode; add the language selector.

### Language selection

A language picker in the header, defaulting to Python. The choice drives:
template list, editor syntax mode, and which engine `runCode()` calls. It
persists via the existing `Store`. Nothing else in the UI changes.

## Instrumentation detail

The instrumenter's only job is answering *"which variables are live at line
N?"* — it does not need to understand Java semantics, because the JVM handles
meaning. It needs a scope tracker, not a language implementation.

Parser: `java-parser` v3.0.1 (Chevrotain-based, Apache-2.0, the parser behind
prettier-plugin-java).

**Verified 2026-09-19.** The package is native ESM (`"type": "module"`) and
jsDelivr serves a browser build at
`https://cdn.jsdelivr.net/npm/java-parser@3.0.1/+esm` (69KB). Loaded in-browser
via a plain `<script type="module">`, it parsed a real `Solution` class and a
CST walk recovered every local declaration (`grid, rows, cols, count, r`).
The no-build-step constraint holds. No bundler required.

Cap output at `STEP_CAP = 1000`, matching Python.

## Out of scope (v1)

Detected and reported honestly, never silently mis-drawn:

- Threads and concurrency — interleaved snapshots are meaningless.
- Streams and lambdas — no line-level statements to instrument.
- Reflection, file I/O, networking.
- Generics beyond collection type parameters; inner classes; annotations.

The app must detect these before running and tell the user plainly, e.g.
"Tracing doesn't support streams yet. Your code still ran, the answer is 3."

## Testing: differential against Python

Python is the oracle. Each test case is written twice, same algorithm, and the
meaningful output is compared.

Compared:
- structures detected (a grid must be a grid, not a list)
- the sequence of distinct structure states
- presence and shape of `call_trees`
- final result

Deliberately not compared: line numbers and raw step counts. Java's
boilerplate and loop constructs legitimately differ.

Test cases come from LeetCode problem pages (problem, exact input, expected
output are all public and copy-paste compatible with the test input box).

Phasing:
1. **Coverage, ~40 problems.** Chosen to exercise every renderer and Java
   construct: 2D grids, linked lists, trees, HashMap, HashSet, ArrayDeque,
   PriorityQueue, StringBuilder, recursion, memoisation, sorting, char
   arithmetic. Finds the large majority of bugs.
2. **Volume, ~350 problems.** Weighted toward easy and medium; hard problems
   mostly exceed the step cap and test little. Runs as a resumable batch
   harness writing pass/fail to JSON. Only failures get read.
3. **Visual spot-check.** Screenshots on every failure plus a sample of passes.

Harness follows the existing `js/test.js` pattern, which has already proven it
catches wrong assumptions.

## Risks

| Risk | Mitigation |
|---|---|
| ~~`java-parser` will not load without a build step~~ | **Resolved 2026-09-19.** Loads as ESM from jsDelivr, parses Java, scope extraction confirmed in-browser. |
| Judge0 free tier throttles at scale | Measured clean at 20 consecutive. If it bites, self-host Judge0 in Docker on an always-free tier; one URL constant changes. |
| Instrumentation wrong for an edge construct | Differential test against Python; fail loudly rather than draw wrongly. |
| Live mode latency (~1.5s vs instant) | Accepted. User explicitly deprioritised live mode for Java. |

## Explicitly not changing

Python continues to run locally in Pyodide, instantly. Nothing about the
existing Python path is modified.

## Revision 2026-09-24: matching Python step for step

The first implementation injected a trace call AFTER each statement. That was
wrong in a way results-only tests could not see: render-core.js highlights
card k's line and shows card k+1's state, because Python's line event fires
BEFORE a line runs. Every Java step showed the variables one statement ahead.
It also never recorded returns, so the call tree was a single chain, and it
sent no max_call_id, so the recursion tree drew nothing.

The instrumenter now works on exact CST offsets, never lines, and inserts:

| where | what | why |
|---|---|---|
| before each statement | `__Tracer.t(line, sid, vars…)` | pre-execution state, like Python's line event |
| method body | `enter(…); try { … } finally { exit(); }` | every exit path pops the call stack |
| each return | `return __Tracer.ret(expr)` | return value reaches the call tree |
| basic `for` | card in the update clause, before `i++` | fires where Python's `for` line does; also leaves `for(;;)` constant |
| `while` / `do` | `c(…) && (cond)` | a card at every condition check |
| enhanced `for` | card at the top of each iteration | one header step per item |
| braceless bodies | `{ card; stmt }` | the TRUE branch of `if (x) y();` is visible |

After the run, lang.js derives the TRUE/FALSE badge from control flow (did the
next card in the same frame land in the then-branch / loop body) and the
statement panel from state diffs. Nothing is re-evaluated, so conditions with
calls or side effects are safe, which Python's eval-based approach is not.
Steps are then merged by Python's own rule: a frame gets a new step only when
its line changes or a loop re-enters.

Lambdas and streams are now supported: their bodies are simply left untraced.

Verification: `dev/feel.js` compares what the user sees at every step against
Python for 12 algorithms and is 12/12 identical; `dev/torture.js` 20/20;
`dev/hard.js` 10/10; unit suite 76/76. See dev/README.md for the intended
differences (block scoping, lambda bodies, hash order).
