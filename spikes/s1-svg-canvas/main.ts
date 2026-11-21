// S1 and S7 page: the runner calls window.run(case, n, data) for each case.
import { runCase, type Case } from '../lib/stage.ts';
import { cloud, walk, type Columns } from '../lib/data.ts';

const cache = new Map<string, Columns>();
function data(kind: 'line' | 'scatter', n: number): Columns {
  const k = `${kind}:${n}`;
  let d = cache.get(k);
  if (!d) {
    cache.clear(); // one data set at a time: 10 M points are 160 MB
    d = kind === 'line' ? walk(n) : cloud(n);
    cache.set(k, d);
  }
  return d;
}

(window as any).run = (c: Case, n: number) => runCase(document.getElementById('stage')!, data(c.kind, n), c); // eslint-free spike: window hook
(window as any).ready = true;
