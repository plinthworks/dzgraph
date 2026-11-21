// The DOM layer's tests run in a real browser (vitest.config.ts): this one fails anywhere else. jsdom measures no text
// and lays nothing out, so a test of a label's width or a plot's size would pass there for nothing.
import { describe, it, expect } from 'vitest';

describe('the DOM tests run in a real browser', () => {
  it('measures SVG text and lays out boxes', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Consommation';
    svg.appendChild(text);
    const box = document.createElement('div');
    box.style.inlineSize = '300px';
    box.style.blockSize = '120px';
    box.appendChild(svg);
    document.body.appendChild(box);
    try {
      expect(text.getComputedTextLength()).toBeGreaterThan(20);
      expect(box.getBoundingClientRect().width).toBe(300);
    } finally {
      box.remove();
    }
  });
});
