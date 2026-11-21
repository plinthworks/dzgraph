/**
 * Reference images (plan step 1.10): every playground case in real Chrome, light and dark, left to right and right to
 * left, at device pixel ratio 1 and 2, compared with the images in test-references/. `-- --update` writes them (after
 * looking at them). `CASES=line,bars` limits the run. One browser, closed in `finally`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve, browser } from '../spikes/kit.mjs';
import { decodePng } from '../spikes/lib/png.mjs';

const update = process.argv.includes('--update');
const out = fileURLToPath(new URL('../test-references/', import.meta.url));
mkdirSync(out, { recursive: true });
const all = ['line', 'area', 'columns', 'bars', 'scatter', 'negative', 'dual', 'many', 'dense', 'empty'];
const cases = process.env.CASES ? process.env.CASES.split(',') : all;

/** Share of pixels whose colour moved by more than `tol` on any channel. */
function difference(a, b, tol = 40) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let n = 0;
  for (let i = 0; i < a.data.length; i += a.channels) {
    if (Math.abs(a.data[i] - b.data[i]) > tol || Math.abs(a.data[i + 1] - b.data[i + 1]) > tol || Math.abs(a.data[i + 2] - b.data[i + 2]) > tol) n++;
  }
  return n / (a.width * a.height);
}

const site = await serve(new URL('../playground/index.html', import.meta.url).href);
const b = await browser('chrome');
let failed = 0;
try {
  for (const dpr of [1, 2]) {
    const ctx = await b.newContext({ deviceScaleFactor: dpr, viewport: { width: 700, height: 460 } });
    const page = await ctx.newPage();
    for (const name of cases)
      for (const theme of ['light', 'dark'])
        for (const dir of ['ltr', 'rtl']) {
          await page.goto(site.root(`playground/index.html?case=${name}&theme=${theme}&dir=${dir}`));
          await page.waitForSelector('body[data-ready] svg');
          await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
          const shot = await page.locator('.case').screenshot();
          const file = `${out}${name}-${theme}-${dir}@${dpr}x.png`;
          if (update) {
            writeFileSync(file, shot);
            console.log(`wrote ${file.slice(out.length)}`);
            continue;
          }
          if (!existsSync(file)) {
            // A missing reference is a failure, not a pass: look at the image, then run with --update.
            failed++;
            writeFileSync(file.replace(/\.png$/, '.actual.png'), shot);
            console.log(`MISSING ${name}-${theme}-${dir}@${dpr}x`);
            continue;
          }
          const d = difference(decodePng(readFileSync(file)), decodePng(shot));
          // Two runs in the same browser draw the same pixels: a tight threshold, so a real change never passes.
          const ok = d <= 0.0002;
          if (!ok) {
            failed++;
            writeFileSync(file.replace(/\.png$/, '.actual.png'), shot);
          }
          console.log(`${ok ? 'ok  ' : 'DIFF'} ${name}-${theme}-${dir}@${dpr}x ${(d * 100).toFixed(2)} %`);
        }
    await ctx.close();
  }
} finally {
  await b.close();
  await site.close();
}
if (failed) {
  console.error(`${failed} image(s) differ: see test-references/*.actual.png`);
  process.exit(1);
}
