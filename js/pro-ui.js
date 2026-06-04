/* ══════════════════════════════════════════════════════════════════════
   pro-ui.js ─ Professional UI layer:
     • Auto-save (debounced) to localStorage
     • Snippets manager (save / load / delete / import / export)
     • Snippets dropdown UI
     • Save-snippet modal
     • Share-via-URL modal
     • Help modal
     • Mobile drawer
   Depends on: utils.js (esc), storage.js (Store, Toast),
               controls.js (cm, tiEl, refreshP)
   ══════════════════════════════════════════════════════════════════════ */

/* ── Auto-save (debounced, 350ms) ───────────────────────────────────── */
const SaveStatus = document.getElementById('save-status');
let _saveTmr = null;

function markSaving(){ SaveStatus.className='save-status saving'; SaveStatus.textContent='Saving…'; }
function markSaved(){  SaveStatus.className='save-status saved';  SaveStatus.textContent='Saved'; }

function autoSave(){
  markSaving();
  clearTimeout(_saveTmr);
  _saveTmr = setTimeout(()=>{
    Store.set('lastCode',     cm.getValue());
    Store.set('lastInput',    tiEl.value);
    Store.set('lastTemplate', document.getElementById('tmpl').value);
    markSaved();
  }, 350);
}

cm.on('change', autoSave);
tiEl.addEventListener('input', autoSave);
document.getElementById('tmpl').addEventListener('change', ()=>setTimeout(autoSave, 50));

/* ── Snippets manager ───────────────────────────────────────────────── */
const Snippets = (()=>{
  const KEY = 'snippets';
  function all(){ return Store.get(KEY, {}); }
  function save(name, code, input){
    if(!name || !name.trim()) return false;
    const map = all();
    map[name.trim()] = { code, input, savedAt:Date.now() };
    Store.set(KEY, map);
    return true;
  }
  function load(name){ return all()[name] || null; }
  function remove(name){ const m=all(); delete m[name]; Store.set(KEY, m); }
  function listSorted(){
    const m = all();
    return Object.keys(m)
      .sort((a,b)=>(m[b].savedAt||0)-(m[a].savedAt||0))
      .map(n=>({ name:n, ...m[n] }));
  }
  function exportAll(){ return JSON.stringify(all(), null, 2); }
  function importJSON(json){
    try {
      const data = JSON.parse(json);
      if(typeof data !== 'object' || data===null) throw 0;
      const map = all(); let count=0;
      for(const [k,v] of Object.entries(data)){
        if(v && typeof v.code==='string'){ map[k]=v; count++; }
      }
      Store.set(KEY, map);
      return count;
    } catch { return -1; }
  }
  return { all, save, load, remove, listSorted, exportAll, importJSON };
})();

/* ── Time-ago helper ────────────────────────────────────────────────── */
function timeAgo(d){
  const s = Math.floor((Date.now()-d)/1000);
  if(s<60)     return 'just now';
  if(s<3600)   return Math.floor(s/60)+'m ago';
  if(s<86400)  return Math.floor(s/3600)+'h ago';
  if(s<604800) return Math.floor(s/86400)+'d ago';
  return d.toLocaleDateString();
}

/* ── Render the snippets dropdown list ──────────────────────────────── */
function renderSnippetsList(){
  const list  = document.getElementById('snippets-list');
  const items = Snippets.listSorted();
  if(!items.length){
    list.innerHTML = '<div class="snip-empty">No snippets saved yet.<br/>Click <strong>Save Current</strong> below.</div>';
    return;
  }
  list.innerHTML = items.map(s=>{
    const ago = timeAgo(new Date(s.savedAt||0));
    return `<div class="snip-item" data-name="${esc(s.name)}">
      <div style="flex:1;min-width:0;">
        <div class="snip-name" title="${esc(s.name)}">${esc(s.name)}</div>
        <div class="snip-meta">${ago}</div>
      </div>
      <button class="snip-del" data-del="${esc(s.name)}" title="Delete">×</button>
    </div>`;
  }).join('');
}

