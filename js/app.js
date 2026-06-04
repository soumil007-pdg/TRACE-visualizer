/* ══════════════════════════════════════════════════════════════════════
   app.js ─ Application bootstrap: restore session state, set empty-state
             HTML, kick off Pyodide initialisation.
   Must be the LAST script loaded (all other modules must be ready).
   Depends on: everything.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Restore persisted session on page load ─────────────────────────── */
(function restoreState(){
  // Theme swatch already set inline at top of <head>; just sync the active class
  const t = document.documentElement.dataset.theme || 'light';
  document.querySelectorAll('#theme-picker .tsw').forEach(x=>x.classList.toggle('active', x.dataset.t===t));

  // Speed slider
  const sp = Store.get('speed');
  if(sp){
    speedEl.value = sp;
    document.getElementById('sval').textContent = sp + '×';
  }

  // URL hash (shared link) takes highest priority
  const fromHash = tryLoadFromHash();
  if(fromHash){ markSaved(); return; }

  // Otherwise restore last code / input from localStorage
  const lastCode  = Store.get('lastCode');
  const lastInput = Store.get('lastInput');
  if(typeof lastCode === 'string' && lastCode.trim()){
    cm.setValue(lastCode);
    tiEl.value = (typeof lastInput === 'string') ? lastInput : '';
    refreshP();
    Toast.show('Restored your previous session', 'success', 1800);
  }
  markSaved();
})();

/* ── Better empty state ─────────────────────────────────────────────── */
document.getElementById('vc').innerHTML = `<div class="empty">
  <div style="font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;">Ready</div>
  Pick an example from <strong>Example ▾</strong> above,<br/>
  or paste your Python solution + LeetCode test input,<br/>
  then press <strong style="color:var(--accent)">⌘/Ctrl + ↵</strong> or click <strong>RUN</strong>.<br/><br/>
  <span style="font-size:11px;color:var(--gray);">Press <strong>?</strong> for shortcuts &amp; tips</span>
</div>`;

/* ── Start Pyodide (last — non-blocking visual init must be done first) ── */
initPyodide().catch(e=>{
  setStat('Failed', 'err');
  document.getElementById('loading').innerHTML =
    `<div style="color:var(--red);font-family:var(--mono);padding:20px;font-size:12px;background:var(--cream);">LOAD ERROR: ${esc(String(e))}</div>`;
});
