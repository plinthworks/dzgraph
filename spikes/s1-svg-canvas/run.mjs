// S1 (SVG vs Canvas threshold) and S7 (Canvas limits at 1 M and 10 M points).
//   node spikes/s1-svg-canvas/run.mjs            both
//   SPIKE=s1|s7 BROWSERS=chrome,chrome-4x,firefox,webkit FRAMES=60
import { serve, browser, record } from '../kit.mjs';

const which = process.env.SPIKE ?? 'all';
const names = (process.env.BROWSERS ?? 'chrome,chrome-4x,firefox,webkit').split(',');
const frames = Number(process.env.FRAMES ?? 60);
const NS = [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6];

/** S1: every renderer, undecimated, growing until a frame takes > 100 ms (median). */
const s1 = [];
for (const action of ['zoom', 'hover', 'resize']) {
  s1.push({ renderer: 'svg', kind: 'line', action, decimate: 'none' });
  s1.push({ renderer: 'canvas', kind: 'line', action, decimate: 'none' });
  s1.push({ renderer: 'svg', kind: 'scatter', action, decimate: 'none' });
  s1.push({ renderer: 'svg-dots', kind: 'scatter', action, decimate: 'none' });
  s1.push({ renderer: 'canvas', kind: 'scatter', action, decimate: 'none' });
}
/** S7: Canvas at 1 M and 10 M points, zoom only (the hardest), with and without decimation. */
const s7 = [
  { renderer: 'canvas', kind: 'line', action: 'zoom', decimate: 'none' },
  { renderer: 'canvas', kind: 'line', action: 'zoom', decimate: 'm4' },
  { renderer: 'canvas', kind: 'line', action: 'zoom', decimate: 'm4-pyramid' },
  { renderer: 'svg', kind: 'line', action: 'zoom', decimate: 'm4' },
  { renderer: 'canvas', kind: 'scatter', action: 'zoom', decimate: 'none' },
  { renderer: 'canvas-pixels', kind: 'scatter', action: 'zoom', decimate: 'none' },
];

const site = await serve(import.meta.url);
const out = { frames, s1: {}, s7: {} };
for (const name of names) {
  const b = await browser(name === 'chrome-4x' ? 'chrome' : name);
  try {
    const page = await b.newPage({ viewport: { width: 1300, height: 600 } });
    if (name === 'chrome-4x') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    page.setDefaultTimeout(600_000);
    await page.goto(site.url());
    await page.waitForFunction(() => window.ready);
    const run = (c, n) => page.evaluate(([c, n]) => window.run({ ...c, frames: c.frames }, n), [{ ...c, frames }, n]);
    const label = (c) => `${c.renderer}/${c.kind}/${c.action}${c.decimate !== 'none' ? '/' + c.decimate : ''}`;

    if (which !== 's7') {
      out.s1[name] = {};
      for (const c of s1) {
        const rows = [];
        for (const n of NS) {
          // SVG circles above 200 k elements only measure how long the browser takes to give up.
          if (c.renderer === 'svg' && c.kind === 'scatter' && n > 2e5) break;
          const r = await run(c, n);
          rows.push({ n, ...r });
          console.log(name, label(c), n, JSON.stringify(r));
          if (r.frameMedian > 100) break;
        }
        out.s1[name][label(c)] = rows;
      }
    }
    if (which !== 's1') {
      out.s7[name] = {};
      for (const c of s7) {
        const rows = [];
        for (const n of [1e6, 1e7]) {
          if (c.decimate === 'none' && c.kind === 'line' && n > 1e6 && rows.at(-1)?.frameMedian > 100) break;
          const r = await run(c, n);
          rows.push({ n, ...r });
          console.log(name, label(c), n, JSON.stringify(r));
        }
        out.s7[name][label(c)] = rows;
      }
    }
  } finally {
    await b.close();
  }
}
await site.close();
record(import.meta.url, out);
