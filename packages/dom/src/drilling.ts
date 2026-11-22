/**
 * Drilldown on screen (drilldown.md): a click or Enter on a point with a detail goes down a level — its series given
 * in the options by key, or loaded by the app, or, with `drilldown: 'time'`, the months of a year and the days of a
 * month (the aggregation and the range); a breadcrumb above the chart goes back up, and Backspace (or Alt + ←) goes up
 * one level. Each level keeps the view it was left with, and gets it back. Comes with the `drilldown` module (ADR 0006).
 */
import type { ChartOptions, PointRef, SeriesOptions } from '@dzgraph/core';
import type { AggregateSpec, ChartModel } from '@dzgraph/core/internal';
import { hasDetail, xLabel } from '@dzgraph/core/internal';

/** A load slower than this is a failure (drilldown.md 3). */
const TIMEOUT_MS = 10_000;

/** What a level leaves behind and gets back: the parts of the view the user changed there. */
export interface SavedView {
  readonly hidden: ReadonlySet<string>;
  readonly range: { readonly min: number; readonly max: number } | null;
  readonly selection: ReadonlyMap<string, Uint8Array> | undefined;
  readonly aggregation: AggregateSpec | null | undefined;
}

interface Level {
  readonly key: string;
  readonly name: string;
  /** The detail's series; absent for a level of an automatic time drill. */
  readonly series?: readonly SeriesOptions[];
  /** A time level: its aggregation and range. */
  readonly time?: { readonly aggregation: AggregateSpec; readonly range: { readonly min: number; readonly max: number } };
  /** The view of the level above, as it was left. */
  readonly saved: SavedView;
}

export interface DrillHooks {
  readonly model: () => ChartModel | null;
  readonly locale: () => string;
  readonly words: () => { readonly breadcrumb: string; readonly root: string; readonly loading: string; readonly failed: string; readonly retry: string };
  /** The view now, to keep with the level left. */
  readonly save: () => SavedView;
  /** Shows a level: its saved view, or a time level's aggregation and range; the chart reads its options again. */
  readonly show: (view: SavedView | null, time: Level['time'] | null) => void;
  readonly announce: (text: string) => void;
  /** The path changed (event `drill`, the view's `drill`). */
  readonly changed: (path: readonly string[]) => void;
  /** A level chosen from the breadcrumb: the keyboard goes back to the chart's points (review 5). */
  readonly refocus: () => void;
}

export class DrillPart {
  readonly nav = document.createElement('nav');
  private readonly list = document.createElement('ol');
  private levels: Level[] = [];
  /** A load under way, by its point; a later one wins. */
  private loading = 0;
  private failure: PointRef | null = null;

  constructor(private readonly hooks: DrillHooks) {
    this.nav.className = 'dzgraph-breadcrumb';
    this.nav.hidden = true;
    this.nav.appendChild(this.list);
  }

  /** The options of the level shown: the detail's series, and the title naming where it is (drilldown.md 2). */
  effective(options: ChartOptions): ChartOptions {
    const detail = [...this.levels].reverse().find((l) => l.series);
    if (!detail?.series) return options;
    const base = typeof options.title === 'string' ? options.title : options.title?.text;
    return { ...options, series: detail.series, title: base ? `${base} — ${this.levels.map((l) => l.name).join(' — ')}` : this.levels.map((l) => l.name).join(' — ') };
  }

  path(): string[] {
    return this.levels.map((l) => l.key);
  }

  /** A click or Enter on a point: down to its detail, when it has one; true when it does. */
  down(point: PointRef): boolean {
    const model = this.hooks.model();
    if (!model || !hasDetail(model, point)) return false;
    const s = model.series.find((o) => o.id === point.seriesId)!;
    const name = xLabel(model, s, point.index, this.hooks.locale());
    const key = s.keys?.[point.index] ?? name;
    const drill = (s.options as { readonly drilldown?: { readonly details?: Readonly<Record<string, readonly SeriesOptions[]>>; readonly load?: (p: PointRef) => Promise<readonly SeriesOptions[]> } }).drilldown;
    // A time level: the next period down, over the period clicked (drilldown.md 6).
    const by = model.xAxes.find((a) => a.id === s.xAxis)?.period;
    if (!drill && by && 'period' in by && model.kit.time) {
      const zone = model.xAxes.find((a) => a.id === s.xAxis)?.zone ?? 'UTC';
      const start = s.columns.x[point.index]!;
      const end = model.kit.time.periodAfter(start, by.period, zone) - 1;
      // Keyed by the period's start, not its name: a saved path works in any language (review 10).
      this.push({ key: String(start), name, time: { aggregation: { period: by.period === 'year' ? 'month' : 'day' }, range: { min: start, max: end } }, saved: this.hooks.save() });
      return true;
    }
    const given = drill?.details?.[key];
    if (given) {
      this.push({ key, name, series: given, saved: this.hooks.save() });
      return true;
    }
    if (drill?.load) void this.load(point, key, name, drill.load);
    return true;
  }

