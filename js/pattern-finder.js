/* ══════════════════════════════════════════════════════════════════════
   pattern-finder.js — Paste a DSA problem, get the thought process.
   Fully local (no network, no API key) — matches TRACE's "runs entirely
   in your browser" identity. Restate → brute force → the waste →
   constraints read → property to exploit → pattern → approach →
   complexity → traps.
   ══════════════════════════════════════════════════════════════════════ */
(function(){

/* ── Pattern database — 28 patterns, each tagged with a "family" so the
   brute-force / waste / traps text can be generated generically instead
   of hand-writing 28 bespoke bodies. ────────────────────────────────── */
// Every icon: viewBox 0 0 24 24, stroke="currentColor" so it inherits each
// pattern's badge color automatically — no emoji anywhere in this file.
const ICON_ATTRS = 'viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const PATTERNS = {
  two_pointers: { name:"Two Pointers", icon:`<svg ${ICON_ATTRS}><path d="M4 12h5M20 12h-5"/><path d="M8 9l-4 3 4 3"/><path d="M16 9l4 3-4 3"/></svg>`, color:"var(--accent)", bg:"color-mix(in srgb, var(--accent) 12%, transparent)", family:"scan",
    why:"Move two indices on sorted data, eliminating impossible candidates in O(n) instead of O(n²).",
    identify:["Sorted array (or sortable)","Find pair/triplet summing to target","Remove duplicates in-place","Rearrange (0s/1s, Dutch flag)","Compare from both ends"],
    signals:["sorted array","pair","triplet","sum to","target sum","two sum","3sum","remove duplicates","rearrange","dutch","palindrome","squaring","backspace compare","container with water"],
    time:"O(n) or O(n log n)", space:"O(1)" },
  fast_slow: { name:"Fast & Slow Pointers", icon:`<svg ${ICON_ATTRS}><line x1="3" y1="12" x2="21" y2="12"/><circle cx="8" cy="12" r="2"/><circle cx="17" cy="12" r="2"/><path d="M13 9v1.5M13 13.5V15" stroke-width="1.6"/></svg>`, color:"var(--blue)", bg:"color-mix(in srgb, var(--blue) 12%, transparent)", family:"scan",
    why:"Two pointers at different speeds — fast catches slow only inside a cycle, or lands at the middle when fast hits the end.",
    identify:["Detect cycle in linked list","Find middle node","Linked-list palindrome","Find duplicate number (array as implicit LL)","Happy number / loop detection"],
    signals:["cycle","loop","linked list","middle","happy number","duplicate number","circular","tortoise","floyd"],
    time:"O(n)", space:"O(1)" },
  sliding_window: { name:"Sliding Window", icon:`<svg ${ICON_ATTRS}><rect x="3" y="9" width="4" height="6"/><rect x="8" y="9" width="4" height="6"/><rect x="13" y="9" width="4" height="6"/><rect x="18" y="9" width="3" height="6" opacity="0.3"/><path d="M6.5 5.5v3M17.5 5.5v3M6.5 5.5h11" stroke-width="1.6"/></svg>`, color:"var(--blue)", bg:"color-mix(in srgb, var(--blue) 12%, transparent)", family:"scan",
    why:"Maintain a window over contiguous elements, expanding/shrinking by a condition — avoids recomputing the window each step.",
    identify:["Max/min over subarray of size K","Longest/shortest substring with a constraint","Min subarray with sum ≥ target","Anagram/permutation in a string","At most K distinct elements"],
    signals:["subarray of size k","substring","window","contiguous","longest substring","at most k distinct","no repeat","anagram","permutation in string","minimum size subarray","consecutive ones","fruit"],
    time:"O(n)", space:"O(k)" },
  kadane: { name:"Kadane's Algorithm", icon:`<svg ${ICON_ATTRS}><polyline points="3 17 7 11 11 15 15 6 21 12"/></svg>`, color:"var(--green)", bg:"var(--green-bg, rgba(16,185,129,.12))", family:"scan",
    why:"Track the best subarray ending at each index; restart when the running sum turns harmful. One pass.",
    identify:["Maximum subarray sum (no size limit)","Minimum subarray sum","Maximum product subarray","Max sum in circular array","Best subarray with one deletion"],
    signals:["maximum subarray","max sum subarray","minimum subarray sum","product subarray","circular subarray","maximum sum","one deletion","largest sum contiguous"],
    time:"O(n)", space:"O(1)" },
  prefix_sum: { name:"Prefix Sum", icon:`<svg ${ICON_ATTRS}><path d="M4 20V16M9 20V12M14 20V8M19 20V4"/></svg>`, color:"var(--yellow)", bg:"color-mix(in srgb, var(--yellow) 12%, transparent)", family:"scan",
    why:"Precompute cumulative sums so any range sum is O(1). Pair with a HashMap to count subarrays summing to K.",
    identify:["Subarray sum equals K (count/find)","Pivot index (left sum = right sum)","Subarray sums divisible by K","Equal 0s and 1s subarray","Range-sum queries"],
    signals:["subarray sum equals k","sum equals","pivot index","divisible by k","equal zeros ones","range sum","cumulative","prefix","running total"],
    time:"O(n)", space:"O(n)" },
  merge_intervals: { name:"Merge Intervals", icon:`<svg ${ICON_ATTRS}><line x1="3" y1="7" x2="13" y2="7"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="3" y1="17" x2="20" y2="17" stroke-width="2.6"/></svg>`, color:"var(--pink)", bg:"color-mix(in srgb, var(--pink) 12%, transparent)", family:"interval",
    why:"Sort intervals by start, then sweep — greedily merge overlaps or detect gaps.",
    identify:["Array of [start, end] given","Merge overlapping intervals","Insert into a sorted interval list","Meeting rooms / max CPU load","Find free time / gaps"],
    signals:["intervals","meeting","overlap","merge","schedule","free time","insert interval","cpu load","start end","rooms","booking"],
    time:"O(n log n)", space:"O(n)" },
  ll_reversal: { name:"In-place LL Reversal", icon:`<svg ${ICON_ATTRS}><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M16.5 9.8L14 12l2.5 2.2M9.5 9.8L7 12l2.5 2.2" stroke-width="1.6"/></svg>`, color:"var(--red)", bg:"color-mix(in srgb, var(--red) 12%, transparent)", family:"scan",
    why:"Flip pointer directions while iterating — no extra memory. Track prev / current / next each step.",
    identify:["Reverse whole linked list","Reverse a sub-list m..n","Swap nodes in pairs","Reverse every K nodes","Rotate by K"],
    signals:["reverse linked list","reverse list","swap nodes","rotate list","reverse k","reverse sub","reorder list"],
    time:"O(n)", space:"O(1)" },
  stack: { name:"Stack", icon:`<svg ${ICON_ATTRS}><rect x="5" y="4" width="14" height="4"/><rect x="5" y="10" width="14" height="4"/><rect x="5" y="16" width="14" height="4"/></svg>`, color:"var(--muted)", bg:"color-mix(in srgb, var(--muted) 14%, transparent)", family:"scan",
    why:"LIFO is perfect for matching, nesting, and 'what was the last valid/open thing?'",
    identify:["Balanced brackets / parentheses","Evaluate expression","Undo-style / path simplification","Decode nested strings","Min-stack / valid sequence"],
    signals:["parentheses","brackets","balanced","valid","expression","simplify path","decode string","nested","min stack","backspace"],
    time:"O(n)", space:"O(n)" },
  monotonic_stack: { name:"Monotonic Stack", icon:`<svg ${ICON_ATTRS}><path d="M3 20V15H8V10H13V6H18V20Z"/></svg>`, color:"var(--muted)", bg:"color-mix(in srgb, var(--muted) 14%, transparent)", family:"scan",
    why:"Keep a stack in sorted order so you can find the next/previous greater or smaller element in one pass.",
    identify:["Next greater / smaller element","Daily temperatures / stock span","Largest rectangle in histogram","Remove K digits for smallest number","Sum of subarray minimums"],
    signals:["next greater","next smaller","previous greater","daily temperatures","stock span","largest rectangle","histogram","remove k digits","subarray minimum","monotonic"],
    time:"O(n)", space:"O(n)" },
  monotonic_deque: { name:"Monotonic Deque", icon:`<svg ${ICON_ATTRS}><rect x="6" y="9" width="12" height="8"/><path d="M3 13h2M19 13h2"/><path d="M5.5 11l-2 2 2 2M18.5 11l2 2-2 2" stroke-width="1.6"/></svg>`, color:"var(--blue)", bg:"color-mix(in srgb, var(--blue) 12%, transparent)", family:"scan",
    why:"A deque that stays sorted gives you the max/min of a sliding window in O(1) amortised.",
    identify:["Sliding window maximum / minimum","Max of every window of size K","Shortest subarray with sum ≥ K (with prefix)","Jump game with window of reach"],
    signals:["sliding window maximum","window minimum","max of every window","shortest subarray sum at least","constrained subsequence"],
    time:"O(n)", space:"O(k)" },
  hashmap: { name:"HashMap / HashSet", icon:`<svg ${ICON_ATTRS}><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="10" x2="10" y2="20"/></svg>`, color:"var(--accent)", bg:"color-mix(in srgb, var(--accent) 12%, transparent)", family:"scan",
    why:"O(1) lookups for counting, existence and grouping — collapses nested loops to a single pass.",
    identify:["First unique / non-repeating element","Anagram grouping or check","Frequency counting","Two-sum on unsorted array","Detect duplicates / seen-before"],
    signals:["first unique","non-repeating","anagram","frequency","count occurrences","ransom note","contains duplicate","two sum","group by","seen","longest consecutive sequence"],
    time:"O(n)", space:"O(n)" },
  binary_search: { name:"Binary Search", icon:`<svg ${ICON_ATTRS}><rect x="3" y="9" width="18" height="6"/><line x1="12" y1="6" x2="12" y2="18" stroke-width="2.4"/></svg>`, color:"var(--blue)", bg:"color-mix(in srgb, var(--blue) 12%, transparent)", family:"search",
    why:"Halve the search space each step — on a sorted array, or on the *answer* itself for min/max optimisation.",
    identify:["Sorted array: find index / first / last","Rotated sorted array","Peak / mountain element","Minimise the max (Koko, ship, books)","Search space is monotonic"],
    signals:["sorted array","rotated","find position","first occurrence","last occurrence","first and last position","koko","bouquets","ship packages","book allocation","aggressive cows","minimum days","peak","mountain","minimize maximum","split array","median of two sorted"],
    time:"O(log n) / O(n log(max))", space:"O(1)" },
  cyclic_sort: { name:"Cyclic Sort", icon:`<svg ${ICON_ATTRS}><path d="M4 12a8 8 0 1 1 2.6 5.9"/><path d="M3 14.5V18h3.5" stroke-width="1.8"/></svg>`, color:"var(--teal, #2dd4bf)", bg:"color-mix(in srgb, var(--teal, #2dd4bf) 12%, transparent)", family:"scan",
    why:"When numbers are in range [1..n], each value belongs at index value-1. Place them home, then anything out of place reveals the missing/duplicate.",
    identify:["Array holds numbers in range 1..n","Find the missing number(s)","Find the duplicate number(s)","Find the smallest missing positive","First K missing positives"],
    signals:["numbers in range","1 to n","missing number","missing positive","find all duplicates","find all missing","array of n integers","first missing positive"],
    time:"O(n)", space:"O(1)" },
  tree_bfs: { name:"Tree BFS", icon:`<svg ${ICON_ATTRS}><circle cx="12" cy="5" r="2"/><circle cx="6" cy="13" r="2"/><circle cx="18" cy="13" r="2"/><path d="M10.5 6.6L7.5 11.5M13.5 6.6L16.5 11.5"/><line x1="2" y1="19" x2="22" y2="19" stroke-width="1.4" stroke-dasharray="1 2.4"/></svg>`, color:"var(--green)", bg:"var(--green-bg, rgba(16,185,129,.12))", family:"tree_graph",
    why:"A queue processes nodes level by level — natural for level-order work and shallowest-node questions.",
    identify:["Level-order traversal","Right/left side view","Zigzag levels","Minimum depth","Connect nodes at same level"],
    signals:["level order","level by level","right side view","left side view","zigzag","minimum depth","connect level","average of levels","bfs"],
    time:"O(n)", space:"O(n)" },
  tree_dfs: { name:"Tree DFS", icon:`<svg ${ICON_ATTRS}><circle cx="12" cy="5" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2" opacity="0.3"/><circle cx="7" cy="19" r="2"/><path d="M10.6 6.5L8.4 10.5M7 14v3" stroke-width="2.2"/><path d="M13.4 6.5L15.6 10.5" stroke-width="1.1" opacity="0.3"/></svg>`, color:"var(--yellow)", bg:"color-mix(in srgb, var(--yellow) 12%, transparent)", family:"tree_graph",
    why:"Recursive depth-first descent — for path problems and properties computed bottom-up from children.",
    identify:["Root-to-leaf path sum","Maximum path sum","Lowest common ancestor","Validate BST","Diameter / height / balance"],
    signals:["path sum","root to leaf","max path","lowest common ancestor","lca","validate bst","inorder","preorder","postorder","diameter","height","balanced tree","subtree","serialize tree"],
    time:"O(n)", space:"O(h)" },
  graph: { name:"Graph BFS / DFS", icon:`<svg ${ICON_ATTRS}><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><path d="M6.7 7.3L10.6 10.6M17.3 7.3L13.4 10.6M6.7 16.7L10.6 13.4M17.3 16.7L13.4 13.4" stroke-width="1.5"/></svg>`, color:"var(--teal, #2dd4bf)", bg:"color-mix(in srgb, var(--teal, #2dd4bf) 12%, transparent)", family:"tree_graph",
    why:"Explore connectivity, components, and reachability. BFS for fewest-steps, DFS for whole regions.",
    identify:["Number of islands / provinces / regions","Path exists between two nodes","Flood fill / surrounded regions","Shortest path in an unweighted grid","Bipartite check"],
    signals:["island","connected component","graph","adjacency","clone graph","walls gates","flood fill","number of provinces","surrounded regions","rotting oranges","bipartite","matrix grid","shortest path unweighted"],
    time:"O(V+E)", space:"O(V)" },
  topo_sort: { name:"Topological Sort", icon:`<svg ${ICON_ATTRS}><circle cx="4" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="12" r="2"/><path d="M6.3 12h3.4M14.3 12h3.4"/><path d="M8.7 10.4L10.3 12l-1.6 1.6M16.7 10.4L18.3 12l-1.6 1.6" stroke-width="1.6"/></svg>`, color:"var(--teal, #2dd4bf)", bg:"color-mix(in srgb, var(--teal, #2dd4bf) 12%, transparent)", family:"tree_graph",
    why:"Order nodes of a DAG so every edge points forward. Kahn's algorithm (BFS on in-degree) or DFS post-order.",
    identify:["Dependencies / prerequisites","'Can you finish all courses?'","Build / compile order","Alien dictionary letter order","Detect cycle in a directed graph"],
    signals:["topological","course schedule","prerequisites","dependency","build order","alien dictionary","ordering with constraints","directed acyclic","can finish"],
    time:"O(V+E)", space:"O(V)" },
  union_find: { name:"Union-Find (DSU)", icon:`<svg ${ICON_ATTRS}><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>`, color:"var(--pink)", bg:"color-mix(in srgb, var(--pink) 12%, transparent)", family:"tree_graph",
    why:"Track connected groups with near-O(1) merge and find. Best when edges arrive dynamically or you count components.",
    identify:["Count connected components","Detect cycle in undirected graph","'Are A and B in the same group?'","Edges added one by one (dynamic connectivity)","Redundant connection / accounts merge"],
    signals:["connected components","union find","disjoint set","same group","redundant connection","accounts merge","number of provinces","dynamic connectivity","friend circles","kruskal"],
    time:"O(α(n)) ≈ O(1)", space:"O(n)" },
  dijkstra: { name:"Dijkstra / Weighted Shortest Path", icon:`<svg ${ICON_ATTRS}><circle cx="4" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="20" cy="18" r="2"/><path d="M5.6 16.6L10.6 7.6" stroke-width="2.2"/><path d="M13.4 7.6L18.4 16.6" stroke-width="1.1" opacity="0.35"/></svg>`, color:"var(--blue)", bg:"color-mix(in srgb, var(--blue) 12%, transparent)", family:"tree_graph",
    why:"Shortest path when edges have non-negative weights — a min-heap always expands the cheapest frontier node.",
    identify:["Edges have weights / costs / times","Cheapest or fastest path between nodes","Network delay / signal time","'Path with minimum effort'","Cheapest flights within K stops"],
    signals:["shortest path","weighted","minimum cost path","network delay","cheapest flights","path with minimum effort","dijkstra","weighted graph","minimum time","swim in rising water"],
    time:"O(E log V)", space:"O(V)" },
  heap: { name:"Top-K / Heap", icon:`<svg ${ICON_ATTRS}><circle cx="12" cy="5" r="2"/><circle cx="6" cy="13" r="2"/><circle cx="18" cy="13" r="2"/><circle cx="3" cy="20" r="1.6"/><circle cx="9" cy="20" r="1.6"/><path d="M10.6 6.6L7.4 11.4M13.4 6.6L16.6 11.4M4.4 14.6L4 18.4M7.6 14.6L8 18.4" stroke-width="1.5"/></svg>`, color:"var(--yellow)", bg:"color-mix(in srgb, var(--yellow) 12%, transparent)", family:"search",
    why:"A heap of size K gives you the K largest/smallest without sorting everything — O(n log k).",
    identify:["K largest / smallest / most frequent","Kth element in a collection","Closest K points to origin","Reorganise / schedule by frequency","Merge ranked streams"],
    signals:["top k","k largest","k smallest","kth largest","most frequent","closest k points","k closest","reorganize string","task scheduler","priority"],
    time:"O(n log k)", space:"O(k)" },
  two_heaps: { name:"Two Heaps", icon:`<svg ${ICON_ATTRS}><path d="M12 4v16M6 8h12"/><path d="M6 8l-3 6h6z"/><path d="M18 8l-3 6h6z" stroke-width="1.4"/><path d="M9 20h6" stroke-width="1.8"/></svg>`, color:"var(--yellow)", bg:"color-mix(in srgb, var(--yellow) 12%, transparent)", family:"search",
    why:"A max-heap for the lower half and a min-heap for the upper half keeps the median at the tops in O(log n).",
    identify:["Find median of a data stream","Median of a sliding window","Balance two halves of a dataset","IPO / maximise capital","Schedule with two competing priorities"],
    signals:["median of stream","find median","sliding window median","two heaps","maximize capital","ipo","balance halves"],
    time:"O(log n) per op", space:"O(n)" },
  kway_merge: { name:"K-way Merge", icon:`<svg ${ICON_ATTRS}><path d="M4 5h4M4 12h4M4 19h4"/><path d="M8 5l8 6M8 12h8M8 19l8-6"/><path d="M16 12h4"/></svg>`, color:"var(--yellow)", bg:"color-mix(in srgb, var(--yellow) 12%, transparent)", family:"search",
    why:"A min-heap holding one element from each sorted list merges K sorted sequences in O(n log k).",
    identify:["Merge K sorted lists / arrays","Smallest range covering all K lists","Kth smallest in a sorted matrix","Kth smallest sum from pairs"],
    signals:["merge k sorted","k sorted lists","smallest range","kth smallest in matrix","kth smallest sum","sorted matrix"],
    time:"O(n log k)", space:"O(k)" },
  backtracking: { name:"Backtracking", icon:`<svg ${ICON_ATTRS}><circle cx="12" cy="5" r="2"/><circle cx="7" cy="13" r="2"/><circle cx="17" cy="13" r="2" opacity="0.3"/><path d="M10.4 6.6L8.6 11.4" stroke-width="2"/><path d="M13.6 6.6L15.4 11.4" stroke-width="1.1" opacity="0.3"/><path d="M6 16a3 3 0 0 0 3 3" stroke-width="1.6"/><path d="M6.5 21l-1.2-2.2 2.4-.4" stroke-width="1.4"/></svg>`, color:"var(--pink)", bg:"color-mix(in srgb, var(--pink) 12%, transparent)", family:"backtracking",
    why:"Build a solution choice by choice; abandon (backtrack) any branch that breaks a constraint. Enumerates every valid configuration.",
    identify:["Generate ALL subsets / combinations","All permutations","N-Queens / Sudoku / constraint puzzles","Word search on a grid","Partition into valid groups"],
    signals:["all subsets","all combinations","permutations","n-queens","sudoku","word search","generate parentheses","combination sum","partition","palindrome partitioning","all possible","letter combinations"],
    time:"O(2ⁿ) / O(n!)", space:"O(n)" },
  dp: { name:"Dynamic Programming", icon:`<svg ${ICON_ATTRS}><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`, color:"var(--accent)", bg:"color-mix(in srgb, var(--accent) 12%, transparent)", family:"dp",
    why:"Overlapping subproblems + optimal substructure: solve each subproblem once and reuse. Sub-types — 0/1 knapsack, unbounded, LCS/LIS, interval DP, DP on grids/trees, bitmask DP.",
    identify:["Count number of ways to reach X","Min cost / max value to a goal","Include-or-exclude each item (knapsack)","Longest common/increasing subsequence","Coin change, edit distance, grid paths"],
    signals:["number of ways","count ways","minimum cost","maximum value","minimum number of","knapsack","subset sum","coin change","climbing stairs","edit distance","longest common subsequence","longest increasing","lcs","lis","word break","house robber","grid paths","partition equal subset","matrix chain","longest palindromic"],
    time:"O(n·states)", space:"O(states)" },
  greedy: { name:"Greedy", icon:`<svg ${ICON_ATTRS}><path d="M4 20V15H8V20ZM10 20V11H14V20ZM16 20V6H20V20Z"/><path d="M18 4l-2 2M18 4l2 2" stroke-width="1.6"/></svg>`, color:"var(--green)", bg:"var(--green-bg, rgba(16,185,129,.12))", family:"greedy",
    why:"Take the locally best choice each step. Valid only when local optimum provably leads to global optimum — no reconsideration.",
    identify:["Minimum jumps / can you reach the end","Max non-overlapping intervals","Assign tasks/cookies to maximise served","Gas station circuit","Build smallest/largest number"],
    signals:["minimum jumps","jump game","can reach","activity selection","non-overlapping","gas station","assign cookies","minimum platforms","largest number","candy distribution","greedy"],
    time:"O(n log n)", space:"O(1)" },
  trie: { name:"Trie (Prefix Tree)", icon:`<svg ${ICON_ATTRS}><circle cx="12" cy="4" r="1.8"/><circle cx="6" cy="11" r="1.8"/><circle cx="18" cy="11" r="1.8"/><circle cx="3" cy="18" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/><circle cx="21" cy="18" r="1.5"/><path d="M10.7 5.4L7.3 9.6M13.3 5.4L16.7 9.6M4.8 12.5L4.2 16.5M7.2 12.5L7.8 16.5M16.8 12.5L16.2 16.5M19.2 12.5L19.8 16.5" stroke-width="1.3"/></svg>`, color:"var(--teal, #2dd4bf)", bg:"color-mix(in srgb, var(--teal, #2dd4bf) 12%, transparent)", family:"trie",
    why:"A tree keyed by characters — shared prefixes share paths. Prefix lookups become O(word length).",
    identify:["Many prefix / autocomplete queries","Insert + search a dictionary of words","Word search II (many words in a grid)","Replace words by root / shortest prefix","Maximum XOR pair (bit-trie)"],
    signals:["prefix","trie","autocomplete","dictionary of words","word search ii","starts with","implement trie","replace words","search suggestions","maximum xor"],
    time:"O(L) per op", space:"O(alphabet·N)" },
  bitwise: { name:"Bit Manipulation / XOR", icon:`<svg ${ICON_ATTRS}><rect x="3" y="9" width="3" height="6"/><rect x="8" y="6" width="3" height="9" opacity="0.35"/><rect x="13" y="9" width="3" height="6"/><rect x="18" y="6" width="3" height="9" opacity="0.35"/></svg>`, color:"var(--red)", bg:"color-mix(in srgb, var(--red) 12%, transparent)", family:"bitwise",
    why:"XOR cancels pairs (a^a=0); bit masks encode sets compactly. Turns counting/parity tricks into O(1) space.",
    identify:["Find the single / two unique numbers","Count set bits","Subsets via bitmask","Power of two / swap without temp","Missing number via XOR"],
    signals:["single number","xor","bits","bitmask","power of two","count bits","hamming","two single numbers","missing number xor","subsets bitmask","gray code"],
    time:"O(n)", space:"O(1)" },
  math: { name:"Math / Number Theory", icon:`<svg ${ICON_ATTRS}><path d="M18 4H6l6 8-6 8h12"/></svg>`, color:"var(--muted)", bg:"color-mix(in srgb, var(--muted) 14%, transparent)", family:"math",
    why:"Sometimes the structure is a formula, not a data structure — GCD, modular arithmetic, sieve, fast power, combinatorics.",
    identify:["n is huge (10⁹+) — needs O(log n) or O(1)","Primes / factorisation / sieve","GCD / LCM relationships","Modular arithmetic, fast exponentiation","Counting / probability / combinatorics"],
    signals:["prime","gcd","lcm","modulo","power","factorial","sieve","combinatorics","probability","digits","newton","sqrt","fast exponentiation","catalan"],
    time:"O(log n) / O(√n)", space:"O(1)" }
};

/* Fallback default per detected input type, used only when zero keywords
   match — avoids silently defaulting to the same pattern every time. */
const STRUCTURAL_DEFAULT = {
  "Linked list": "fast_slow",
  "Tree": "tree_dfs",
  "Graph / Grid": "graph",
  "Intervals": "merge_intervals",
  "2D Grid": "graph",
  "Array / String": "hashmap",
  "Array / Abstract": "hashmap"
};

/* Generic brute-force / waste / traps text per pattern family — honest
   and useful without hand-authoring 28 bespoke write-ups. */
const FAMILY_TEXT = {
  scan: {
    brute: "Check every pair (or re-scan from scratch at each step) — O(n²) or worse.",
    waste: "It re-examines elements you've already ruled out, instead of carrying forward what you learned in a single pass.",
    traps: ["Empty input or a single element", "Duplicate values changing the expected count"]
  },
  search: {
    brute: "Scan the whole range/collection linearly for every query — O(n) per query.",
    waste: "It doesn't exploit that the search space (or collection) is sorted/ordered, so it can't skip half the possibilities each step.",
    traps: ["Off-by-one at the search boundaries (lo/hi, mid rounding)", "Loop that never shrinks the range on some branch"]
  },
  interval: {
    brute: "Compare every interval against every other interval — O(n²).",
    waste: "It doesn't exploit that sorting by start time turns overlap-checking into one linear sweep.",
    traps: ["Intervals that only touch at an endpoint (inclusive vs exclusive)", "Input arrives unsorted"]
  },
  tree_graph: {
    brute: "Explore every path/node combination without tracking what's visited — exponential blow-up, or an infinite loop on a cycle.",
    waste: "It revisits nodes/paths already explored instead of marking visited state once and reusing it.",
    traps: ["Forgetting to mark nodes visited (infinite loop on cycles)", "Disconnected components not all separately explored"]
  },
  backtracking: {
    brute: "This *is* already the exhaustive search — try every choice via recursion, O(2ⁿ) or O(n!).",
    waste: "Nothing to eliminate structurally; the win comes from pruning bad branches as early as possible, not from a smarter data structure.",
    traps: ["Forgetting to un-choose (backtrack) before trying the next branch", "Duplicate results from equal elements — sort + skip duplicates"]
  },
  dp: {
    brute: "Recompute every branch recursively with no memory of past answers — exponential.",
    waste: "It solves the exact same subproblem many times because nothing remembers a previously-computed answer.",
    traps: ["Off-by-one in the base case / table size", "Integer overflow on large counts or sums"]
  },
  greedy: {
    brute: "Try every ordering/combination of choices and keep the best — factorial or exponential.",
    waste: "Full search considers orderings a locally-optimal choice can already provably rule out.",
    traps: ["Greedy choice not actually optimal here — prove it or fall back to DP", "Ties in the greedy criterion need a secondary rule"]
  },
  trie: {
    brute: "Scan the entire word list from scratch for every prefix query — O(n·L) per query.",
    waste: "It re-reads full words repeatedly instead of sharing common prefixes in one structure.",
    traps: ["Case sensitivity / non-letter characters", "Marking end-of-word vs. just a visited node"]
  },
  bitwise: {
    brute: "Track counts/seen values in a hash set or map — an extra O(n) space.",
    waste: "It spends memory tracking state that XOR or bit masks can cancel out or encode for free.",
    traps: ["Sign bit / negative numbers with shifts", "32-bit vs. 64-bit overflow"]
  },
  math: {
    brute: "Iterate every candidate value up to n and test it directly — O(n) or O(√n) per check.",
    waste: "It doesn't exploit a closed-form or number-theory shortcut (modular arithmetic, sieve, fast exponentiation) that skips most candidates.",
    traps: ["Integer overflow — use modulo or 64-bit arithmetic", "n = 0 or 1 edge cases"]
  }
};

/* ── Constraint reading: pull the largest n-ish number out of the text
   and map it to a target complexity. Buckets are strict, non-overlapping
   upper bounds — no ambiguous double-use of one value. ────────────────── */
const N_BUCKETS = [
  { max:12,        cx:"O(n!) or O(2ⁿ·n)",  label:"n ≤ 12" },
  { max:25,        cx:"O(2ⁿ)",             label:"n ≤ 25" },
  { max:500,       cx:"O(n³)",             label:"n ≤ 500" },
  { max:2000,      cx:"O(n²)",             label:"n ≤ 2,000" },
  { max:100000,    cx:"O(n log n)",        label:"n ≤ 100,000" },
  { max:10000000,  cx:"O(n)",              label:"n ≤ 10,000,000" },
  { max:Infinity,  cx:"O(log n) or O(1)",  label:"n ≥ 10⁷" }
];
function targetComplexityFor(n){
  for(const b of N_BUCKETS) if(n <= b.max) return b;
  return N_BUCKETS[N_BUCKETS.length-1];
}
// Find the largest bound in a chunk of text (handles "10^5", "10**5", and
// plain/comma'd integers ≥ 1000).
function maxBoundIn(str){
  let best = 0;
  const powMatches = str.match(/10\s*\^?\s*\*?\*?\s*(\d{1,2})/g) || [];
  for(const tok of powMatches){
    const m = tok.match(/(\d{1,2})\s*$/);
    if(m){ const n = Math.pow(10, parseInt(m[1],10)); if(n > best) best = n; }
  }
  const rawNums = str.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d{4,}\b/g) || [];
  for(const tok of rawNums){
    const n = parseInt(tok.replace(/,/g,''), 10);
    if(n > best) best = n;
  }
  return best;
}

