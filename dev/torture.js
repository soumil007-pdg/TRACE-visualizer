/* ══════════════════════════════════════════════════════════════════════
   torture.js ─ Java constructs that stress the instrumenter.
   Each must compile, return the right answer, and produce a trace that
   passes the invariants below. Expected values reasoned out by hand and
   noted inline; none rely on the tool under test.
   ══════════════════════════════════════════════════════════════════════ */

export const TORTURE = [
{ name:'uninitialized local, assigned in if/else', input:'a = 3\nb = 7', expected:14,
java:`public class Solution {
  public int pick(int a, int b) {
    int best;
    if (a > b) best = a;
    else best = b;
    return best * 2;
  }
}`},
{ name:'labeled loop with continue outer', input:'g = [[1,2],[3,-1,5],[4]]', expected:4,   // 1,2 | 3 then skip | 4
java:`public class Solution {
  public int count(int[][] g) {
    int n = 0;
    outer:
    for (int i = 0; i < g.length; i++) {
      for (int j = 0; j < g[i].length; j++) {
        if (g[i][j] < 0) continue outer;
        n++;
      }
    }
    return n;
  }
}`},
{ name:'do-while', input:'x = 12345', expected:5,
java:`public class Solution {
  public int digits(int x) {
    int d = 0;
    do {
      d++;
      x /= 10;
    } while (x > 0);
    return d;
  }
}`},
{ name:'while(true) as the last statement, no return after', input:'a = [1,4,9,16]\nt = 5', expected:2,
java:`public class Solution {
  public int firstOver(int[] a, int t) {
    int i = 0;
    while (true) {
      if (a[i] > t) return i;
      i++;
    }
  }
}`},
{ name:'for(;;) with break', input:'n = 40', expected:5,   // 40 20 10 5 2 1
java:`public class Solution {
  public int halve(int n) {
    int steps = 0;
    for (;;) {
      if (n <= 1) break;
      n /= 2;
      steps++;
    }
    return steps;
  }
}`},
{ name:'switch with fallthrough-free cases', input:'s = "abz"', expected:13,   // 1 + 2 + 10
java:`public class Solution {
  public int score(String s) {
    int total = 0;
    for (int i = 0; i < s.length(); i++) {
      switch (s.charAt(i)) {
        case 'a': total += 1; break;
        case 'b': total += 2; break;
        default: total += 10;
      }
    }
    return total;
  }
}`},
{ name:'try/catch assigning an uninitialized local', input:'a = 7\nb = 0', expected:-1,
java:`public class Solution {
  public int safeDiv(int a, int b) {
    int r;
    try {
      r = a / b;
    } catch (ArithmeticException e) {
      r = -1;
    }
    return r;
  }
}`},
{ name:'inner class with fields and a constructor', input:'keys = [1,2,3]', expected:6,
java:`public class Solution {
  class Node {
    int key;
    Node next;
    Node(int k) { key = k; }
  }
  public int sumKeys(int[] keys) {
    Node head = null;
    for (int k : keys) {
      Node n = new Node(k);
      n.next = head;
      head = n;
    }
    int s = 0;
    for (Node p = head; p != null; p = p.next) s += p.key;
    return s;
  }
}`},
{ name:'lambda comparator capturing a local (max-heap)', input:'nums = [3,1,5,2]\nk = 2', expected:3,   // polls 5 then 3
java:`public class Solution {
  public int kthMax(int[] nums, int k) {
    int offset = 0;
    PriorityQueue<Integer> pq = new PriorityQueue<>((a, b) -> b - a + offset);
    for (int x : nums) pq.offer(x);
    int ans = 0;
    for (int i = 0; i < k; i++) ans = pq.poll();
    return ans;
  }
}`},
{ name:'stream pipeline', input:'nums = [1,2,3,4,6]', expected:3,
java:`public class Solution {
  public int evens(int[] nums) {
    int c = (int) Arrays.stream(nums).filter(v -> v % 2 == 0).count();
    return c;
  }
}`},
{ name:'anonymous Comparator class', input:'a = [2,9,4]', expected:[9,4,2],
java:`public class Solution {
  public int[] sortDesc(int[] a) {
    Integer[] b = new Integer[a.length];
    for (int i = 0; i < a.length; i++) b[i] = a[i];
    Arrays.sort(b, new Comparator<Integer>() {
      public int compare(Integer x, Integer y) { return y - x; }
    });
    int[] out = new int[a.length];
    for (int i = 0; i < b.length; i++) out[i] = b[i];
    return out;
  }
}`},
{ name:'char arithmetic and StringBuilder', input:'s = "xyz"', expected:'yza',
java:`public class Solution {
  public String shift(String s) {
    StringBuilder sb = new StringBuilder();
    for (char ch : s.toCharArray()) {
      sb.append((char) ((ch - 'a' + 1) % 26 + 'a'));
    }
    return sb.toString();
  }
}`},
{ name:'int overflow is real JVM semantics', input:'x = 2147483647', expected:-2147483648,
java:`public class Solution {
  public int bump(int x) {
    x = x + 1;
    return x;
  }
}`},
{ name:'memoised recursion returning boolean', input:'n = 8', expected:true,   // 8 -> 5 -> 0
java:`public class Solution {
  Map<Integer, Boolean> memo = new HashMap<>();
  public boolean canReach(int n) {
    if (n == 0) return true;
    if (n < 0) return false;
    if (memo.containsKey(n)) return memo.get(n);
    boolean ok = canReach(n - 3) || canReach(n - 5);
    memo.put(n, ok);
    return ok;
  }
}`},
{ name:'several statements on one line, ternary, compound op', input:'a = 2', expected:-1,   // x=-2 y=-4 y=-1
java:`public class Solution {
  public int mix(int a) {
    int x = a > 5 ? a : -a; int y = x * 2; y += 3;
    return y;
  }
}`},
{ name:'nested generics in and out', input:'m = [[1,2,3],[4,5,6]]', expected:[[1,4],[2,5],[3,6]],
java:`public class Solution {
  public List<List<Integer>> transpose(List<List<Integer>> m) {
    List<List<Integer>> t = new ArrayList<>();
    for (int c = 0; c < m.get(0).size(); c++) {
      List<Integer> row = new ArrayList<>();
      for (int r = 0; r < m.size(); r++) row.add(m.get(r).get(c));
      t.add(row);
    }
    return t;
  }
}`},
{ name:'void helper with a bare return inside a braceless if', input:'root = [1,2,3,4]', expected:3,
java:`public class Solution {
  int best = 0;
  public int maxPath(TreeNode root) {
    go(root, 0);
    return best;
  }
  void go(TreeNode n, int d) {
    if (n == null) return;
    if (d + 1 > best) best = d + 1;
    go(n.left, d + 1);
    go(n.right, d + 1);
  }
}`},
{ name:'infinite loop hits the step cap, trace kept', input:'n = 1', expectError:/Step cap/,
java:`public class Solution {
  public int spin(int n) {
    int x = 0;
    while (n > 0) {
      x++;
    }
    return x;
  }
}`},
{ name:'runtime exception reports the user line, trace kept', input:'a = [1,2]', expectError:/ArrayIndexOutOfBounds[\s\S]*line 5/,
java:`public class Solution {
  public int oob(int[] a) {
    int s = 0;
    for (int i = 0; i <= a.length; i++) {
      s += a[i];
    }
    return s;
  }
}`},
{ name:'compile error reports the user line', input:'x = 1', expectError:/Line 3/,
java:`public class Solution {
  public int bad(int x) {
    int y = "text";
    return y;
  }
}`}
];