/* ── Snippets dropdown toggle ───────────────────────────────────────── */
const snipDD   = document.getElementById('snippets-dd');
const snipMenu = document.getElementById('snippets-menu');

function toggleSnipMenu(force){
  const willShow = force !== undefined ? force : !snipMenu.classList.contains('show');
  if(willShow){
    // Compute fixed-position coords below the button — escapes the header's
    // overflow-x:auto clipping context which would otherwise cut the menu off.
    const btn = document.getElementById('btn-snippets');
    const r = btn.getBoundingClientRect();
    snipMenu.style.top    = (r.bottom + 6) + 'px';
    snipMenu.style.right  = (window.innerWidth - r.right) + 'px';
    snipMenu.style.left   = 'auto';
    snipMenu.style.bottom = 'auto';
    renderSnippetsList();
  }
  snipMenu.classList.toggle('show', willShow);
}

document.getElementById('btn-snippets').addEventListener('click', e=>{
  e.stopPropagation(); toggleSnipMenu();
});
document.addEventListener('click', e=>{
  if(!snipDD.contains(e.target)) toggleSnipMenu(false);
});

// Snippet item click: load or delete
document.getElementById('snippets-list').addEventListener('click', e=>{
  const del = e.target.closest('[data-del]');
  if(del){
    e.stopPropagation();
    const name = del.dataset.del;
    if(confirm(`Delete snippet "${name}"?`)){
      Snippets.remove(name);
      renderSnippetsList();
      Toast.show(`Deleted "${name}"`, 'warn');
    }
    return;
  }
  const item = e.target.closest('[data-name]');
  if(item){
    const name = item.dataset.name;
    const s = Snippets.load(name);
    if(s){
      cm.setValue(s.code||'');
      tiEl.value = s.input||'';
      refreshP();
      toggleSnipMenu(false);
      Toast.show(`Loaded "${name}"`);
    }
  }
});

/* ── Modal open/close helpers ───────────────────────────────────────── */
function openModal(id){  document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }

// Close buttons with data-close="modal-id"
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click', ()=>closeModal(btn.dataset.close));
});
// Click on backdrop to close
document.querySelectorAll('.modal-backdrop').forEach(bd=>{
  bd.addEventListener('click', e=>{ if(e.target===bd) bd.classList.remove('show'); });
});

/* ── Save-snippet modal ─────────────────────────────────────────────── */
function openSaveModal(){
  openModal('save-modal');
  const inp = document.getElementById('snip-name-input');
  inp.value = '';
  setTimeout(()=>inp.focus(), 50);
}

document.getElementById('snip-save').addEventListener('click', ()=>{
  toggleSnipMenu(false); openSaveModal();
});
document.getElementById('snip-name-save').addEventListener('click', ()=>{
  const name = document.getElementById('snip-name-input').value.trim();
  if(!name){ Toast.show('Name cannot be empty', 'error'); return; }
  Snippets.save(name, cm.getValue(), tiEl.value);
  closeModal('save-modal');
  Toast.show(`Saved "${name}"`);
});
document.getElementById('snip-name-input').addEventListener('keydown', e=>{
  if(e.key==='Enter') document.getElementById('snip-name-save').click();
});

