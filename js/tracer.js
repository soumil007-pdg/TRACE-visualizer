/* ══════════════════════════════════════════════════════════════════════
   tracer.js ─ The Python tracer harness that runs inside Pyodide.
   TRACER is a multi-line Python string executed once on Pyodide startup
   to define run_trace() and all helpers. JS then calls run_trace(_u,_d).
   No JS dependencies.
   ══════════════════════════════════════════════════════════════════════ */

const TRACER = `
import sys,json,math as _math,collections as _col,re as _re
STEP_CAP=1000;MAX_LL=200;MAX_TR=200
PREAMBLE="""
import heapq,math,bisect,random,string,sys
import collections,itertools,functools
from typing import Optional,List,Dict,Set,Tuple,Any
from collections import defaultdict,Counter,deque,OrderedDict
from bisect import bisect_left,bisect_right,insort
from functools import lru_cache,cache,reduce
from itertools import product,permutations,combinations,accumulate
from math import inf,gcd,ceil,floor,sqrt,log2,factorial
INF=float('inf')
class ListNode:
 def __init__(self,val=0,next=None):self.val=val;self.next=next
 def __repr__(self):return"Node("+str(self.val)+")"
class TreeNode:
 def __init__(self,val=0,left=None,right=None):self.val=val;self.left=left;self.right=right
 def __repr__(self):return"Tree("+str(self.val)+")"
def build_linked_list(values,pos=-1):
 if not values:return None
 nodes=[ListNode(v)for v in values]
 for i in range(len(nodes)-1):nodes[i].next=nodes[i+1]
 if 0<=pos<len(nodes):nodes[-1].next=nodes[pos]
 return nodes[0]
def build_tree(values):
 if not values:return None
 root=TreeNode(values[0]);q=[root];i=1
 while q and i<len(values):
  node=q.pop(0)
  if i<len(values)and values[i]is not None:node.left=TreeNode(values[i]);q.append(node.left)
  i+=1
  if i<len(values)and values[i]is not None:node.right=TreeNode(values[i]);q.append(node.right)
  i+=1
 return root
def find_node(root,val):
 if root is None:return None
 q=[root]
 while q:
  node=q.pop(0)
  if node.val==val:return node
  if node.left:q.append(node.left)
  if node.right:q.append(node.right)
 return None
"""
def _p(v):
 if v is None or isinstance(v,bool)or isinstance(v,(int,str)):return True
 if isinstance(v,float):return _math.isfinite(v)  # reject inf/nan
 return False
def _sl(v):
 if not isinstance(v,list):return None
 r=[];has_tuple=False
 for x in v:
  if _p(x):r.append(x)
  elif isinstance(x,tuple):
   sub=[]
   for item in x:
    if _p(item):sub.append(item)
    else:return None
   r.append(sub);has_tuple=True
  else:return None
 if has_tuple and any(not isinstance(i,list)for i in r):return None
 return r
def _grid(v):
 if not isinstance(v,list)or not v or not isinstance(v[0],list):return None
 rows=[]
 for row in v:
  if not isinstance(row,list):return None
  r=[]
  for x in row:
   if _p(x):r.append(x)
   else:return None
  rows.append(r)
 return rows
def _sd(v):
 if not isinstance(v,dict):return None
 r={}
 for k,val in v.items():
  if not _p(k)or not _p(val):return None
  r[str(k)]=val
 return r
def _ss(v):
 if not isinstance(v,(set,frozenset)):return None
 r=[]
 for x in v:
  if not _p(x):return None
  r.append(x)
 try:r.sort(key=lambda a:(isinstance(a,str),a))
 except:pass
 return r
def _isll(v):return hasattr(v,'val')and hasattr(v,'next')and not hasattr(v,'left')
def _istr(v):return hasattr(v,'val')and hasattr(v,'left')and hasattr(v,'right')
def _wll(head):
 nodes=[];seen={};cur=head;cyc=None
 while cur is not None and len(nodes)<MAX_LL:
  cid=id(cur)
  if cid in seen:cyc=seen[cid];break
  seen[cid]=len(nodes)
  val=getattr(cur,'val',None)
  if not _p(val):val=repr(val)[:20]
  nodes.append({'id':cid,'val':val});cur=getattr(cur,'next',None)
 return nodes,cyc
def _wtr(root,seen,out):
 if root is None:return None
 if len(out)>=MAX_TR:return None
 nid=id(root)
 if nid in seen:return None
 seen.add(nid)
 val=getattr(root,'val',None)
 if not _p(val):val=repr(val)[:20]
 node={'id':nid,'val':val,'left':None,'right':None};out.append(node)
 node['left']=_wtr(getattr(root,'left',None),seen,out)
 node['right']=_wtr(getattr(root,'right',None),seen,out)
 return node
def _deep_ser(v,depth=0,max_depth=6):
 """Recursively serialize any value, handling nested structures."""
 if depth>max_depth:return '...'
 if v is None or isinstance(v,bool):return v
 if isinstance(v,(int,str)):return v
 if isinstance(v,float):return v if _math.isfinite(v)else repr(v)
 if isinstance(v,(list,tuple)):
  try:return[_deep_ser(x,depth+1,max_depth)for x in v[:100]]
  except:return repr(v)[:80]
 if isinstance(v,dict):
  try:return{str(k):_deep_ser(val,depth+1,max_depth)for k,val in list(v.items())[:50]}
  except:return repr(v)[:80]
 if isinstance(v,(set,frozenset)):
  try:r=[_deep_ser(x,depth+1,max_depth)for x in list(v)[:50]];r.sort(key=str);return r
  except:return repr(v)[:80]
 return repr(v)[:80]

def _cap_val(n,v,sc,ls,gr,ds,ss,dqs,llq,trq,_var_order):
 """Capture one name/value pair into the appropriate bucket. Returns True if captured."""
 captured=False
 if _p(v):sc[n]=v;captured=True
 elif isinstance(v,list):
  gv=_grid(v)
  if gv is not None:gr[n]=gv;captured=True
  else:
   lv=_sl(v)
   if lv is not None:ls[n]=lv;captured=True
   else:
    # ── Fallback: deep serialize nested lists ──
    try:ls[n]=_deep_ser(v);captured=True
    except:pass
 elif isinstance(v,_col.deque):
  dqv=list(v)
  lv=_sl(dqv)
  if lv is not None:dqs[n]=lv;captured=True
  else:
    # ── Fallback: deep serialize nested deque ──
    try:dqs[n]=_deep_ser(dqv);captured=True
    except:pass
 elif isinstance(v,dict):
  dv=_sd(v)
  if dv is not None:ds[n]=dv;captured=True
  else:
    # ── Fallback: deep serialize nested dict ──
    try:ds[n]=_deep_ser(v);captured=True
    except:pass
 elif isinstance(v,(set,frozenset)):
  sv=_ss(v)
  if sv is not None:ss[n]=sv;captured=True
  else:
    # ── Fallback: deep serialize nested set ──
    try:ss[n]=_deep_ser(v);captured=True
    except:pass
 elif _istr(v):trq.append((n,v));sc[n]=v.val;captured=True
 elif _isll(v):llq.append((n,v));sc[n]=v.val;captured=True
 if captured and not _p(v):_var_order.append(n)
 return captured

def _snap(frame):
 loc=frame.f_locals;sc={};ls={};gr={};ds={};ss={};dqs={};ll={};tr={};pt={}
 tracked=set();llq=[];trq=[];_var_order=[]
 skip=_PRE_KEYS if frame.f_code.co_filename=='<driver>'else set()
 for n,v in loc.items():
  if n.startswith('__')or n in skip or n=='self':continue
  _cap_val(n,v,sc,ls,gr,ds,ss,dqs,llq,trq,_var_order)
 # ── Capture self.* attributes (design-pattern / OOP problems) ──────────
 if 'self' in loc:
  try:
   obj=loc['self']
   if not _isll(obj) and not _istr(obj):
    for an,av in vars(obj).items():
     if an.startswith('_'):continue
     if an in sc or an in ls or an in gr or an in ds or an in ss or an in dqs:continue
     _cap_val(an,av,sc,ls,gr,ds,ss,dqs,llq,trq,_var_order)
  except Exception:pass
 # ── Linked lists ──────────────────────────────────────────────────────
 for n,h in llq:
  if id(h)in tracked:pt[n]=id(h);continue
  nodes,cyc=_wll(h)
  if not nodes:pt[n]=id(h);continue
  for nd in nodes:tracked.add(nd['id'])
  ll[n]={'nodes':nodes,'cycle_to':cyc}
 # ── Trees ─────────────────────────────────────────────────────────────
 for n,r in trq:
  if id(r)in tracked:pt[n]=id(r);continue
  col=[];t=_wtr(r,set(),col)
  if t is None:continue
  for nd in col:tracked.add(nd['id'])
  tr[n]=t
 for n,v in loc.items():
  if n.startswith('__')or n in ll or n in tr:continue
  if(_isll(v)or _istr(v))and v is not None and id(v)in tracked:pt[n]=id(v)
 return{'line':frame.f_lineno,'filename':frame.f_code.co_filename,
        'locals':sc,'lists':ls,'grids':gr,'dicts':ds,'sets':ss,'deques':dqs,
        'linked_lists':ll,'trees':tr,'node_pointers':pt,'_var_order':_var_order}

# Pre-load preamble ONCE — all imports (heapq, collections, etc.) happen here
_PRE={}
try:exec(compile(PREAMBLE,'<pre>','exec'),_PRE)
except Exception as _e:_PRE={'__init_error__':repr(_e)}
_PRE_KEYS=frozenset(_PRE.keys())|{'_result','__name__','__doc__','__package__','__loader__','__spec__','__builtins__'}

_SAFE_BUILTINS=frozenset({'len','min','max','abs','sum','sorted','range','int','str','float','bool','ord','chr','any','all','round','isinstance','type','list','tuple','dict','set','frozenset','enumerate','reversed','zip','map','filter','hex','bin','oct','repr','divmod','pow','True','False','None'})
_RE_CALL=_re.compile(r'(?<![\\w.])(\\w+)\\s*\\(')
_RE_METHOD_CALL=_re.compile(r'\\.\\w+\\s*\\(')
def _is_pure(expr):
 """Return True if expr is safe to evaluate (no user functions / mutating methods)."""
 for m in _RE_CALL.finditer(expr):
  if m.group(1)not in _SAFE_BUILTINS:return False
 if _RE_METHOD_CALL.search(expr):return False
 return True

def _cond_eval(line_src,locs):
 s=line_src.strip();kw=None;ct=None
 if s.startswith('if '):kw='if';ct=s[3:].rstrip(':').strip()
 elif s.startswith('elif '):kw='elif';ct=s[5:].rstrip(':').strip()
 elif s.startswith('while '):kw='while';ct=s[6:].rstrip(':').strip()
 elif s.startswith('for ')and' in 'in s:
  inner=s[4:s.rfind(':')].strip() if':'in s else s[4:]
  return{'kw':'for','expr':inner,'loop':True,'result':None,'raw':''}
 if ct is None:return None
 # Skip eval if condition contains an unsafe call (could mutate user state)
 if not _is_pure(ct):
  return{'kw':kw,'expr':ct,'result':None,'raw':'?','loop':False}
 try:
  result=eval(compile(ct,'<c>','eval'),{},dict(locs))
  return{'kw':kw,'expr':ct,'result':bool(result),'raw':repr(result)[:40],'loop':False}
 except:
  return{'kw':kw,'expr':ct,'result':None,'raw':'?','loop':False}

def _top_args(s,start):
 """Extract top-level comma-separated arguments starting after index start (pointing to '(')."""
 depth=0;args=[];cur=start+1;i=start+1
 while i<len(s):
  c=s[i]
  if c in'([{':depth+=1
  elif c in')]}':
   if depth==0:args.append(s[cur:i].strip());break
   depth-=1
  elif c==','and depth==0:args.append(s[cur:i].strip());cur=i+1
  i+=1
 return args

def _try_eval(expr,locs):
 try:
  e=expr.strip()
  # Refuse to eval expressions with user-defined function or mutating method calls.
  # This is critical: line events fire BEFORE Python executes the line, so any
  # eval here happens IN ADDITION to the real execution and can corrupt state.
  if not _is_pure(e):return e,False
  return eval(compile(e,'<c>','eval'),{},dict(locs)),True
 except:return expr.strip(),False

def _stmt_eval(line_src,locs,prev_locs):
 s=line_src.strip();stmts=[];globs=dict(locs)
 SKIP=('if ','elif ','while ','for ','return ','else:','pass','break','continue','#','def ','class ')
 if any(s.startswith(k)for k in SKIP):
  if s.startswith('return '):
   expr=s[7:].strip()
   if expr:
    val,ok=_try_eval(expr,locs)
    if ok:stmts.append({'type':'return','expr':expr,'result':repr(val)[:60]})
  return stmts or None

 def _heap_dn(raw):return raw.split('.')[-1]if'.'in raw else raw
 if'heappush'in s:
  m=_re.search(r'heappush\\s*\\(',s)
  if m:
   args=_top_args(s,m.end()-1)
   if len(args)>=2:
    heap_raw=args[0];val,_=_try_eval(args[1],locs)
    stmts.append({'type':'heappush','heap':_heap_dn(heap_raw),'value':repr(val)[:60]})
   return stmts or None
 if'heappop'in s:
  m=_re.search(r'heappop\\s*\\(',s)
  if m:
   args=_top_args(s,m.end()-1)
   if args:
    heap_raw=args[0]
    heap_val,heap_ok=_try_eval(heap_raw,locs)
    cur_heap=heap_val if heap_ok and isinstance(heap_val,list)else[]
    top=repr(cur_heap[0])[:40]if cur_heap else'empty'
    stmts.append({'type':'heappop','heap':_heap_dn(heap_raw),'top':top})
   return stmts or None
 if'heapify'in s:
  m=_re.search(r'heapify\\s*\\(',s)
  if m:
   args=_top_args(s,m.end()-1)
   if args:
    heap_raw=args[0];stmts.append({'type':'heapify','heap':_heap_dn(heap_raw)})
   return stmts or None

 if'.append('in s or'.extend('in s:
  m=_re.search(r'([\\w\\.]+)\\.(append|extend)\\s*\\(',s)
  if m:
   lst_raw,op=m.group(1),m.group(2)
   lst_name=lst_raw.split('.')[-1]
   args=_top_args(s,m.end()-1)
   if args:
    val,_=_try_eval(args[0],locs)
    stmts.append({'type':'list_'+op,'list':lst_name,'value':repr(val)[:60]})
   return stmts or None

 m=_re.match(r'^(\\w+)\\[(.+?)\\]\\s*(\\+?=)\\s*(.+)$',s)
 if m:
  obj_name,key_expr,op,val_expr=m.group(1),m.group(2),m.group(3),m.group(4)
  key,_=_try_eval(key_expr,locs);val,ok=_try_eval(val_expr.rstrip(':'),locs)
  if ok:
   t='dict_update'if'+='in op else'dict_set'
   stmts.append({'type':t,'dict':obj_name,'key':repr(key)[:25],'value':repr(val)[:40]})
  return stmts or None

 # ── Augmented assignments: x += y  /  self.res -= 1  /  count *= 2 etc.
 #    These were completely invisible before — now shown as assign events.
 _aug=_re.match(r'^(self\\.\\w+|[a-zA-Z_]\\w*)\\s*([+\\-*/%&|^]|//|<<|>>)=\\s*(.+)$',s)
 if _aug:
  lhs_raw,op_c,rhs_a=_aug.group(1),_aug.group(2),_aug.group(3).strip()
  _rhs_has_call=bool(_re.search(r'\\w\\s*\\(',rhs_a))
  if not _rhs_has_call:
   combined='('+lhs_raw+')'+op_c+'('+rhs_a+')'
   val,ok=_try_eval(combined,locs)
   if ok:stmts.append({'type':'assign','var':lhs_raw,'expr':lhs_raw+' '+op_c+'= '+rhs_a,'result':repr(val)[:60]})
  return stmts or None

 if'='in s:
  eq=s.find('=');lhs=s[:eq].strip();rhs=s[eq+1:].strip()
  # Skip eval if RHS contains a function/method call — avoids side-effect mutation (e.g. obj.addNum(1))
  _rhs_has_call=bool(_re.search(r'\\w\\s*\\(',rhs))
  # Match plain local var OR self.attr
  if _re.match(r'^[a-zA-Z_]\\w*$',lhs) or _re.match(r'^self\\.\\w+$',lhs):
   if not _rhs_has_call:
    val,ok=_try_eval(rhs,locs)
    if ok:stmts.append({'type':'assign','var':lhs,'expr':rhs,'result':repr(val)[:60]})
  elif','in lhs:
   if not _rhs_has_call:
    val,ok=_try_eval(rhs,locs)
    if ok:stmts.append({'type':'unpack','vars':lhs,'expr':rhs,'result':repr(val)[:60]})

 return stmts if stmts else None

def run_trace(u,d):
 snaps=[];error=None
 if'__init_error__'in _PRE:return json.dumps({'snapshots':[],'error':'Preamble: '+_PRE['__init_error__']})
 sb=dict(_PRE);sb['__name__']='__main__'
 u_lines=u.splitlines();d_lines=d.splitlines()
 try:cu=compile(u,'<user>','exec')if u.strip()else None
 except SyntaxError as e:return json.dumps({'snapshots':[],'error':'SyntaxError: '+(e.msg or'')+' line '+str(e.lineno)})
 try:cd=compile(d,'<driver>','exec')if d.strip()else None
 except SyntaxError as e:return json.dumps({'snapshots':[],'error':'SyntaxError(driver): '+(e.msg or'')+' line '+str(e.lineno)})
 # ── Call-tree tracking (recursion visualisation) ──────────────────
 _cs=[];_roots=[];_cid=[0];_seen_calls=set()
 def tracer(frame,event,arg):
  fn=frame.f_code.co_filename
  if fn not in('<user>','<driver>'):return None
  # ── function entry: push a new call-tree node ──────────────────
  if event=='call' and fn=='<user>':
   try:
    fname=frame.f_code.co_name
    # Skip synthetic frames: <module>, <lambda>, <listcomp>, <genexpr>, etc.
    if fname.startswith('<'):return tracer
    # Skip class body executions (their locals contain __qualname__ at call time)
    if '__qualname__' in frame.f_locals:return tracer
    _cid[0]+=1;args={}
    # Only capture declared parameters, not closure/outer-scope variables.
    # co_varnames[:co_argcount] = positional params; add kwonly and *args/**kwargs.
    co=frame.f_code
    param_names=co.co_varnames[:co.co_argcount+co.co_kwonlyargcount]
    if co.co_flags&0x04:param_names=param_names+(co.co_varnames[co.co_argcount+co.co_kwonlyargcount],)
    if co.co_flags&0x08:param_names=param_names+(co.co_varnames[co.co_argcount+co.co_kwonlyargcount+(1 if co.co_flags&0x04 else 0)],)
    for k in param_names:
     if k=='self'or k.startswith('_'):continue
     v=frame.f_locals.get(k,'?')
     try:args[k]=repr(v)[:22]
     except:args[k]='?'
    # Capture closure lists (free vars) as visual context — e.g. arr in check(index)
    ctx={}
    for k in co.co_freevars:
     try:
      v=frame.f_locals.get(k)
      if isinstance(v,list)and 0<len(v)<=25 and not isinstance(v[0],list):
       ctx[k]=[repr(x)[:8]for x in v[:25]]
     except:pass
    # Memo detection: same (func, args) called before = cache hit / overlapping subproblem
    _args_key=str(sorted(args.items()))
    _memo_key=(fname,_args_key)
    _is_memo=_memo_key in _seen_calls
    _seen_calls.add(_memo_key)
    node={'id':_cid[0],'func':fname,'args':args,'ctx':ctx,'depth':len(_cs),
          'return_val':None,'returned':False,'children':[],'is_memo':_is_memo}
    if _cs:_cs[-1]['children'].append(node)
    else:_roots.append(node)
    _cs.append(node)
   except:pass
  # ── function exit: record return value ─────────────────────────
  elif event=='return' and fn=='<user>':
   try:
    # Only pop if the returning function name matches top of stack
    # (guards against <listcomp>/<genexpr>/class-body returns wrongly popping)
    if _cs and _cs[-1]['func']==frame.f_code.co_name:
     top=_cs[-1]
     try:top['return_val']=repr(arg)[:40]
     except:top['return_val']='?'
     top['returned']=True;_cs.pop()
   except:pass
  # ── line event: capture snapshot + call-depth ──────────────────
  elif event=='line':
   if len(snaps)>=STEP_CAP:raise RuntimeError('Step cap — possible infinite loop')
   snap=_snap(frame)
   snap['call_depth']=len(_cs)
   snap['current_call_id']=_cs[-1]['id']if _cs else None
   snap['max_call_id']=_cid[0]
   lines=u_lines if fn=='<user>'else d_lines
   lineno=frame.f_lineno
   if 1<=lineno<=len(lines):
    src=lines[lineno-1]
    snap['cond']=_cond_eval(src,frame.f_locals)
    snap['stmt']=_stmt_eval(src,frame.f_locals,snaps[-1]['locals']if snaps else{})
   else:snap['cond']=None;snap['stmt']=None
   snaps.append(snap)
  return tracer
 sys.settrace(tracer)
 try:
  if cu:exec(cu,sb)
  if cd:exec(cd,sb)
 except Exception as e:error=type(e).__name__+': '+str(e)
 finally:sys.settrace(None)
 def _ser(v,depth=0):
  if depth>4:return repr(v)[:80]
  if v is None or isinstance(v,(bool,int,str)):return v
  if isinstance(v,float):return v if _math.isfinite(v)else repr(v)
  if isinstance(v,(list,tuple)):
   try:return[_ser(x,depth+1)for x in v]
   except:return repr(v)[:200]
  if isinstance(v,dict):
   try:return{str(k):_ser(val,depth+1)for k,val in list(v.items())[:50]}
   except:return repr(v)[:200]
  # TreeNode / ListNode: serialize into renderer-compatible shapes so the
  # result panel can render the actual tree/list instead of just repr().
  if _istr(v):
   try:
    col=[];root=_wtr(v,set(),col)
    if root is not None:return{'__kind__':'tree','root':root}
   except:pass
  if _isll(v):
   try:
    nodes,cyc=_wll(v)
    if nodes:return{'__kind__':'list','nodes':nodes,'cycle_to':cyc}
   except:pass
  return repr(v)[:200]
 _MISSING=object()
 raw_res=sb.get('_result',_MISSING)
 result_data=None if raw_res is _MISSING else _ser(raw_res)
 has_result=raw_res is not _MISSING
 return json.dumps({'snapshots':snaps,'error':error,'result':result_data,
                    'has_result':has_result,'call_trees':_roots})
`;
