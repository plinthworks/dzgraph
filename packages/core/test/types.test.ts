// The public types' promises, checked by the compiler (`npm run typecheck`) and run as tests. Step 1.2, after the
// type review (findings 1–17).
import { describe, it, expectTypeOf } from 'vitest';
import type { AxisOptions, ChartOptions, ChartUpdate, Day, InstantMs, ProblemCode, SeriesBase, SeriesOptions, SeriesUnionOf } from '@dzgraph/core';
import type { OwnOptionNames, SeriesType } from '@dzgraph/core/internal';

// Series type modules add themselves to the registry (ADR 0005); here stand-ins for a line and an OHLC type.
interface TestLine extends SeriesBase<'test-line'> {
  readonly smooth?: boolean | undefined;
}
interface OhlcPoint {
  readonly x: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}
interface TestOhlc extends SeriesBase<'test-ohlc', readonly OhlcPoint[]> {
  readonly upColor?: number | undefined;
}
declare module '@dzgraph/core' {
  interface SeriesOptionsByType {
    'test-line': TestLine;
    'test-ohlc': TestOhlc;
  }
  interface ProblemCodes {
    'test-negative-slice': true;
  }
}

describe('public types', () => {
  it('series are a union discriminated by type, grown by declaration merging', () => {
    const s = { type: 'test-line', data: [1, 2] } as SeriesOptions;
    if (s.type === 'test-line') expectTypeOf(s.smooth).toEqualTypeOf<boolean | undefined>();
    // @ts-expect-error an option of another type is refused on a narrowed series
    const bad: SeriesOptions = { type: 'test-line', data: [], upColor: 2 };
    void bad;
  });

  it('a type declares its own data shape (finding 1)', () => {
    const ok: SeriesOptions = { type: 'test-ohlc', data: [{ x: 1, open: 1, high: 2, low: 0, close: 1 }] };
    // @ts-expect-error OHLC data is not x/y data
    const bad: SeriesOptions = { type: 'test-ohlc', data: [1, 2, 3] };
    void ok;
    void bad;
  });

  it('a registry entry without type and data is refused (finding 5)', () => {
    type Bogus = SeriesUnionOf<{ bogus: { foo: 1 } }>;
    // @ts-expect-error no type, no data
    const s: Bogus = { foo: 1 };
    void s;
  });

  it('every x/y data shape is accepted', () => {
    const options: ChartOptions = {
      series: [
        { type: 'test-line', data: [1, null, 3] },
        { type: 'test-line', data: [['a', 1], ['b', null]] },
        { type: 'test-line', data: [{ x: 1, y: 2, key: 'k1' }] },
        { type: 'test-line', data: { x: new Float64Array(2), y: new Float64Array(2) } },
      ],
    };
    void options;
  });

  it('an absent field may be passed as undefined, in options and in updates (finding 15)', () => {
    const fromSignal: string | undefined = undefined;
    const options: ChartOptions = { series: [], title: fromSignal, legend: undefined, xAxis: { title: fromSignal } };
    const update: ChartUpdate = { series: undefined, title: undefined };
    void options;
    void update;
  });

  it('an axis formatter takes its scale\'s values (finding 4)', () => {
    const time: AxisOptions = { scale: 'time', zone: 'Europe/Paris', ticks: { format: (v) => (expectTypeOf(v).toEqualTypeOf<InstantMs>(), '') } };
    const category: AxisOptions = { scale: 'category', ticks: { format: (v) => (expectTypeOf(v).toEqualTypeOf<string>(), v) } };
    // @ts-expect-error a category axis has no numeric bounds
    const bad: AxisOptions = { scale: 'category', min: 0 };
    void time;
    void category;
    void bad;
  });

  it('instants and days do not mix, and plain values are neither', () => {
    expectTypeOf<InstantMs>().not.toEqualTypeOf<number>();
    // @ts-expect-error a plain number is not an instant: it comes only from the core's checks
    const i: InstantMs = 0;
    // @ts-expect-error a day is not an instant
    const d: InstantMs = '2026-03-29' as Day;
    void i;
    void d;
  });

  it('colours are palette places or CSS tokens, never literals', () => {
    // @ts-expect-error a colour literal is refused
    const bad: SeriesOptions = { type: 'test-line', data: [], color: '#2563eb' };
    const ok: SeriesOptions = { type: 'test-line', data: [], color: { token: 'revenue' } };
    void bad;
    void ok;
  });

  it('problem codes are open to type modules (finding 9)', () => {
    expectTypeOf<'test-negative-slice'>().toExtend<ProblemCode>();
    expectTypeOf<'unknown-option'>().toExtend<ProblemCode>();
  });

  it('a type lists every option it adds, and is accepted where any type is (finding 6)', () => {
    // @ts-expect-error `smooth` is missing from the list
    const missing: OwnOptionNames<TestLine> = {};
    // @ts-expect-error a misspelt name is refused
    const misspelt: OwnOptionNames<TestLine> = { smooth: true, smoth: true };
    expectTypeOf<SeriesType<TestLine, 'cartesian'>>().toExtend<SeriesType>();
    void missing;
    void misspelt;
  });
});
