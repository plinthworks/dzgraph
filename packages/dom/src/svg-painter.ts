/**
 * Draws a scene into one SVG element, reusing elements by scene id (scene.ts): a frame that changes a few values
 * changes a few attributes. The same translation as the export (`svgOf`), so the screen and an export match. Phase 1
 * draws every group in SVG, those the scene gives to Canvas included (the Canvas painter comes in Phase 3).
 */
import type { Group, Scene } from '@dzgraph/core';
import { clipId, clipIndex, clipsOf, drawnItems, svgOf, type SvgOptions } from '@dzgraph/core/internal';
import type { Painter } from './painter.js';

const NS = 'http://www.w3.org/2000/svg';

export class SvgPainter implements Painter {
  private readonly defs: SVGDefsElement;
  private readonly layers = new Map<string, SVGGElement>();
  private readonly groups = new Map<string, SVGGElement>();
  private readonly elements = new Map<string, SVGElement>();
  /** The attributes each element was given last, to remove those a new frame does not set. */
  private readonly given = new WeakMap<SVGElement, readonly string[]>();

  constructor(
    readonly svg: SVGSVGElement,
    private readonly prefix: string,
  ) {
    this.defs = document.createElementNS(NS, 'defs');
    svg.appendChild(this.defs);
  }

  paint(scene: Scene, opts: SvgOptions, accepts: (group: Group, layer: string) => boolean = () => true): void {
    const { svg } = this;
    svg.setAttribute('width', String(scene.width));
    svg.setAttribute('height', String(scene.height));
    svg.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);

    // Clip paths, one per distinct rectangle: the same table and ids as the export (svg.ts).
    const clips = clipsOf(scene);
    // A layer none of whose groups this painter draws is left out (the back SVG draws two layers, the front the rest).
    const drawn = new Set(scene.layers.filter((l) => l.groups.some((g) => accepts(g, l.id))).map((l) => l.id));
    const seenGroups = new Set<string>();
    const seen = new Set<string>();
    let layerCursor: ChildNode | null = this.defs.nextSibling;
    for (const layer of scene.layers) {
      if (!drawn.has(layer.id) && !this.layers.has(layer.id)) continue;
      let lg = this.layers.get(layer.id);
      if (!lg) {
        lg = document.createElementNS(NS, 'g');
        lg.setAttribute('data-layer', layer.id);
        // The drawing is for the eyes: its content reaches screen readers through the summary, the points and the
        // data table (screen-reader.md 4).
        lg.setAttribute('aria-hidden', 'true');
        this.layers.set(layer.id, lg);
      }
      if (lg !== layerCursor) svg.insertBefore(lg, layerCursor);
      layerCursor = lg.nextSibling;

      let groupCursor: ChildNode | null = lg.firstChild;
      for (const group of layer.groups) {
        if (!accepts(group, layer.id)) continue;
        const gid = `${layer.id}\u0000${group.sceneId}`;
        seenGroups.add(gid);
        let g = this.groups.get(gid);
        if (!g) {
          g = document.createElementNS(NS, 'g');
          this.groups.set(gid, g);
        }
        if (group.clip) g.setAttribute('clip-path', `url(#${clipId(this.prefix, clipIndex(clips, group.clip))})`);
        else g.removeAttribute('clip-path');
        if (group.opacity !== undefined && group.opacity !== 1) g.setAttribute('opacity', String(group.opacity));
        else g.removeAttribute('opacity');
        if (g !== groupCursor) lg.insertBefore(g, groupCursor);
        groupCursor = g.nextSibling;

        let cursor: ChildNode | null = g.firstChild;
        // A batch as one element per point that may show (ADR 0008).
        for (const p of drawnItems(group.items, group.clip)) {
          const spec = svgOf(p, opts);
          seen.add(p.sceneId);
          let el = this.elements.get(p.sceneId);
          if (!el || el.localName !== spec.tag) {
            // Replaced where it was: past it first when it is where the next one goes (a column getting a rounded end).
            if (el && el === cursor) cursor = el.nextSibling;
            el?.remove();
            el = document.createElementNS(NS, spec.tag);
            this.elements.set(p.sceneId, el);
          }
          const names = Object.keys(spec.attrs);
          for (const old of this.given.get(el) ?? []) if (!(old in spec.attrs)) el.removeAttribute(old);
          for (const n of names) if (el.getAttribute(n) !== spec.attrs[n]) el.setAttribute(n, spec.attrs[n]!);
          this.given.set(el, names);
          if (spec.text !== undefined && el.textContent !== spec.text) el.textContent = spec.text;
          if (el !== cursor) g.insertBefore(el, cursor);
          cursor = el.nextSibling;
        }
      }
    }
    // What this frame did not draw goes.
    for (const [id, el] of this.elements) if (!seen.has(id)) {
      el.remove();
      this.elements.delete(id);
    }
    for (const [id, g] of this.groups) if (!seenGroups.has(id)) {
      g.remove();
      this.groups.delete(id);
    }
    this.defs.replaceChildren(
      ...clips.map((r, i) => {
        const cp = document.createElementNS(NS, 'clipPath');
        cp.id = clipId(this.prefix, i);
        const rect = document.createElementNS(NS, 'rect');
        for (const [k, v] of Object.entries({ x: r.x, y: r.y, width: r.width, height: r.height })) rect.setAttribute(k, String(v));
        cp.appendChild(rect);
        return cp;
      }),
    );
  }

  /** The element drawn for a scene id (tests, the hover layer). */
  elementOf(sceneId: string): SVGElement | undefined {
    return this.elements.get(sceneId);
  }
}
