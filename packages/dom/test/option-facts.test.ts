// The site's option facts (scripts/gen-options.mjs, Phase 9 batch 3) say which feature each option needs, from the
// comments' `@feature` tags. Here each claim is held to the chart itself: the option given with every feature but that
// one (and those that bring it), the chart reports `missing-module` naming it. The samples are written by hand.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { allFeatures, chart, type Chart } from '@dzgraph/dom';
import facts from '../../../website/src/generated/options.json';

const T0 = Date.UTC(2026, 0, 1);
const day = 86_400_000;
const timed = { xAxis: { scale: 'time' as const, zone: 'UTC' }, series: [{ type: 'column' as const, id: 's', data: [[T0, 1], [T0 + day, 2], [T0 + 40 * day, 3]] as [number, number][] }] };
/** One option set per claim, keyed `section.name[:scale]`; `act` runs what needs the feature when an option alone does not. */
const SAMPLES: Record<string, { options: object; act?: (c: Chart) => unknown }> = {
  'chart.navigator': { options: { ...timed, navigator: true } },
  'chart.rangeButtons': { options: { ...timed, rangeButtons: true } },
  'chart.crosshair': { options: { ...timed, crosshair: true } },
  'chart.menu': { options: { ...timed, menu: true } },
  'chart.exporting': { options: { ...timed, exporting: { filename: 'x' } }, act: (c) => c.exportSvg() },
  'chart.drilldown': { options: { ...timed, drilldown: 'time' } },
  'chart.selection': { options: { ...timed, selection: true } },
  'series.drilldown': { options: { series: [{ type: 'column', id: 's', data: { y: [1, 2], key: ['a', 'b'] }, drilldown: { details: { a: [{ type: 'column', data: [1] }] } } }] } },
  'axis.scale:time': { options: timed },
  'axis.compare': { options: { ...timed, yAxis: { compare: 'percent' } } },
  'axis.aggregate': { options: { ...timed, xAxis: { scale: 'time', zone: 'UTC', aggregate: 'month' } } },
};

const made: { el: HTMLElement; c: Chart }[] = [];
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

describe('every option\'s @feature is the feature the chart asks for', () => {
  const claims = facts.features.flatMap((f) => f.enables.map((e) => ({ feature: f.name, key: `${e.section}.${e.name}${'scale' in e && e.scale ? `:${e.scale}` : ''}` })));

  it('a sample for each claim, and no sample without one', () => {
    expect(claims.map((c) => c.key).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  for (const { feature, key } of claims) {
    it(`${key} needs ${feature}`, async () => {
      const sample = SAMPLES[key]!;
      const el = document.createElement('div');
      el.setAttribute('style', 'inline-size:500px;block-size:300px');
      document.body.appendChild(el);
      const features = allFeatures.filter((f) => f.name !== feature && !(f.needs ?? []).some((n) => n.name === feature));
      // The samples are plain objects of the options' shapes; the chart checks them like any input.
      const c = chart(el, { animation: false, ...sample.options } as never, { types: allTypes, features });
      made.push({ el, c });
      await sample.act?.(c);
      // A call's problem is told at the next draw.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      expect(c.problems.filter((p) => p.code === 'missing-module').map((p) => p.detail)).toContain(feature);
    });
  }
});
