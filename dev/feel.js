/* ══════════════════════════════════════════════════════════════════════
   feel.js ─ Step-by-step differential test: does Java LOOK like Python?

   Each case is one algorithm written in both languages, with matching
   `@tag` comments on corresponding lines. For every step, this computes
   what the user actually sees, using the renderer's own computeDispS, and
   requires the two sequences to match step for step:
     - which statement is highlighted (by tag)
     - the value of every variable both languages have in scope
     - every data structure, including node-pointer labels
     - call depth, current call id, calls started so far
     - the TRUE / FALSE badge on conditions
   and the two call trees must match node for node: function, args,
   return value, memo flag, children.

   Run from the app page (see dev/README.md).
   ══════════════════════════════════════════════════════════════════════ */

export const FEEL_CASES = [
{ name:'Number of Islands', input:'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
python:`class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        rows = len(grid)  # @rows
        cols = len(grid[0])  # @cols
        count = 0  # @count0
        for r in range(rows):  # @forR
            for c in range(cols):  # @forC
                if grid[r][c] == '1':  # @ifLand
                    count = count + 1  # @inc
                    self.dfs(grid, r, c, rows, cols)  # @call
        return count  # @ret
    def dfs(self, g, r, c, rows, cols):
        if r < 0 or r >= rows or c < 0 or c >= cols: return  # @bounds
        if g[r][c] != '1': return  # @notLand
        g[r][c] = '2'  # @mark
        self.dfs(g, r + 1, c, rows, cols)  # @d1
        self.dfs(g, r - 1, c, rows, cols)  # @d2
        self.dfs(g, r, c + 1, rows, cols)  # @d3
        self.dfs(g, r, c - 1, rows, cols)  # @d4`,
java:`public class Solution {
  public int numIslands(char[][] grid) {
    int rows = grid.length; // @rows
    int cols = grid[0].length; // @cols
    int count = 0; // @count0
    for (int r = 0; r < rows; r++) { // @forR
      for (int c = 0; c < cols; c++) { // @forC
        if (grid[r][c] == '1') { // @ifLand
          count = count + 1; // @inc
          dfs(grid, r, c, rows, cols); // @call
        }
      }
    }
    return count; // @ret
  }
  void dfs(char[][] g, int r, int c, int rows, int cols) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return; // @bounds
    if (g[r][c] != '1') return; // @notLand
    g[r][c] = '2'; // @mark
    dfs(g, r + 1, c, rows, cols); // @d1
    dfs(g, r - 1, c, rows, cols); // @d2
    dfs(g, r, c + 1, rows, cols); // @d3
    dfs(g, r, c - 1, rows, cols); // @d4
  }
}`},

{ name:'Two Sum', input:'nums = [2,7,11,15]\ntarget = 26',
python:`class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}  # @seen
        for i in range(len(nums)):  # @forI
            need = target - nums[i]  # @need
            if need in seen:  # @if
                return [seen[need], i]  # @ret
            seen[nums[i]] = i  # @put
        return []  # @none`,
java:`public class Solution {
  public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>(); // @seen
    for (int i = 0; i < nums.length; i++) { // @forI
      int need = target - nums[i]; // @need
      if (seen.containsKey(need)) { // @if
        return new int[]{ seen.get(need), i }; // @ret
      }
      seen.put(nums[i], i); // @put
    }
    return new int[]{}; // @none
  }
}`},

{ name:'Binary Search', input:'nums = [-1,0,3,5,9,12]\ntarget = 9',
python:`class Solution:
    def search(self, nums: List[int], target: int) -> int:
        left = 0  # @left
        right = len(nums) - 1  # @right
        while left <= right:  # @while
            mid = (left + right) // 2  # @mid
            if nums[mid] == target:  # @eq
                return mid  # @found
            elif nums[mid] < target:  # @lt
                left = mid + 1  # @goR
            else:
                right = mid - 1  # @goL
        return -1  # @miss`,
java:`public class Solution {
  public int search(int[] nums, int target) {
    int left = 0; // @left
    int right = nums.length - 1; // @right
    while (left <= right) { // @while
      int mid = (left + right) / 2; // @mid
      if (nums[mid] == target) { // @eq
        return mid; // @found
      } else if (nums[mid] < target) { // @lt
        left = mid + 1; // @goR
      } else {
        right = mid - 1; // @goL
      }
    }
    return -1; // @miss
  }
}`},

{ name:'Reverse Linked List', input:'head = [1,2,3,4,5]',
python:`class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None  # @prev
        cur = head  # @cur
        while cur is not None:  # @while
            nxt = cur.next  # @nxt
            cur.next = prev  # @link
            prev = cur  # @adv1
            cur = nxt  # @adv2
        return prev  # @ret`,
java:`public class Solution {
  public ListNode reverseList(ListNode head) {
    ListNode prev = null; // @prev
    ListNode cur = head; // @cur
    while (cur != null) { // @while
      ListNode nxt = cur.next; // @nxt
      cur.next = prev; // @link
      prev = cur; // @adv1
      cur = nxt; // @adv2
    }
    return prev; // @ret
  }
}`},

{ name:'Maximum Depth of Binary Tree', input:'root = [3,9,20,null,null,15,7]',
python:`class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if root is None:  # @base
            return 0  # @ret0
        left = self.maxDepth(root.left)  # @left
        right = self.maxDepth(root.right)  # @right
        return max(left, right) + 1  # @ret`,
java:`public class Solution {
  public int maxDepth(TreeNode root) {
    if (root == null) { // @base
      return 0; // @ret0
    }
    int left = maxDepth(root.left); // @left
    int right = maxDepth(root.right); // @right
    return Math.max(left, right) + 1; // @ret
  }
}`},

{ name:'Fibonacci', input:'n = 5',
python:`class Solution:
    def fib(self, n: int) -> int:
        if n < 2:  # @base
            return n  # @retN
        a = self.fib(n - 1)  # @a
        b = self.fib(n - 2)  # @b
        return a + b  # @ret`,
java:`public class Solution {
  public int fib(int n) {
    if (n < 2) { // @base
      return n; // @retN
    }
    int a = fib(n - 1); // @a
    int b = fib(n - 2); // @b
    return a + b; // @ret
  }
}`},

{ name:'Valid Parentheses', input:'s = "([])"',
python:`class Solution:
    def isValid(self, s: str) -> bool:
        stack = []  # @stack
        for i in range(len(s)):  # @forI
            ch = s[i]  # @ch
            if ch == '(':  # @open
                stack.append(')')  # @push
            elif ch == '[':  # @open2
                stack.append(']')  # @push2
            elif len(stack) == 0 or stack[-1] != ch:  # @bad
                return False  # @fail
            else:
                stack.pop()  # @pop
        return len(stack) == 0  # @ret`,
java:`public class Solution {
  public boolean isValid(String s) {
    List<Character> stack = new ArrayList<>(); // @stack
    for (int i = 0; i < s.length(); i++) { // @forI
      char ch = s.charAt(i); // @ch
      if (ch == '(') { // @open
        stack.add(')'); // @push
      } else if (ch == '[') { // @open2
        stack.add(']'); // @push2
      } else if (stack.size() == 0 || stack.get(stack.size() - 1) != ch) { // @bad
        return false; // @fail
      } else {
        stack.remove(stack.size() - 1); // @pop
      }
    }
    return stack.size() == 0; // @ret
  }
}`},

{ name:'Climbing Stairs (DP)', input:'n = 5',
python:`class Solution:
    def climbStairs(self, n: int) -> int:
        dp = [0] * (n + 1)  # @dp
        dp[0] = 1  # @d0
        dp[1] = 1  # @d1
        for i in range(2, n + 1):  # @forI
            dp[i] = dp[i - 1] + dp[i - 2]  # @step
        return dp[n]  # @ret`,
java:`public class Solution {
  public int climbStairs(int n) {
    int[] dp = new int[n + 1]; // @dp
    dp[0] = 1; // @d0
    dp[1] = 1; // @d1
    for (int i = 2; i <= n; i++) { // @forI
      dp[i] = dp[i - 1] + dp[i - 2]; // @step
    }
    return dp[n]; // @ret
  }
}`},

{ name:'Contains Duplicate', input:'nums = [3,1,4,1]',
python:`class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        seen = set()  # @seen
        for i in range(len(nums)):  # @forI
            if nums[i] in seen:  # @if
                return True  # @yes
            seen.add(nums[i])  # @add
        return False  # @no`,
java:`public class Solution {
  public boolean containsDuplicate(int[] nums) {
    Set<Integer> seen = new HashSet<>(); // @seen
    for (int i = 0; i < nums.length; i++) { // @forI
      if (seen.contains(nums[i])) { // @if
        return true; // @yes
      }
      seen.add(nums[i]); // @add
    }
    return false; // @no
  }
}`},

{ name:'Merge Intervals (lambda comparator)', input:'intervals = [[8,10],[1,3],[2,6],[15,18]]',
python:`class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        intervals.sort(key=lambda x: x[0])  # @sort
        res = []  # @res
        for i in range(len(intervals)):  # @forI
            cur = intervals[i]  # @cur
            if len(res) == 0 or res[-1][1] < cur[0]:  # @gap
                res.append([cur[0], cur[1]])  # @add
            else:
                res[-1][1] = max(res[-1][1], cur[1])  # @extend
        return res  # @ret`,
java:`public class Solution {
  public int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> a[0] - b[0]); // @sort
    List<int[]> res = new ArrayList<>(); // @res
    for (int i = 0; i < intervals.length; i++) { // @forI
      int[] cur = intervals[i]; // @cur
      if (res.size() == 0 || res.get(res.size() - 1)[1] < cur[0]) { // @gap
        res.add(new int[]{ cur[0], cur[1] }); // @add
      } else {
        res.get(res.size() - 1)[1] = Math.max(res.get(res.size() - 1)[1], cur[1]); // @extend
      }
    }
    return res.toArray(new int[0][]); // @ret
  }
}`},

{ name:'Level Order Traversal (BFS)', input:'root = [3,9,20,null,null,15,7]',
python:`class Solution:
    def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        res = []  # @res
        q = deque([root])  # @q
        while len(q) > 0:  # @while
            size = len(q)  # @size
            level = []  # @level
            for k in range(size):  # @forK
                node = q.popleft()  # @pop
                level.append(node.val)  # @val
                if node.left is not None:  # @hasL
                    q.append(node.left)  # @pushL
                if node.right is not None:  # @hasR
                    q.append(node.right)  # @pushR
            res.append(level)  # @add
        return res  # @ret`,
java:`public class Solution {
  public List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> res = new ArrayList<>(); // @res
    Deque<TreeNode> q = new ArrayDeque<>(List.of(root)); // @q
    while (q.size() > 0) { // @while
      int size = q.size(); // @size
      List<Integer> level = new ArrayList<>(); // @level
      for (int k = 0; k < size; k++) { // @forK
        TreeNode node = q.pollFirst(); // @pop
        level.add(node.val); // @val
        if (node.left != null) { // @hasL
          q.addLast(node.left); // @pushL
        }
        if (node.right != null) { // @hasR
          q.addLast(node.right); // @pushR
        }
      }
      res.add(level); // @add
    }
    return res; // @ret
  }
}`},

{ name:'Kth Largest (heap)', input:'nums = [3,2,1,5,6,4]\nk = 2',
python:`class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        heap = []  # @heap
        for i in range(len(nums)):  # @forI
            heapq.heappush(heap, nums[i])  # @push
            if len(heap) > k:  # @over
                heapq.heappop(heap)  # @pop
        return heap[0]  # @ret`,
java:`public class Solution {
  public int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>(); // @heap
    for (int i = 0; i < nums.length; i++) { // @forI
      heap.offer(nums[i]); // @push
      if (heap.size() > k) { // @over
        heap.poll(); // @pop
      }
    }
    return heap.peek(); // @ret
  }
}`}
];

