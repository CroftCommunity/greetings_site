// greetings.croft.ing build (Phase 1a): esbuild src/main.ts -> a content-hashed
// ESM bundle, injected into stable-named index.html. A deploy changes the bundle
// URL, so stale JS is structurally impossible (the peadoubleueh cache-buster,
// carried from arecipe). CNAME + .nojekyll are copied so the custom domain and
// the pre-built assets survive the gh-pages deploy (see scripts/pages-deploy.sh:
// Pages runs Jekyll on a branch source by default, which would drop this
// pre-built SPA without .nojekyll).
//
// Deliberately minimal for Phase 1a — this proves the build -> gh-pages -> Pages
// loop. CSP injection, SRI, the service worker, and the PWA manifest arrive in
// Phase 1b; the OAuth client-metadata copy arrives in Phase 2.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';

rmSync('dist', { recursive: true, force: true }); // no stale artifacts
mkdirSync('dist', { recursive: true });

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

// Resolve the hashed main bundle name from the metafile (fail loud if absent).
let mainBundle;
for (const [outPath, meta] of Object.entries(result.metafile.outputs)) {
  if (meta.entryPoint === 'src/main.ts') mainBundle = outPath.replace('dist/', '');
}
if (!mainBundle) throw new Error('build: could not find the src/main.ts output bundle in the esbuild metafile');

// Inject the hashed bundle name into stable-named index.html.
const html = readFileSync('index.html', 'utf8');
if (!html.includes('./main.js')) throw new Error('build: index.html is missing the ./main.js script reference');
writeFileSync('dist/index.html', html.replace('./main.js', `./${mainBundle}`));

// Custom domain + Jekyll opt-out survive every gh-pages deploy.
copyFileSync('CNAME', 'dist/CNAME');
writeFileSync('dist/.nojekyll', '');

// Deploy stamp (stable-named, uncached) for deploy checks.
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
writeFileSync('dist/build-info.json', JSON.stringify({ version: sha, mainBundle }));
console.log(`built ${sha}: ${mainBundle}`);
