/**
 * The benches (big-data.md 4): bench/index.html in real Chrome, one run; the result in bench/results/result.json.
 * Measured, never asserted (CLAUDE.md): run it on a quiet machine and read it against 16.7 ms a frame (60 a second).
 */
import { serve, browser, record } from '../spikes/kit.mjs';

const site = await serve(new URL('../bench/index.html', import.meta.url).href);
const b = await browser('chrome');
try {
  const page = await b.newPage({ viewport: { width: 1100, height: 600 } });
  await page.goto(site.url(process.argv.includes('--quick') ? 'index.html?quick' : 'index.html'));
  await page.waitForFunction(() => window.benchResult || window.benchError, null, { timeout: 600_000, polling: 500 });
  const error = await page.evaluate(() => window.benchError);
  if (error) throw new Error(error);
  const result = await page.evaluate(() => window.benchResult);
  if (process.argv.includes('--quick')) console.log(JSON.stringify(result, null, 1));
  else record(new URL('../bench/index.html', import.meta.url).href, { browser: 'chrome', budgetMs: 16.7, result });
} finally {
  await b.close();
  await site.close();
}
