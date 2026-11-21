/**
 * What draws a scene on screen. Phase 1 has one, SVG, which draws every group; Phase 3 adds Canvas (and WebGL2,
 * D.20) and `chart()` gives each painter the groups the scene assigns to it (ADR 0002). One interface, so the hybrid
 * arrives without rewriting `chart()`.
 */
import type { Group, Scene } from '@dzgraph/core';
import type { SvgOptions } from '@dzgraph/core/internal';

export interface Painter {
  /** Draws the scene's groups that `accepts` keeps, back to front, reusing what it drew last time by scene id. */
  paint(scene: Scene, opts: SvgOptions, accepts: (group: Group) => boolean): void;
}
