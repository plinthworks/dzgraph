/**
 * The view as plain JSON and back (view-state.md, ADR 0009): what `getView()` gives and `setView()` takes. Series by
 * id, points by their key where the app gave one, else by index; the visible range of the first x axis. No app value
 * ever goes into a `Problem`: what a view names that does not exist is reported by its path alone.
 */
import type { ChartModel } from './model.js';
import type { Problem } from './problem.js';
import { pointKey, type View } from './view.js';
import type { CompareMode } from './compare.js';
import type { Selection } from './selection.js';
import type { AggregateSpec } from './aggregation.js';
import type { Period } from './time.js';

/** A chart's view as the app sees it: JSON, saved and given back as it is. */
export interface ChartView {
  /** Hidden series, by id. */
  readonly hidden?: readonly string[];
  /** Hidden points (a pie's slices), by series id: each by its key, or by its index when it has none. */
  readonly hiddenPoints?: Readonly<Record<string, readonly (string | number)[]>>;
  /** The first x axis's visible range; null: the whole data. */
  readonly range?: { readonly min: number; readonly max: number } | null;
  /** The comparison (compare.md), as shown: how, and its fixed baseline's x (null: the first point in view); null: none. */
  readonly compare?: { readonly mode: CompareMode; readonly to: number | null } | null;
  /** The selected points, by series id: each by its key, or by its index when the series has no keys. */
  readonly selection?: Readonly<Record<string, readonly (string | number)[]>>;
  /** The user's aggregation (aggregation.md): a period, or a step; null: none. */
  readonly aggregation?: AggregateSpec | null;
  /** The drill level (drilldown.md 7): the keys of the points drilled into, from the root. */
  readonly drill?: readonly string[];
  /** The user's types by series id, and value axis scale, from the menu (menu.md 2, 4). */
  readonly types?: Readonly<Record<string, string>>;
  readonly scale?: 'linear' | 'log';
}

/** The view's parts the DOM keeps (view.ts `View` is built from them). */
export interface ViewParts {
  readonly hidden: ReadonlySet<string>;
  readonly range: { readonly min: number; readonly max: number } | null;
  /** The user's comparison; absent: the options'. */
  readonly compare?: View['compare'];
  readonly selection?: Selection;
  readonly aggregation?: View['aggregation'];
  readonly drill?: readonly string[];
  readonly types?: Readonly<Record<string, string>>;
  readonly scale?: 'linear' | 'log';
}

/** Point keys in the hidden set look like `#index/seriesId` (view.ts `pointKey`). */
const POINT = /^#(\d+)\/(.*)$/s;

function selectionJson(model: ChartModel, sel: Selection | undefined): Record<string, (string | number)[]> {
  const out: Record<string, (string | number)[]> = {};
  for (const s of model.series) {
    const bits = sel?.get(s.id);
    if (!bits) continue;
    const refs: (string | number)[] = [];
    for (let i = 0; i < bits.length; i++) if (bits[i]) refs.push(s.keys?.[i] ?? i);
    if (refs.length) out[s.id] = refs;
  }
  return out;
}

export function viewToJson(model: ChartModel, parts: ViewParts): ChartView {
  const ids = new Set(model.series.map((s) => s.id));
  const hidden: string[] = [];
  const points: Record<string, (string | number)[]> = {};
  for (const h of parts.hidden) {
    if (ids.has(h)) {
      hidden.push(h);
      continue;
    }
    const m = POINT.exec(h);
    const s = m ? model.series.find((o) => o.id === m[2]) : undefined;
    if (!m || !s) continue;
    const index = Number(m[1]);
    (points[s.id] ??= []).push(s.keys?.[index] ?? index);
  }
  return {
    hidden,
    ...(Object.keys(points).length ? { hiddenPoints: points } : {}),
    // Always written, null for the whole data: a saved view given back shows what it showed (absent would keep the
    // current range).
    range: parts.range ? { min: parts.range.min, max: parts.range.max } : null,
    // As shown (the user's, else the first compared axis's option): a saved view gives back what it showed.
    // The user's comparison only: the options' stay the options' (review 1: written as shown, a view given back
    // compared every axis like the first).
    ...(parts.compare !== undefined ? { compare: parts.compare && { mode: parts.compare.mode, to: parts.compare.to } } : {}),
    // Always written ({} for none), as the range: a saved view gives back what it selected.
    selection: selectionJson(model, parts.selection),
    ...(parts.aggregation !== undefined ? { aggregation: parts.aggregation } : {}),
    ...(parts.drill ? { drill: [...parts.drill] } : {}),
    ...(parts.types && Object.keys(parts.types).length ? { types: { ...parts.types } } : {}),
    ...(parts.scale ? { scale: parts.scale } : {}),
  };
}

/**
 * A view given by the app, read. `hidden` and `range` are undefined when the view does not say (left as they are);
 * `range` null is the whole data. Never throws.
 */
