/* ══════════════════════════════════════════════════════════════════════
   java-preamble.js ─ Java source prepended to every user program.
   Mirrors the Python PREAMBLE and tracer in tracer.js: helper types, the
   serializer that buckets values into the renderer's categories, and the
   call-stack bookkeeping behind the Call Stack and Recursion Tree panels.

   Every card this emits must match what tracer.js emits field for field,
   because the renderers were written against Python's output:
     line, filename, locals, lists, grids, dicts, sets, deques,
     linked_lists, trees, node_pointers, _var_order,
     call_depth, current_call_id, max_call_id, cond, stmt
   plus sid, which lang.js uses to derive cond and stmt afterwards.

   Note on quoting: this Java deliberately contains ZERO backslashes.
   Every quote character comes from the QU constant instead of an escape
   sequence, so the source survives being embedded in a JS template
   literal without a second layer of escaping to get wrong.
   ══════════════════════════════════════════════════════════════════════ */

const JAVA_PREAMBLE = `
import java.util.*;

class ListNode {
  int val; ListNode next;
  ListNode(){} ListNode(int v){val=v;} ListNode(int v,ListNode n){val=v;next=n;}
}
class TreeNode {
  int val; TreeNode left, right;
  TreeNode(){} TreeNode(int v){val=v;} TreeNode(int v,TreeNode l,TreeNode r){val=v;left=l;right=r;}
}

class __Tracer {
  static final char QU = (char)34;   // double quote
  static final char BK = (char)92;   // backslash
  static final int CAP = 1000;       // STEP_CAP in tracer.js
  static int steps = 0;
  static int depth = 0;
  static int nextId = 1;
  static ArrayDeque<Integer> stack = new ArrayDeque<Integer>();
  static Object lastRet = null;
  static boolean hasRet = false;

  static String esc(String s){
    StringBuilder b = new StringBuilder();
    for(int i=0;i<s.length();i++){
      char c = s.charAt(i);
      if(c==QU){ b.append(BK).append(QU); }
      else if(c==BK){ b.append(BK).append(BK); }
      else if(c==(char)10){ b.append(BK).append('n'); }
      else if(c==(char)13){ b.append(BK).append('r'); }
      else if(c==(char)9){ b.append(BK).append('t'); }
      else if(c<32){ b.append(BK).append('u').append(String.format("%04x",(int)c)); }
      else { b.append(c); }
    }
    return b.toString();
  }

  static String q(String s){ return QU + esc(s) + QU; }

  static boolean isArr(Object o){ return o != null && o.getClass().isArray(); }

  /* A row of primitives: tracer.js _grid only accepts rows whose cells are
     primitive, so a list of lists of lists is a list, not a grid. */
  static boolean flatRow(Object x){
    if(isArr(x)) return !x.getClass().getComponentType().isArray();
    if(x instanceof List){
      for(Object y : (List<?>)x)
        if(isArr(y) || y instanceof Collection || y instanceof Map) return false;
      return true;
    }
    return false;
  }

  /* Same classification as tracer.js _cap_val, where Java's static types
     allow it to be exact. */
  static String bucket(Object o){
    if(o == null) return "locals";
    if(isArr(o)){
      int n = java.lang.reflect.Array.getLength(o);
      if(n > 0 && o.getClass().getComponentType().isArray()){
        for(int i=0;i<n;i++) if(!flatRow(java.lang.reflect.Array.get(o,i))) return "lists";
        return "grids";
      }
      return "lists";
    }
    if(o instanceof PriorityQueue) return "lists";   // drawn as a heap, see lang.js
    if(o instanceof Deque) return "deques";
    if(o instanceof Map) return "dicts";
    if(o instanceof Set) return "sets";
    if(o instanceof List){
      List<?> l = (List<?>)o;
      if(l.isEmpty()) return "lists";
      for(Object x : l) if(!flatRow(x)) return "lists";
      return "grids";
    }
    if(o instanceof ListNode) return "linked_lists";
    if(o instanceof TreeNode) return "trees";
    return "locals";
  }

  /* Values tracer.js treats as primitive (_p). Anything else that lands in
     locals, a user-defined object, is not shown, exactly as in Python. */
  static boolean scalar(Object o){
    return o == null || o instanceof Boolean || o instanceof Number ||
           o instanceof Character || o instanceof CharSequence;
  }

  static String ser(Object o){
    if(o == null) return "null";
    if(o instanceof Boolean || o instanceof Integer || o instanceof Long ||
       o instanceof Short || o instanceof Byte) return o.toString();
    if(o instanceof Double || o instanceof Float){
      double d = ((Number)o).doubleValue();
      if(Double.isNaN(d) || Double.isInfinite(d)) return "null";
      return o.toString();
    }
    if(o instanceof Character || o instanceof CharSequence) return q(o.toString());

    if(isArr(o)){
      int n = java.lang.reflect.Array.getLength(o);
      StringBuilder b = new StringBuilder("[");
      for(int i=0;i<n && i<500;i++){
        if(i>0) b.append(',');
        b.append(ser(java.lang.reflect.Array.get(o,i)));
      }
      return b.append(']').toString();
    }

    /* A node reached through ser() is an ELEMENT of something: a TreeNode
       in a BFS queue, a ListNode in a heap of list heads. tracer.js shows
       those by repr, Tree(v) / Node(v), not as the whole structure hanging
       off them. Whole structures go through serLL / serTree instead. */
    if(o instanceof ListNode) return q("Node(" + ((ListNode)o).val + ")");
    if(o instanceof TreeNode) return q("Tree(" + ((TreeNode)o).val + ")");

    if(o instanceof Map){ StringBuilder b=new StringBuilder("{"); boolean f=true; int k=0;
      for(Object e : ((Map<?,?>)o).entrySet()){
        if(k++>=200) break;
        Map.Entry<?,?> en=(Map.Entry<?,?>)e; if(!f)b.append(','); f=false;
        b.append(q(String.valueOf(en.getKey()))).append(':').append(ser(en.getValue()));
      } return b.append('}').toString(); }

    /* PriorityQueue iterates in internal heap-array order, which is exactly
       the array a heap diagram is drawn from. */
    if(o instanceof Collection){ StringBuilder b=new StringBuilder("["); boolean f=true; int k=0;
      for(Object x : (Collection<?>)o){ if(k++>=500) break; if(!f)b.append(','); f=false; b.append(ser(x)); }
      return b.append(']').toString(); }

    return q(String.valueOf(o));
  }

  /* The linked_lists and trees BUCKETS are not plain arrays. tracer.js
     stores {nodes:[{id,val}], cycle_to} and a nested {id,val,left,right},
     and renderers.js destructures exactly those. Node identity comes from
     System.identityHashCode, standing in for Python's id(). */
  static String serLL(ListNode head){
    StringBuilder b = new StringBuilder("{");
    b.append(q("nodes")).append(":[");
    LinkedHashMap<Integer,Integer> seen = new LinkedHashMap<Integer,Integer>();
    ListNode p = head; int idx = 0; boolean f = true; String cyc = "null";
    while(p != null && idx < 200){
      int nid = System.identityHashCode(p);
      if(seen.containsKey(nid)){ cyc = String.valueOf(seen.get(nid)); break; }
      seen.put(nid, idx);
      if(!f) b.append(',');
      f = false;
      b.append('{').append(q("id")).append(':').append(nid)
       .append(',').append(q("val")).append(':').append(ser(p.val)).append('}');
      p = p.next; idx++;
    }
    b.append("],").append(q("cycle_to")).append(':').append(cyc);
    return b.append('}').toString();
  }

  static String serTree(TreeNode n, HashSet<Integer> seen){
    if(n == null) return "null";
    int nid = System.identityHashCode(n);
    if(seen.contains(nid) || seen.size() >= 200) return "null";
    seen.add(nid);
    StringBuilder b = new StringBuilder("{");
    b.append(q("id")).append(':').append(nid);
    b.append(',').append(q("val")).append(':').append(ser(n.val));
    b.append(',').append(q("left")).append(':').append(serTree(n.left, seen));
    b.append(',').append(q("right")).append(':').append(serTree(n.right, seen));
    return b.append('}').toString();
  }

  static String serFor(String bucket, Object v){
    if(bucket.equals("linked_lists") && v instanceof ListNode) return serLL((ListNode)v);
    if(bucket.equals("trees") && v instanceof TreeNode)
      return serTree((TreeNode)v, new HashSet<Integer>());
    return ser(v);
  }

  /* The RESULT panel takes a different shape again: tracer.js wraps
     structures as {__kind__:'tree',root} and {__kind__:'list',nodes,cycle_to}. */
  static String serResult(Object o){
    if(o instanceof ListNode)
      return "{" + q("__kind__") + ":" + q("list") + "," + serLL((ListNode)o).substring(1);
    if(o instanceof TreeNode)
      return "{" + q("__kind__") + ":" + q("tree") + "," + q("root") + ":"
             + serTree((TreeNode)o, new HashSet<Integer>()) + "}";
    return ser(o);
  }

  /* Python raises at STEP_CAP and keeps the trace so far. Stopping the JVM
     here does the same: every card already printed is kept. */
  static void cap(){
    System.out.println("__CAP");
    System.exit(0);
  }

  /* Every node reachable from a list head or tree root, for the pointer
     dedup below. */
  static void collect(Object v, HashSet<Integer> into){
    if(v instanceof ListNode){
      ListNode p = (ListNode)v; int g = 0;
      while(p != null && g++ < 200){ if(!into.add(System.identityHashCode(p))) break; p = p.next; }
    } else if(v instanceof TreeNode){
      ArrayList<TreeNode> q2 = new ArrayList<TreeNode>(); q2.add((TreeNode)v); int i = 0;
      while(i < q2.size() && into.size() < 400){
        TreeNode t = q2.get(i++); if(t == null) continue;
        if(!into.add(System.identityHashCode(t))) continue;
        q2.add(t.left); q2.add(t.right);
      }
    }
  }

  static void emit(int line, int sid, Object[] kv){
    String[] names = {"locals","lists","grids","dicts","sets","deques","linked_lists","trees"};
    LinkedHashMap<String,StringBuilder> buckets = new LinkedHashMap<String,StringBuilder>();
    for(String k : names) buckets.put(k, new StringBuilder());
    StringBuilder order = new StringBuilder();
    StringBuilder ptrs = new StringBuilder();
    /* tracer.js _snap: a variable pointing at a node some earlier variable's
       list or tree already contains is drawn as a pointer label on that
       structure (node_pointers) instead of as a second copy of it. That is
       how Python shows cur and prev as arrows on one chain. */
    HashSet<Integer> tracked = new HashSet<Integer>();
    for(int i=0;i+1<kv.length;i+=2){
      String name = String.valueOf(kv[i]);
      Object val  = kv[i+1];
      String bk = bucket(val);
      if(bk.equals("locals") && !scalar(val)) continue;
      if((bk.equals("linked_lists") || bk.equals("trees"))
         && tracked.contains(System.identityHashCode(val))){
        if(ptrs.length()>0) ptrs.append(',');
        ptrs.append(q(name)).append(':').append(System.identityHashCode(val));
        if(order.length()>0) order.append(',');
        order.append(q(name));
        StringBuilder lb = buckets.get("locals");
        if(lb.length()>0) lb.append(',');
        lb.append(q(name)).append(':').append(val instanceof ListNode ? ((ListNode)val).val : ((TreeNode)val).val);
        continue;
      }
      if(bk.equals("linked_lists") || bk.equals("trees")) collect(val, tracked);
      StringBuilder b = buckets.get(bk);
      if(b.length()>0) b.append(',');
      b.append(q(name)).append(':').append(serFor(bk, val));
      if(!bk.equals("locals")){
        if(order.length()>0) order.append(',');
        order.append(q(name));
      }
      /* tracer.js also records a node's val as a plain local (sc[n]=v.val),
         so the variable chips show it alongside the diagram. */
      if(val instanceof ListNode || val instanceof TreeNode){
        StringBuilder lb = buckets.get("locals");
        if(lb.length()>0) lb.append(',');
        int nv = (val instanceof ListNode) ? ((ListNode)val).val : ((TreeNode)val).val;
        lb.append(q(name)).append(':').append(nv);
      }
    }
    StringBuilder o = new StringBuilder("__T{");
    o.append(q("line")).append(':').append(line);
    o.append(',').append(q("sid")).append(':').append(sid);
    o.append(',').append(q("filename")).append(':').append(q("<user>"));
    for(Map.Entry<String,StringBuilder> e : buckets.entrySet())
      o.append(',').append(q(e.getKey())).append(":{").append(e.getValue()).append('}');
    o.append(',').append(q("node_pointers")).append(":{").append(ptrs).append('}');
    o.append(',').append(q("_var_order")).append(":[").append(order).append(']');
    o.append(',').append(q("call_depth")).append(':').append(depth);
    o.append(',').append(q("current_call_id")).append(':')
     .append(stack.isEmpty() ? "null" : String.valueOf(stack.peek()));
    o.append(',').append(q("max_call_id")).append(':').append(nextId - 1);
    o.append(',').append(q("cond")).append(":null");
    o.append(',').append(q("stmt")).append(":null");
    o.append('}');
    System.out.println(o);
  }

  /* Card BEFORE a statement runs. tracer.js snapshots on the LINE event,
     which also fires before the line executes, and render-core.js relies on
     that: it highlights card k's line and shows card k+1's state. */
  static void t(int line, int sid, Object... kv){
    if(steps >= CAP) cap();
    steps++;
    emit(line, sid, kv);
  }

  /* Card at a loop-condition check. Injected as  c(...) && (cond)  so it
     fires before every evaluation, the way Python re-fires the loop line. */
  static boolean c(int line, int sid, Object... kv){
    t(line, sid, kv);
    return true;
  }

  /* Call-stack args and return values. Python shows a node as its
     __repr__, Node(v) or Tree(v), not as the whole structure. The __repr__
     key tells lang.js to print the string without quotes. */
  static String serArg(Object v){
    if(v instanceof ListNode) return "{" + q("__repr__") + ":" + q("Node(" + ((ListNode)v).val + ")") + "}";
    if(v instanceof TreeNode) return "{" + q("__repr__") + ":" + q("Tree(" + ((TreeNode)v).val + ")") + "}";
    return ser(v);
  }

  static void enter(String fn, Object... kv){
    int id = nextId++;
    StringBuilder args = new StringBuilder();
    for(int i=0;i+1<kv.length;i+=2){
      if(args.length()>0) args.append(',');
      args.append(q(String.valueOf(kv[i]))).append(':').append(serArg(kv[i+1]));
    }
    StringBuilder o = new StringBuilder("__CALL{");
    o.append(q("id")).append(':').append(id);
    o.append(',').append(q("fn")).append(':').append(q(fn));
    o.append(',').append(q("depth")).append(':').append(depth);
    o.append(',').append(q("parent")).append(':')
     .append(stack.isEmpty() ? "null" : String.valueOf(stack.peek()));
    o.append(',').append(q("args")).append(":{").append(args).append('}');
    o.append('}');
    System.out.println(o);
    stack.push(id); depth++;
  }

  /* return EXPR  becomes  return __Tracer.ret(EXPR). ret records the value
     for the frame about to exit; exit() in the method's finally block reads
     it. A void return or an exception leaves hasRet false, so the call
     records null. Any child call's exit has already cleared the slot. */
  static <T> T ret(T v){ lastRet = v; hasRet = true; return v; }

  static void exit(){
    Object r = hasRet ? lastRet : null;
    hasRet = false; lastRet = null;
    if(!stack.isEmpty()){
      StringBuilder o = new StringBuilder("__RET{");
      o.append(q("id")).append(':').append(stack.pop());
      o.append(',').append(q("ret")).append(':').append(serArg(r));
      o.append('}');
      System.out.println(o);
    }
    if(depth>0) depth--;
  }
}

class __H {
  static ListNode buildList(int[] v){
    if(v==null||v.length==0) return null;
    ListNode head=new ListNode(v[0]), p=head;
    for(int i=1;i<v.length;i++){ p.next=new ListNode(v[i]); p=p.next; }
    return head;
  }
  static TreeNode buildTree(Integer[] v){
    if(v==null||v.length==0||v[0]==null) return null;
    TreeNode root=new TreeNode(v[0]); ArrayDeque<TreeNode> qq=new ArrayDeque<TreeNode>();
    qq.add(root); int i=1;
    while(!qq.isEmpty() && i<v.length){
      TreeNode n=qq.poll();
      if(i<v.length && v[i]!=null){ n.left=new TreeNode(v[i]); qq.add(n.left); } i++;
      if(i<v.length && v[i]!=null){ n.right=new TreeNode(v[i]); qq.add(n.right); } i++;
    }
    return root;
  }
}
`;

/* Short aliases for hand-written test programs. The instrumenter itself
   always emits fully qualified __Tracer.x() calls. */
const JAVA_PREAMBLE_ALIASES = `
  static void __t(int line, Object... kv){ __Tracer.t(line, -1, kv); }
  static void __enter(String fn, Object... kv){ __Tracer.enter(fn, kv); }
  static void __exit(Object r){ __Tracer.ret(r); __Tracer.exit(); }
  static String __ser(Object o){ return __Tracer.ser(o); }
`;
