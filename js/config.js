/* ══════════════════════════════════════════════════════════════════════
   config.js ─ One place to configure analytics, error tracking, and site.
   ──────────────────────────────────────────────────────────────────────
   HOW TO GO LIVE (free):

   1. POSTHOG (analytics + bug reports)
      • Sign up at https://posthog.com  (free: 1M events/month)
      • Project Settings → paste the "Project API Key" below as POSTHOG_KEY
      • Pick your region: US → https://us.i.posthog.com
                          EU → https://eu.i.posthog.com

   2. SENTRY (automatic JS error tracking) — OPTIONAL
      • Sign up at https://sentry.io  (free: 5k errors/month)
      • Create a "Browser JavaScript" project
      • Copy the DSN and paste below as SENTRY_DSN

   Leave a value as '' (empty) to disable that service. Nothing breaks —
   the app just skips it. So local dev stays clean and quiet.
   ══════════════════════════════════════════════════════════════════════ */

window.TRACE_CONFIG = {
  // ── Analytics ──────────────────────────────────────────────────────
  POSTHOG_KEY:  'phc_rt7YwEEB3XhYCBneMudw6NzknfMmQBvsEKGjUKJW7yNo',  // PostHog Project API Key
  POSTHOG_HOST: 'https://us.i.posthog.com',      // US region

  // ── Error tracking ─────────────────────────────────────────────────
  SENTRY_DSN:   '',                              // ← paste Sentry DSN (optional)

  // ── Site ───────────────────────────────────────────────────────────
  SITE_URL:     'https://trace.dev',             // ← your real domain once deployed
};
