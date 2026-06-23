/* ══════════════════════════════════════════════════════════════════════
   onboard.js — New-user step-by-step guide.
   6-step animated carousel modal; auto-shows on first visit.
   Depends on: pro-ui.js (openModal, closeModal), storage.js (Store)
   ══════════════════════════════════════════════════════════════════════ */

(function(){
  const TOTAL_STEPS = 6;
  let _cur = 1;
  let _dir = 1;  // 1 = forward, -1 = backward (for animation)

  // ── Helpers ────────────────────────────────────────────────────────
  function $ (id){ return document.getElementById(id); }
  function $$(sel){ return document.querySelectorAll(sel); }

  function gotoStep(n, dir){
    if(n < 1 || n > TOTAL_STEPS) return;
    dir = dir !== undefined ? dir : (n > _cur ? 1 : -1);

    const from = document.querySelector('.ob-step.active');
    if(from){
      from.classList.remove('active');
      // brief exit animation class — auto-removed after transition
      const exitClass = dir > 0 ? 'ob-exit-left' : 'ob-exit-right';
      from.classList.add(exitClass);
      setTimeout(()=>{ from.classList.remove(exitClass); }, 280);
    }

    _cur = n;

    const to = document.querySelector(`.ob-step[data-step="${n}"]`);
    if(to){
      // direction of slide-in
      to.style.animationName = dir > 0 ? 'ob-slide-in' : 'ob-slide-in-left';
      to.classList.add('active');
      // reset animation name so next call triggers fresh
      setTimeout(()=>{ to.style.animationName = ''; }, 400);
    }

    // dots
    $$('.ob-dot').forEach(d => d.classList.toggle('active', +d.dataset.step === n));

    // prev button
    $('ob-prev').disabled = (n === 1);

    // next button — becomes "Let's go!" on last step
    const nxt = $('ob-next');
    if(n === TOTAL_STEPS){
      nxt.textContent = "Let's go! 🚀";
      nxt.classList.add('ob-finish');
    } else {
      nxt.textContent = 'Next →';
      nxt.classList.remove('ob-finish');
    }

    // step counter
    $('ob-step-count').textContent = `Step ${n} of ${TOTAL_STEPS}`;
  }

  // ── Event wiring ───────────────────────────────────────────────────
  $('ob-next').addEventListener('click', ()=>{
    if(_cur === TOTAL_STEPS){
      closeOnboard();
    } else {
      gotoStep(_cur + 1, 1);
    }
  });

  $('ob-prev').addEventListener('click', ()=>{ gotoStep(_cur - 1, -1); });
  $('ob-skip').addEventListener('click', closeOnboard);

  $$('.ob-dot').forEach(dot =>{
    dot.addEventListener('click', ()=>{
      gotoStep(+dot.dataset.step, +dot.dataset.step > _cur ? 1 : -1);
    });
  });

  // Backdrop click
  const backdrop = document.getElementById('onboard-modal');
  backdrop.addEventListener('click', e =>{ if(e.target === backdrop) closeOnboard(); });

  // data-close button already handled by pro-ui.js generic handler,
  // but we also need to strip the pulse:
  document.querySelectorAll('[data-close="onboard-modal"]').forEach(btn =>{
    btn.addEventListener('click', closeOnboard);
  });

  // ── Open / close ───────────────────────────────────────────────────
  function openOnboard(){
    _cur = 1;
    // Reset to step 1 cleanly
    $$('.ob-step').forEach(s => s.classList.remove('active','ob-exit-left','ob-exit-right'));
    const first = document.querySelector('.ob-step[data-step="1"]');
    if(first) first.classList.add('active');
    $$('.ob-dot').forEach(d => d.classList.toggle('active', d.dataset.step === '1'));
    $('ob-prev').disabled = true;
    $('ob-next').textContent = 'Next →';
    $('ob-next').classList.remove('ob-finish');
    $('ob-step-count').textContent = `Step 1 of ${TOTAL_STEPS}`;

    document.getElementById('onboard-modal').classList.add('show');
    // stop the pulse once they open it
    const btn = $('btn-onboard');
    if(btn) btn.classList.remove('ob-pulse');
    Store.set('ob_seen', '1');
  }

  function closeOnboard(){
    document.getElementById('onboard-modal').classList.remove('show');
    Store.set('ob_seen', '1');
  }

  // ── Header button ──────────────────────────────────────────────────
  $('btn-onboard').addEventListener('click', openOnboard);

  // ── Auto-show on genuine first visit (no prior code saved) ────────
  const alreadySeen = Store.get('ob_seen');
  const hasCode     = !!Store.get('lastCode');
  if(!alreadySeen && !hasCode){
    // slight delay so the app finishes painting first
    setTimeout(openOnboard, 800);
  }

  // Expose for mobile menu / shortcuts if needed
  window._openOnboard = openOnboard;

})();
