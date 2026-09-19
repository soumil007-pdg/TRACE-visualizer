/* ══════════════════════════════════════════════════════════════════════
   cases.js ─ Differential test cases. Each is one algorithm written
   twice, plus the answer verified independently (not from memory).

   Python is the oracle: Java is correct when its meaningful output
   matches Python's for the same algorithm.

   Loaded at runtime from the app page so no dev code ships in index.html:
     const M = await import('/dev/cases.js');
   ══════════════════════════════════════════════════════════════════════ */

export const DIFF_CASES = [
{
  name: 'Number of Islands', bucket: 'grids', expected: 3,
  input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
  python: `class Solution:
    def numIslands(self, grid):
        rows = len(grid)
        cols = len(grid[0])
        count = 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == '1':
                    count = count + 1
                    self.dfs(grid, r, c, rows, cols)
        return count
    def dfs(self, g, r, c, rows, cols):
        if r < 0 or r >= rows or c < 0 or c >= cols: return
        if g[r][c] != '1': return
        g[r][c] = '2'
        self.dfs(g, r+1, c, rows, cols)
        self.dfs(g, r-1, c, rows, cols)
        self.dfs(g, r, c+1, rows, cols)
        self.dfs(g, r, c-1, rows, cols)`,
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
    dfs(g, r + 1, c, rows, cols);
    dfs(g, r - 1, c, rows, cols);
    dfs(g, r, c + 1, rows, cols);
    dfs(g, r, c - 1, rows, cols);
  }
}`
},
{
  name: 'Max Area of Island', bucket: 'grids', expected: 4,
  input: 'grid = [[0,0,1,0,0],[0,0,0,0,0],[0,1,1,0,0],[0,1,1,0,0]]',
  python: `class Solution:
    def maxAreaOfIsland(self, grid):
        rows = len(grid)
        cols = len(grid[0])
        best = 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == 1:
                    area = self.dfs(grid, r, c, rows, cols)
                    if area > best:
                        best = area
        return best
    def dfs(self, g, r, c, rows, cols):
        if r < 0 or r >= rows or c < 0 or c >= cols: return 0
        if g[r][c] != 1: return 0
        g[r][c] = 2
        total = 1
        total = total + self.dfs(g, r+1, c, rows, cols)
        total = total + self.dfs(g, r-1, c, rows, cols)
        total = total + self.dfs(g, r, c+1, rows, cols)
        total = total + self.dfs(g, r, c-1, rows, cols)
        return total`,
  java: `public class Solution {
  public int maxAreaOfIsland(int[][] grid) {
    int rows = grid.length;
    int cols = grid[0].length;
    int best = 0;
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        if (grid[r][c] == 1) {
          int area = dfs(grid, r, c, rows, cols);
          if (area > best) {
            best = area;
          }
        }
      }
    }
    return best;
  }
  int dfs(int[][] g, int r, int c, int rows, int cols) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return 0;
    if (g[r][c] != 1) return 0;
    g[r][c] = 2;
    int total = 1;
    total = total + dfs(g, r + 1, c, rows, cols);
    total = total + dfs(g, r - 1, c, rows, cols);
    total = total + dfs(g, r, c + 1, rows, cols);
    total = total + dfs(g, r, c - 1, rows, cols);
    return total;
  }
}`
},
{
  name: 'Binary Search', bucket: 'lists', expected: 4,
  input: 'nums = [-1,0,3,5,9,12]\ntarget = 9',
  python: `class Solution:
    def search(self, nums, target):
        left = 0
        right = len(nums) - 1
        while left <= right:
            mid = (left + right) // 2
            if nums[mid] == target:
                return mid
            if nums[mid] < target:
                left = mid + 1
            else:
                right = mid - 1
        return -1`,
  java: `public class Solution {
  public int search(int[] nums, int target) {
    int left = 0;
    int right = nums.length - 1;
    while (left <= right) {
      int mid = (left + right) / 2;
      if (nums[mid] == target) {
        return mid;
      }
      if (nums[mid] < target) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return -1;
  }
}`
},
{
  name: 'Maximum Subarray', bucket: 'lists', expected: 6,
  input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
  python: `class Solution:
    def maxSubArray(self, nums):
        best = nums[0]
        cur = nums[0]
        for i in range(1, len(nums)):
            if cur + nums[i] > nums[i]:
                cur = cur + nums[i]
            else:
                cur = nums[i]
            if cur > best:
                best = cur
        return best`,
  java: `public class Solution {
  public int maxSubArray(int[] nums) {
    int best = nums[0];
    int cur = nums[0];
    for (int i = 1; i < nums.length; i++) {
      if (cur + nums[i] > nums[i]) {
        cur = cur + nums[i];
      } else {
        cur = nums[i];
      }
      if (cur > best) {
        best = cur;
      }
    }
    return best;
  }
}`
},
{
  name: 'Two Sum', bucket: 'dicts', expected: [2,3],
  input: 'nums = [2,7,11,15]\ntarget = 26',
  python: `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i in range(len(nums)):
            need = target - nums[i]
            if need in seen:
                return [seen[need], i]
            seen[nums[i]] = i
        return []`,
  java: `public class Solution {
  public int[] twoSum(int[] nums, int target) {
    java.util.Map<Integer, Integer> seen = new java.util.HashMap<>();
    for (int i = 0; i < nums.length; i++) {
      int need = target - nums[i];
      if (seen.containsKey(need)) {
        return new int[]{ seen.get(need), i };
      }
      seen.put(nums[i], i);
    }
    return new int[]{};
  }
}`
},
{
  name: 'Contains Duplicate', bucket: 'sets', expected: true,
  input: 'nums = [1,2,3,1]',
  python: `class Solution:
    def containsDuplicate(self, nums):
        seen = set()
        for i in range(len(nums)):
            if nums[i] in seen:
                return True
            seen.add(nums[i])
        return False`,
  java: `public class Solution {
  public boolean containsDuplicate(int[] nums) {
    java.util.Set<Integer> seen = new java.util.HashSet<>();
    for (int i = 0; i < nums.length; i++) {
      if (seen.contains(nums[i])) {
        return true;
      }
      seen.add(nums[i]);
    }
    return false;
  }
}`
},
{
  name: 'Move Zeroes', bucket: 'lists', expected: [1,3,12,0,0],
  input: 'nums = [0,1,0,3,12]',
  python: `class Solution:
    def moveZeroes(self, nums):
        k = 0
        for i in range(len(nums)):
            if nums[i] != 0:
                tmp = nums[k]
                nums[k] = nums[i]
                nums[i] = tmp
                k = k + 1
        return nums`,
  java: `public class Solution {
  public int[] moveZeroes(int[] nums) {
    int k = 0;
    for (int i = 0; i < nums.length; i++) {
      if (nums[i] != 0) {
        int tmp = nums[k];
        nums[k] = nums[i];
        nums[i] = tmp;
        k = k + 1;
      }
    }
    return nums;
  }
}`
},
{
  name: 'Reverse Linked List', bucket: 'linked_lists',
  expected: { __kind__:'list', values:[5,4,3,2,1] },
  input: 'head = [1,2,3,4,5]',
  python: `class Solution:
    def reverseList(self, head):
        prev = None
        cur = head
        while cur is not None:
            nxt = cur.next
            cur.next = prev
            prev = cur
            cur = nxt
        return prev`,
  java: `public class Solution {
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
}`
},
{
  name: 'Maximum Depth of Binary Tree', bucket: 'trees', expected: 3,
  input: 'root = [3,9,20,null,null,15,7]',
  python: `class Solution:
    def maxDepth(self, root: TreeNode) -> int:
        if root is None:
            return 0
        left = self.maxDepth(root.left)
        right = self.maxDepth(root.right)
        if left > right:
            return left + 1
        return right + 1`,
  java: `public class Solution {
  public int maxDepth(TreeNode root) {
    if (root == null) {
      return 0;
    }
    int left = maxDepth(root.left);
    int right = maxDepth(root.right);
    if (left > right) {
      return left + 1;
    }
    return right + 1;
  }
}`
},
{
  name: 'Fibonacci', bucket: 'recursion', expected: 55,
  input: 'n = 10',
  python: `class Solution:
    def fib(self, n):
        if n < 2:
            return n
        return self.fib(n - 1) + self.fib(n - 2)`,
  java: `public class Solution {
  public int fib(int n) {
    if (n < 2) {
      return n;
    }
    return fib(n - 1) + fib(n - 2);
  }
}`
},
{
  name: 'Climbing Stairs', bucket: 'locals', expected: 34,
  input: 'n = 8',
  python: `class Solution:
    def climbStairs(self, n):
        a = 1
        b = 1
        for i in range(n - 1):
            total = a + b
            a = b
            b = total
        return b`,
  java: `public class Solution {
  public int climbStairs(int n) {
    int a = 1;
    int b = 1;
    for (int i = 0; i < n - 1; i++) {
      int total = a + b;
      a = b;
      b = total;
    }
    return b;
  }
}`
},
{
  name: 'Valid Anagram', bucket: 'lists', expected: true,
  input: 's = "anagram"\nt = "nagaram"',
  python: `class Solution:
    def isAnagram(self, s, t):
        if len(s) != len(t):
            return False
        cnt = [0] * 26
        for i in range(len(s)):
            cnt[ord(s[i]) - 97] = cnt[ord(s[i]) - 97] + 1
        for i in range(len(t)):
            cnt[ord(t[i]) - 97] = cnt[ord(t[i]) - 97] - 1
        for i in range(26):
            if cnt[i] != 0:
                return False
        return True`,
  java: `public class Solution {
  public boolean isAnagram(String s, String t) {
    if (s.length() != t.length()) {
      return false;
    }
    int[] cnt = new int[26];
    for (int i = 0; i < s.length(); i++) {
      cnt[s.charAt(i) - 97] = cnt[s.charAt(i) - 97] + 1;
    }
    for (int i = 0; i < t.length(); i++) {
      cnt[t.charAt(i) - 97] = cnt[t.charAt(i) - 97] - 1;
    }
    for (int i = 0; i < 26; i++) {
      if (cnt[i] != 0) {
        return false;
      }
    }
    return true;
  }
}`
}
];

/* Reduce a run to only what must match across languages. Line numbers and
   raw step counts are deliberately excluded: Java's boilerplate and loop
   forms are not statement-for-statement equal to Python's. */
export function fingerprint(run){
  const structs = new Set();
  const perBucket = {};
  for(const s of run.snapshots || []){
    for(const b of ['lists','grids','dicts','sets','deques','linked_lists','trees']){
      for(const name in (s[b] || {})){
        structs.add(b);
        let v = s[b][name];
        // object identity differs between runtimes; compare values only
        if(b === 'linked_lists' && v && v.nodes) v = v.nodes.map(n => n.val);
        if(b === 'trees') v = _treeVals(v);
        /* Keyed by bucket, NOT by variable name. The same array is `grid` in
           one frame and `g` inside the recursive call, and the two languages
           surface those names at different moments. What must match is the
           sequence of states the structure passes through. */
        const sig = JSON.stringify(v);
        (perBucket[b] ||= []);
        if(perBucket[b][perBucket[b].length - 1] !== sig) perBucket[b].push(sig);
      }
    }
  }
  const stateSeq = [];
  for(const b of Object.keys(perBucket).sort())
    for(const sig of perBucket[b]) stateSeq.push(b + '=' + sig);
  return {
    result: run.result,
    structures: [...structs].sort(),
    hasCallTree: (run.call_trees || []).length > 0,
    stateSeq
  };
}

function _treeVals(n){
  if(!n) return null;
  return { v: n.val, l: _treeVals(n.left), r: _treeVals(n.right) };
}

/* Results that are structures carry object ids, which no two runtimes share.
   Reduce both sides to the values before comparing. */
export function resultValues(r){
  if(r && r.__kind__ === 'list') return { kind:'list', values:(r.nodes||[]).map(n=>n.val) };
  if(r && r.__kind__ === 'tree') return { kind:'tree', values:_treeVals(r.root) };
  return r;
}

export function compare(py, jv){
  const a = fingerprint(py), b = fingerprint(jv), diffs = [];
  const ra = JSON.stringify(resultValues(a.result)), rb = JSON.stringify(resultValues(b.result));
  if(ra !== rb) diffs.push(`result: python ${ra} vs java ${rb}`);
  if(a.structures.join() !== b.structures.join())
    diffs.push(`structures: python [${a.structures}] vs java [${b.structures}]`);
  if(a.hasCallTree !== b.hasCallTree)
    diffs.push(`call tree: python ${a.hasCallTree} vs java ${b.hasCallTree}`);
  /* Sequence equality is too strict where several variables alias one
     structure. In reverseList, head/prev/cur/nxt all point into the same
     chain, and Python's node_pointers dedup suppresses a variable's view
     when another already covers that node, so Python legitimately shows
     FEWER states than Java. Verified by hand: for that case the state sets
     are identical and Java additionally captures the initial [1,2,3,4,5]
     and prev=[1], which Python omits.

     So the rule is coverage, not order: every state Python shows, Java must
     also show. Java showing more is better, not a failure. */
  const pySet = new Set(a.stateSeq), jvSet = new Set(b.stateSeq);
  const missing = [...pySet].filter(x => !jvSet.has(x));
  if(missing.length)
    diffs.push(`java is missing ${missing.length} state(s) python shows, first:\n` +
               `      ${missing[0].slice(0, 160)}`);

  // order still has to match where neither side is aliasing
  if(!missing.length && a.stateSeq.length === b.stateSeq.length &&
     a.stateSeq.join('|') !== b.stateSeq.join('|')){
    const i = a.stateSeq.findIndex((x, k) => x !== b.stateSeq[k]);
    diffs.push(`same states, different order, first at ${i}\n` +
               `      python: ${a.stateSeq[i]}\n      java:   ${b.stateSeq[i]}`);
  }
  return diffs;
}
