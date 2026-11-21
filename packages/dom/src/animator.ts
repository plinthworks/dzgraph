/**
 * Animation (animation.md): draws the scenes between two states, frame by frame, easing out. The scenes come from the
 * core (`interpolateScene`, `appearFrom`); this only keeps time. An app may drive it instead (`animate` hook).
 */
import type { Scene } from '@dzgraph/core';
import { interpolateScene } from '@dzgraph/core/internal';

/** What an app's `animate` hook receives: both states, the duration it would take, a way to draw any state between. */
export interface AnimateHook {
  readonly from: Scene;
  readonly to: Scene;
  readonly duration: number;
  /** Draws the state at `t` (0: from, 1: to). */
  draw(t: number): void;
  /** Says the animation is over (the end state is drawn if it was not). */
  done(): void;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export class Animator {
  /** The scene on screen now (mid-animation: the one between). */
  shown: Scene | null = null;
  private frame = 0;
  private run = 0;

  constructor(private readonly paint: (scene: Scene) => void) {}

  /** Draws `to` at once, stopping any animation. */
  jump(to: Scene): void {
    this.stop();
    this.paint(to);
    this.shown = to;
  }

  /** Animates from `from` to `to`; the app's hook, if given, drives it instead. */
  animate(from: Scene, to: Scene, duration: number, hook?: (a: AnimateHook) => void): void {
    this.stop();
    const run = ++this.run;
    const draw = (t: number) => {
      if (run !== this.run) return;
      const s = interpolateScene(from, to, Math.min(1, Math.max(0, t)));
      this.paint(s);
      this.shown = s;
    };
    if (hook) {
      draw(0);
      hook({ from, to, duration, draw, done: () => run === this.run && draw(1) });
      return;
    }
    const start = performance.now();
    const tick = () => {
      this.frame = 0;
      const t = Math.min(1, (performance.now() - start) / duration);
      draw(easeOut(t));
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };
    draw(0);
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.run++;
  }
}
