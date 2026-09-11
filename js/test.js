/* ══════════════════════════════════════════════════════════════════════
   test.js — stress harness for the visualizer.

   Inert until you call it. Open the app, open the console:

     TEST.list()      — show every scenario
     TEST.load(3)     — load #3 into the editor (don't run) and eyeball it
     TEST.run(3)      — load, run, assert, report
     TEST.runAll()    — run everything, print a pass/fail table
     TEST.combo('heap','trie')  — only scenarios mixing those structures

   A scenario passes when: Python didn't error, steps were captured, and
   every expected panel actually drew in #vc at some point during the run.

   Add a case = append one object to SCENARIOS. Nothing else changes.
   ══════════════════════════════════════════════════════════════════════ */
(function(){

/* Test input containing "Solution()" is used verbatim as the driver
   (see buildDriver in parser.js) — that's how these drive multi-class code. */
const SCENARIOS = [
{
  name: 'LRU Cache (dict + doubly-linked list)',
  structures: ['dict','linkedlist'],
  expect: { panels:['Dict','Variables'], minSteps:40, result:[null,null,1,null,-1,3] },
  code: `class Node:
    def __init__(self, k=0, v=0):
        self.key = k
        self.val = v
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, cap):
        self.cap = cap
        self.cache = {}
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _insert(self, node):
        node.prev = self.head
        node.next = self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key):
        if key in self.cache:
            node = self.cache[key]
            self._remove(node)
            self._insert(node)
            return node.val
        return -1

    def put(self, key, value):
        if key in self.cache:
            self._remove(self.cache[key])
        node = Node(key, value)
        self._insert(node)
        self.cache[key] = node
        if len(self.cache) > self.cap:
            lru = self.tail.prev
            self._remove(lru)
            del self.cache[lru.key]

class Solution:
    def run(self, ops):
        c = LRUCache(2)
        out = []
        for op in ops:
            if op[0] == 'put':
                c.put(op[1], op[2])
                out.append(None)
            else:
                out.append(c.get(op[1]))
        return out`,
  input: `obj = Solution()
_result = obj.run([['put',1,1],['put',2,2],['get',1],['put',3,3],['get',2],['get',3]])`
},
{
  name: 'Topological sort -> DP longest path (graph + queue + dp)',
  structures: ['graph','queue','dp'],
  expect: { panels:['Queue','List','Variables'], minSteps:40, result:4 },  // 0->1->3->4->5 = 4 edges
  code: `from collections import deque, defaultdict

def build_graph(n, edges):
    adj = defaultdict(list)
    indeg = [0] * n
    for a, b in edges:
        adj[a].append(b)
        indeg[b] += 1
    return adj, indeg

def topo_order(n, adj, indeg):
    q = deque([i for i in range(n) if indeg[i] == 0])
    order = []
    while q:
        node = q.popleft()
        order.append(node)
        for nxt in adj[node]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                q.append(nxt)
    return order

def longest_path(n, adj, order):
    dp = [0] * n
    for node in order:
        for nxt in adj[node]:
            if dp[node] + 1 > dp[nxt]:
                dp[nxt] = dp[node] + 1
    return max(dp)

class Solution:
    def solve(self, n, edges):
        adj, indeg = build_graph(n, edges)
        order = topo_order(n, adj, indeg)
        if len(order) < n:
            return -1
        return longest_path(n, adj, order)`,
  input: `obj = Solution()
_result = obj.solve(6, [[0,1],[0,2],[1,3],[2,3],[3,4],[4,5]])`
},
{
  name: 'Dijkstra + path rebuild (heap + adjacency + parent map)',
  structures: ['heap','graph','list'],
  expect: { panels:['Heap','List','Variables'], minSteps:50, result:[7,[0,2,1,3,4]] },
  code: `import heapq
from collections import defaultdict

def build_adj(edges):
    adj = defaultdict(list)
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    return adj

def dijkstra(adj, n, src):
    dist = [float('inf')] * n
    dist[src] = 0
    parent = [-1] * n
    heap = [(0, src)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                parent[v] = u
                heapq.heappush(heap, (nd, v))
    return dist, parent

def rebuild(parent, target):
    path = []
    node = target
    while node != -1:
        path.append(node)
        node = parent[node]
    path.reverse()
    return path

class Solution:
    def solve(self, n, edges, src, dst):
        adj = build_adj(edges)
        dist, parent = dijkstra(adj, n, src)
        return [dist[dst], rebuild(parent, dst)]`,
  input: `obj = Solution()
_result = obj.solve(5, [[0,1,4],[0,2,1],[2,1,2],[1,3,1],[2,3,5],[3,4,3]], 0, 4)`
},
{
  name: 'Word Search II (trie + grid + backtracking)',
  structures: ['trie','grid','recursion','set'],
  expect: { panels:['Grid','Variables'], minSteps:60, result:['oath'] },  // no 'a' adjacent to 'e' on this board
  code: `def build_trie(words):
    root = {}
    for w in words:
        node = root
        for ch in w:
            node = node.setdefault(ch, {})
        node['$'] = w
    return root

def dfs(board, r, c, node, found):
    ch = board[r][c]
    if ch not in node:
        return
    nxt = node[ch]
    word = nxt.get('$')
    if word and word not in found:
        found.append(word)
    board[r][c] = '#'
    for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < len(board) and 0 <= nc < len(board[0]):
            if board[nr][nc] != '#':
                dfs(board, nr, nc, nxt, found)
    board[r][c] = ch

class Solution:
    def solve(self, board, words):
        root = build_trie(words)
        found = []
        for r in range(len(board)):
            for c in range(len(board[0])):
                dfs(board, r, c, root, found)
        return sorted(found)`,
  input: `obj = Solution()
_result = obj.solve([['o','a','a'],['e','t','a'],['i','h','k']], ["oath","eat"])`
},
{
  name: 'Meeting Rooms II (sort intervals + heap sweep)',
  structures: ['heap','intervals'],
  expect: { panels:['Heap','Variables'], minSteps:25, result:3 },
  code: `import heapq

def normalize(intervals):
    return sorted(intervals, key=lambda x: x[0])

def min_rooms(intervals):
    heap = []
    best = 0
    for start, end in intervals:
        while heap and heap[0] <= start:
            heapq.heappop(heap)
        heapq.heappush(heap, end)
        if len(heap) > best:
            best = len(heap)
    return best

class Solution:
    def solve(self, intervals):
        ordered = normalize(intervals)
        return min_rooms(ordered)`,
  input: `obj = Solution()
_result = obj.solve([[0,30],[5,10],[15,20],[10,25],[2,8]])`
},
{
  name: 'Tree build -> validate BST -> LCA (tree + queue + recursion)',
  structures: ['tree','queue','recursion'],
  expect: { panels:['Tree','Variables'], minSteps:50, result:[true,6] },
  code: `from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def build(vals):
    if not vals:
        return None
    root = TreeNode(vals[0])
    q = deque([root])
    i = 1
    while q and i < len(vals):
        node = q.popleft()
        if i < len(vals) and vals[i] is not None:
            node.left = TreeNode(vals[i])
            q.append(node.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            node.right = TreeNode(vals[i])
            q.append(node.right)
        i += 1
    return root

def is_bst(node, lo, hi):
    if not node:
        return True
    if not (lo < node.val < hi):
        return False
    return is_bst(node.left, lo, node.val) and is_bst(node.right, node.val, hi)

def lca(node, p, q):
    if not node:
        return None
    if node.val > p and node.val > q:
        return lca(node.left, p, q)
    if node.val < p and node.val < q:
        return lca(node.right, p, q)
    return node

class Solution:
    def solve(self, vals, p, q):
        root = build(vals)
        valid = is_bst(root, float('-inf'), float('inf'))
        anc = lca(root, p, q)
        return [valid, anc.val if anc else None]`,
  input: `obj = Solution()
_result = obj.solve([6,2,8,0,4,7,9,None,None,3,5], 2, 8)`
},
{
  name: 'Sliding window max + running median (deque + two heaps)',
  structures: ['deque','heap','list'],
  expect: { panels:['Heap','List','Variables'], minSteps:60, result:[[3,3,5,5,6,7],[1.0,2.0,1.0,0.0,1.0,2.0,3.0,3.0]] },
  code: `import heapq
from collections import deque

def window_max(nums, k):
    dq = deque()
    out = []
    for i, n in enumerate(nums):
        while dq and nums[dq[-1]] <= n:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()
        if i >= k - 1:
            out.append(nums[dq[0]])
    return out

def running_median(nums):
    lo = []
    hi = []
    meds = []
    for n in nums:
        heapq.heappush(lo, -n)
        heapq.heappush(hi, -heapq.heappop(lo))
        if len(hi) > len(lo):
            heapq.heappush(lo, -heapq.heappop(hi))
        if len(lo) > len(hi):
            meds.append(float(-lo[0]))
        else:
            meds.append((-lo[0] + hi[0]) / 2.0)
    return meds

class Solution:
    def solve(self, nums, k):
        return [window_max(nums, k), running_median(nums)]`,
  input: `obj = Solution()
_result = obj.solve([1,3,-1,-3,5,3,6,7], 3)`
},
{
  name: 'Kruskal MST (union-find + sorted edges)',
  structures: ['unionfind','list'],
  expect: { panels:['List','Variables'], minSteps:40, result:[6,[[0,1,1],[1,3,2],[1,2,3]]] },
  code: `def find(parent, x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x

def union(parent, rank, a, b):
    ra = find(parent, a)
    rb = find(parent, b)
    if ra == rb:
        return False
    if rank[ra] < rank[rb]:
        ra, rb = rb, ra
    parent[rb] = ra
    if rank[ra] == rank[rb]:
        rank[ra] += 1
    return True

def kruskal(n, edges):
    parent = list(range(n))
    rank = [0] * n
    total = 0
    used = []
    for w, u, v in sorted(edges):
        if union(parent, rank, u, v):
            total += w
            used.append([u, v, w])
    return total, used

class Solution:
    def solve(self, n, edges):
        total, used = kruskal(n, edges)
        return [total, used]`,
  input: `obj = Solution()
_result = obj.solve(4, [[1,0,1],[4,0,2],[3,1,2],[2,1,3],[5,2,3]])`
},
{
  name: 'Two-class sim: Inventory(dict+heap) + OrderBook(lists)',
  structures: ['dict','heap','list'],
  expect: { panels:['Dict','Variables'], minSteps:40, result:[2,2,2] },
  code: `import heapq

class Inventory:
    def __init__(self):
        self.stock = {}
        self.restock = []

    def add(self, sku, qty):
        self.stock[sku] = self.stock.get(sku, 0) + qty

    def take(self, sku, qty):
        have = self.stock.get(sku, 0)
        if have < qty:
            heapq.heappush(self.restock, (have, sku))
            return False
        self.stock[sku] = have - qty
        return True

class OrderBook:
    def __init__(self):
        self.filled = []
        self.rejected = []

    def record(self, order, ok):
        if ok:
            self.filled.append(order)
        else:
            self.rejected.append(order)

class Solution:
    def solve(self, seed, orders):
        inv = Inventory()
        book = OrderBook()
        for sku, qty in seed:
            inv.add(sku, qty)
        for sku, qty in orders:
            ok = inv.take(sku, qty)
            book.record([sku, qty], ok)
        return [len(book.filled), len(book.rejected), len(inv.restock)]`,
  input: `obj = Solution()
_result = obj.solve([['a',5],['b',2]], [['a',3],['b',3],['a',2],['c',1]])`
},
{
  name: 'Memoized edit distance (recursion + memo dict)',
  structures: ['recursion','dict','dp'],
  expect: { panels:['Dict','Variables'], minSteps:60, result:3 },
  code: `def edit(a, b, i, j, memo):
    if i == 0:
        return j
    if j == 0:
        return i
    key = (i, j)
    if key in memo:
        return memo[key]
    if a[i-1] == b[j-1]:
        memo[key] = edit(a, b, i-1, j-1, memo)
    else:
        ins = edit(a, b, i, j-1, memo)
        dele = edit(a, b, i-1, j, memo)
        sub = edit(a, b, i-1, j-1, memo)
        memo[key] = 1 + min(ins, dele, sub)
    return memo[key]

class Solution:
    def solve(self, a, b):
        memo = {}
        return edit(a, b, len(a), len(b), memo)`,
  input: `obj = Solution()
_result = obj.solve("horse", "ros")`
}
];

/* ── helpers ─────────────────────────────────────────────────────────── */

const STEP_CAP = 1000;   // tracer's own ceiling; a run at the cap is truncated

// Panel titles currently drawn in #vc, e.g. "Heap", "Tree", "Variables".
function panelsNow(){
  const out = new Set();
  document.querySelectorAll('#vc .vb h3').forEach(h => {
    const t = h.textContent.replace(/ /g, ' ').trim().split(/\s{2,}|\s\[/)[0].trim();
    if (t) out.add(t);
  });
  if (document.querySelector('#vc .svgt-panel')) out.add('Recursion');
  if (document.querySelector('#vc .csl-panel'))  out.add('Call Stack');
  return out;
}

function ready(){
  return typeof pyodide !== 'undefined' && pyodide &&
         document.getElementById('status').classList.contains('ready');
}

function waitReady(timeoutMs = 90000){
  const t0 = Date.now();
  return new Promise((res, rej) => {
    (function poll(){
      if (ready()) return res();
      if (Date.now() - t0 > timeoutMs) return rej(new Error('Pyodide never became ready'));
      setTimeout(poll, 250);
    })();
  });
}

function finalResult(){
  try { if (typeof _finalResult !== 'undefined') return _finalResult; } catch(e){}
  return null;
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── core ────────────────────────────────────────────────────────────── */

function load(i){
  const s = SCENARIOS[i];
  if (!s) { console.error(`No scenario ${i}. TEST.list() to see them.`); return; }
  window._cm.setValue(s.code);
  window._tiEl.value = s.input;
  window._cm.refresh();
  console.log(`Loaded #${i} — ${s.name}\nHit RUN, or TEST.run(${i}) to assert it.`);
  return s.name;
}

async function run(i){
  const s = SCENARIOS[i];
  if (!s) { console.error(`No scenario ${i}`); return; }
  await waitReady();

  // catch anything a renderer throws while we step through
  const errors = [];
  const prevOnErr = window.onerror;
  window.onerror = (m) => { errors.push(String(m)); return false; };

  window._cm.setValue(s.code);
  window._tiEl.value = s.input;
  await runCode();

  const crashed = document.getElementById('errbanner').classList.contains('show');
  const steps   = snaps.length;
  const seen    = new Set();

  // walk every step so a panel that only appears mid-run still counts
  for (let j = 0; j < steps; j++){
    cur = j;
    try { render(); } catch (e) { errors.push(`render(step ${j}): ${e.message}`); }
    panelsNow().forEach(p => seen.add(p));
  }
  if (steps){ cur = steps - 1; try { render(); } catch(e){} }

  window.onerror = prevOnErr;

  const want    = s.expect.panels || [];
  const missing = want.filter(p => !seen.has(p));
  const truncated = steps >= STEP_CAP;
  const got = finalResult();

  const fails = [];
  if (crashed) fails.push('python/tracer error');
  if (steps < (s.expect.minSteps || 1)) fails.push(`only ${steps} steps (want >=${s.expect.minSteps})`);
  if (missing.length) fails.push(`no panel: ${missing.join(', ')}`);
  if (errors.length) fails.push(`${errors.length} render error(s)`);
  if (s.expect.result !== undefined && !truncated && !eq(got, s.expect.result))
    fails.push(`result ${JSON.stringify(got)} != ${JSON.stringify(s.expect.result)}`);

  const rep = {
    '#': i,
    name: s.name,
    status: fails.length ? 'FAIL' : (truncated ? 'PASS*' : 'PASS'),
    steps,
    panels: [...seen].join(', '),
    problem: fails.join(' | ') || ''
  };
  if (errors.length) rep._errors = errors;
  return rep;
}

async function runAll(){
  const rows = [];
  for (let i = 0; i < SCENARIOS.length; i++){
    console.log(`running ${i + 1}/${SCENARIOS.length} …`);
    rows.push(await run(i));
  }
  console.table(rows.map(({_errors, ...r}) => r));
  const bad = rows.filter(r => r.status === 'FAIL');
  console.log(bad.length ? `${bad.length} FAILED` : `all ${rows.length} passed`);
  bad.forEach(r => r._errors && console.error(r.name, r._errors));
  return rows;
}

function list(){
  console.table(SCENARIOS.map((s, i) => ({
    '#': i, name: s.name, mixes: s.structures.join(' + '), expects: (s.expect.panels||[]).join(', ')
  })));
}

function combo(...structs){
  const hits = SCENARIOS
    .map((s, i) => ({ i, s }))
    .filter(({s}) => structs.every(x => s.structures.includes(x)));
  if (!hits.length){
    console.log(`Nothing mixes ${structs.join(' + ')} yet. Ask Claude to add one.`);
    return [];
  }
  console.table(hits.map(({i, s}) => ({ '#': i, name: s.name, mixes: s.structures.join(' + ') })));
  return hits.map(h => h.i);
}

window.TEST = { list, load, run, runAll, combo, SCENARIOS };
console.log('TEST ready — TEST.list() / TEST.run(0) / TEST.runAll()');
})();
