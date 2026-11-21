/**
 * The one module that knows which physical side is which (CLAUDE.md: logical sides only, right to left designed in).
 * Everything else speaks of the start and the end of the reading direction; the scene is in physical pixels, so this
 * turns one into the other. Screen x grows from the left edge: `x-min` is the left side, `x-max` the right side.
 */
export type Dir = 'ltr' | 'rtl';
export type InlineSide = 'start' | 'end';
/** A physical side along x, without naming it in words (the guards hold every other file to that). */
export type XSide = 'x-min' | 'x-max';

/** Where the start or the end of the reading direction falls on screen. */
export function sideOf(dir: Dir, side: InlineSide): XSide {
  return (side === 'start') === (dir === 'ltr') ? 'x-min' : 'x-max';
}

/** The x of a box's start or end edge. */
export function edgeX(box: { readonly x: number; readonly width: number }, dir: Dir, side: InlineSide): number {
  return sideOf(dir, side) === 'x-min' ? box.x : box.x + box.width;
}

/** +1 when the reading direction runs towards larger x, −1 otherwise. */
export function inlineSign(dir: Dir): 1 | -1 {
  return dir === 'ltr' ? 1 : -1;
}
