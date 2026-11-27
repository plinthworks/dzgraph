/**
 * The documentation site in a real browser (docs/phase-9-steps/plan.md, batch 5): every page of the built site
 * (`website/dist`, `npm --prefix website run build` first), served by `astro preview`.
 *
 *   node scripts/browser-site.mjs --engine chrome|firefox|webkit    (default chrome)
 *   PAGES=gallery,api/core node scripts/browser-site.mjs            (limits the run, both languages)
 *
 * Each page, English in light and French in dark: no console error or warning (a demo's problems are warnings), every
 * live chart, the gauge workshop and the DzGrid demos (grid and chart) drawn once scrolled into view. A page of each kind at 360 px wide: nothing wider
 * than the screen. Chrome only, the same pages in light and in dark: axe finds nothing. One browser, closed in
 * `finally`; the preview server stopped with it. Exit 1 on any failure.
 */
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from '../spikes/kit.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'website/dist');
const at = process.argv.indexOf('--engine');
const ENGINE = at > 0 ? process.argv[at + 1] : 'chrome';
const PORT = 4761;
const BASE = `http://localhost:${PORT}/dzgraph/`;
/** A page of each kind: home, getting started, gallery, a guide, the DzGrid guide (a real grid), an option page with the workshop, the API. */
const KINDS = ['', 'getting-started/typescript/', 'gallery/', 'guides/exploring/', 'guides/dzgrid/', 'options/series-types/gauge/', 'api/core/'];

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f === 'index.html' ? [p] : [];
  });
const only = process.env.PAGES?.split(',').map((p) => p.replace(/^\/|\/$/g, ''));
const pages = walk(DIST)
  .map((f) => relative(DIST, f).replace(/index\.html$/, ''))
  .filter((p) => p !== '404/' && !p.startsWith('_'))
  .filter((p) => !only || only.includes(p.replace(/^fr\//, '').replace(/\/$/, '')))
  .sort();

const failures = [];
const fail = (what, detail) => {
  failures.push(`${what}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
  console.log(`  ✗ ${what}`, detail ?? '');
};

/**
 * WebKit's timing hint on the heaviest page (the gallery): a module of Astro's own build, which WebKit preloads as a
 * script's import, fetched more than a few seconds after the load event. Advice on Astro's bundling, not a fault: the
 * demos are drawn. Only that message, only for Astro's files.
 */
const hint = (text) => ENGINE === 'webkit' && /^The resource \S+\/_astro\/\S+\.js was preloaded using link preload but not used within a few seconds/.test(text);

/** A page opened in a theme, its console collected. */
async function open(b, path, theme, width = 1280) {
  const page = await b.newPage({ viewport: { width, height: 900 } });
  const said = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !hint(m.text()) && said.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => said.push(`pageerror: ${e.message}`));
  await page.addInitScript((t) => localStorage.setItem('starlight-theme', t), theme);
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { page, said };
}

/** Every demo scrolled into view and drawn: the index of each one that is not. */
async function undrawn(page) {
  const demos = page.locator('dzgraph-live-chart, dzgraph-gauge-workshop, dzgraph-grid-demo');
  const n = await demos.count();
  const missing = [];
  for (let i = 0; i < n; i++) {
    const d = demos.nth(i);
    await d.scrollIntoViewIfNeeded();
    const ok = await d
      .evaluate(
        (el) =>
          new Promise((done) => {
            const t0 = performance.now();
            const look = () => {
              // A grid demo is drawn once both are there: the chart and DzGrid's grid.
              const grid = el.localName !== 'dzgraph-grid-demo' || el.querySelector('[role="grid"], [role="treegrid"]');
              if (grid && el.querySelector('svg, canvas')) return done(true);
              if (performance.now() - t0 > 8000) return done(false);
              setTimeout(look, 100);
            };
            look();
          }),
      )
      .catch(() => false);
    if (!ok) missing.push(i);
  }
  return { n, missing };
}

// A server already on the port (one left from an earlier run) would be tested instead of today's build.
const taken = await fetch(BASE).then(() => true, () => false);
if (taken) {
  console.error(`port ${PORT} is already served: stop that server first`);
  process.exit(1);
}
// `--ignore-lock`: run by an agent, Astro otherwise moves the server to a background process of its own, which
// outlives the one started here (batch 5: such servers were left running). Its own process group, stopped whole.
const preview = spawn('node', ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(PORT), '--ignore-lock'], { cwd: join(ROOT, 'website'), stdio: 'ignore', detached: true });
let b;
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  b = await browser(ENGINE);
  console.log(`${ENGINE}: ${pages.length} pages`);
  let demos = 0;
  for (const path of pages) {
    const theme = path.startsWith('fr/') ? 'dark' : 'light';
    const { page, said } = await open(b, path, theme);
    const { n, missing } = await undrawn(page);
    demos += n;
    await page.waitForTimeout(200);
    if (missing.length) fail(`${path} (${theme}): demos not drawn`, missing);
    if (said.length) fail(`${path} (${theme}): console`, said);
    await page.close();
  }
  console.log(`  ${demos} demos looked at`);

  for (const path of KINDS.flatMap((k) => [k, `fr/${k}`])) {
    if (only && !pages.includes(path)) continue;
    const { page } = await open(b, path, 'light', 360);
    await undrawn(page);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (wide > 0) fail(`${path} at 360 px: ${wide} px wider than the screen`);
    await page.close();
  }

  if (ENGINE === 'chrome') {
    for (const path of KINDS.flatMap((k) => [k, `fr/${k}`]))
      for (const theme of ['light', 'dark']) {
        if (only && !pages.includes(path)) continue;
        const { page } = await open(b, path, theme);
        await undrawn(page);
        await page.addScriptTag({ path: join(ROOT, 'node_modules/axe-core/axe.min.js') });
        const v = await page.evaluate(async () =>
          // eslint-disable-next-line no-undef
          (await window.axe.run(document, { resultTypes: ['violations'] })).violations
            // Starlight's search button: named « Search », it also shows its shortcut (⌘K), which axe counts as visible
            // text missing from the name. A key hint is not the label (WCAG 2.5.3: « click Search » still works); every
            // other rule still applies to that button.
            .map((x) => ({ ...x, nodes: x.nodes.filter((n) => !(x.id === 'label-content-name-mismatch' && n.target.join(' ') === 'button[data-open-modal=""]')) }))
            .filter((x) => x.nodes.length)
            .map((x) => `${x.id}: ${x.nodes.length} (${x.nodes[0]?.target?.join(' ')})`),
        );
        if (v.length) fail(`${path || '/'} (${theme}): axe`, v);
        await page.close();
      }
  }
} finally {
  await b?.close();
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
  // Not done until the port is free again: the next run must not find this server.
  for (let i = 0; i < 50 && (await fetch(BASE).then(() => true, () => false)); i++) await new Promise((r) => setTimeout(r, 100));
}
console.log(failures.length ? `${ENGINE}: ${failures.length} failure(s)` : `${ENGINE}: every page clean`);
process.exit(failures.length ? 1 : 0);
