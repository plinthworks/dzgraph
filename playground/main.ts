// The playground: every case, or one (`?case=line&theme=dark&dir=rtl`) for the reference images.
import { area, bar, column, line, scatter } from '@dzgraph/core';
import { chart } from '@dzgraph/dom';
import { cases } from './cases.ts';

const types = [line, area, column, bar, scatter];
const params = new URLSearchParams(location.search);
const theme = params.get('theme') ?? 'light';
const rtl = params.get('dir') === 'rtl';
document.documentElement.dataset['theme'] = theme;
document.documentElement.dir = rtl ? 'rtl' : 'ltr';
document.documentElement.lang = rtl ? 'ar' : 'fr';

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
  chart(box, c.options(rtl), { types });
}
document.body.dataset['ready'] = 'true';
