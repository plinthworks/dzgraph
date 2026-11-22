/**
 * `@dzgraph/dom/sparkline` (sparkline.md): a small drawing of a list of numbers in a page, its own entry — an app that
 * draws only sparklines ships no chart. SVG stretched over its box (no measuring, lines keeping their width), named
 * by its summary for screen readers, coloured by the theme. Neither tooltip nor keyboard: a sparkline is read.
 */
import type { Problem } from '@dzgraph/core';
import { sparklineOf, SPARK_BOX, type SparklineOptions } from '@dzgraph/core/sparkline';
import { sparklineEn, sparklineFr, type SparklineWords } from './locales/sparkline.js';

export type { SparklineOptions } from '@dzgraph/core/sparkline';
export type { SparklineWords } from './locales/sparkline.js';

export interface SparklineSetup extends SparklineOptions {
  /** The app's name for it, before the summary (sparkline.md 6). */
  readonly label?: string | undefined;
  /** The numbers' language; default: the element's `lang`, else the browser's. */
  readonly locale?: string | undefined;
  /** Words of the app's own, replacing the built-in English or French. */
  readonly messages?: SparklineWords | undefined;
}

export interface SparklineHandle {
  /** Draws other values, with other options when given (replacing the previous ones). */
  update(values: ArrayLike<number | null | undefined>, options?: SparklineSetup | null): void;
  /** What was wrong with the last values (`invalid-data`). */
  readonly problems: readonly Problem[];
  destroy(): void;
}

const NS = 'http://www.w3.org/2000/svg';

function shape(tag: string, cls: string, attrs: Readonly<Record<string, string | number>>): SVGElement {
  const e = document.createElementNS(NS, tag);
  e.setAttribute('class', cls);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** A language `Intl` takes: the first given that it accepts (an empty or malformed tag would throw, review 1). */
function language(...tags: readonly (string | null | undefined)[]): string | undefined {
  for (const t of tags) {
    if (!t) continue;
    try {
      return Intl.NumberFormat.supportedLocalesOf(t).length ? t : undefined;
    } catch {
      // Malformed: the next one.
    }
  }
  return undefined;
}

export function sparkline(element: HTMLElement, values: ArrayLike<number | null | undefined>, options?: SparklineSetup | null): SparklineHandle {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'dzgraph-sparkline');
  svg.setAttribute('role', 'img');
  svg.setAttribute('viewBox', `0 0 ${SPARK_BOX} ${SPARK_BOX}`);
  // Stretched over its box: the box's CSS decides its size (sparkline.md 7).
  svg.setAttribute('preserveAspectRatio', 'none');
  // Time runs left to right in either direction (sparkline.md 8).
  svg.setAttribute('direction', 'ltr');
  element.appendChild(svg);
  let problems: readonly Problem[] = [];
  // Plain JavaScript may pass null (review 2).
  const setupOf = (o: SparklineSetup | null | undefined): SparklineSetup => (o && typeof o === 'object' ? o : {});
  let setup = setupOf(options);

  const draw = (list: ArrayLike<number | null | undefined>) => {
    const s = sparklineOf(list, setup);
    problems = s.problems;
    const lang = language(setup.locale, element.closest('[lang]')?.getAttribute('lang'), navigator.language);
    const words = setup.messages ?? (lang?.toLowerCase().startsWith('fr') ? sparklineFr : sparklineEn);
    const f = new Intl.NumberFormat(lang);
    const sum = s.summary;
    const said = !sum ? words.noData : sum.count === 1 ? words.one(f.format(sum.last)) : words.summary(f.format(sum.count), f.format(sum.min), f.format(sum.max), f.format(sum.last));
    svg.setAttribute('aria-label', setup.label ? words.labelled(setup.label, said) : said);
    const parts: SVGElement[] = [];
    if (s.area) parts.push(shape('path', 'dzgraph-sparkline-area', { d: s.area }));
    if (s.line) parts.push(shape('path', 'dzgraph-sparkline-line', { d: s.line, 'vector-effect': 'non-scaling-stroke' }));
    for (const c of s.columns) parts.push(shape('rect', `dzgraph-sparkline-column${c.negative ? ' dzgraph-sparkline-negative' : ''}${c.marked ? ' dzgraph-sparkline-marked' : ''}`, { x: c.x, y: c.y, width: c.width, height: c.height }));
    // Dots that stay round however the box stretches: a zero-length stroke with round caps, its width not scaled.
    const dot = (cls: string, p: { readonly x: number; readonly y: number }) => shape('path', cls, { d: `M${p.x} ${p.y}h0`, 'vector-effect': 'non-scaling-stroke' });
    for (const d of s.dots) parts.push(dot('dzgraph-sparkline-dot', d));
    for (const m of s.markers) parts.push(dot('dzgraph-sparkline-marker', m));
    svg.replaceChildren(...parts);
  };
  draw(values);

  return {
    update(list, next) {
      if (next !== undefined) setup = setupOf(next);
      draw(list);
    },
    get problems() {
      return problems;
    },
    destroy() {
      svg.remove();
    },
  };
}
