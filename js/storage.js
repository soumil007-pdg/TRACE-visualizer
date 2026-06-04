/* ══════════════════════════════════════════════════════════════════════
   storage.js ─ Store (localStorage wrapper) + Toast notification system.
   Depends on: utils.js (esc)
   ══════════════════════════════════════════════════════════════════════ */

/* ── Toast notifications ─────────────────────────────────────────────── */
const Toast = (()=>{
  function show(msg, kind='success', ms=2200){
    const cont = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span>${esc(msg)}</span>`;
    cont.appendChild(el);
    setTimeout(()=>{ el.classList.add('fade'); setTimeout(()=>el.remove(), 260); }, ms);
  }
  return { show };
})();

/* ── Storage abstraction over localStorage with safe in-memory fallback ─ */
const Store = (()=>{
  const PREFIX = 'trace.v1.';
  let mem = {};
  let avail = true;
  try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); } catch(e){ avail = false; }

  function get(k, def=null){
    try {
      const v = avail ? localStorage.getItem(PREFIX+k) : mem[k];
      if(v == null) return def;
      try { return JSON.parse(v); } catch { return v; }
    } catch { return def; }
  }
  function set(k, v){
    try {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      if(avail) localStorage.setItem(PREFIX+k, s); else mem[k] = s;
    } catch(e) { console.warn('Store set failed', e); }
  }
  function del(k){
    try { if(avail) localStorage.removeItem(PREFIX+k); else delete mem[k]; } catch{}
  }
  return { get, set, del, available:()=>avail };
})();