/* ── What the user sees at each step ─────────────────────────────────── */

function tagsOf(src, lang){
  const re = lang === 'java' ? /\/\/\s*@(\w+)/ : /#\s*@(\w+)/;
  const t = {};
  String(src).split('\n').forEach((l, i) => { const m = l.match(re); if(m) t[i + 1] = m[1]; });
  return t;
}

function treeVals(n){ return n ? { v: n.val, l: treeVals(n.left), r: treeVals(n.right) } : null; }
function sortKeys(o){ const r = {}; for(const k of Object.keys(o).sort()) r[k] = o[k]; return r; }

/* Identity differs between runtimes, so a pointer is recorded as
   "which structure, which position": cur -> head#2. */
function pointerView(d){
  const where = {};
  for(const [n, ll] of Object.entries(d.linked_lists || {}))
    (ll.nodes || []).forEach((nd, i) => { where[nd.id] = n + '#' + i; });
  for(const [n, t] of Object.entries(d.trees || {})){
    let i = 0;
    (function walk(x){ if(!x) return; where[x.id] = n + '#' + (i++); walk(x.left); walk(x.right); })(t);
  }
  const out = {};
  for(const [n, id] of Object.entries(d.node_pointers || {})) out[n] = where[id] || '?';
  return sortKeys(out);
}

