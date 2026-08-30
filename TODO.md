# TODO — greetings

> Known work only — items whose shape is already decided, and which may therefore be
> proposed as work. Anything still an open question (decide / verify / investigate /
> reconcile) belongs in the backlog of record, `discovery/alpha/ROADMAP_TODO.md`,
> however small or operational it is. Tracking scheme: `CroftC/.claude/TRACKING.md`;
> the two piles and why: its § "Two piles". Cross-reference E-numbers where an item
> here implements a backlog row.

Started 2026-08-29 with the first gap the workspace design standard recorded against
this repo.

## Design standard gaps (croft-pwa/docs/DESIGN.md)

- [x] ~~**Sign-in copy: the noun is "atmo provider", not Bluesky.**~~ DONE 2026-08-29 (signin-pattern): `src/views/create.ts`
  says *Sign in with your Bluesky handle to make a card* with the label *Bluesky handle*
  for a field that takes a handle on any host. Use the sheet's words and the verbatim
  gloss (DESIGN.md § Copy). Workspace audit check 45 FLAGs this until it changes — it
  found this repo on its first run; the same-day survey had missed it.
- [x] ~~**Adopt the sign-in flow.**~~ DONE 2026-08-29 (signin-pattern) — `src/signin/`, inline two panels on the create view, `tests/e2e/signin.spec.ts` + `signin-providers.live.spec.ts`: The create view is handle-only with no provider registry
  and no Create. Adopt DESIGN.md § Flows › Sign in — registry with probed posture + live
  drift check, two panels split by posture, Create only where signups are open, the handle
  seam; reference `croft-pwa/src/signin/` (this repo already shares arecipe's OAuth
  client). Container is this repo's call; copy, registry and the both-direction Create rule
  are not. Check 45 NOTEs the missing registry.
