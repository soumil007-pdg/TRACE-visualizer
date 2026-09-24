/* ══════════════════════════════════════════════════════════════════════
   app.js ─ Application bootstrap: restore session state, set empty-state
             HTML, kick off Pyodide initialisation.
   Must be the LAST script loaded (all other modules must be ready).
   Depends on: everything.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Restore persisted session on page load ─────────────────────────── */
(function restoreState(){

  // Speed slider
  const sp = Store.get('speed');
  if(sp){
    speedEl.value = sp;
    document.getElementById('sval').textContent = sp + '×';
  }

  // A shared link already names its language and code: open it directly.
  const shared = tryLoadFromHash();
  if(shared){ enterLang(shared.lang, { code: shared.code, input: shared.input }); markSaved(); return; }

  // Otherwise every visit starts at the front page. The chosen language's
  // last session is restored when it is picked (enterLang in lang.js).
  showFront();
  markSaved();
})();

/* ── Designed empty state ────────────────────────────────────────────── */
document.getElementById('vc').innerHTML = `<div class="empty">
  <div class="empty-icon"><svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" stroke="none"><path d="M13 2 4.5 13.2a.6.6 0 0 0 .48.96H11l-1.2 7.2a.5.5 0 0 0 .9.38L19.5 10.8a.6.6 0 0 0-.48-.96H13l1.1-7.5a.5.5 0 0 0-.9-.34z"/></svg></div>
  <div class="empty-title">Ready to trace</div>
  <div class="empty-sub">Pick a template above, or paste your own code + input and hit RUN</div>
  <div class="empty-steps">
    <div class="empty-step"><span class="es-num">1</span>Paste code &amp; input</div>
    <div class="empty-step"><span class="es-num">2</span>Click RUN</div>
    <div class="empty-step"><span class="es-num">3</span>Step through visuals</div>
  </div>
</div>`;

/* ── Start Pyodide (last — non-blocking visual init must be done first) ── */
initPyodide().catch(e=>{
  setStat('Failed', 'err');
  document.getElementById('loading').innerHTML =
    `<div style="color:var(--red);font-family:var(--mono);padding:20px;font-size:12px;background:var(--cream);">LOAD ERROR: ${esc(String(e))}</div>`;
});