function structView(d){
  const v = {};
  for(const b of ['lists','grids','dicts','sets','deques']){
    for(const [n, x] of Object.entries(d[b] || {})){
      let y = x;
      if(b === 'dicts' && x && typeof x === 'object') y = sortKeys(x);   // HashMap order is not insertion order
      if(b === 'sets' && Array.isArray(x)) y = [...x].sort((a, c) => String(a) < String(c) ? -1 : 1);
      v[b + ':' + n] = y;
    }
  }
  for(const [n, ll] of Object.entries(d.linked_lists || {}))
    v['ll:' + n] = { vals: (ll.nodes || []).map(x => x.val), cyc: ll.cycle_to };
  for(const [n, t] of Object.entries(d.trees || {})) v['tree:' + n] = treeVals(t);
  return v;
}

/* Python traces the class statement itself: a step on `class Solution:`
   and a call-tree node for the class body. Those are interpreter
   mechanics, not algorithm steps, and Java correctly has neither. */
function isDefLine(src, line){
  const l = (String(src).split('\n')[line - 1] || '').trim();
  return /^(class|def)\b/.test(l);
}

export function views(trace, src, lang, ids){
  ids = ids || { call: x => x, max: x => x };
  const tags = tagsOf(src, lang);
  const saved = snaps;
  snaps = trace.snapshots;
  const out = [];
  try {
    for(let i = 0; i < snaps.length; i++){
      const s = snaps[i];
      if(s.filename === '<driver>') continue;
      if(lang === 'python' && !tags[s.line] && isDefLine(src, s.line)) continue;
      const d = computeDispS(i);
      out.push({
        i, tag: tags[s.line] || ('L' + s.line), line: s.line,
        locals: d.locals || {}, structs: structView(d), ptrs: pointerView(d),
        depth: s.call_depth, callId: ids.call(s.current_call_id), maxCall: ids.max(s.max_call_id),
        cond: s.cond && s.cond.result !== null && s.cond.result !== undefined ? s.cond.result : undefined
      });
    }
  } finally { snaps = saved; }
  return out;
}

