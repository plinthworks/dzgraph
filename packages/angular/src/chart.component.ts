/**
 * `<dz-chart>` (angular.md, D.13): a DzGraph chart in an Angular template. Its options are a signal input: a new
 * value updates the chart, never re-creates it. One output per event. Drawn in the browser only (nothing on the
 * server); destroyed with the component.
 */
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, input, output, untracked } from '@angular/core';
import type { ChartOptions, PointRef, Problem } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import type { SeriesType } from '@dzgraph/core/internal';
import { allFeatures, chart, type Chart, type ChartEvents, type ChartSetup, type Feature } from '@dzgraph/dom';

@Component({
  selector: 'dz-chart',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A block that fills its parent's width; its height comes from the app's CSS or the `aspectRatio` option (D.11).
  host: { style: 'display: block' },
})
export class DzChart {
  /** The chart's options (ChartOptions). */
  readonly options = input.required<ChartOptions>();
  /** The series types it may draw: every type by default; pass only those you use to ship less (ADR 0005). */
  readonly types = input<readonly SeriesType[]>(allTypes);
  /** The features it may use (time axes, zoom, navigator, Canvas, WebGL2): every one by default (ADR 0006, 0008). */
  readonly features = input<readonly Feature[]>(allFeatures);
  /** Words to use instead of the built-in ones. */
  readonly messages = input<ChartSetup['messages']>();
  /** Drive the animations yourself (animation.md 6). */
  readonly animate = input<ChartSetup['animate']>();

  readonly problems = output<readonly Problem[]>();
  readonly pointHover = output<PointRef | null>();
  readonly pointClick = output<PointRef>();
  readonly pointFocus = output<PointRef>();
  readonly legendToggle = output<ChartEvents['legendToggle']>();
  readonly rangeChange = output<ChartEvents['rangeChange']['range']>();
  /** Phase 5: the view as state, the mode, a measure, the selection (view-state.md, modes.md, measure.md, selection.md). */
  readonly viewChange = output<ChartEvents['viewChange']>();
  readonly modeChange = output<ChartEvents['modeChange']['mode']>();
  readonly measure = output<ChartEvents['measure']>();
  readonly selectionChange = output<ChartEvents['selectionChange']>();

  private instance: Chart | null = null;

  /**
   * The chart, for its methods (angular.md 7): `exportPng()`, `print()`, `getView()`… Null before it is drawn (in the
   * browser, after the first render) and on the server.
   */
  get chart(): Chart | null {
    return this.instance;
  }
  /** The options last given, to tell the chart which top-level fields went away (review 7). */
  private given: ChartOptions | null = null;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const create = () => {
      this.instance?.destroy();
      const messages = untracked(this.messages);
      const animate = untracked(this.animate);
      const options = untracked(this.options);
      const c = chart(host, options, { types: untracked(this.types), features: untracked(this.features), ...(messages ? { messages } : {}), ...(animate ? { animate } : {}) });
      this.instance = c;
      this.given = options;
      c.on('problems', (d) => this.problems.emit(d.problems));
      c.on('pointHover', (d) => this.pointHover.emit(d.point));
      c.on('pointClick', (d) => this.pointClick.emit(d.point));
      c.on('pointFocus', (d) => this.pointFocus.emit(d.point));
      c.on('legendToggle', (d) => this.legendToggle.emit(d));
      c.on('rangeChange', (d) => this.rangeChange.emit(d.range));
      c.on('viewChange', (d) => this.viewChange.emit(d));
      c.on('modeChange', (d) => this.modeChange.emit(d.mode));
      c.on('measure', (d) => this.measure.emit(d));
      c.on('selectionChange', (d) => this.selectionChange.emit(d));
      if (c.problems.length) this.problems.emit(c.problems);
    };
    // In the browser only, once the host is in the page.
    afterNextRender(create);
    // A new value of the options updates the chart; a field it no longer has goes back to its default.
    effect(() => {
      const options = this.options();
      untracked(() => {
        if (!this.instance || options === this.given) return;
        const changes: Record<string, unknown> = { ...options };
        for (const k of Object.keys(this.given ?? {})) if (!(k in options)) changes[k] = undefined;
        this.given = options;
        this.instance.update(changes);
      });
    });
    // The types, the features and the words are the chart's setup: a new value draws a new chart.
    effect(() => {
      this.types();
      this.features();
      this.messages();
      this.animate();
      untracked(() => this.instance && create());
    });
    inject(DestroyRef).onDestroy(() => {
      this.instance?.destroy();
      this.instance = null;
    });
  }
}
