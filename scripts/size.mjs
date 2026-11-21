/**
 * Measures each entry the way an app ships it — bundled, minified, gzipped — against size-budget.json. Exits 1 over
 * budget. A budget of null only records the size (ARCHITECTURE §13: the owner sets budgets after Phase 1).
 * Taken from DzGrid's scripts/size.mjs (our own code), simplified.
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const budget = JSON.parse(readFileSync(`${root}size-budget.json`, 'utf8'));

let over = 0;
for (const [name, { file, maxGzip, external = [] }] of Object.entries(budget.entries)) {
  const out = await build({ entryPoints: [root + file], bundle: true, minify: true, format: 'esm', target: 'es2022', write: false, treeShaking: true, external });
  const code = out.outputFiles[0].contents;
  const gz = gzipSync(code, { level: 9 }).length;
  const ok = maxGzip === null || gz <= maxGzip;
  if (!ok) over++;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${name}: ${code.length} B min, ${gz} B gz (budget ${maxGzip ?? 'recorded'})`);
}
if (over) process.exit(1);
