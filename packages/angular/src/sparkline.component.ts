/**
 * `<dz-sparkline>` (sparkline.md, angular.md 8): a sparkline in an Angular template. Its values and options are signal
 * inputs: a new value draws it again, never re-creates it. Drawn in the browser only (nothing on the server).
 */
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, input, untracked } from '@angular/core';
import { sparkline, type SparklineHandle, type SparklineSetup } from '@dzgraph/dom/sparkline';

@Component({
  selector: 'dz-sparkline',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DzSparkline {
  /** The numbers, in order; `null` is a gap. */
  readonly values = input.required<ArrayLike<number | null | undefined>>();
  /** Type, range, markers, label, language, words (SparklineSetup). */
  readonly options = input<SparklineSetup>({});

  private instance: SparklineHandle | null = null;

  /** The sparkline, for its `problems`; null before it is drawn and on the server. */
  get sparkline(): SparklineHandle | null {
    return this.instance;
  }

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      this.instance = sparkline(host, untracked(this.values), untracked(this.options));
    });
    effect(() => {
      const values = this.values();
      const options = this.options();
      untracked(() => this.instance?.update(values, options));
    });
    inject(DestroyRef).onDestroy(() => {
      this.instance?.destroy();
      this.instance = null;
    });
  }
}
