// The view as plain JSON and back (view-state.md, ADR 0009). Phase 5a step 2. Expectations by hand.
import { describe, it, expect } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { pointKey } from '../src/view.js';
import { viewFromJson, viewToJson } from '../src/view-json.js';
import { FULL_KIT } from './helpers/kit.js';

const model = normalize(
  {
    series: [
      { type: 'line', id: 'a', data: [1, 2, 3] },
      { type: 'line', id: 'b', data: [4, 5, 6] },
    ],
  },
  allTypes,
).model;
const pie = normalize({ series: [{ type: 'pie', id: 'p', data: [{ name: 'A', y: 1, key: 'k-a' }, { name: 'B', y: 2 }, { name: 'C', y: 3, key: 'k-c' }] }] }, allTypes).model;

describe('to JSON (view-state.md 2, 5)', () => {
  it('hidden series by id, hidden slices by key or index, the range; nothing else', () => {
    const hidden = new Set(['b']);
    expect(viewToJson(model, { hidden, range: { min: 0.5, max: 1.5 } })).toEqual({ hidden: ['b'], range: { min: 0.5, max: 1.5 }, selection: {} });
    expect(viewToJson(pie, { hidden: new Set([pointKey('p', 0), pointKey('p', 1)]), range: null })).toEqual({ hidden: [], hiddenPoints: { p: ['k-a', 1] }, range: null, selection: {} });
    const json = viewToJson(pie, { hidden: new Set([pointKey('p', 2)]), range: null });
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });
});

describe('from JSON (view-state.md 3)', () => {
  it('back to the same view', () => {
    const r = viewFromJson(pie, { hidden: [], hiddenPoints: { p: ['k-a', 1] }, range: null });
    expect([[...r.hidden!].sort(), r.range, r.problems]).toEqual([[pointKey('p', 0), pointKey('p', 1)].sort(), null, []]);
  });

  it('what does not exist is left out and reported, without its value; never a throw', () => {
    const r = viewFromJson(model, { hidden: ['a', 'zz', 7], range: { min: 2, max: 1 }, colour: 'x' });
    expect([...r.hidden!]).toEqual(['a']);
    expect(r.range).toBeUndefined();
    expect(r.problems).toEqual([
      { code: 'invalid-view', path: 'view.hidden[1]' },
      { code: 'invalid-view', path: 'view.hidden[2]' },
      { code: 'invalid-view', path: 'view.range' },
      { code: 'invalid-view', path: 'view.colour' },
    ]);
    const p = viewFromJson(pie, { hiddenPoints: { p: ['nope', 9, 1.5], q: [0] } });
    expect(p.problems.map((x) => x.path)).toEqual(['view.hiddenPoints.p[0]', 'view.hiddenPoints.p[1]', 'view.hiddenPoints.p[2]', 'view.hiddenPoints.q']);
    for (const bad of [null, 3, 'v', [], undefined]) expect(viewFromJson(model, bad).problems).toEqual([{ code: 'invalid-view', path: 'view' }]);
  });

  it('a range of null is the whole data; absent, the range is left as it is', () => {
    expect(viewFromJson(model, { range: null }).range).toBeNull();
    expect(viewFromJson(model, {}).range).toBeUndefined();
    expect(viewFromJson(model, {}).hidden).toBeUndefined();
  });
});

describe('the comparison in the view (view-state.md 1, compare.md)', () => {
  it('the user\'s only (review 1: the option stays the option\'s); read back, bad ones reported', () => {
    expect(viewToJson(model, { hidden: new Set(), range: null, compare: { mode: 'index', to: 2 } }).compare).toEqual({ mode: 'index', to: 2 });
    const opt = normalize({ yAxis: { compare: 'percent' }, series: [{ type: 'line', data: [1, 2] }] }, allTypes, { kit: FULL_KIT }).model;
    expect(viewToJson(opt, { hidden: new Set(), range: null }).compare).toBeUndefined();
    expect(viewToJson(opt, { hidden: new Set(), range: null, compare: null }).compare).toBeNull();
    expect(viewFromJson(model, { compare: { mode: 'value' } }).compare).toEqual({ mode: 'value', to: null });
    expect(viewFromJson(model, { compare: null }).compare).toBeNull();
    expect(viewFromJson(model, {}).compare).toBeUndefined();
    expect(viewFromJson(model, { compare: { mode: 'ratio' } }).problems).toEqual([{ code: 'invalid-view', path: 'view.compare' }]);
  });
});
