/**
 * The features an app passes to `chart()` (ADR 0006): `chart(el, options, { types, features: [timeAxis, zoom] })`.
 * Each module object is the only path to its code, so a bundler leaves out what the app did not import. The contract
 * is internal until 1.0, as the series types' is (ADR 0005).
 */
import type { Kit, NavigatorKit, Range, TimeKit } from '@dzgraph/core/internal';
import { navigatorKit, timeKit } from '@dzgraph/core/internal';
import type { Painter } from './painter.js';
import { CanvasPainter } from './canvas-painter.js';
import { WebglPainter } from './webgl-painter.js';
import { ZoomControls, type ZoomHooks } from './gestures.js';
import { NavigatorPart, type NavigatorPartHooks } from './navigator.js';

/** What a zoom module gives the chart: gestures, keys and the reset button. */
export interface ZoomPart {
  busy(): boolean;
  /** A key on a focused point; true when it was a zoom key and was used. */
  key(e: KeyboardEvent, x: number | null): boolean;
  /** After each layout: the reset button at the plot's top end, shown when zoomed. */
  place(plot: { readonly x: number; readonly y: number; readonly width: number }, width: number, dir: 'ltr' | 'rtl', range: Range | null, label: string): void;
  destroy(): void;
}

/** What the navigator module gives the chart: the strip's controls and the range buttons. */
export interface NavigatorControlsPart {
  busy(): boolean;
  /** After each layout and each change of range. */
  update(width: number, dir: 'ltr' | 'rtl'): void;
  destroy(): void;
}

export interface Feature {
  readonly name: 'timeAxis' | 'zoom' | 'navigatorStrip' | 'canvas' | 'webgl';
  /** The features it brings with it. */
  readonly needs?: readonly Feature[];
  readonly time?: TimeKit;
  readonly navigator?: { readonly kit: NavigatorKit; readonly controls: (svg: SVGSVGElement, group: SVGGElement, root: HTMLElement, hooks: NavigatorPartHooks) => NavigatorControlsPart };
  readonly zoom?: (root: HTMLElement, svg: SVGSVGElement, hooks: ZoomHooks) => ZoomPart;
  readonly canvas?: (root: HTMLElement) => Painter & { destroy(): void };
  /** `changed`: the painter can or can no longer draw (its context lost or back): paint again. */
  readonly webgl?: (root: HTMLElement, changed: () => void) => WebglPart;
}

/** What the WebGL2 module gives the chart: a painter that says whether it can draw now. */
export interface WebglPart extends Painter {
  ready(): boolean;
  destroy(): void;
}

/** Dates on an axis (`scale: 'time'`): reading ISO strings, ticks on the zone's calendar, dates in tooltips. */
export const timeAxis: Feature = { name: 'timeAxis', time: timeKit };

/** Zoom and pan by the user (zoom-pan.md): drag, Shift + drag, Ctrl/⌘ + wheel, pinch, keys, the reset button. */
export const zoom: Feature = { name: 'zoom', zoom: (root, svg, hooks) => new ZoomControls(root, svg, hooks) };

/**
 * The navigator strip and the range buttons (navigator.md, range-buttons.md); brings `zoom`. Not named `navigator`,
 * which would hide the browser's global of that name in the app's module.
 */
export const navigatorStrip: Feature = {
  name: 'navigatorStrip',
  needs: [zoom],
  navigator: { kit: navigatorKit, controls: (svg, group, root, hooks) => new NavigatorPart(svg, group, root, hooks) },
};

/** A Canvas plane for series of many marks (ADR 0002); without it every series is drawn in SVG. */
export const canvas: Feature = { name: 'canvas', canvas: (root) => new CanvasPainter(root) };

/**
 * WebGL2 for dense scatters (ADR 0008, big-data.md 6–10); brings `canvas`, which draws them when WebGL2 cannot. The
 * context is opened only when a chart first draws such a scatter.
 */
export const webgl: Feature = { name: 'webgl', needs: [canvas], webgl: (root, changed) => new WebglPainter(root, changed) };

/** Every feature, for apps that do not count bytes; importing it brings them all into the bundle. */
export const allFeatures: readonly Feature[] = [timeAxis, zoom, navigatorStrip, canvas, webgl];

/** The features given and those they bring, as the chart uses them. */
export interface Resolved {
  readonly kit: Kit;
  readonly zoom: Feature['zoom'] | null;
  readonly navigator: NonNullable<Feature['navigator']>['controls'] | null;
  readonly canvas: Feature['canvas'] | null;
  readonly webgl: Feature['webgl'] | null;
}

export function resolveFeatures(given: readonly Feature[] | undefined): Resolved {
  const all = new Set<Feature>();
  const add = (f: unknown) => {
    // Plain JavaScript may pass anything: what is not a feature is left out.
    if (typeof f !== 'object' || f === null || all.has(f as Feature)) return;
    all.add(f as Feature);
    for (const n of (f as Feature).needs ?? []) add(n);
  };
  if (Array.isArray(given)) given.forEach(add);
  let time: TimeKit | null = null;
  let nav: Feature['navigator'] | null = null;
  let zoomPart: Feature['zoom'] | null = null;
  let canvasPart: Feature['canvas'] | null = null;
  let webglPart: Feature['webgl'] | null = null;
  for (const f of all) {
    webglPart ??= f.webgl ?? null;
    time ??= f.time ?? null;
    nav ??= f.navigator ?? null;
    zoomPart ??= f.zoom ?? null;
    canvasPart ??= f.canvas ?? null;
  }
  return { kit: { time, navigator: nav?.kit ?? null }, zoom: zoomPart, navigator: nav?.controls ?? null, canvas: canvasPart, webgl: webglPart };
}
