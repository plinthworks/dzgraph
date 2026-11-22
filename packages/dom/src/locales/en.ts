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
    const modes = { value: 'as a difference', percent: 'in percent', index: 'as base 100' } as const;
    const compare = s.compare ? ` Compared to ${s.compare.baseline ?? 'the first point in view'}, ${modes[s.compare.mode]}.` : '';
    const selected = s.selected ? ` ${s.selected} ${s.selected === 1 ? 'point' : 'points'} selected.` : '';
    const PERIODS = { hour: 'hour', day: 'day', week: 'week', month: 'month', quarter: 'quarter', year: 'year' } as const;
    const FNS = { sum: 'sum', mean: 'mean', min: 'minimum', max: 'maximum', count: 'count' } as const;
    const by = s.aggregation ? ('period' in s.aggregation.by ? `By ${PERIODS[s.aggregation.by.period]}` : `By steps of ${s.aggregation.by.step}`) : '';
    const aggregated = s.aggregation ? ` ${by}, ${new Intl.ListFormat('en').format(s.aggregation.fns.map((f) => FNS[f]))}.` : '';
    return `${kind}, ${s.series.length} series.${series}${x}${compare}${selected}${aggregated}`;
  },
  seriesList: (name, count) => `${name}, ${count} points`,
  point: (p) =>
    p.meter
      ? `${p.x}: ${p.y}, between ${p.meter.min} and ${p.meter.max}.${p.meter.threshold ? ` ${p.meter.threshold}.` : ''}`
      : p.share && p.total === undefined
      ? `${p.x}: ${p.y ? `${p.y}, ` : ''}${p.share}. Slice ${p.position} of ${p.count}.`
      : `${p.series}, ${p.x}: ${p.y}${p.raw ? ` (${p.raw})` : ''}${p.share ? `, ${p.share} of ${p.total}` : ''}${p.selected ? ', selected' : ''}${p.detail ? ', detail available' : ''}. Point ${p.position} of ${p.count}.`,
  total: 'Total',
  menu: {
    button: 'Chart options',
    type: 'Type',
    aggregation: 'Aggregation',
    scale: 'Scale',
    compare: 'Comparison',
    types: { line: 'Line', area: 'Area', column: 'Column' },
    none: 'None',
    periods: { hour: 'By hour', day: 'By day', week: 'By week', month: 'By month', quarter: 'By quarter', year: 'By year' },
    linear: 'Linear',
    log: 'Logarithmic',
    compares: { value: 'Difference', percent: 'Percent', index: 'Base 100' },
  },
  exporting: { download: 'Download', print: 'Print', png: 'PNG image', svg: 'SVG image', csv: 'CSV data', filename: 'chart' },
  drill: { breadcrumb: 'Levels', root: 'All', loading: 'Loading…', failed: 'The detail could not be loaded.', retry: 'Try again' },
  pointsIn: (n) => `${n} ${n === '1' ? 'point' : 'points'}`,
  shapes: { rectangle: 'Rectangle', range: 'Range', lasso: 'Lasso' },
  selectedCount: (n) => (n === '0' ? 'Selection cleared' : `${n} ${n === '1' ? 'point' : 'points'} selected`),
  selectedColumn: 'Selected',
  modeBar: 'Chart mode',
  modes: { zoom: 'Zoom', selection: 'Select', measure: 'Measure' },
  measureTag: (r) => `${r.value}${r.percent ? ` (${r.percent})` : ''}${r.along.kind === 'text' ? ` · ${r.along.text}` : ` · ${r.along.count} ${r.along.count === 1 ? 'category' : 'categories'}`}`,
  measured: (r) => `Difference: ${r.value}${r.percent ? ` (${r.percent})` : ''}, ${r.along.kind === 'text' ? `over ${r.along.text}` : `over ${r.along.count} ${r.along.count === 1 ? 'category' : 'categories'}`}.`,
  since: (baseline) => `Since ${baseline}`,
  compared: (name) => `${name} (compared)`,
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
