import type { Messages } from '../messages.js';

const KINDS: Readonly<Record<string, string>> = { line: 'Line chart', area: 'Area chart', column: 'Column chart', bar: 'Bar chart', scatter: 'Scatter plot' };

export const en: Messages = {
  seriesName: (n) => `Series ${n}`,
  noData: 'No data',
  ellipsis: '…',
  seriesHidden: (name) => `${name} hidden`,
  seriesShown: (name) => `${name} shown`,
  chart: 'Chart',
  summary: (s) => {
    const kind = s.types.length === 1 ? (KINDS[s.types[0]!] ?? 'Chart') : 'Combined chart';
    const series = s.series.map((r) => ` ${r.name}: from ${r.min} to ${r.max}.`).join('');
    const x = s.x ? ` X axis: from ${s.x.from} to ${s.x.to}.` : '';
    return `${kind}, ${s.series.length} series.${series}${x}`;
  },
  seriesList: (name, count) => `${name}, ${count} points`,
  point: (p) => `${p.series}, ${p.x}: ${p.y}. Point ${p.position} of ${p.count}.`,
  tableCaption: 'Chart data',
  rowsOmitted: (count) => `${count} more rows`,
  category: 'Category',
  xValue: 'X value',
};
