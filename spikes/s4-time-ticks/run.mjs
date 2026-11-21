// S4: node spikes/s4-time-ticks/run.mjs   (BROWSERS=chrome,firefox,webkit)
import { serve, browser, record } from '../kit.mjs';

const names = (process.env.BROWSERS ?? 'chrome,firefox,webkit').split(',');
const site = await serve(import.meta.url);
const out = {};
for (const name of names) {
  const b = await browser(name);
  try {
    const page = await b.newPage();
    await page.goto(site.url());
    await page.waitForFunction(() => window.ready);
    out[name] = await page.evaluate(() => window.run());
    console.log(name, JSON.stringify(out[name]));
  } finally {
    await b.close();
  }
}
await site.close();
record(import.meta.url, out);
