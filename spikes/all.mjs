// Runs every Phase 0 spike, one after another (one browser at a time: the machine stays cool). S6 is a listening
// page for the owner (node spikes/s6-screen-reader/serve.mjs), not run here.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
for (const s of ['s1-svg-canvas', 's2-text', 's3-decimation', 's4-time-ticks', 's5-align', 's8-lasso']) {
  console.log(`\n### ${s}`);
  execFileSync('node', [here(`./${s}/run.mjs`)], { stdio: 'inherit' });
}
