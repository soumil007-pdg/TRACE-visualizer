/* ══════════════════════════════════════════════════════════════════════
   utils.js ─ Tiny shared helpers (esc, fv).
   Must be the first script loaded — everything else depends on these.
   ══════════════════════════════════════════════════════════════════════ */

/** HTML-escape a string to prevent XSS. */
function esc(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

/** Format a value for display, in the language being traced: a Java
    variable reads true / false / null, a Python one True / False / None. */
function fv(v){
  const java = window.LANG === 'java';
  if(v===null||v===undefined)return java ? 'null' : 'None';
  if(v===true)return java ? 'true' : 'True';
  if(v===false)return java ? 'false' : 'False';
  if(typeof v==='string')return v.length===1?v:JSON.stringify(v);
  return String(v);
}

/* Panel title as "Kind  name". When the variable is named after its own
   kind, as LeetCode's `grid`, `list`, `heap` and `root` often are, that
   reads as a stutter ("GRID  GRID"), so the kind is shown once. */
function _hdr(kind, name){
  const k = String(kind), n = String(name);
  if(k.toLowerCase().split(/\s+/).includes(n.toLowerCase())) return esc(k);
  return esc(k) + '&nbsp;&nbsp;' + esc(n);
}
