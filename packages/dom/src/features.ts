/**
 * The features an app passes to `chart()` (ADR 0006): `chart(el, options, { types, features: [timeAxis, zoom] })`.
 * Each module object is the only path to its code, so a bundler leaves out what the app did not import. The contract
 * is internal until 1.0, as the series types' is (ADR 0005).
 */
import type { AggregationKit, CompareKit, CrosshairKit, Kit, NavigatorKit, Range, SelectionKit, TimeKit } from '@dzgraph/core/internal';
import { SelectionPart, type SelectionHooks } from './selecting.js';
import { DrillPart, type DrillHooks } from './drilling.js';
import { MenuPart, type MenuHooks } from './menu.js';
import * as exportingParts from './exporting.js';
import { aggregationKit, compareKit, crosshairKit, measureKit, navigatorKit, selectionKit, timeKit } from '@dzgraph/core/internal';
import { CrosshairPart, type CrosshairHooks } from './crosshair.js';
import { MeasurePart, type MeasureHooks } from './measuring.js';
import { ModeBar, type ModeBarHooks } from './modes.js';
import type { Painter } from './painter.js';
import type { TooltipDrawer } from './hover.js';
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
  readonly name: 'timeAxis' | 'zoom' | 'navigatorStrip' | 'canvas' | 'webgl' | 'crosshair' | 'compare' | 'measure' | 'selection' | 'aggregation' | 'drilldown' | 'menu' | 'exporting' | 'tooltip';
  /** The features it brings with it. */
  readonly needs?: readonly Feature[];
  readonly time?: TimeKit;
  readonly navigator?: { readonly kit: NavigatorKit; readonly controls: (svg: SVGSVGElement, group: SVGGElement, root: HTMLElement, hooks: NavigatorPartHooks) => NavigatorControlsPart };
  readonly zoom?: (root: HTMLElement, svg: SVGSVGElement, hooks: ZoomHooks) => ZoomPart;
  readonly canvas?: (root: HTMLElement) => Painter & { destroy(): void };
  /** `changed`: the painter can or can no longer draw (its context lost or back): paint again. */
  readonly webgl?: (root: HTMLElement, changed: () => void) => WebglPart;
  readonly compare?: CompareKit;
  readonly aggregation?: AggregationKit;
  /** Drilldown (drilldown.md): its levels and breadcrumb. */
  readonly drill?: (hooks: DrillHooks) => DrillPart;
  /** The chart menu (menu.md). */
  readonly menu?: (root: HTMLElement, hooks: MenuHooks) => MenuPart;
  /** Export and printing (export.md, csv.md, print.md). */
  readonly exporting?: ExportingKit;
  /** Who draws the points' tooltip (dztooltip.md): a bridge's; absent, the chart's own card. */
  readonly tooltip?: (root: HTMLElement) => TooltipDrawer;
  /** Measuring between two points (measure.md), a mode of the mode bar. */
  readonly measure?: (svg: SVGSVGElement, hooks: MeasureHooks) => MeasurePart;
  /** Selecting points (selection.md): the core's shapes, and the gestures. */
  readonly selection?: { readonly kit: SelectionKit; readonly part: (svg: SVGSVGElement, hooks: SelectionHooks) => SelectionPart };
  /** The mode bar (modes.md), brought by the modules that add a mode. */
  readonly modeBar?: (root: HTMLElement, hooks: ModeBarHooks) => ModeBar;
  readonly crosshair?: { readonly kit: CrosshairKit; readonly part: (svg: SVGSVGElement, hooks: CrosshairHooks) => CrosshairPart };
}

