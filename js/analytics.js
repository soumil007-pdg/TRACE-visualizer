/* ══════════════════════════════════════════════════════════════════════
   analytics.js ─ PostHog analytics, Sentry error tracking, bug reports.
   Reads keys from window.TRACE_CONFIG (config.js, loaded just before this).
   All services are OPTIONAL — if a key is empty, that service is skipped
   silently so local dev stays quiet and nothing ever throws.

   Public API (always safe to call, no-ops when disabled):
     Analytics.track(event, props)   — record a custom event
     Analytics.reportBug(text)       — send a user bug report w/ code+input
     Analytics.ready                 — true once at least PostHog is live
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  const CFG = window.TRACE_CONFIG || {};
  const A = { ready:false };
  window.Analytics = A;

  /* ── PostHog ───────────────────────────────────────────────────────── */
  if(CFG.POSTHOG_KEY){
    // Official PostHog snippet (minified loader)
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init(CFG.POSTHOG_KEY, {
      api_host: CFG.POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      autocapture: true
    });
    A.ready = true;
  }

  /* ── Sentry (optional) ─────────────────────────────────────────────── */
  if(CFG.SENTRY_DSN){
    const s = document.createElement('script');
    s.src = 'https://browser.sentry-cdn.com/8.0.0/bundle.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = function(){
      if(window.Sentry){
        window.Sentry.init({
          dsn: CFG.SENTRY_DSN,
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0
        });
      }
    };
    document.head.appendChild(s);
  }

  /* ── track() — custom event helper ─────────────────────────────────── */
  A.track = function(event, props){
    try { if(window.posthog && window.posthog.capture) window.posthog.capture(event, props||{}); }
    catch(e){ /* never let analytics break the app */ }
  };

  /* ── Capture context for bug reports ───────────────────────────────── */
  function _snapshotContext(){
    let code = '', input = '', err = '';
    try { code  = window._cm  ? window._cm.getValue()  : ''; } catch(e){}
    try { input = window._tiEl ? window._tiEl.value     : ''; } catch(e){}
    try {
      const eb = document.getElementById('errbanner');
      if(eb && eb.classList.contains('show')) err = eb.textContent || '';
    } catch(e){}
    return {
      code, input, error_shown: err,
      step: (typeof cur !== 'undefined') ? cur : null,
      total_steps: (typeof snaps !== 'undefined' && snaps) ? snaps.length : 0,
      theme: document.documentElement.dataset.theme || '',
      ua: navigator.userAgent,
      viewport: window.innerWidth + 'x' + window.innerHeight
    };
  }
  A.snapshotContext = _snapshotContext;

  /* ── reportBug() — user-submitted bug report ───────────────────────── */
  A.reportBug = function(description){
    const ctx = _snapshotContext();
    ctx.description = description || '';
    // Send through PostHog as a first-class event you can filter in the dashboard
    A.track('bug_report', ctx);
    // Also mirror to Sentry (if present) so it shows up in your issue feed
    try {
      if(window.Sentry && window.Sentry.captureMessage){
        window.Sentry.captureMessage('User bug report: ' + (description||'(no text)'), {
          level: 'info',
          extra: ctx
        });
      }
    } catch(e){}
    return true;
  };

  /* ── Auto-capture uncaught JS errors → PostHog (even without Sentry) ── */
  window.addEventListener('error', function(ev){
    A.track('js_error', {
      message: ev.message,
      source:  ev.filename,
      line:    ev.lineno,
      col:     ev.colno,
      stack:   ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 800) : ''
    });
  });
  window.addEventListener('unhandledrejection', function(ev){
    A.track('js_unhandled_rejection', {
      reason: ev.reason ? String(ev.reason).slice(0, 800) : ''
    });
  });
})();
