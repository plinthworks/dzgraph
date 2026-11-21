// S3, by eye: the full drawing and the M4 drawing of 1 M points, written as PNG files to compare side by side.
import { writeFileSync, mkdirSync } from 'node:fs';
import { serve, browser } from '../kit.mjs';

const site = await serve(import.meta.url);
const b = await browser('chrome');
try {
  const page = await b.newPage();
  await page.goto(site.url());
  await page.waitForFunction(() => window.ready);
  const urls = await page.evaluate(async () => {
    const { walk, extent } = await import('../lib/data.ts');
    const { m4 } = await import('../lib/decimate.ts');
    const d = walk(1e6);
    const yr = extent(d.y);
    const [a, b] = extent(d.x);
    const W = 1200, H = 400;
    const shot = async (idx, k) => {
      const cv = new OffscreenCanvas(W, H);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      const sx = W / (b - a), sy = (H - 20) / (yr[1] - yr[0]);
      ctx.beginPath();
      for (let j = 0; j < k; j++) { const i = idx ? idx[j] : j; const X = (d.x[i] - a) * sx, Y = H - 10 - (d.y[i] - yr[0]) * sy; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke();
      const blob = await cv.convertToBlob();
      return [...new Uint8Array(await blob.arrayBuffer())];
    };
    const out = new Int32Array(4 * W + 8);
    const k = m4(d.x, d.y, a, b, W, out);
    return { full: await shot(null, d.x.length), m4: await shot(out, k) };
  });
  mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
  for (const [k, v] of Object.entries(urls)) writeFileSync(new URL(`./results/${k}.png`, import.meta.url), Buffer.from(v));
  console.log('written results/full.png, results/m4.png');
} finally {
  await b.close();
  await site.close();
}