  /** Up one level (Backspace, Alt + ←); false at the root. */
  up(): boolean {
    if (!this.levels.length) return false;
    this.upTo(this.levels.length - 1);
    return true;
  }

  /**
   * Goes to a path of keys from the root (setView): up to where it parts, then down by each key it finds — each level
   * read before the next key is looked for. Returns the place of the first key not found, or -1.
   */
  goTo(path: readonly string[]): number {
    let same = 0;
    while (same < path.length && same < this.levels.length && this.levels[same]!.key === path[same]) same++;
    if (same < this.levels.length) this.upTo(same);
    for (let k = same; k < path.length; k++) {
      const model = this.hooks.model();
      const found = model?.series.flatMap((s) => Array.from({ length: s.columns.x.length }, (_, i) => ({ seriesId: s.id, index: i }))).find((p) => this.keyOf(model, p) === path[k]);
      if (!found || !this.down(found)) return k;
    }
    return -1;
  }

  /** A point's key on the drill path: the app's, a time period's start, else its name. */
  private keyOf(model: ChartModel, p: PointRef): string {
    const s = model.series.find((o) => o.id === p.seriesId)!;
    const by = model.xAxes.find((a) => a.id === s.xAxis)?.period;
    if (model.drill === 'time' && by && 'period' in by) return String(s.columns.x[p.index]);
    return s.keys?.[p.index] ?? xLabel(model, s, p.index, this.hooks.locale());
  }

  private upTo(depth: number, refocus = false): void {
    // A load under way is for a level being left: it is dropped (review 4).
    this.loading++;
    this.failure = null;
    const target = this.levels[depth]!;
    this.levels = this.levels.slice(0, depth);
    // The view the level above was left with comes back (drilldown.md 5); a time level above shows its own period.
    const above = this.levels.at(-1);
    this.hooks.show(target.saved, above?.time ?? null);
    this.render();
    this.hooks.changed(this.path());
    if (refocus) this.hooks.refocus();
  }

  private push(level: Level): void {
    this.loading++;
    // The root's name, as the app titled the chart, before the first level renames it.
    if (!this.levels.length) this.root = this.hooks.model()?.title?.text ?? '';
    this.failure = null;
    this.levels.push(level);
    this.hooks.show(null, level.time ?? null);
    this.render();
    this.hooks.changed(this.path());
  }

  private async load(point: PointRef, key: string, name: string, load: (p: PointRef) => Promise<readonly SeriesOptions[]>): Promise<void> {
    const ticket = ++this.loading;
    this.failure = null;
    this.hooks.announce(this.hooks.words().loading);
    let timer = 0;
    try {
      const series = await Promise.race([
        Promise.resolve().then(() => load(point)),
        new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS) as unknown as number)),
      ]);
      if (ticket !== this.loading) return;
      if (!Array.isArray(series)) throw new Error('not a list');
      // `push` moves the ticket on: this load is the one it pushes.
      this.push({ key, name, series, saved: this.hooks.save() });
    } catch {
      // The level stays; a short message and a way to try again (drilldown.md 3). Never the app's error text.
      if (ticket !== this.loading) return;
      this.failure = point;
      this.hooks.announce(this.hooks.words().failed);
      this.render();
    } finally {
      clearTimeout(timer);
    }
  }

  /** The breadcrumb (drilldown.md 4): the root, then each level; links but the last; a failure and its retry. */
  render(): void {
    const w = this.hooks.words();
    const model = this.hooks.model();
    this.nav.setAttribute('aria-label', w.breadcrumb);
    this.nav.hidden = !this.levels.length && !this.failure;
    const items: HTMLLIElement[] = [];
    const names = [this.rootName(model), ...this.levels.map((l) => l.name)];
    names.forEach((name, i) => {
      const li = document.createElement('li');
      if (i < names.length - 1) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = name;
        b.addEventListener('click', () => this.upTo(i, true));
        li.appendChild(b);
      } else {
        li.textContent = name;
        li.setAttribute('aria-current', 'page');
      }
      items.push(li);
    });
    if (this.failure) {
      const li = document.createElement('li');
      li.className = 'dzgraph-drill-failed';
      li.append(w.failed, ' ');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'dzgraph-retry';
      retry.textContent = w.retry;
      const at = this.failure;
      retry.addEventListener('click', () => this.down(at));
      li.appendChild(retry);
      items.push(li);
    }
    this.list.replaceChildren(...items);
  }

  private root = '';

  /** The root's name: the chart's title as the app gave it, kept from before the first level. */
  private rootName(model: ChartModel | null): string {
    if (!this.levels.length) this.root = model?.title?.text ?? '';
    return this.root || this.hooks.words().root;
  }

  destroy(): void {
    this.loading++;
    this.nav.remove();
  }
}