/* ── Call trees ───────────────────────────────────────────────────────── */

function normRepr(r){
  if(r === null || r === undefined) return null;
  let s = String(r);
  s = s.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
  s = s.replace(/'([^',]{2,})'/g, '"$1"');
  s = s.replace(/^'([^']*\u2026)$/, '"$1');       // truncated string label           // Python 'abc'  vs  Java "abc"
  return s;
}

function treeShape(nodes){
  return (nodes || []).map(n => ({
    f: n.func,
    a: sortKeys(Object.fromEntries(Object.entries(n.args || {}).map(([k, v]) => [k, normRepr(v)]))),
    r: normRepr(n.return_val), done: !!n.returned, memo: !!n.is_memo,
    c: treeShape(n.children)
  }));
}

/* ── The comparison ───────────────────────────────────────────────────── */

/* Frames Python traces that Java deliberately does not: the class body
   (interpreter mechanics) and lambdas. Java leaves lambda bodies untraced,
   the way a sort comparator runs inside Arrays.sort O(n log n) times and
   is not part of the algorithm being studied. Those frames are removed from
   the Python side, and call ids are renumbered over what remains, so the
   comparison is of the algorithm's own steps. The difference is reported. */
function withoutInternalFrames(trace, classNames){
  const excluded = new Set(), kept = [];
  (function walk(nodes, skip){
    for(const n of nodes || []){
      const x = skip || classNames.has(n.func) || n.func === '<lambda>';
      if(x) excluded.add(n.id); else kept.push(n.id);
      walk(n.children, x);
    }
  })(trace.call_trees, false);
  kept.sort((a, b) => a - b);
  const rank = new Map(kept.map((id, i) => [id, i + 1]));
  const prune = nodes => (nodes || []).filter(n => !excluded.has(n.id))
                                       .map(n => Object.assign({}, n, { children: prune(n.children) }));
  /* tracer.js gives a lambda no call-tree frame, so its line events arrive
     attributed to the enclosing method, on the lambda's own line. Keep the
     first card of each run on a lambda line (the statement itself) and drop
     the rest (the calls into the lambda). */
  const lambdaLine = ln => /\blambda\b/.test(String(trace.__src || '').split('\n')[ln - 1] || '');
  const kept2 = [];
  for(const sn of trace.snapshots){
    if(excluded.has(sn.current_call_id)) continue;
    const prev = kept2[kept2.length - 1];
    if(prev && prev.line === sn.line && lambdaLine(sn.line)) { excluded.lambdaRun = (excluded.lambdaRun || 0) + 1; continue; }
    kept2.push(sn);
  }
  return {
    trace: Object.assign({}, trace, {
      snapshots: kept2,
      call_trees: prune(trace.call_trees)
    }),
    ids: { call: x => (x == null ? x : (rank.get(x) ?? x)),
           max:  x => kept.filter(id => id <= x).length },
    lambdaSteps: (excluded.lambdaRun || 0)
  };
}

