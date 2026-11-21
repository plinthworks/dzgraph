// Scales (GLOSSARY: Scale): values to pixels and back. Step 1.5. Expectations written by hand.
import { describe, it, expect } from 'vitest';
import { categoryScale, linearScale } from '../src/scale.js';

describe('linearScale', () => {
  it('maps the domain onto the range, both ways', () => {
    const s = linearScale([0, 100], [0, 500]);
    expect([s.map(0), s.map(50), s.map(100), s.map(120)]).toEqual([0, 250, 500, 600]);
    expect(s.invert(250)).toBe(50);
    expect(s.bandwidth).toBe(0);
  });

  it('an upright axis runs downwards on screen: the range is given reversed', () => {
    const s = linearScale([0, 10], [400, 0]);
    expect([s.map(0), s.map(10), s.map(2.5)]).toEqual([400, 0, 300]);
    expect(s.invert(300)).toBe(2.5);
  });

  it('a domain too narrow for a finite ratio (denormals) is treated as empty (found by the layout property)', () => {
    const s = linearScale([-1e-323, 0], [0, 88]);
    expect([s.map(-1e-323), s.map(0)]).toEqual([44, 44]);
  });

  it('an empty domain maps everything to the middle of the range', () => {
    const s = linearScale([5, 5], [0, 100]);
    expect([s.map(5), s.map(9)]).toEqual([50, 50]);
    expect(s.invert(10)).toBe(5);
  });
});

describe('categoryScale', () => {
  it('one band per category, a value at its band\'s centre', () => {
    const s = categoryScale(4, [0, 400]);
    expect(s.bandwidth).toBe(100);
    expect([s.map(0), s.map(1), s.map(3)]).toEqual([50, 150, 350]);
  });

  it('back from a pixel to the band under it, clamped to the categories', () => {
    const s = categoryScale(4, [0, 400]);
    expect([s.invert(0), s.invert(99.9), s.invert(100), s.invert(399), s.invert(-20), s.invert(900)]).toEqual([0, 0, 1, 3, 0, 3]);
  });

  it('reversed range: the first category at the far end (bars: the first at the top)', () => {
    const s = categoryScale(2, [200, 0]);
    expect([s.map(0), s.map(1)]).toEqual([150, 50]);
    expect(s.bandwidth).toBe(100);
    expect(s.invert(160)).toBe(0);
  });

  it('no category: a band of the whole range', () => {
    const s = categoryScale(0, [0, 300]);
    expect(s.bandwidth).toBe(300);
    expect(s.map(0)).toBe(150);
  });
});
