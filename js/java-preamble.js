/* ══════════════════════════════════════════════════════════════════════
   java-preamble.js ─ Java source prepended to every user program.
   Mirrors the Python PREAMBLE in tracer.js: helper types plus the
   serializer that buckets values into the renderer's categories.

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
  static int steps = 0;
  static final int CAP = 1000;
  static int depth = 0;
  static int nextId = 1;
  static ArrayDeque<Integer> stack = new ArrayDeque<Integer>();

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

  /* Which renderer bucket does this value belong in? Java's static types
     make this unambiguous, unlike Python's duck typing. */
  static String bucket(Object o){
    if(o instanceof int[][] || o instanceof char[][] ||
       o instanceof String[][] || o instanceof boolean[][]) return "grids";
    if(o instanceof int[] || o instanceof char[] || o instanceof String[] ||
       o instanceof boolean[] || o instanceof long[] || o instanceof double[]) return "lists";
    if(o instanceof Deque) return "deques";
    if(o instanceof Map) return "dicts";
    if(o instanceof Set) return "sets";
    if(o instanceof List) return "lists";
    if(o instanceof ListNode) return "linked_lists";
    if(o instanceof TreeNode) return "trees";
    return "locals";
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
    if(o instanceof Character || o instanceof String) return q(o.toString());

    if(o instanceof int[]){ int[] a=(int[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(','); b.append(a[i]); } return b.append(']').toString(); }
    if(o instanceof char[]){ char[] a=(char[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(','); b.append(q(String.valueOf(a[i]))); }
      return b.append(']').toString(); }
    if(o instanceof boolean[]){ boolean[] a=(boolean[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(','); b.append(a[i]); } return b.append(']').toString(); }
    if(o instanceof long[]){ long[] a=(long[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(','); b.append(a[i]); } return b.append(']').toString(); }
    if(o instanceof double[]){ double[] a=(double[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(','); b.append(a[i]); } return b.append(']').toString(); }
    if(o instanceof Object[]){ Object[] a=(Object[])o; StringBuilder b=new StringBuilder("[");
      for(int i=0;i<a.length;i++){ if(i>0)b.append(','); b.append(ser(a[i])); } return b.append(']').toString(); }

    if(o instanceof ListNode){
      StringBuilder b=new StringBuilder("["); ListNode p=(ListNode)o; int guard=0; boolean f=true;
      while(p!=null && guard++<200){ if(!f)b.append(','); f=false; b.append(p.val); p=p.next; }
      return b.append(']').toString();
    }
    if(o instanceof TreeNode){
      /* ArrayList, not ArrayDeque: a leaf's children are null and ArrayDeque
         throws NullPointerException on add(null). Level order with nulls,
         matching how LeetCode prints a tree. */
      StringBuilder b=new StringBuilder("["); ArrayList<TreeNode> q2=new ArrayList<TreeNode>();
      q2.add((TreeNode)o); int i=0; boolean f=true;
      while(i<q2.size() && i<200){
        TreeNode t=q2.get(i++); if(!f)b.append(','); f=false;
        if(t==null){ b.append("null"); continue; }
        b.append(t.val); q2.add(t.left); q2.add(t.right);
      }
      return b.append(']').toString();
    }

    if(o instanceof Map){ StringBuilder b=new StringBuilder("{"); boolean f=true;
      for(Object e : ((Map<?,?>)o).entrySet()){
        Map.Entry<?,?> en=(Map.Entry<?,?>)e; if(!f)b.append(','); f=false;
        b.append(q(String.valueOf(en.getKey()))).append(':').append(ser(en.getValue()));
      } return b.append('}').toString(); }

    if(o instanceof Collection){ StringBuilder b=new StringBuilder("["); boolean f=true;
      for(Object x : (Collection<?>)o){ if(!f)b.append(','); f=false; b.append(ser(x)); }
      return b.append(']').toString(); }

    return q(String.valueOf(o));
  }

  /* The linked_lists and trees BUCKETS are not plain arrays. tracer.js
     stores {nodes:[{id,val}], cycle_to} and a nested {id,val,left,right},
     and renderers.js destructures exactly those. Emitting an array here
     makes rLL throw on nodes.length. Node identity comes from
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

  /* Bucket values use the structure-shaped form; everything else uses ser. */
  static String serFor(String bucket, Object v){
    if(bucket.equals("linked_lists") && v instanceof ListNode) return serLL((ListNode)v);
    if(bucket.equals("trees") && v instanceof TreeNode)
      return serTree((TreeNode)v, new HashSet<Integer>());
    return ser(v);
  }

  /* The RESULT panel takes a different shape again: tracer.js:463,468 wrap
     structures as {__kind__:'tree',root} and {__kind__:'list',nodes,cycle_to}.
     Plain values pass through ser unchanged. */
  static String serResult(Object o){
    if(o instanceof ListNode)
      return "{" + q("__kind__") + ":" + q("list") + "," + serLL((ListNode)o).substring(1);
    if(o instanceof TreeNode)
      return "{" + q("__kind__") + ":" + q("tree") + "," + q("root") + ":"
             + serTree((TreeNode)o, new HashSet<Integer>()) + "}";
    return ser(o);
  }

  /* One card per traced statement. kv is name,value,name,value,... */
  static void t(int line, Object... kv){
    if(steps++ >= CAP) return;
    String[] names = {"locals","lists","grids","dicts","sets","deques","linked_lists","trees"};
    LinkedHashMap<String,StringBuilder> buckets = new LinkedHashMap<String,StringBuilder>();
    for(String k : names) buckets.put(k, new StringBuilder());
    for(int i=0;i+1<kv.length;i+=2){
      String name = String.valueOf(kv[i]);
      Object val  = kv[i+1];
      String bk = bucket(val);
      StringBuilder b = buckets.get(bk);
      if(b.length()>0) b.append(',');
      b.append(q(name)).append(':').append(serFor(bk, val));
    }
    StringBuilder o = new StringBuilder("__T{");
    o.append(q("line")).append(':').append(line);
    for(Map.Entry<String,StringBuilder> e : buckets.entrySet())
      o.append(',').append(q(e.getKey())).append(":{").append(e.getValue()).append('}');
    o.append(',').append(q("node_pointers")).append(":{}");
    o.append(',').append(q("call_depth")).append(':').append(depth);
    o.append(',').append(q("current_call_id")).append(':')
     .append(stack.isEmpty() ? "null" : String.valueOf(stack.peek()));
    o.append(',').append(q("cond")).append(":null");
    o.append(',').append(q("stmt")).append(":null");
    o.append('}');
    System.out.println(o);
  }

  static void enter(String fn, Object... kv){
    int id = nextId++;
    StringBuilder args = new StringBuilder();
    for(int i=0;i+1<kv.length;i+=2){
      if(args.length()>0) args.append(',');
      args.append(q(String.valueOf(kv[i]))).append(':').append(ser(kv[i+1]));
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

  static void exit(Object ret){
    if(!stack.isEmpty()){
      StringBuilder o = new StringBuilder("__RET{");
      o.append(q("id")).append(':').append(stack.pop());
      o.append(',').append(q("ret")).append(':').append(ser(ret));
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

/* The instrumenter emits bare __t / __enter / __exit / __ser calls; these
   aliases are injected into whichever class holds main(). */
const JAVA_PREAMBLE_ALIASES = `
  static void __t(int line, Object... kv){ __Tracer.t(line, kv); }
  static void __enter(String fn, Object... kv){ __Tracer.enter(fn, kv); }
  static void __exit(Object r){ __Tracer.exit(r); }
  static String __ser(Object o){ return __Tracer.ser(o); }
`;
