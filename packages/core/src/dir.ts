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

/** A letter of a script written right to left (Unicode's strong right-to-left classes, by script). */
const RTL_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Mende_Kikakui}\p{Script=Old_Hungarian}\p{Script=Yezidi}]/u;

/**
 * A text's own direction (direction.md 6): its first letter's — Unicode's « first strong » rule — so a Latin name in a
 * right-to-left chart keeps its parentheses where they belong; no letter (a number, a date in digits): the chart's,
 * which the locale wrote it for (direction.md 5).
 */
export function textDir(text: string, dir: Dir): Dir {
  const letter = /\p{L}/u.exec(text);
  return letter ? (RTL_LETTER.test(letter[0]) ? 'rtl' : 'ltr') : dir;
}

/** A text placed by the layout in `dir` at `anchor`, given its own direction: the anchor turned so it stays in place. */
export function ownDirection(text: string, dir: Dir, anchor: 'start' | 'middle' | 'end'): { readonly dir: Dir; readonly anchor: 'start' | 'middle' | 'end' } {
  const own = textDir(text, dir);
  return { dir: own, anchor: own === dir || anchor === 'middle' ? anchor : anchor === 'start' ? 'end' : 'start' };
}
