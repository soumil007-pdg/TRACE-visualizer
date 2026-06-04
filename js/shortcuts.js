/* ══════════════════════════════════════════════════════════════════════
   shortcuts.js ─ Global keyboard shortcut handler.
   Depends on: controls.js (btnRun, btnSB, btnSF, btnPlay, stopPlay,
                             startPlay, playing, reRender, snaps),
               pro-ui.js (openSaveModal, toggleSnipMenu, mobileDrawer)
   ══════════════════════════════════════════════════════════════════════ */

/** Return true if the focused element is a text input or the CodeMirror editor. */
function isTypingTarget(el){
  if(!el) return false;
  if(el.tagName==='INPUT' || el.tagName==='TEXTAREA') return true;
  if(el.isContentEditable) return true;
  if(el.closest && el.closest('.CodeMirror')) return true;
  return false;
}

document.addEventListener('keydown', e=>{
  const mod = e.metaKey || e.ctrlKey;

  // Escape: close any open modal / stop playback
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-backdrop.show').forEach(m=>m.classList.remove('show'));
    if(playing) stopPlay();
    toggleSnipMenu(false);
    mobileDrawer.classList.remove('show');
    return;
  }

  // Cmd/Ctrl + Enter → Run
  if(mod && e.key==='Enter'){
    e.preventDefault();
    if(!btnRun.disabled){ stopPlay(); runCode(); }
    return;
  }
  // Cmd/Ctrl + S → Save snippet
  if(mod && (e.key==='s'||e.key==='S')){
    e.preventDefault(); openSaveModal(); return;
  }
  // Cmd/Ctrl + K → Snippets menu
  if(mod && (e.key==='k'||e.key==='K')){
    e.preventDefault(); toggleSnipMenu(); return;
  }
  // Cmd/Ctrl + D → Toggle dark / light
  if(mod && (e.key==='d'||e.key==='D')){
    e.preventDefault(); document.getElementById('themetgl').click(); return;
  }

  // Bare-key shortcuts — only when not typing
  if(isTypingTarget(e.target)) return;

  if(e.key==='ArrowLeft'){
    e.preventDefault();
    if(!btnSB.disabled) btnSB.click();
  } else if(e.key==='ArrowRight'){
    e.preventDefault();
    if(!btnSF.disabled) btnSF.click();
  } else if(e.key===' '){
    e.preventDefault();
    if(!btnPlay.disabled) btnPlay.click();
  } else if(e.key==='Home' && snaps.length){
    e.preventDefault(); reRender(0);
  } else if(e.key==='End' && snaps.length){
    e.preventDefault(); reRender(snaps.length-1);
  } else if(e.key==='?'){
    e.preventDefault(); document.getElementById('btn-help').click();
  }
});