/* ── Import / Export snippets ───────────────────────────────────────── */
document.getElementById('snip-export').addEventListener('click', ()=>{
  const json = Snippets.exportAll();
  const blob = new Blob([json], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `trace-snippets-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toggleSnipMenu(false);
  Toast.show('Exported snippets');
});

document.getElementById('snip-import').addEventListener('click', ()=>{
  const inp = document.createElement('input');
  inp.type  = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ev=>{
      const n = Snippets.importJSON(ev.target.result);
      if(n<0) Toast.show('Invalid JSON file', 'error');
      else { Toast.show(`Imported ${n} snippet(s)`); renderSnippetsList(); }
    };
    r.readAsText(f);
  };
  inp.click();
  toggleSnipMenu(false);
});

/* ── Share via URL ──────────────────────────────────────────────────── */
function utf8b64(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64utf8(s){ try { return decodeURIComponent(escape(atob(s))); } catch { return null; } }

function buildShareURL(){
  const payload = JSON.stringify({ c:cm.getValue(), i:tiEl.value });
  const hash    = utf8b64(payload);
  return location.origin + location.pathname + '#s=' + hash;
}

function tryLoadFromHash(){
  const h = location.hash;
  if(!h.startsWith('#s=')) return false;
  const decoded = b64utf8(h.slice(3));
  if(!decoded) return false;
  try {
    const obj = JSON.parse(decoded);
    if(typeof obj.c === 'string'){
      cm.setValue(obj.c);
      tiEl.value = obj.i || '';
      refreshP();
      Toast.show('Loaded from shared URL');
      history.replaceState(null, '', location.pathname);
      return true;
    }
  } catch {}
  return false;
}

document.getElementById('btn-share').addEventListener('click', ()=>{
  const url = buildShareURL();
  const inp = document.getElementById('share-url-input');
  inp.value = url;
  openModal('share-modal');
  setTimeout(()=>{ inp.focus(); inp.select(); }, 50);
});
document.getElementById('share-copy').addEventListener('click', ()=>{
  const inp = document.getElementById('share-url-input');
  inp.select();
  navigator.clipboard.writeText(inp.value).then(
    ()=>Toast.show('URL copied to clipboard'),
    ()=>{ document.execCommand('copy'); Toast.show('URL copied'); }
  );
});

/* ── Help modal ─────────────────────────────────────────────────────── */
document.getElementById('btn-help').addEventListener('click', ()=>openModal('help-modal'));

/* ── Bug-report modal ───────────────────────────────────────────────── */
(function(){
  const fab  = document.getElementById('bug-fab');
  const desc = document.getElementById('bug-desc');
  const send = document.getElementById('bug-send');
  if(!fab) return;

  fab.addEventListener('click', ()=>{
    openModal('bug-modal');
    if(desc){ desc.value = ''; setTimeout(()=>desc.focus(), 50); }
    if(window.Analytics) Analytics.track('bug_modal_opened');
  });

  if(send) send.addEventListener('click', ()=>{
    const text = (desc && desc.value || '').trim();
    if(!text){
      if(window.Toast) Toast.show('Please describe the problem first', 'warn', 2200);
      if(desc) desc.focus();
      return;
    }
    if(window.Analytics && Analytics.reportBug) Analytics.reportBug(text);
    closeModal('bug-modal');
    if(window.Toast) Toast.show('Thanks! Your report was sent 🐞', 'success', 2600);
  });
})();

/* ── Mobile drawer ──────────────────────────────────────────────────── */
const mobileDrawer = document.getElementById('mobile-drawer');

document.getElementById('mobile-menu-btn').addEventListener('click', e=>{
  e.stopPropagation(); mobileDrawer.classList.toggle('show');
});
document.addEventListener('click', e=>{
  if(!mobileDrawer.contains(e.target) && e.target.id !== 'mobile-menu-btn')
    mobileDrawer.classList.remove('show');
});

document.getElementById('m-snippets').addEventListener('click', ()=>{ mobileDrawer.classList.remove('show'); toggleSnipMenu(true); });
document.getElementById('m-save').addEventListener('click',     ()=>{ mobileDrawer.classList.remove('show'); openSaveModal(); });
document.getElementById('m-share').addEventListener('click',    ()=>{ mobileDrawer.classList.remove('show'); document.getElementById('btn-share').click(); });
document.getElementById('m-help').addEventListener('click',     ()=>{ mobileDrawer.classList.remove('show'); document.getElementById('btn-help').click(); });

// Mobile theme swatches
document.querySelectorAll('#theme-picker-mobile .tsw').forEach(sw=>{
  sw.addEventListener('click', ()=>{
    const t = sw.dataset.t;
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch{}
    document.querySelectorAll('#theme-picker .tsw').forEach(x=>x.classList.toggle('active', x.dataset.t===t));
    mobileDrawer.classList.remove('show');
  });
});
