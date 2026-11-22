import type { Summary } from '@dzgraph/core/internal';
import type { Messages } from '../messages.js';

const KINDS: Readonly<Record<string, string>> = { line: 'Line chart', area: 'Area chart', column: 'Column chart', bar: 'Bar chart', scatter: 'Scatter plot', pie: 'Pie chart', donut: 'Donut chart', gauge: 'Gauge' };
const PLURAL: Readonly<Record<string, string>> = { line: 'lines', area: 'areas', column: 'columns', bar: 'bars', scatter: 'points' };
const STACKED: Readonly<Record<string, string>> = { area: 'Stacked area chart', column: 'Stacked column chart', bar: 'Stacked bar chart' };

export const en: Messages = {
  seriesName: (n) => `Series ${n}`,
  noData: 'No data',
  ellipsis: '…',
  seriesHidden: (name) => `${name} hidden`,
  seriesShown: (name) => `${name} shown`,
  chart: 'Chart',
  summary: (s) => {
    if (s.meter) return `Gauge. ${s.meter.name}: ${s.meter.value}, between ${s.meter.min} and ${s.meter.max}.${s.meter.threshold ? ` ${s.meter.threshold}.` : ''}`;
    if (s.slices !== undefined) {
      const kind = KINDS[s.types[0]!] ?? 'Chart';
      const largest = s.largest ? ` Largest: ${s.largest.name}, ${s.largest.share}.` : '';
      return `${kind}, ${s.slices} ${s.slices === 1 ? 'slice' : 'slices'}.${largest}`;
    }
    const kind = s.types.length === 1 ? ((s.stacked ? STACKED[s.types[0]!] : undefined) ?? KINDS[s.types[0]!] ?? 'Chart') : `Combined chart: ${new Intl.ListFormat('en').format(s.types.map((t) => PLURAL[t] ?? t))}`;
    const on = (a: NonNullable<Summary['series'][number]['axis']>) => (a.title ? `, on the ${a.title} axis` : `, on the ${['first', 'second'][a.index] ?? `number ${a.index + 1}`} axis`);
    const series = s.series.map((r) => ` ${r.name}: from ${r.min} to ${r.max}${r.axis ? on(r.axis) : ''}.`).join('');
    const x = s.x ? ` X axis: from ${s.x.from} to ${s.x.to}.` : '';
    return `${kind}, ${s.series.length} series.${series}${x}`;
  },
  seriesList: (name, count) => `${name}, ${count} points`,
  point: (p) =>
    p.meter
      ? `${p.x}: ${p.y}, between ${p.meter.min} and ${p.meter.max}.${p.meter.threshold ? ` ${p.meter.threshold}.` : ''}`
      : p.share && p.total === undefined
      ? `${p.x}: ${p.y ? `${p.y}, ` : ''}${p.share}. Slice ${p.position} of ${p.count}.`
      : `${p.series}, ${p.x}: ${p.y}${p.share ? `, ${p.share} of ${p.total}` : ''}. Point ${p.position} of ${p.count}.`,
  total: 'Total',
  stackTotal: (stack) => (stack === null ? 'Total' : `Total ${stack}`),
  seriesOnAxis: (name, axis) => `${name} (${axis})`,
  pointName: (n) => `Slice ${n}`,
  others: 'Others',
  share: 'Share',
  moreSlices: (count) => `and ${count} more`,
  sliceLabel: (name, share) => `${name} ${share}`,
  gaugeNote: (min, max, threshold) => `${min}–${max}${threshold ? ` · ${threshold}` : ''}`,
  meter: { min: 'Minimum', max: 'Maximum', threshold: 'Threshold' },
  tableCaption: 'Chart data',
  rowsOmitted: (count) => `${count} more rows`,
  category: 'Category',
  xValue: 'X value',
  resetZoom: 'Reset zoom',
  rangeShown: (from, to) => `Showing ${from} to ${to}`,
  rangeWhole: 'Showing all data',
  rangeStart: 'Start of range',
  rangeEnd: 'End of range',
  range1m: '1m',
  range3m: '3m',
  rangeYtd: 'YTD',
  range1y: '1y',
  rangeAll: 'All',
  tableRange: (from, to) => `from ${from} to ${to}`,
  tableAll: 'Show all data',
  tableVisible: 'Show the visible range',
};