// Constraint blocks mix SIZE bounds ("nums.length <= 10^5") with VALUE-range
// bounds ("-10^9 <= nums[i] <= 10^9") — only the former sets the complexity
// budget. Prefer an explicit size-variable inequality; fall back to any
// clause mentioning length/size/count; only then fall back to the naive
// whole-text max (flagged as approximate by the caller).
function detectConstraint(text){
  const sizeVarMatches = text.match(/\b(?:n|m|k|len|length|\w+\.length)\s*<=?\s*(?:10\s*\^?\s*\*?\*?\s*\d{1,2}|\d{1,3}(?:,\d{3})+|\d{4,})/gi) || [];
  if(sizeVarMatches.length){
    const best = Math.max(...sizeVarMatches.map(maxBoundIn));
    if(best > 0) return best;
  }
  const sizeClauses = text.match(/[^.;\n]*\b(length|size|count of|number of)\b[^.;\n]*/gi) || [];
  if(sizeClauses.length){
    const best = Math.max(...sizeClauses.map(maxBoundIn));
    if(best > 0) return best;
  }
  const fallback = maxBoundIn(text);
  return fallback > 0 ? fallback : null;
}

function detectInputType(text){
  const t = text.toLowerCase();
  if(/linked.?list|listnode|\.next\b/.test(t)) return "Linked list";
  if(/\btree\b|\broot\b|\bbst\b|treenode|left.*right.*child/.test(t)) return "Tree";
  if(/\bgraph\b|adjacency|\bedges\b|vertices|provinces|island|topolog|prerequisite/.test(t)) return "Graph / Grid";
  if(/interval|meeting|\[start|booking/.test(t)) return "Intervals";
  if(/\bmatrix\b|\bgrid\b|2d array/.test(t)) return "2D Grid";
  if(/array|nums|string|substring|characters|list of/.test(t)) return "Array / String";
  return "Array / Abstract";
}
function detectOutput(text){
  const t = text.toLowerCase();
  if(/all .*(combination|subset|permut|partition)|generate all/.test(t)) return "Enumerate every configuration";
  if(/number of ways|count .*ways|how many ways/.test(t)) return "Count the ways (likely DP)";
  if(/minimum (cost|number|jumps|steps)|maximum (value|profit)/.test(t)) return "Optimise a value";
  if(/shortest path|cheapest|minimum (time|effort)/.test(t)) return "Shortest / cheapest path";
  if(/k(th| )(largest|smallest|frequent|closest)/.test(t)) return "Top-K / selection";
  if(/median/.test(t)) return "Running median";
  if(/missing|duplicate/.test(t)) return "Find missing / duplicate";
  if(/longest|shortest|maximum|minimum/.test(t)) return "Optimal subarray/substring";
  if(/pair|triplet|two sum/.test(t)) return "Pair/triplet matching";
  return "Find / return a value";
}

// Weight each hit by how many words the signal phrase has — a specific
// 3-word phrase ("merge k sorted") is a far stronger tell than a generic
// 2-word one ("linked list") that many patterns' problems happen to mention
// in passing. Flat +1-per-hit let generic phrases outrank specific ones on
// ties (e.g. a linked-list merge problem losing to Fast & Slow Pointers
// instead of K-way Merge).
function scorePatterns(text){
  const lower = text.toLowerCase();
  const scores = {}, hits = {};
  for(const [k,p] of Object.entries(PATTERNS)){
    scores[k] = 0; hits[k] = [];
    for(const sig of p.signals){
      if(lower.includes(sig)){
        scores[k] += sig.trim().split(/\s+/).length;
        hits[k].push(sig);
      }
    }
  }
  return { scores, hits };
}
function rankPatterns(scores, n=4){
  return Object.entries(scores).sort((a,b)=>b[1]-a[1]).filter(([,s])=>s>0).slice(0,n).map(([k])=>k);
}

/* ── Render ─────────────────────────────────────────────────────────── */
function esc(s){ return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function stepHtml(n, label, body){
  return `<div class="pf-step">
    <div class="pf-step-num">${n}</div>
    <div class="pf-step-body">
      <div class="pf-step-label">${esc(label)}</div>
      <div class="pf-step-text">${body}</div>
    </div>
  </div>`;
}

function analyze(text){
  const inputType = detectInputType(text);
  const outputGoal = detectOutput(text);
  const nEst = detectConstraint(text);
  const targetBucket = targetComplexityFor(nEst || 100000);

  const { scores, hits } = scorePatterns(text);
  const ranked = rankPatterns(scores, 4);
  let topKey, confidence, matchedSignals;
  if(ranked.length){
    topKey = ranked[0];
    matchedSignals = hits[topKey];
    // A tied top score (another pattern scored exactly the same) means the
    // keyword match didn't actually distinguish between them — say so
    // instead of reporting false confidence.
    const tied = ranked.length > 1 && scores[ranked[1]] === scores[topKey];
    confidence = tied ? 'tied' : (matchedSignals.length >= 3 ? 'high' : 'medium');
  } else {
    topKey = STRUCTURAL_DEFAULT[inputType] || 'hashmap';
    matchedSignals = [];
    confidence = 'low';
  }
  const pat = PATTERNS[topKey];
  const fam = FAMILY_TEXT[pat.family];
  const others = ranked.filter(k => k !== topKey).slice(0,3);

  return { inputType, outputGoal, nEst, targetBucket, topKey, pat, fam, confidence, matchedSignals, others };
}

function confidenceMeta(confidence){
  if(confidence === 'high') return { color:'var(--green)', bg:'var(--green-bg, rgba(16,185,129,.12))', label:'Strong keyword match' };
  if(confidence === 'medium') return { color:'var(--yellow)', bg:'color-mix(in srgb, var(--yellow) 12%, transparent)', label:'Some keyword match' };
  if(confidence === 'tied') return { color:'var(--yellow)', bg:'color-mix(in srgb, var(--yellow) 12%, transparent)', label:'Tied with another pattern — check "Also consider" below' };
  if(confidence === 'manual') return { color:'var(--muted)', bg:'color-mix(in srgb, var(--muted) 14%, transparent)', label:'Manually selected' };
  return { color:'var(--red)', bg:'color-mix(in srgb, var(--red) 12%, transparent)', label:'Low confidence — structural guess only, verify against the recognition list below' };
}

// Single render path — used both for the initial analysis and for candidate-chip swaps.
function render(r){
  const p = r.pat;
  const conf = confidenceMeta(r.confidence);

  let html = `<div class="pf-result-head">
    <div class="pf-pattern-badge" style="background:${p.bg};color:${p.color};border-color:${p.color}">${p.icon}${esc(p.name)}</div>
    <div class="pf-confidence" style="background:${conf.bg};color:${conf.color}">${esc(conf.label)}</div>
  </div>`;

  if(r.others.length){
    html += `<div class="pf-candidates">Also consider: ` +
      r.others.map(k => `<span class="pf-cand-chip" data-pat="${k}">${PATTERNS[k].icon}${esc(PATTERNS[k].name)}</span>`).join(' ') +
      `</div>`;
  }

  html += `<div class="pf-steps">`;
  html += stepHtml(1, "Restate", `You're given <b>${esc(r.inputType)}</b>, and the goal is to <b>${esc(r.outputGoal.toLowerCase())}</b>.`);
  html += stepHtml(2, "Brute force", r.fam.brute);
  html += stepHtml(3, "The waste", r.fam.waste);
  html += stepHtml(4, "Constraints read", r.nEst
    ? `Largest bound found ≈ <b>${r.nEst.toLocaleString()}</b> → target complexity <b>${r.targetBucket.cx}</b> (${r.targetBucket.label}).`
    : `No explicit size bound found in the text — assuming n ~ 10⁵ by default → target complexity <b>${targetComplexityFor(100000).cx}</b>. Paste the constraints line for a precise read.`);
  html += stepHtml(5, "Property to exploit", esc(p.why));
  html += stepHtml(6, "Pattern", `<span class="pf-inline-badge" style="background:${p.bg};color:${p.color}">${p.icon}${esc(p.name)}</span>`);
  html += stepHtml(7, "Signs it fits / approach", `<ul class="pf-list">${p.identify.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`);
  html += stepHtml(8, "Optimal complexity", `<div class="pf-cx-box"><span>Time: <b>${esc(p.time)}</b></span><span>Space: <b>${esc(p.space)}</b></span></div>`);
  html += stepHtml(9, "Common traps", `<ul class="pf-list">${r.fam.traps.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`);
  html += `</div>`;

  const panel = document.getElementById('pf-result');
  panel.innerHTML = html;
  panel.classList.add('show');

  panel.querySelectorAll('.pf-cand-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const key = chip.dataset.pat;
      const swapped = analyze(document.getElementById('pf-input').value);
      swapped.topKey = key;
      swapped.pat = PATTERNS[key];
      swapped.fam = FAMILY_TEXT[swapped.pat.family];
      swapped.confidence = 'manual';
      swapped.others = swapped.others.filter(k=>k!==key);
      render(swapped);
    });
  });
}
function renderResult(text){ render(analyze(text)); }