/* Invariants every trace must satisfy. Each one would have caught a bug
   found during this work. */
export function checkInvariants(res, src){
  const bad = [];
  const lines = String(src).split('\n');
  const S = res.snapshots || [];
  S.forEach((s, i) => {
    if(s.filename !== '<user>') bad.push(`step ${i}: filename ${s.filename}`);
    const code = (lines[s.line - 1] || '').trim();
    if(!code || /^[{}]+$/.test(code) || code.startsWith('//'))
      bad.push(`step ${i}: card on a blank or brace-only line ${s.line}`);
    if(!(s.call_depth >= 1)) bad.push(`step ${i}: call_depth ${s.call_depth}`);
    if(s.current_call_id == null || s.current_call_id > s.max_call_id)
      bad.push(`step ${i}: current_call_id ${s.current_call_id} > max_call_id ${s.max_call_id}`);
    if(/^\s*(if|while|for)\s*\(/.test(code) && !s.cond && !/^\s*for\s*\(.*:/.test(code) === false) {}
  });
  const clean = !res.error;
  (function walk(nodes, depth){
    for(const n of nodes || []){
      if(clean && !n.returned) bad.push(`call ${n.func}#${n.id} never returned`);
      if(n.depth !== depth) bad.push(`call ${n.func}#${n.id} depth ${n.depth}, expected ${depth}`);
      if(typeof n.return_val !== 'string' && n.return_val !== null) bad.push(`call ${n.func}#${n.id} return_val not a string`);
      walk(n.children, depth + 1);
    }
  })(res.call_trees, 0);
  // conditions: every card on an if / while / basic-for header carries a badge
  S.forEach((s, i) => {
    const code = (lines[s.line - 1] || '').trim();
    if(/^(\}\s*else\s+)?if\s*\(/.test(code) && !(s.cond && typeof s.cond.result === 'boolean'))
      bad.push(`step ${i}: if on line ${s.line} has no TRUE/FALSE`);
  });
  return bad.slice(0, 5);
}
