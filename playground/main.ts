// The playground: every case, or one (`?case=line&theme=dark&dir=rtl`) for the reference images.
import { allTypes } from '@dzgraph/core';
import { allFeatures, chart, type Chart } from '@dzgraph/dom';
import { cases } from './cases.ts';

const types = allTypes;
const params = new URLSearchParams(location.search);
const theme = params.get('theme') ?? 'light';
const rtl = params.get('dir') === 'rtl';
document.documentElement.dataset['theme'] = theme;
document.documentElement.dir = rtl ? 'rtl' : 'ltr';
document.documentElement.lang = rtl ? 'ar' : 'fr';

// The charts by case, for a script that drives them (the exports looked at by eye, Phase 6).
const charts: Record<string, Chart> = {};
Object.assign(globalThis, { dzgraphCharts: charts });

const only = params.get('case');
const host = document.getElementById('cases')!;
for (const [name, c] of Object.entries(cases)) {
  if (only && name !== only) continue;
  const figure = document.createElement('figure');
  figure.className = 'case';
  figure.dataset['case'] = name;
  const caption = document.createElement('figcaption');
  caption.textContent = c.title;
  const box = document.createElement('div');
  box.className = 'chart';
  figure.append(caption, box);
  host.appendChild(figure);
  // Every module but measure, whose mode bar would sit on every chart; the exploration cases take them all.
  const features = c.exploration ? allFeatures : allFeatures.filter((f) => f.name !== 'measure');
  const made = chart(box, c.options(rtl), { types, features });
  charts[name] = made;
  c.after?.(made);
}
document.body.dataset['ready'] = 'true';
