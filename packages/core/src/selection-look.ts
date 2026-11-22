/**
 * How a selection looks (selection.md 4, 10): while points are selected, the others fade to 35 % and the selected
 * keep their look; a selected column, bar or slice gets a ring in the focus colour too, so the selection is not told
 * by colour alone; a line fades, and its selected points get a marker and the segments between them stay full; a
 * dense scatter fades, and its selected points are drawn again, full, over it.
 */
import type { MarkSet } from './series-type.js';
import type { PathPrimitive, Primitive } from './scene.js';
import type { SeriesModel } from './series-type.js';
import type { Selection } from './selection.js';
import { placesOf } from './selection.js';
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import { PathBuilder, sceneId, symbolOf } from './series/shared.js';

const FADED = 0.35;
const fade = <P extends Primitive>(p: P): P => ({ ...p, paint: { ...p.paint, opacity: (p.paint.opacity ?? 1) * FADED } });

/** A series' sets of marks under a selection; `place` gives where a point is drawn (NaN for a gap). */
export function selectionLook(model: ChartModel, layout: ChartLayout, sets: readonly MarkSet[], s: SeriesModel, sel: Selection): MarkSet[] {
  const place = placesOf(model, layout, s);
  const bits = sel.get(s.id);
  const on = (i: number) => bits?.[i] === 1;
  // Points the series already marks (a line's own markers): a selected one keeps its marker, none is added.
  const marked = new Set<number>();
  for (const set of sets) if (set.role === 'marks') for (const p of set.items) if (p.point && p.kind === 'marker') marked.add(p.point.index);
  const out: MarkSet[] = [];
  for (const set of sets) {
    if (set.role !== 'marks' && set.role !== 'path') {
      out.push(set);
      continue;
    }
    const items: Primitive[] = [];
    for (const p of set.items) {
      if (p.kind === 'points') {
        items.push(fade(p));
        // Drawn again, full, over the faded cloud (selection.md 10): the selected ones only.
        const only: number[] = [];
        if (bits) for (let i = bits.indexOf(1); i !== -1; i = bits.indexOf(1, i + 1)) only.push(i);
        if (only.length) items.push({ ...p, sceneId: sceneId(p.sceneId, 'selected'), only: Int32Array.from(only) });
        continue;
      }
      if (set.role === 'path' || !p.point) {
        items.push(set.role === 'path' ? fade(p) : p);
        continue;
      }
      if (!on(p.point.index)) {
        items.push(fade(p));
        continue;
      }
      items.push(p);
      if (p.kind === 'rect' || p.kind === 'arc') {
        // The ring is not a point: the hit tests and the hover answer with the mark under it.
        const { point: _point, ...shape } = p;
        void _point;
        items.push({ ...shape, sceneId: sceneId(p.sceneId, 'ring'), paint: { stroke: 'focus', strokeWidth: 2 } });
      }
    }
    out.push({ ...set, items });
    // A line's selected points: their segments full, then a marker on each (selection.md 4).
    const line = set.role === 'path' ? set.items.find((p): p is PathPrimitive => p.kind === 'path' && !p.paint.fill && !!p.paint.stroke) : undefined;
    if (line && bits && place) {
      const runs = new PathBuilder();
      const markers: Primitive[] = [];
      let prev: [number, number] | null = null;
      for (let i = 0; i < bits.length; i++) {
        const at = place(i);
        if (Number.isNaN(at[0])) {
          // A gap breaks a run as it breaks the line; a point not selected ends it.
          prev = null;
          continue;
        }
        if (!bits[i]) {
          prev = null;
          continue;
        }
        if (prev) runs.lineTo(at[0], at[1]);
        else runs.moveTo(at[0], at[1]);
        prev = at;
        if (!marked.has(i))
          markers.push({ kind: 'marker', sceneId: sceneId('s', s.id, 'selected', i), paint: { fill: s.color, stroke: 'background', strokeWidth: 2 }, x: at[0], y: at[1], size: 8, symbol: symbolOf(s.rank), point: { seriesId: s.id, index: i } });
      }
      if (!runs.empty) out.push({ layer: set.layer, role: 'path', items: [{ ...line, sceneId: sceneId(line.sceneId, 'selected'), path: runs.build() }] });
      if (markers.length) out.push({ layer: set.layer, role: 'marks', items: markers });
    }
  }
  return out;
}
