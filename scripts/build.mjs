// greetings.croft.ing build (Phase 1b). esbuild bundles src/main.ts and src/sw.ts
// into CONTENT-HASHED assets injected into stable-named index.html — a deploy
// changes URLs, so stale JS is structurally impossible (the cache-buster carried
// from arecipe). On top of Phase 1a it adds:
//   - a strict Content-Security-Policy (<meta http-equiv>, since GitHub Pages
//     sets no response headers) whose script-src admits each inline <script> by
//     its exact sha256 hash — no 'unsafe-inline';
//   - Subresource Integrity (sha384) on the entry module + stylesheet;
//   - a hashed stylesheet;
//   - the app-shell service worker, compiled with the build version + precache
//     list baked in;
//   - the PWA manifest + assets.
// The OAuth client-metadata copy arrives in Phase 2.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';

rmSync('dist', { recursive: true, force: true }); // no stale artifacts
mkdirSync('dist', { recursive: true });

// --- App bundle (content-hashed) -------------------------------------------
const result = buildSync({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  entryNames: '[name]-[hash]',
  chunkNames: 'chunk-[hash]',
  outdir: 'dist',
  metafile: true,
});

let mainBundle;
for (const [outPath, meta] of Object.entries(result.metafile.outputs)) {
  if (meta.entryPoint === 'src/main.ts') mainBundle = outPath.replace('dist/', '');
}
if (!mainBundle) throw new Error('build: could not find the src/main.ts output bundle in the esbuild metafile');
const jsOutputs = Object.keys(result.metafile.outputs)
  .filter((k) => k.endsWith('.js'))
  .map((k) => k.replace('dist/', ''));

// --- Hashed stylesheet ------------------------------------------------------
const cssBytes = readFileSync('styles.css');
const cssName = `styles-${createHash('sha256').update(cssBytes).digest('hex').slice(0, 8)}.css`;
writeFileSync(`dist/${cssName}`, cssBytes);

// --- Subresource Integrity (sha384 over the exact served bytes) -------------
const sri = (bytes) => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
const entrySri = sri(readFileSync(`dist/${mainBundle}`));
const stylesSri = sri(cssBytes);

// --- Content-Security-Policy ------------------------------------------------
// GitHub Pages sets no response headers, so the CSP ships via <meta http-equiv>.
// Inline <script> blocks (the pre-paint theme script) are admitted by their
// exact sha256 hash, computed from the real content so the hash can never drift.
// A <meta> CSP does not govern inline scripts that precede it, so it is injected
// immediately after <meta charset> — charset stays the genuine first child and
// the CSP still precedes every inline script. No 'unsafe-inline'/'unsafe-eval'.
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const cspFor = (html) => {
  const hashes = [...html.matchAll(INLINE_SCRIPT)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
  );
  return [
    "default-src 'none'",
    `script-src ${["'self'", ...hashes].join(' ')}`,
    "style-src 'self'",
    // data: + blob: cover the Phase 4 decrypted-cover object URLs; https: the public covers.
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    // 'self' + the atproto endpoints; https: admits an arbitrary user PDS (D2).
    "connect-src 'self' https://bsky.social https://public.api.bsky.app https://plc.directory https:",
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
};
const injectCsp = (html) =>
  html.replace(
    /(<meta charset="utf-8" \/>)/i,
    `$1\n    <meta http-equiv="Content-Security-Policy" content="${cspFor(html)}" />`,
  );

// --- index.html: hashed refs + SRI + CSP ------------------------------------
let html = readFileSync('index.html', 'utf8');
if (!html.includes('./main.js')) throw new Error('build: index.html is missing the ./main.js script reference');
if (!html.includes('./styles.css')) throw new Error('build: index.html is missing the ./styles.css stylesheet reference');
html = html.replace('./main.js', `./${mainBundle}`);
html = html.replace('./styles.css', `./${cssName}`);
html = html.replace(
  `<script type="module" src="./${mainBundle}"></script>`,
  `<script type="module" src="./${mainBundle}" integrity="${entrySri}" crossorigin="anonymous"></script>`,
);
html = html.replace(
  `<link rel="stylesheet" href="./${cssName}" />`,
  `<link rel="stylesheet" href="./${cssName}" integrity="${stylesSri}" crossorigin="anonymous" />`,
);
html = injectCsp(html);
writeFileSync('dist/index.html', html);

// --- Static assets ----------------------------------------------------------
copyFileSync('CNAME', 'dist/CNAME'); // custom domain survives every deploy
writeFileSync('dist/.nojekyll', ''); // gh-pages branch source: disable Jekyll
copyFileSync('manifest.webmanifest', 'dist/manifest.webmanifest');
copyFileSync('client-metadata.json', 'dist/client-metadata.json'); // hosted OAuth client_id target (Phase 2)
cpSync('assets', 'dist/assets', { recursive: true });

// --- Service worker: version + precache list baked in -----------------------
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const precache = [
  './', // bare-origin navigation must hit the cache too
  './index.html',
  ...jsOutputs.map((f) => `./${f}`),
  `./${cssName}`,
  './manifest.webmanifest',
  './assets/icons/icon.svg',
];
buildSync({
  entryPoints: ['src/sw.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: 'dist/sw.js',
  define: {
    __BUILD_VERSION__: JSON.stringify(sha),
    __PRECACHE__: JSON.stringify(precache),
  },
});

// --- Deploy stamp (stable-named, uncached) ----------------------------------
writeFileSync('dist/build-info.json', JSON.stringify({ version: sha, mainBundle, css: cssName }));
console.log(`built ${sha}: ${mainBundle} + ${cssName} + sw.js (precache ${precache.length})`);
