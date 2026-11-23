/** Lines (line-area.md): points joined in x order, gaps breaking them, markers when there is room, M4 when dense. */
import type { SeriesBase } from '../options.js';
import type { MarkSet, MarkContext, SeriesType } from '../series-type.js';
import type { MarkerPrimitive, Primitive } from '../scene.js';
import { decimate } from '../decimate.js';
import { PathBuilder, isGap, placer, rangeOf, sceneId, symbolOf, visibleX } from './shared.js';

export interface LineSeriesOptions extends SeriesBase<'line'> {
  /**
   * Markers on every point (`true`) or none (`false`); default: when points are far enough apart to read them.
   * @default {markerRoom}
   */
  readonly marker?: boolean | undefined;
}

declare module '../options.js' {
  interface SeriesOptionsByType {
    line: LineSeriesOptions;
  }
}

/** Markers show when there are fewer visible points than the plot's width ÷ 12 px (line-area.md 3). */
const MARKER_ROOM = 12;
/** On a dense line, one marker about every 80 px (owner 2026-11-21): the series' symbol without the clutter. */
const SPARSE_EVERY = 80;
const LINE_WIDTH = 2;
/** Markers 8 px, ringed by 2 px of the background so they stand out on their own line (and a crossing one). */
const MARKER_SIZE = 8;
const MARKER_RING = 2;
/** A lone area is seen through (line-area.md 6); stacked layers never overlap, so they are filled fuller (stacking.md 13). */
const AREA_FILL = 0.25;
const STACKED_FILL = 0.5;

/** The line and its markers; `fillTo`, when given, also returns the area under it (area.ts). */
export function lineMarks<O extends SeriesBase<string, unknown> & { readonly marker?: boolean | undefined }>(ctx: MarkContext<O, 'cartesian'>, typeName: string, fillTo: number | null): MarkSet[] {
  const s = ctx.series;
  const { x, y } = s.columns;
  const at = placer(ctx);
  const [x0, x1] = visibleX(ctx);
  const width = ctx.frame.orientation === 'vertical' ? ctx.plot.width : ctx.plot.height;
  // A stacked area is drawn at its segments' ends and filled down to the layer below (stacking.md 5, 13); never
  // decimated, so no layer is drawn from other points than the one beneath it (stacking.md 7).
  const pile = fillTo !== null ? ctx.stacked : null;
  const value = pile ? (i: number) => pile.top[i]! : (i: number) => y[i]!;
  const indices = s.sorted && !pile ? decimate(x, y, x0, x1, width) : Int32Array.from(x, (_, i) => i);

  const stroke = new PathBuilder();
  const fill = new PathBuilder();
  let runStart = -1;
  let last = -1;
  /** A stacked run's indices, to come back along the layer below. */
  const run: number[] = [];
  const closeRun = () => {
    if (fillTo === null || runStart === -1 || last === -1) return;
    if (pile) {
      for (let k = run.length - 1; k >= 0; k--) {
        const [bx, by] = at(x[run[k]!]!, pile.base[run[k]!]!);
        fill.lineTo(bx, by);
      }
    } else {
      const [ax] = at(x[runStart]!, fillTo);
      const [bx, base] = at(x[last]!, fillTo);
      fill.lineTo(bx, base);
      fill.lineTo(ax, base);
    }
    fill.close();
  };
  for (const i of indices) {
    if (isGap(s, i)) {
      closeRun();
      runStart = last = -1;
      run.length = 0;
      continue;
    }
    const [px, py] = at(x[i]!, value(i));
    if (pile) run.push(i);
    if (runStart === -1) {
      stroke.moveTo(px, py);
      if (fillTo !== null) fill.moveTo(px, py);
      runStart = i;
    } else {
      stroke.lineTo(px, py);
      if (fillTo !== null) fill.lineTo(px, py);
    }
    last = i;
  }
  closeRun();

  // Markers: on every visible point when there is room or when asked; always on a point alone between gaps.
  const forced = s.options.marker;
  let visible = 0;
  for (const i of indices) if (!isGap(s, i) && x[i]! >= x0 && x[i]! <= x1) visible++;
  const all = forced === true || (forced !== false && visible < width / MARKER_ROOM);
  const markers: MarkerPrimitive[] = [];
  const symbol = symbolOf(s.rank);
  // Sparse markers on a dense line, from a start that differs by series so two series' markers do not overlap.
  const sparse = !all && forced !== false;
  const vertical = ctx.frame.orientation === 'vertical';
  const along = (px: number, py: number) => (vertical ? px : py);
  const from = vertical ? ctx.plot.x : ctx.plot.y;
  let next = SPARSE_EVERY / 2 + ((s.rank * 29) % SPARSE_EVERY);
  for (const i of indices) {
    if (isGap(s, i) || x[i]! < x0 || x[i]! > x1) continue;
    const alone = (i === 0 || isGap(s, i - 1)) && (i === x.length - 1 || isGap(s, i + 1));
    const [px, py] = at(x[i]!, value(i));
    const distance = Math.abs(along(px, py) - from);
    const due = sparse && distance >= next;
    if (due) next = distance + SPARSE_EVERY;
    if (!all && !(alone && forced !== false) && !due) continue;
    markers.push({ kind: 'marker', sceneId: sceneId('s', s.id, 'm', i), paint: { fill: s.color, stroke: 'background', strokeWidth: MARKER_RING }, x: px, y: py, size: MARKER_SIZE, symbol, point: { seriesId: s.id, index: i } });
  }

  const out: MarkSet[] = [];
  const paths: Primitive[] = [];
  if (fillTo !== null && !fill.empty) paths.push({ kind: 'path', sceneId: sceneId('s', s.id, `${typeName}-fill`), paint: { fill: s.color, opacity: pile ? STACKED_FILL : AREA_FILL }, path: fill.build() });
  if (!stroke.empty) paths.push({ kind: 'path', sceneId: sceneId('s', s.id, typeName), paint: { stroke: s.color, strokeWidth: LINE_WIDTH }, path: stroke.build() });
  if (paths.length) out.push({ layer: 'series', role: 'path', items: paths });
  if (markers.length) out.push({ layer: 'series', role: 'marks', items: markers });
  return out;
}

export const line: SeriesType<LineSeriesOptions, 'cartesian'> = {
  name: 'line',
  system: 'cartesian',
  sign: 'line',
  sortedX: true,
  optionNames: { marker: true },
  check: (o, path) => (o['marker'] === undefined || typeof o['marker'] === 'boolean' ? [] : [{ code: 'invalid-option', path: `${path}.marker` }]),
  bounds: (s) => ({ x: rangeOf(s.columns.x), y: rangeOf(s.columns.y) }),
  marks: (ctx) => lineMarks(ctx, 'line', null),
};
