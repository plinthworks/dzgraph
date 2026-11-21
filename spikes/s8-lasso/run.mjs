// S8: node spikes/s8-lasso/run.mjs   (BROWSERS=chrome,firefox,webkit)
import { serve, browser, record } from '../kit.mjs';

const names = (process.env.BROWSERS ?? 'chrome,firefox,webkit').split(',');
const site = await serve(import.meta.url);
const out = {};
for (const name of names) {
  const b = await browser(name);
  try {
    const page = await b.newPage();
    page.setDefaultTimeout(600_000);
    await page.goto(site.url());
    await page.waitForFunction(() => window.ready);
    out[name] = {};
    for (const n of [1e5, 1e6]) {
      out[name][n] = await page.evaluate((n) => window.run(n), n);
      console.log(name, n, JSON.stringify(out[name][n]));
    }
  } finally {
    await b.close();
  }
}
await site.close();
record(import.meta.url, out);
