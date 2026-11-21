/**
 * A scene between two others (animation.md 2): what stays (same scene id, same kind) moves from one place to the
 * other; paths of the same commands have their points interpolated, others take the new shape; text takes the new
 * state; a group that comes fades in, one that goes fades out. Pure: the DOM's animator asks for frames.
 */
import type { Group, Layer, Primitive, Scene } from './scene.js';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function between(a: Primitive, b: Primitive, t: number): Primitive {
  if (a.kind !== b.kind) return b;
  switch (b.kind) {
    case 'rect': {
      const r = a as typeof b;
      return { ...b, x: lerp(r.x, b.x, t), y: lerp(r.y, b.y, t), width: lerp(r.width, b.width, t), height: lerp(r.height, b.height, t) };
    }
    case 'line': {
      const l = a as typeof b;
      return { ...b, x1: lerp(l.x1, b.x1, t), y1: lerp(l.y1, b.y1, t), x2: lerp(l.x2, b.x2, t), y2: lerp(l.y2, b.y2, t) };
    }
    case 'marker': {
      const m = a as typeof b;
      return { ...b, x: lerp(m.x, b.x, t), y: lerp(m.y, b.y, t), size: lerp(m.size, b.size, t) };
    }
    case 'arc': {
      const c = a as typeof b;
      return { ...b, cx: lerp(c.cx, b.cx, t), cy: lerp(c.cy, b.cy, t), innerRadius: lerp(c.innerRadius, b.innerRadius, t), outerRadius: lerp(c.outerRadius, b.outerRadius, t), startAngle: lerp(c.startAngle, b.startAngle, t), endAngle: lerp(c.endAngle, b.endAngle, t) };
    }
    case 'path': {
      const p = a as typeof b;
      const same = p.path.commands.length === b.path.commands.length && p.path.commands.every((c, i) => c === b.path.commands[i]);
      if (!same) return b;
      const coords = new Float64Array(b.path.coords.length);
      for (let i = 0; i < coords.length; i++) coords[i] = lerp(p.path.coords[i]!, b.path.coords[i]!, t);
      return { ...b, path: { commands: b.path.commands, coords } };
    }
    case 'text':
      return b;
  }
}

function faded(g: Group, opacity: number): Group {
  return { ...g, opacity: (g.opacity ?? 1) * opacity };
}

export function interpolateScene(a: Scene, b: Scene, t: number): Scene {
  if (t >= 1) return b;
  if (t <= 0) return a;
  const layers: Layer[] = b.layers.map((lb) => {
    const la = a.layers.find((l) => l.id === lb.id);
    const before = new Map((la?.groups ?? []).map((g) => [g.sceneId, g]));
    const groups: Group[] = lb.groups.map((gb) => {
      const ga = before.get(gb.sceneId);
      if (!ga) return faded(gb, t);
      const old = new Map(ga.items.map((p) => [p.sceneId, p]));
      const items: Primitive[] = gb.items.map((p) => {
        const q = old.get(p.sceneId);
        return q ? between(q, p, t) : { ...p, paint: { ...p.paint, opacity: (p.paint.opacity ?? 1) * t } };
      });
      const kept = new Set(gb.items.map((p) => p.sceneId));
      for (const q of ga.items) if (!kept.has(q.sceneId)) items.push({ ...q, paint: { ...q.paint, opacity: (q.paint.opacity ?? 1) * (1 - t) } });
      const opacity = lerp(ga.opacity ?? 1, gb.opacity ?? 1, t);
      // A clip that grows (a line being revealed) is interpolated too.
      const clip = ga.clip && gb.clip ? { x: lerp(ga.clip.x, gb.clip.x, t), y: lerp(ga.clip.y, gb.clip.y, t), width: lerp(ga.clip.width, gb.clip.width, t), height: lerp(ga.clip.height, gb.clip.height, t) } : gb.clip;
      return { ...gb, items, ...(opacity !== 1 ? { opacity } : {}), ...(clip ? { clip } : {}) };
    });
    const kept = new Set(lb.groups.map((g) => g.sceneId));
    for (const ga of la?.groups ?? []) if (!kept.has(ga.sceneId)) groups.push(faded(ga, 1 - t));
    return { id: lb.id, groups };
  });
  return { ...b, layers };
}

/**
 * Where a chart appears from (animation.md 1): lines and areas clipped to nothing at the start of the x axis (`fromXMax`
 * when it runs from x-max), so
 * interpolating to the drawn scene reveals them; columns and bars collapsed onto their baseline (the edge opposite
 * their rounded end); markers transparent. Axes, labels and the legend are already there.
 */
export function appearFrom(scene: Scene, opts: { readonly fromXMax?: boolean } = {}): Scene {
  // The x axis starts at x-max when it is mirrored (direction.md 3): the reveal starts there.
  const startsAtMax = opts.fromXMax === true;
  const layers = scene.layers.map((l) => {
    if (l.id !== 'series') return l;
    const groups = l.groups.map((g) => {
      const clip = g.clip && g.items.some((p) => p.kind === 'path') ? { ...g.clip, x: startsAtMax ? g.clip.x + g.clip.width : g.clip.x, width: 0 } : g.clip;
      const items = g.items.map((p): Primitive => {
        if (p.kind === 'rect') {
          // The base: opposite the rounded free end (a column the plot cut grows from where it is drawn from).
          switch (p.roundEnd) {
            case 'y-max':
              return { ...p, height: 0 };
            case 'x-max':
              return { ...p, width: 0 };
            case 'x-min':
              return { ...p, x: p.x + p.width, width: 0 };
            default:
              return { ...p, y: p.y + p.height, height: 0 };
          }
        }
        if (p.kind === 'marker') return { ...p, paint: { ...p.paint, opacity: 0 } };
        return p;
      });
      return { ...g, items, ...(clip ? { clip } : {}) };
    });
    return { id: l.id, groups };
  });
  return { ...scene, layers };
}
