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

/** Format a Python-style value for display. */
function fv(v){
  if(v===null||v===undefined)return'None';
  if(v===true)return'True';
  if(v===false)return'False';
  if(typeof v==='string')return v.length===1?v:JSON.stringify(v);
  return String(v);
}
