/**
 * The view as a picture (export.md 1–2, 4): the chart laid out again at the size asked, as the screen shows it — the
 * visible range, hidden series, selection, comparison — without the controls: no navigator strip, no range buttons
 * (the DOM's controls are not in the scene at all). One scene for the SVG and PNG exports and for printing.
 */
import { layout, type ChartLayout, type LayoutInput } from './layout.js';
import { composeScene } from './compose.js';
import type { Scene } from './scene.js';

export function exportScene(input: LayoutInput): { readonly layout: ChartLayout; readonly scene: Scene } {
  const model = { ...input.model, navigator: false, rangeButtons: false };
  const l = layout({ ...input, model });
  return { layout: l, scene: composeScene({ model, types: input.types, layout: l, measureText: input.measureText, ...(input.view ? { view: input.view } : {}) }) };
}
