// Checking and completing the options (options.ts) into the model (model.ts): defaults, problems, categories,
// orientation. Never throws, never puts a value from the data in a Problem. Expectations written by hand. Step 1.4.
import { describe, it, expect } from 'vitest';
import { normalize } from '../src/normalize.js';
import { types } from './helpers/types.js';

const run = (options: unknown) => normalize(options, types);
const codes = (options: unknown) => run(options).problems.map((p) => `${p.code} ${p.path}`);

describe('normalize: defaults', () => {
  it('one line series: ids, palette, axes, no legend', () => {
    const { model, problems } = run({ series: [{ type: 'line', data: [1, 2, 3] }] });
    expect(problems).toEqual([]);
    const s = model.series[0]!;
    expect([s.id, s.type, s.name, s.rank, s.color, s.xAxis, s.yAxis, s.initiallyHidden]).toEqual(['#1', 'line', null, 0, 'series-1', 'x', 'y', false]);
    expect([...s.columns.x]).toEqual([0, 1, 2]);
    expect([...s.columns.y]).toEqual([1, 2, 3]);
    expect(model.xAxes.map((a) => [a.id, a.scale])).toEqual([['x', 'linear']]);
    expect(model.yAxes.map((a) => [a.id, a.scale])).toEqual([['y', 'linear']]);
    expect(model.legend).toBeNull();
    expect([model.title, model.locale, model.dir, model.mirror, model.aspectRatio, model.orientation]).toEqual([null, null, null, false, 16 / 9, 'vertical']);
    expect([model.highlight, model.animation, model.dataTable]).toEqual([true, true, false]);
  });

  it('two series: a legend under the plot, centred; the second colour', () => {
    const { model } = run({ series: [{ type: 'line', data: [1] }, { type: 'column', data: [2], name: 'B' }] });
    expect(model.legend).toEqual({ position: 'bottom', align: 'center' });
    expect(model.series.map((s) => [s.id, s.name, s.color])).toEqual([['#1', null, 'series-1'], ['#2', 'B', 'series-2']]);
  });

  it('legend forced on or off; title as a string or an object', () => {
    expect(run({ series: [{ type: 'line', data: [] }], legend: true }).model.legend).toEqual({ position: 'bottom', align: 'center' });
    expect(run({ series: [{ type: 'line', data: [] }, { type: 'line', data: [] }], legend: false }).model.legend).toBeNull();
    expect(run({ series: [], legend: { position: 'end' } }).model.legend).toEqual({ position: 'end', align: 'center' });
    expect(run({ series: [], title: 'Ventes' }).model.title).toEqual({ text: 'Ventes', subtitle: null, align: 'start' });
    expect(run({ series: [], title: { text: 'Ventes', subtitle: '2026', align: 'center' } }).model.title).toEqual({ text: 'Ventes', subtitle: '2026', align: 'center' });
  });

  it('colours: palette places from 1, wrapped after 8; app tokens', () => {
    const { model, problems } = run({ series: [3, 12, { token: 'revenue' }].map((color) => ({ type: 'line', data: [], color })) });
    expect(problems).toEqual([]);
    // 12 is past the eight colours: 12 − 8 = 4.
    expect(model.series.map((s) => s.color)).toEqual(['series-3', 'series-4', 'color-revenue']);
  });

  it('initially hidden, locale, direction, mirror, aspect ratio, description', () => {
    const { model, problems } = run({ series: [{ type: 'line', data: [], initiallyHidden: true }], locale: 'fr-FR', dir: 'rtl', mirror: true, aspectRatio: 2, description: 'Ventes par mois' });
    expect(problems).toEqual([]);
    expect([model.series[0]!.initiallyHidden, model.locale, model.dir, model.mirror, model.aspectRatio, model.description]).toEqual([true, 'fr-FR', 'rtl', true, 2, 'Ventes par mois']);
  });
});

describe('normalize: problems, and what is drawn instead', () => {
  it('options that are not an object: an empty chart', () => {
    for (const bad of [undefined, null, 42, 'x', []]) {
      const { model, problems } = run(bad);
      expect(model.series).toEqual([]);
      expect(problems).toEqual([{ code: 'invalid-option', path: '' }]);
    }
  });

  it('series not an array; an entry not an object', () => {
    expect(codes({ series: 'line' })).toEqual(['invalid-option series']);
    expect(codes({})).toEqual(['invalid-option series']);
    expect(codes({ series: [{ type: 'line', data: [] }, 7] })).toEqual(['invalid-option series[1]']);
  });

  it('an unknown option, at the top and on a series; a type\'s own option on another type', () => {
    expect(codes({ series: [], colour: 'red' })).toEqual(['unknown-option colour']);
    expect(codes({ series: [{ type: 'line', data: [], smooth: true }] })).toEqual(['unknown-option series[0].smooth']);
    expect(codes({ series: [{ type: 'column', data: [], marker: true }] })).toEqual(['unknown-option series[0].marker']);
  });

  it('a type\'s own check is run with the series\' path', () => {
    expect(codes({ series: [{ type: 'line', data: [], marker: 'yes' }] })).toEqual(['invalid-option series[0].marker']);
  });

  it('an unknown series type: the series is left out, the type named in the detail', () => {
    const { model, problems } = run({ series: [{ type: 'pie', data: [1] }, { type: 'line', data: [1] }] });
    expect(problems).toEqual([{ code: 'unknown-series-type', path: 'series[0].type', detail: 'pie' }]);
    expect(model.series.map((s) => [s.id, s.rank])).toEqual([['#2', 0]]);
  });

  it('ids: a repeated one, a reserved one; each falls back to its default', () => {
    const { model, problems } = run({ series: [{ type: 'line', data: [], id: 'a' }, { type: 'line', data: [], id: 'a' }, { type: 'line', data: [], id: '#9' }] });
    expect(problems.map((p) => `${p.code} ${p.path}`)).toEqual(['duplicate-id series[1].id', 'duplicate-id series[2].id']);
    expect(model.series.map((s) => s.id)).toEqual(['a', '#2', '#3']);
  });

  it('bad values for known options fall back to their defaults', () => {
    expect(codes({ series: [{ type: 'line', data: [], color: 0 }, { type: 'line', data: [], color: 1.5 }, { type: 'line', data: [], color: { token: 'a b' } }] })).toEqual([
      'invalid-option series[0].color',
      'invalid-option series[1].color',
      'invalid-option series[2].color',
    ]);
    expect(codes({ series: [], dir: 'up', aspectRatio: -1, mirror: 'yes', locale: 'not a locale!' })).toEqual([
      'invalid-option locale',
      'invalid-option dir',
      'invalid-option mirror',
      'invalid-option aspectRatio',
    ]);
    expect(run({ series: [], aspectRatio: -1 }).model.aspectRatio).toBe(16 / 9);
  });

  it('a series naming an axis that does not exist is drawn on the first one', () => {
    const { model, problems } = run({ series: [{ type: 'line', data: [], yAxis: 'right' }] });
    expect(problems).toEqual([{ code: 'unknown-axis', path: 'series[0].yAxis', seriesId: '#1', detail: 'right' }]);
    expect(model.series[0]!.yAxis).toBe('y');
  });

  it('data problems carry the series\' path and id', () => {
    expect(run({ series: [{ type: 'line', id: 'sales', data: [1, Number.NaN] }] }).problems).toEqual([
      { code: 'non-finite-value', path: 'series[0].data[1]', seriesId: 'sales', detail: 'count=1' },
    ]);
  });
});

