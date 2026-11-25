// The gauge workshop (owner 2026-11-25), the site's own module (website/src/components/demo/gauge-workshop.ts):
// every part of a gauge set with buttons. `?theme=dark`, `?dir=rtl`.
import { allTypes } from '@dzgraph/core';
import { chart } from '@dzgraph/dom';
import { gaugeWorkshop } from '../website/src/components/demo/gauge-workshop.ts';

const params = new URLSearchParams(location.search);
document.documentElement.dataset['theme'] = params.get('theme') ?? 'light';
const rtl = params.get('dir') === 'rtl';
document.documentElement.dir = rtl ? 'rtl' : 'ltr';
const host = document.getElementById('workshop')!;
if (rtl) host.lang = 'ar';
gaugeWorkshop(host, 'fr', (box, options) => {
  const c = chart(box, options as never /* Partial<ChartOptions>: the series are always given */, { types: allTypes });
  c.on('problems', (d) => {
    for (const p of d.problems) console.warn('dzgraph workshop', p.code, p.path);
  });
  return c;
});