/* Is `name` declared inside a nested block (loop body, if body, for-init)
   in the Java source? Only then is it legitimately invisible in Java where
   Python still has it: Python locals live for the whole function, Java
   locals end with their block. A name declared at method level that goes
   missing in Java is a real failure, not scoping. */
function javaBlockScoped(src, name){
  const s = String(src);
  const decl = new RegExp('(\\bfor\\s*\\(\\s*(?:final\\s+)?[\\w<>\\[\\],.\\s]+?\\s+' + name + '\\b)|' +
                          '([\\w>\\]]\\s+' + name + '\\s*(=|;|:))', 'g');
  let m;
  while((m = decl.exec(s)) !== null){
    if(m[1]) return true;                                   // for-init / enhanced-for variable
    let depth = 0;
    for(let i = 0; i < m.index; i++){ if(s[i] === '{') depth++; else if(s[i] === '}') depth--; }
    if(depth > 2) return true;                              // class { method { block { … } } }
  }
  return false;
}

export function compareFeel(pyTrace, jvTrace, c){
  const classNames = new Set([...String(c.python).matchAll(/^class\s+(\w+)/gm)].map(m => m[1]));
  const clean = withoutInternalFrames(Object.assign({ __src: c.python }, pyTrace), classNames);
  const P = views(clean.trace, c.python, 'python', clean.ids);
  const J = views(jvTrace, c.java, 'java');
  const problems = [], notes = new Set();

  const n = Math.max(P.length, J.length);
  for(let k = 0; k < n && problems.length < 4; k++){
    const p = P[k], j = J[k];
    if(!p || !j){
      problems.push(`step ${k}: ${p ? 'python has' : 'java has'} an extra step ` +
                    `(${(p || j).tag}); python ${P.length} steps, java ${J.length}`);
      break;
    }
    const at = `step ${k} [py ${p.tag} / java ${j.tag}]`;
    if(p.tag !== j.tag){ problems.push(`${at}: highlighted statement differs`); break; }

    for(const name of Object.keys(p.locals)){
      if(!(name in j.locals)){
        if(javaBlockScoped(c.java, name)) notes.add(`python-only variable ${name}: block-scoped in Java`);
        else problems.push(`${at}: ${name} is missing in java but declared at method level`);
        continue;
      }
      if(JSON.stringify(p.locals[name]) !== JSON.stringify(j.locals[name]))
        problems.push(`${at}: ${name} = ${JSON.stringify(p.locals[name])} in python, ${JSON.stringify(j.locals[name])} in java`);
    }
    for(const name of Object.keys(j.locals))
      if(!(name in p.locals)) problems.push(`${at}: java shows ${name}, python does not`);

    const ks = new Set([...Object.keys(p.structs), ...Object.keys(j.structs)]);
    for(const key of ks){
      const a = JSON.stringify(p.structs[key]), b = JSON.stringify(j.structs[key]);
      if(a === b) continue;
      const name = key.slice(key.indexOf(':') + 1);
      if(j.structs[key] === undefined && javaBlockScoped(c.java, name)){
        notes.add(`python-only structure ${name}: block-scoped in Java`);
        continue;
      }
      problems.push(`${at}: ${key}\n      python ${a}\n      java   ${b}`);
    }
    const both = n => (n in p.locals) && (n in j.locals);
    const pp = JSON.stringify(Object.fromEntries(Object.entries(p.ptrs).filter(([n]) => both(n))));
    const jp = JSON.stringify(Object.fromEntries(Object.entries(j.ptrs).filter(([n]) => both(n))));
    if(pp !== jp)
      problems.push(`${at}: node pointers python ${JSON.stringify(p.ptrs)} java ${JSON.stringify(j.ptrs)}`);
    if(p.depth !== j.depth || p.callId !== j.callId || p.maxCall !== j.maxCall)
      problems.push(`${at}: call state python depth ${p.depth} id ${p.callId} max ${p.maxCall}, ` +
                    `java depth ${j.depth} id ${j.callId} max ${j.maxCall}`);
    if(p.cond !== undefined && j.cond !== undefined && p.cond !== j.cond)
      problems.push(`${at}: condition python ${p.cond}, java ${j.cond}`);
  }

  const pt = JSON.stringify(treeShape(clean.trace.call_trees)), jt = JSON.stringify(treeShape(jvTrace.call_trees));
  if(pt !== jt){
    let i = 0; while(i < pt.length && pt[i] === jt[i]) i++;
    problems.push(`call tree differs near: python …${pt.slice(Math.max(0, i - 60), i + 60)}…\n` +
                  `                        java   …${jt.slice(Math.max(0, i - 60), i + 60)}…`);
  }
  const lambdaSteps = clean.lambdaSteps;
  if(lambdaSteps > 0) notes.add(`python also steps into lambda bodies (${lambdaSteps} steps); java does not`);
  return { steps: [P.length, J.length], problems, notes: [...notes] };
}
