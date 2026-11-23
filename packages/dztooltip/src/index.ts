/**
 * @dzgraph/dztooltip — the bridge (dztooltip.md): a chart's points' tooltip drawn by DzTooltip, with its look —
 * placements, tones, shapes, animations — over a virtual anchor at the point (DzTooltip's rule 38).
 *
 * ```ts
 * chart(el, options, { types, features: [dzTooltip({ tone: 'neutral', placement: 'top', animation: 'morph' })] });
 * ```
 *
 * The chart still decides what the tooltip says and when it shows (hover, focus, Escape, a tap); DzTooltip where and
 * how. Only this package imports `@dztooltip/core`: a chart without the bridge ships none of it.
 */
import { tooltip, type TipLook, type VirtualRect } from '@dztooltip/core';
import type { Feature, TooltipDrawer } from '@dzgraph/dom';

export interface DzTooltipOptions extends TipLook {
  /** The page's nonce for the one `<style>` DzTooltip adds (a strict CSP). */
  readonly nonce?: string;
  /** Where the bubble goes in the page; default DzTooltip's (the page's end, or the open `<dialog>`). */
  readonly root?: HTMLElement;
}

/** The chart's feature (ADR 0006): pass it in `features`. */
export function dzTooltip(options: DzTooltipOptions = {}): Feature {
  return { name: 'tooltip', tooltip: (root) => drawer(root, options) };
}

function drawer(root: HTMLElement, options: DzTooltipOptions): TooltipDrawer {
  // The point the chart names, as a box of no size, read whenever DzTooltip places the bubble (the page may have moved
  // the chart since, review 5): the bubble beside it, its arrow on it.
  let where = () => ({ x: 0, y: 0 });
  const anchor = {
    getBoundingClientRect: (): VirtualRect => {
      const at = where();
      return { x: at.x, y: at.y, left: at.x, top: at.y, right: at.x, bottom: at.y, width: 0, height: 0 };
    },
    contextElement: root,
  };
  /** The chart wants it shown: an Escape that is not the chart's (DzTooltip hides on any) does not hide it (review 4). */
  let wanted = false;
  let content: Node = root.ownerDocument.createTextNode('');
  // The chart says when (dztooltip.md 3): no delay of DzTooltip's, no group warming another tooltip.
  const handle = tooltip(anchor, { placement: 'top', ...options, content: () => content, delayMs: 0, hideDelayMs: 0, group: false });
  const doc = root.ownerDocument;
  // After the chart's own keys (the document's bubbling phase): it has decided whether its tooltip goes.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && wanted && !handle.shown) handle.show();
  };
  doc.addEventListener('keydown', onKey);
  return {
    show(c, at) {
      content = c;
      where = at;
      wanted = true;
      // Shown: new content and place at once (`update` shows it again); hidden: shown (review 3: never both).
      if (handle.shown) handle.update({ content: () => content });
      else handle.show();
    },
    hide() {
      wanted = false;
      handle.hide();
    },
    get shown() {
      return handle.shown;
    },
    destroy() {
      wanted = false;
      doc.removeEventListener('keydown', onKey);
      handle.destroy();
    },
  };
}