export function viewFromJson(model: ChartModel, json: unknown): { hidden: Set<string> | undefined; range: { min: number; max: number } | null | undefined; compare: View['compare']; selection: Map<string, Uint8Array> | undefined; aggregation: View['aggregation']; drill: string[] | undefined; types: Record<string, string> | undefined; scale: 'linear' | 'log' | undefined; problems: Problem[] } {
  const problems: Problem[] = [];
  const bad = (path: string) => problems.push({ code: 'invalid-view', path });
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    bad('view');
    return { hidden: undefined, range: undefined, compare: undefined, selection: undefined, aggregation: undefined, drill: undefined, types: undefined, scale: undefined, problems };
  }
  const v = json as Record<string, unknown>;
  let hidden: Set<string> | undefined;
  if (v['hidden'] !== undefined || v['hiddenPoints'] !== undefined) {
    hidden = new Set();
    const list = v['hidden'];
    if (list !== undefined && !Array.isArray(list)) bad('view.hidden');
    else
      (list ?? []).forEach((id: unknown, i: number) => {
        if (typeof id === 'string' && model.series.some((s) => s.id === id)) hidden!.add(id);
        else bad(`view.hidden[${i}]`);
      });
    const points = v['hiddenPoints'];
    if (points !== undefined && (typeof points !== 'object' || points === null || Array.isArray(points))) bad('view.hiddenPoints');
    else
      for (const [id, refs] of Object.entries((points ?? {}) as Record<string, unknown>)) {
        const s = model.series.find((o) => o.id === id);
        if (!s || !Array.isArray(refs)) {
          bad(`view.hiddenPoints.${id}`);
          continue;
        }
        refs.forEach((ref: unknown, i: number) => {
          const index = typeof ref === 'string' ? (s.keys?.indexOf(ref) ?? -1) : typeof ref === 'number' && Number.isInteger(ref) && ref >= 0 && ref < s.columns.y.length ? ref : -1;
          if (index >= 0) hidden!.add(pointKey(id, index));
          else bad(`view.hiddenPoints.${id}[${i}]`);
        });
      }
  }
  let range: { min: number; max: number } | null | undefined;
  const r = v['range'];
  if (r === null) range = null;
  else if (r !== undefined) {
    const o = typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>) : null;
    const min = o?.['min'];
    const max = o?.['max'];
    if (typeof min === 'number' && typeof max === 'number' && Number.isFinite(min) && Number.isFinite(max) && min < max) range = { min, max };
    else bad('view.range');
  }
  let compare: View['compare'];
  const c = v['compare'];
  if (c === null) compare = null;
  else if (c !== undefined) {
    const o = typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : null;
    const mode = o?.['mode'];
    const to = o?.['to'] ?? null;
    if ((mode === 'value' || mode === 'percent' || mode === 'index') && (to === null || (typeof to === 'number' && Number.isFinite(to)))) compare = { mode, to };
    else bad('view.compare');
  }
  let selection: Map<string, Uint8Array> | undefined;
  const sv = v['selection'];
  // A selection needs its module to be drawn (ADR 0006): without it, reported and left out.
  if (sv !== undefined && !model.kit.selection && !(typeof sv === 'object' && sv !== null && Object.keys(sv).length === 0)) problems.push({ code: 'missing-module', path: 'view.selection', detail: 'selection' });
  else if (sv !== undefined) {
    selection = new Map();
    if (typeof sv !== 'object' || sv === null || Array.isArray(sv)) bad('view.selection');
    else
      for (const [id, refs] of Object.entries(sv as Record<string, unknown>)) {
        const s = model.series.find((o) => o.id === id);
        if (!s || !Array.isArray(refs)) {
          bad(`view.selection.${id}`);
          continue;
        }
        const bits = new Uint8Array(s.columns.y.length);
        refs.forEach((ref: unknown, i: number) => {
          const index = typeof ref === 'string' ? (s.keys?.indexOf(ref) ?? -1) : typeof ref === 'number' && Number.isInteger(ref) && ref >= 0 && ref < bits.length ? ref : -1;
          if (index >= 0) bits[index] = 1;
          else bad(`view.selection.${id}[${i}]`);
        });
        if (bits.some((b) => b)) selection.set(id, bits);
      }
  }
  let aggregation: View['aggregation'];
  const ag = v['aggregation'];
  if (ag === null) aggregation = null;
  else if (ag !== undefined) {
    const o = typeof ag === 'object' && !Array.isArray(ag) ? (ag as Record<string, unknown>) : null;
    const period = o?.['period'];
    const step = o?.['step'];
    if (o && Object.keys(o).length === 1 && typeof period === 'string' && ['hour', 'day', 'week', 'month', 'quarter', 'year'].includes(period)) aggregation = { period: period as Period };
    else if (o && Object.keys(o).length === 1 && typeof step === 'number' && step > 0 && Number.isFinite(step)) aggregation = { step };
    else bad('view.aggregation');
    // A period on a time axis, a step on a numeric one (review 8): another kind would aggregate nothing.
    const x = model.xAxes[0];
    if (aggregation && ('period' in aggregation ? x?.scale !== 'time' : x?.scale === 'time' || x?.scale === 'category')) {
      bad('view.aggregation');
      aggregation = undefined;
    }
    if (aggregation && !model.kit.aggregation) {
      problems.push({ code: 'missing-module', path: 'view.aggregation', detail: 'aggregation' });
      aggregation = undefined;
    }
  }
  let drill: string[] | undefined;
  const dv = v['drill'];
  if (dv !== undefined) {
    if (Array.isArray(dv) && dv.every((k) => typeof k === 'string')) drill = [...dv];
    else bad('view.drill');
  }
  let types: Record<string, string> | undefined;
  const tv = v['types'];
  if (tv !== undefined) {
    types = {};
    if (typeof tv !== 'object' || tv === null || Array.isArray(tv)) bad('view.types');
    else
      for (const [id, t] of Object.entries(tv as Record<string, unknown>)) {
        if (typeof t === 'string' && model.series.some((s) => s.id === id)) types[id] = t;
        else bad(`view.types.${id}`);
      }
  }
  let scale: 'linear' | 'log' | undefined;
  const sc = v['scale'];
  if (sc === 'linear' || sc === 'log') scale = sc;
  else if (sc !== undefined) bad('view.scale');
  for (const k of Object.keys(v)) if (!['hidden', 'hiddenPoints', 'range', 'compare', 'selection', 'aggregation', 'drill', 'types', 'scale'].includes(k)) bad(`view.${k}`);
  return { hidden, range, compare, selection, aggregation, drill, types, scale, problems };
}
