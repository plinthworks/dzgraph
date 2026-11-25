/**
 * `<dz-chart>` (angular.md, D.13): a DzGraph chart in an Angular template. Its options are a signal input: a new
 * value updates the chart, never re-creates it. One output per event. Drawn in the browser only (nothing on the
 * server); destroyed with the component. Its series types, features and words are the app's, on the tag or through
 * `provideDzGraph()` (angular.md 9): it imports none itself, so the app ships only those it names.
 */
import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, input, output, PLATFORM_ID, untracked } from '@angular/core';
import type { ChartOptions, PointRef, Problem } from '@dzgraph/core';
import type { SeriesType } from '@dzgraph/core/internal';
import { chart, type Chart, type ChartEvents, type ChartSetup, type Feature } from '@dzgraph/dom';
import { DZGRAPH_CONFIG } from './providers.js';

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
  /**
   * The series types it may draw (ADR 0005): `[line, column]`, or `allTypes`. Here or through `provideDzGraph()`.
   */
  readonly types = input<readonly SeriesType[]>();
  /**
   * The features it may use (time axes, zoom, navigator, Canvas, WebGL2; ADR 0006, 0008). Here or through
   * `provideDzGraph()`.
   */
  readonly features = input<readonly Feature[]>();
  /** Words to use instead of the built-in ones, word by word (words.md). Here or through `provideDzGraph()`. */
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
  readonly drill = output<ChartEvents['drill']>();

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
    const app = inject(DZGRAPH_CONFIG);
    const create = () => {
      this.instance?.destroy();
      // A binding wins over the app's provider (angular.md 9).
      const messages = untracked(this.messages) ?? app.messages;
      const animate = untracked(this.animate);
      const options = untracked(this.options);
      const types = untracked(this.types) ?? app.types ?? [];
      const features = untracked(this.features) ?? app.features ?? [];
      const c = chart(host, options, { types, features, ...(messages ? { messages } : {}), ...(animate ? { animate } : {}) });
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
      c.on('drill', (d) => this.drill.emit(d));
      if (c.problems.length) this.problems.emit(c.problems);
    };
    // In the browser only, once the host is in the page: never on the server, whatever runs the render hooks (angular.md 5).
    if (isPlatformBrowser(inject(PLATFORM_ID))) afterNextRender(create);
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