/** What the exporting module gives the chart: pictures, data, a download, printing. */
export interface ExportingKit {
  readonly svg: typeof exportingParts.exportSvg;
  readonly png: typeof exportingParts.exportPng;
  readonly csv: typeof exportingParts.exportCsv;
  readonly download: typeof exportingParts.download;
  readonly print: typeof exportingParts.print;
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

/** Lines through the pointer with its values on the axes (crosshair.md), for charts with `crosshair: true`. */
export const crosshair: Feature = { name: 'crosshair', crosshair: { kit: crosshairKit, part: (svg, hooks) => new CrosshairPart(svg, crosshairKit, hooks) } };

/** Series shown against a baseline (compare.md): `compare` on a y axis, or the user's choice in the view. */
export const compare: Feature = { name: 'compare', compare: compareKit };

const modeBar = (root: HTMLElement, hooks: ModeBarHooks) => new ModeBar(root, hooks);

/** Measuring between two points (measure.md): the « Mesure » mode, and M on a focused point. */
export const measure: Feature = { name: 'measure', measure: (svg, hooks) => new MeasurePart(svg, measureKit, hooks), modeBar };

/** Selecting points (selection.md): `selection: true`, the « Sélection » mode, Space on a focused point. */
export const selection: Feature = { name: 'selection', selection: { kit: selectionKit, part: (svg, hooks) => new SelectionPart(svg, selectionKit, hooks) }, modeBar };

/** Points grouped by period or bucket (aggregation.md): `aggregate` on the x axis, or the user's choice in the view. */
export const aggregation: Feature = { name: 'aggregation', aggregation: aggregationKit };

/** A point's detail by click or Enter, the breadcrumb, Backspace (drilldown.md); `drilldown: 'time'` needs `aggregation`. */
export const drilldown: Feature = { name: 'drilldown', needs: [aggregation], drill: (hooks) => new DrillPart(hooks) };

/** The chart menu (menu.md): a series' type, the aggregation, the scale, the comparison, as the app allows. */
export const menu: Feature = { name: 'menu', menu: (root, hooks) => new MenuPart(root, hooks) };

/** Every feature, for apps that do not count bytes; importing it brings them all into the bundle. */
/**
 * Export and printing (export.md, csv.md, print.md): `exportSvg`, `exportPng`, `exportCsv`, `download`, `print`, and
 * the menu's « Download » and « Print » entries.
 */
export const exporting: Feature = { name: 'exporting', exporting: { svg: exportingParts.exportSvg, png: exportingParts.exportPng, csv: exportingParts.exportCsv, download: exportingParts.download, print: exportingParts.print } };

export const allFeatures: readonly Feature[] = [timeAxis, zoom, navigatorStrip, canvas, webgl, crosshair, compare, measure, selection, aggregation, drilldown, menu, exporting];

/** The features given and those they bring, as the chart uses them. */
export interface Resolved {
  readonly kit: Kit;
  readonly zoom: Feature['zoom'] | null;
  readonly navigator: NonNullable<Feature['navigator']>['controls'] | null;
  readonly canvas: Feature['canvas'] | null;
  readonly webgl: Feature['webgl'] | null;
  readonly crosshair: NonNullable<Feature['crosshair']>['part'] | null;
  readonly measure: Feature['measure'] | null;
  readonly modeBar: Feature['modeBar'] | null;
  readonly selection: NonNullable<Feature['selection']>['part'] | null;
  readonly drill: Feature['drill'] | null;
  readonly menu: Feature['menu'] | null;
  readonly exporting: ExportingKit | null;
  readonly tooltip: Feature['tooltip'] | null;
  /** Whether the comparison and the aggregation came (the menu offers only what can be done). */
  readonly compares: boolean;
  readonly aggregates: boolean;
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
  let cross: Feature['crosshair'] | null = null;
  let cmp: CompareKit | null = null;
  let agg: AggregationKit | null = null;
  let drill: Feature['drill'] | null = null;
  let menuPart: Feature['menu'] | null = null;
  let exp: ExportingKit | null = null;
  let tip: Feature['tooltip'] | null = null;
  let measurePart: Feature['measure'] | null = null;
  let bar: Feature['modeBar'] | null = null;
  let sel: Feature['selection'] | null = null;
  for (const f of all) {
    sel ??= f.selection ?? null;
    measurePart ??= f.measure ?? null;
    bar ??= f.modeBar ?? null;
    cmp ??= f.compare ?? null;
    agg ??= f.aggregation ?? null;
    drill ??= f.drill ?? null;
    menuPart ??= f.menu ?? null;
    exp ??= f.exporting ?? null;
    tip ??= f.tooltip ?? null;
    cross ??= f.crosshair ?? null;
    webglPart ??= f.webgl ?? null;
    time ??= f.time ?? null;
    nav ??= f.navigator ?? null;
    zoomPart ??= f.zoom ?? null;
    canvasPart ??= f.canvas ?? null;
  }
  return { kit: { time, navigator: nav?.kit ?? null, crosshair: cross?.kit ?? null, compare: cmp, selection: sel?.kit ?? null, aggregation: agg }, zoom: zoomPart, navigator: nav?.controls ?? null, canvas: canvasPart, webgl: webglPart, crosshair: cross?.part ?? null, measure: measurePart, modeBar: bar, selection: sel?.part ?? null, drill, menu: menuPart, exporting: exp, tooltip: tip, compares: cmp !== null, aggregates: agg !== null };
}