describe('normalize: axes', () => {
  it('one axis or several; default ids; the second y axis by id', () => {
    const { model, problems } = run({ series: [{ type: 'line', data: [], yAxis: 'y2' }], yAxis: [{ title: 'kg' }, { opposite: true }] });
    expect(problems).toEqual([]);
    expect(model.yAxes.map((a) => [a.id, a.title, a.opposite])).toEqual([['y', 'kg', false], ['y2', null, true]]);
    expect(model.series[0]!.yAxis).toBe('y2');
  });

  it('a repeated axis id, an unknown scale, an option of another scale, min above max', () => {
    expect(codes({ series: [], xAxis: [{ id: 'a' }, { id: 'a' }] })).toEqual(['duplicate-id xAxis[1].id']);
    expect(codes({ series: [], xAxis: { scale: 'radial' } })).toEqual(['invalid-option xAxis[0].scale']);
    expect(codes({ series: [], xAxis: { categories: ['a'] } })).toEqual(['unknown-option xAxis[0].categories']);
    expect(codes({ series: [], yAxis: { min: 10, max: 5 } })).toEqual(['invalid-option yAxis[0].min']);
    expect(run({ series: [], yAxis: { min: 10, max: 5 } }).model.yAxes[0]!.min).toBeNull();
  });

  it('strings along x make a category axis, categories in order of appearance across series', () => {
    const { model, problems } = run({ series: [{ type: 'column', data: [['B', 1], ['A', 2]] }, { type: 'column', data: [['C', 3], ['B', 4]] }] });
    expect(problems).toEqual([]);
    expect(model.xAxes[0]!.scale).toBe('category');
    expect(model.xAxes[0]!.categories).toEqual(['B', 'A', 'C']);
    expect([...model.series[0]!.columns.x]).toEqual([0, 1]);
    expect([...model.series[1]!.columns.x]).toEqual([2, 0]);
  });

  it('the app\'s categories come first; one it did not list is added after them, reported', () => {
    const { model, problems } = run({ series: [{ type: 'column', id: 's', data: [['Q2', 1], ['Q5', 2]] }], xAxis: { scale: 'category', categories: ['Q1', 'Q2'] } });
    expect(model.xAxes[0]!.categories).toEqual(['Q1', 'Q2', 'Q5']);
    expect([...model.series[0]!.columns.x]).toEqual([1, 2]);
    expect(problems).toEqual([{ code: 'invalid-data', path: 'series[0].data[1]', seriesId: 's', detail: 'category' }]);
  });

  it('values only on a category axis take the categories by position', () => {
    const { model } = run({ series: [{ type: 'column', data: [5, 6] }], xAxis: { scale: 'category', categories: ['Jan', 'Feb'] } });
    expect([...model.series[0]!.columns.x]).toEqual([0, 1]);
  });

  it('strings along a linear x axis are gaps, reported once', () => {
    const { model, problems } = run({ series: [{ type: 'line', id: 's', data: [[1, 1], ['B', 2]] }], xAxis: { scale: 'linear' } });
    expect(Number.isNaN(model.series[0]!.columns.y[1]!)).toBe(true);
    expect(problems).toEqual([{ code: 'invalid-data', path: 'series[0].data[1]', seriesId: 's', detail: 'count=1' }]);
  });
});

describe('normalize: orientation', () => {
  it('bars turn the chart across', () => {
    expect(run({ series: [{ type: 'bar', data: [1] }] }).model.orientation).toBe('horizontal');
  });

  it('bars and columns in one chart: the first series\' orientation wins, the others are left out', () => {
    const { model, problems } = run({ series: [{ type: 'bar', data: [1] }, { type: 'column', data: [1] }, { type: 'bar', data: [2] }] });
    expect(model.series.map((s) => s.id)).toEqual(['#1', '#3']);
    expect(problems).toEqual([{ code: 'mixed-orientation', path: 'series[1].type', seriesId: '#2', detail: 'column' }]);
  });
});
