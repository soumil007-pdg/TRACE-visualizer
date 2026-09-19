/* 10 LeetCode HARD problems in Java. Expected values were computed by
   running each algorithm in Python first, never recalled. */
export const HARD = [
{ name:'42. Trapping Rain Water', expected:6,
  input:'height = [0,1,0,2,1,0,1,3,2,1,2,1]',
  java:`public class Solution {
  public int trap(int[] height) {
    int l = 0;
    int r = height.length - 1;
    int lm = 0;
    int rm = 0;
    int total = 0;
    while (l < r) {
      if (height[l] < height[r]) {
        if (height[l] >= lm) { lm = height[l]; } else { total = total + lm - height[l]; }
        l = l + 1;
      } else {
        if (height[r] >= rm) { rm = height[r]; } else { total = total + rm - height[r]; }
        r = r - 1;
      }
    }
    return total;
  }
}`},
{ name:'4. Median of Two Sorted Arrays', expected:2.0,
  input:'nums1 = [1,3]\nnums2 = [2]',
  java:`public class Solution {
  public double findMedianSortedArrays(int[] nums1, int[] nums2) {
    int n = nums1.length + nums2.length;
    int[] merged = new int[n];
    int i = 0;
    int j = 0;
    int k = 0;
    while (i < nums1.length && j < nums2.length) {
      if (nums1[i] <= nums2[j]) { merged[k] = nums1[i]; i = i + 1; }
      else { merged[k] = nums2[j]; j = j + 1; }
      k = k + 1;
    }
    while (i < nums1.length) { merged[k] = nums1[i]; i = i + 1; k = k + 1; }
    while (j < nums2.length) { merged[k] = nums2[j]; j = j + 1; k = k + 1; }
    if (n % 2 == 1) { return merged[n / 2]; }
    return (merged[n / 2 - 1] + merged[n / 2]) / 2.0;
  }
}`},
{ name:'72. Edit Distance', expected:3,
  input:'word1 = "horse"\nword2 = "ros"',
  java:`public class Solution {
  public int minDistance(String word1, String word2) {
    int n = word1.length();
    int m = word2.length();
    int[][] dp = new int[n + 1][m + 1];
    for (int i = 0; i <= n; i++) { dp[i][0] = i; }
    for (int j = 0; j <= m; j++) { dp[0][j] = j; }
    for (int i = 1; i <= n; i++) {
      for (int j = 1; j <= m; j++) {
        if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          int best = dp[i - 1][j - 1];
          if (dp[i - 1][j] < best) { best = dp[i - 1][j]; }
          if (dp[i][j - 1] < best) { best = dp[i][j - 1]; }
          dp[i][j] = best + 1;
        }
      }
    }
    return dp[n][m];
  }
}`},
{ name:'32. Longest Valid Parentheses', expected:4,
  input:'s = "\\u0029\\u0028\\u0029\\u0028\\u0029\\u0029"',
  java:`public class Solution {
  public int longestValidParentheses(String s) {
    int best = 0;
    java.util.ArrayDeque<Integer> st = new java.util.ArrayDeque<>();
    st.push(-1);
    for (int i = 0; i < s.length(); i++) {
      if (s.charAt(i) == '(') {
        st.push(i);
      } else {
        st.pop();
        if (st.isEmpty()) {
          st.push(i);
        } else {
          int len = i - st.peek();
          if (len > best) { best = len; }
        }
      }
    }
    return best;
  }
}`},
{ name:'84. Largest Rectangle in Histogram', expected:10,
  input:'heights = [2,1,5,6,2,3]',
  java:`public class Solution {
  public int largestRectangleArea(int[] heights) {
    int n = heights.length;
    int[] h = new int[n + 1];
    for (int i = 0; i < n; i++) { h[i] = heights[i]; }
    h[n] = 0;
    java.util.ArrayDeque<Integer> st = new java.util.ArrayDeque<>();
    int best = 0;
    for (int i = 0; i <= n; i++) {
      while (!st.isEmpty() && h[st.peek()] >= h[i]) {
        int ht = h[st.pop()];
        int w = i;
        if (!st.isEmpty()) { w = i - st.peek() - 1; }
        if (ht * w > best) { best = ht * w; }
      }
      st.push(i);
    }
    return best;
  }
}`},
{ name:'135. Candy', expected:5,
  input:'ratings = [1,0,2]',
  java:`public class Solution {
  public int candy(int[] ratings) {
    int n = ratings.length;
    int[] c = new int[n];
    for (int i = 0; i < n; i++) { c[i] = 1; }
    for (int i = 1; i < n; i++) {
      if (ratings[i] > ratings[i - 1]) { c[i] = c[i - 1] + 1; }
    }
    for (int i = n - 2; i >= 0; i--) {
      if (ratings[i] > ratings[i + 1] && c[i] <= c[i + 1]) { c[i] = c[i + 1] + 1; }
    }
    int total = 0;
    for (int i = 0; i < n; i++) { total = total + c[i]; }
    return total;
  }
}`},
{ name:'41. First Missing Positive', expected:2,
  input:'nums = [3,4,-1,1]',
  java:`public class Solution {
  public int firstMissingPositive(int[] nums) {
    int n = nums.length;
    for (int i = 0; i < n; i++) {
      while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] != nums[i]) {
        int j = nums[i] - 1;
        int tmp = nums[i];
        nums[i] = nums[j];
        nums[j] = tmp;
      }
    }
    for (int i = 0; i < n; i++) {
      if (nums[i] != i + 1) { return i + 1; }
    }
    return n + 1;
  }
}`},
{ name:'124. Binary Tree Maximum Path Sum', expected:42,
  input:'root = [-10,9,20,null,null,15,7]',
  java:`public class Solution {
  int best = -1000000;

  public int maxPathSum(TreeNode root) {
    gain(root);
    return best;
  }

  int gain(TreeNode node) {
    if (node == null) { return 0; }
    int left = gain(node.left);
    if (left < 0) { left = 0; }
    int right = gain(node.right);
    if (right < 0) { right = 0; }
    int through = node.val + left + right;
    if (through > best) { best = through; }
    if (left > right) { return node.val + left; }
    return node.val + right;
  }
}`},
{ name:'76. Minimum Window Substring', expected:"BANC",
  input:'s = "ADOBECODEBANC"\nt = "ABC"',
  java:`public class Solution {
  public String minWindow(String s, String t) {
    int[] need = new int[128];
    for (int i = 0; i < t.length(); i++) { need[t.charAt(i)] = need[t.charAt(i)] + 1; }
    int missing = t.length();
    int start = 0;
    int end = 0;
    int lo = 0;
    for (int j = 0; j < s.length(); j++) {
      char ch = s.charAt(j);
      if (need[ch] > 0) { missing = missing - 1; }
      need[ch] = need[ch] - 1;
      if (missing == 0) {
        while (need[s.charAt(lo)] < 0) {
          need[s.charAt(lo)] = need[s.charAt(lo)] + 1;
          lo = lo + 1;
        }
        if (end == 0 || j + 1 - lo < end - start) { start = lo; end = j + 1; }
        need[s.charAt(lo)] = need[s.charAt(lo)] + 1;
        missing = missing + 1;
        lo = lo + 1;
      }
    }
    return s.substring(start, end);
  }
}`},
{ name:'10. Regular Expression Matching', expected:true,
  input:'s = "aab"\np = "c*a*b"',
  java:`public class Solution {
  public boolean isMatch(String s, String p) {
    int n = s.length();
    int m = p.length();
    boolean[][] dp = new boolean[n + 1][m + 1];
    dp[0][0] = true;
    for (int j = 1; j <= m; j++) {
      if (p.charAt(j - 1) == '*') { dp[0][j] = dp[0][j - 2]; }
    }
    for (int i = 1; i <= n; i++) {
      for (int j = 1; j <= m; j++) {
        if (p.charAt(j - 1) == '*') {
          boolean skip = dp[i][j - 2];
          boolean take = false;
          if (p.charAt(j - 2) == '.' || p.charAt(j - 2) == s.charAt(i - 1)) { take = dp[i - 1][j]; }
          dp[i][j] = skip || take;
        } else {
          boolean same = p.charAt(j - 1) == '.' || p.charAt(j - 1) == s.charAt(i - 1);
          dp[i][j] = dp[i - 1][j - 1] && same;
        }
      }
    }
    return dp[n][m];
  }
}`}
];
