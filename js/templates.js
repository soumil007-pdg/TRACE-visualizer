/* ══════════════════════════════════════════════════════════════════════
   templates.js ─ Built-in example code snippets (TMPL object).
   No dependencies.
   ══════════════════════════════════════════════════════════════════════ */

const TMPL = {
  blank: { code:'', input:'' },

  binary_search: {
    code: `class Solution:
    def search(self, nums: List[int], target: int) -> int:
        left, right = 0, len(nums) - 1
        while left <= right:
            mid = (left + right) // 2
            if nums[mid] == target:
                return mid
            elif nums[mid] < target:
                left = mid + 1
            else:
                right = mid - 1
        return -1`,
    input: `nums = [1,3,5,7,9,11,13,15]\ntarget = 11`
  },

  bubble_sort: {
    code: `def bubble_sort(arr: List[int]) -> List[int]:
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
    input: `arr = [5,2,8,1,9,3]`
  },

  two_sum: {
    code: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i in range(len(nums)):
            need = target - nums[i]
            if need in seen:
                return [seen[need], i]
            seen[nums[i]] = i
        return []`,
    input: `nums = [2,7,11,15]\ntarget = 18`
  },

  ll_reverse: {
    code: `class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        curr = head
        while curr:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        return prev`,
    input: `head = [1,2,3,4,5]`
  },

  ll_cycle: {
    code: `class Solution:
    def detectCycle(self, head: Optional[ListNode]) -> Optional[ListNode]:
        slow = head
        fast = head
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next
            if fast is slow:
                break
        else:
            return None
        if fast is None or fast.next is None:
            return None
        start = head
        while start is not slow:
            start = start.next
            slow = slow.next
        return start`,
    input: `head = [3,2,0,-4]\npos = 1`
  },

  tree_inorder: {
    code: `class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        result = []
        def visit(node):
            if node is None:
                return
            visit(node.left)
            result.append(node.val)
            visit(node.right)
        visit(root)
        return result`,
    input: `root = [1,null,2,3]`
  },

  tree_depth: {
    code: `class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if root is None:
            return 0
        left_depth = self.maxDepth(root.left)
        right_depth = self.maxDepth(root.right)
        return 1 + max(left_depth, right_depth)`,
    input: `root = [3,9,20,null,null,15,7]`
  },

  top_k_freq: {
    code: `class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        count = Counter(nums)
        hp = []
        for num, freq in count.items():
            heapq.heappush(hp, (-freq, num))
        result = []
        for _ in range(k):
            freq, num = heapq.heappop(hp)
            result.append(num)
        return result`,
    input: `nums = [1,1,1,2,2,3]\nk = 2`
  },

  k_closest: {
    code: `class Solution:
    def kClosest(self, points: List[List[int]], k: int) -> List[List[int]]:
        hp = []
        for x, y in points:
            dist = x*x + y*y
            heapq.heappush(hp, (dist, x, y))
        result = []
        for _ in range(k):
            d, x, y = heapq.heappop(hp)
            result.append([x, y])
        return result`,
    input: `points = [[1,3],[-2,2],[5,8],[0,1]]\nk = 2`
  },

  grid_islands: {
    code: `class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        if not grid:
            return 0
        rows, cols = len(grid), len(grid[0])
        count = 0
        def dfs(r, c):
            if r < 0 or r >= rows or c < 0 or c >= cols:
                return
            if grid[r][c] != '1':
                return
            grid[r][c] = '2'
            dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1)
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == '1':
                    count += 1
                    dfs(r, c)
        return count`,
    input: `grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]`
  },
};
