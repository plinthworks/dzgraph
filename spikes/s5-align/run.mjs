// S5: node spikes/s5-align/run.mjs   (BROWSERS=chrome,firefox,webkit)
// For each DPR (1, 1.5, 2), box width (1200, 1201) and start offset (10, 10.5 px): screenshot SVG, screenshot Canvas,
// count the pixels that differ by more than a tolerance, and how far the inked area moved (centre of mass).
import { serve, browser, record } from '../kit.mjs';
import { decodePng } from '../lib/png.mjs';

const names = (process.env.BROWSERS ?? 'chrome,firefox,webkit').split(',');
const site = await serve(import.meta.url);
const out = {};

function compare(a, b, tol) {
  let differ = 0, inked = 0, ax = 0, ay = 0, an = 0, bx = 0, by = 0, bn = 0;
  for (let y = 0; y < a.height; y++)
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * a.channels;
      const j = (y * b.width + x) * b.channels;
      const da = 765 - a.data[i] - a.data[i + 1] - a.data[i + 2];
      const db = 765 - b.data[j] - b.data[j + 1] - b.data[j + 2];
      if (da > 30) { inked++; ax += x * da; ay += y * da; an += da; }
      if (db > 30) { bx += x * db; by += y * db; bn += db; }
      if (Math.max(Math.abs(a.data[i] - b.data[j]), Math.abs(a.data[i + 1] - b.data[j + 1]), Math.abs(a.data[i + 2] - b.data[j + 2])) > tol) differ++;
    }
  return {
    differ, inked, share: +(differ / inked).toFixed(3),
    shiftPx: [+(bx / bn - ax / an).toFixed(3), +(by / bn - ay / an).toFixed(3)],
  };
}

for (const name of names) {
  out[name] = [];
  const b = await browser(name);
  try {
    for (const dpr of [1, 1.5, 2]) {
      const ctx = await b.newContext({ deviceScaleFactor: dpr, viewport: { width: 1300, height: 340 } });
      const page = await ctx.newPage();
      await page.goto(site.url());
      await page.waitForFunction(() => window.ready);
      for (const w of [1200, 1201]) for (const start of [10, 10.5]) {
        const shot = async (mode) => {
          await page.evaluate(([m, w, s]) => window.draw(m, w, s), [mode, w, start]);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          return decodePng(await page.screenshot({ clip: { x: 0, y: 0, width: 1250, height: 330 } }));
        };
        const svg = await shot('svg');
        const cnv = await shot('canvas');
        const row = { dpr, w, start, strict: compare(svg, cnv, 64), loose: compare(svg, cnv, 128) };
        out[name].push(row);
        console.log(name, JSON.stringify(row));
      }
      await ctx.close();
    }
  } finally {
    await b.close();
  }
}
await site.close();
record(import.meta.url, out);