/* ── Wiring ─────────────────────────────────────────────────────────── */
function openPatternFinder(){ openModal('pattern-modal'); }

// Script tag sits at the bottom of <body> with no `defer`, so the DOM is
// already parsed by the time this runs — DOMContentLoaded has already fired
// and would never invoke a listener registered here. Wire up directly.
(function wire(){
  const btn = document.getElementById('btn-pattern');
  const mBtn = document.getElementById('m-pattern');
  if(btn) btn.addEventListener('click', openPatternFinder);
  if(mBtn) mBtn.addEventListener('click', openPatternFinder);

  const analyzeBtn = document.getElementById('pf-analyze');
  const clearBtn = document.getElementById('pf-clear');
  const input = document.getElementById('pf-input');
  if(analyzeBtn) analyzeBtn.addEventListener('click', ()=>{
    const text = (input.value || '').trim();
    const status = document.getElementById('pf-status');
    if(!text){ status.textContent = 'Paste a problem statement first.'; return; }
    status.textContent = '';
    renderResult(text);
  });
  if(clearBtn) clearBtn.addEventListener('click', ()=>{
    input.value = '';
    document.getElementById('pf-result').classList.remove('show');
    document.getElementById('pf-result').innerHTML = '';
    document.getElementById('pf-status').textContent = '';
  });
})();

window._openPatternFinder = openPatternFinder;
})();
