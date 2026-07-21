# greetings

A 1:1 greeting card you make and deliver by link, on the AT Protocol. No
backend: a static PWA/SPA on GitHub Pages writes to the creator's own PDS, and a
recipient opens a link with no login to read.

Live at **https://greetings.croft.ing/**.

## Two privacy modes

- **Public** — plaintext, a bare `ing.croft.greeting.card` record on the
  creator's PDS. Anyone with the link (or the record) can read it.
- **Server-blind link-key** — the card is encrypted in the browser
  (AES-256-GCM); only the ciphertext is stored on the PDS, and the symmetric key
  rides in the URL fragment (`#k=…`), which is never sent to any server. Only a
  link holder can read it. The store sees ciphertext, never content.

## Link grammar

```
#/c/<did>/<rkey>            public card
#/c/<did>/<rkey>#k=<key>    server-blind card (key in the fragment, never networked)
#/create                    create a card (creator signs in)
```

Reads resolve the creator's DID to their PDS via `plc.directory`, then fetch the
record (and cover blob) directly — a custom-NSID record is not served by the
public appview.

## Development

```
npm install
npm run build        # esbuild -> dist/ (content-hashed bundle, CSP, SRI, service worker)
npm run serve        # serve dist/ at http://127.0.0.1:4173
npm test             # lint + typecheck + unit (vitest) + build + e2e (playwright)
npm run test:live    # LIVE=1 playwright — real-PDS suites (needs a bsky app password via env)
```

Unit tests (vitest) cover the pure modules (router, and — as they land — crypto,
link codec, record builder). Browser wiring is covered by playwright e2e.

## Deploy

Push to `main` → GitHub Actions builds and publishes `dist/` to the `gh-pages`
branch root (`scripts/pages-deploy.sh`, plain git); GitHub Pages serves it at the
custom domain. Per-PR previews land at `/pr-preview/pr-<N>/`.

## Why this design

The reasoning, phase plan, and the model it builds on (the Croft card-ingest
link-key tier) live in the discovery corpus:
`CroftCommunity/…/discovery/alpha/plans/2026-07-21-greetings-croft-ing-mvp.md`.
This repo stays lean; the *why* lives with the reasoning corpus.
