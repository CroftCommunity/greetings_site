// greetings.croft.ing — app entry (Phase 1a hello-world).
//
// This exists to prove the esbuild build -> gh-pages -> Pages deploy loop end to
// end. The routed shell + PWA arrive in Phase 1b, creator OAuth in Phase 2, and
// the public / server-blind card flows in Phases 3 and 4.
const app = document.getElementById('app');
if (app) {
  app.textContent = 'greetings.croft.ing — build is live.';
}
