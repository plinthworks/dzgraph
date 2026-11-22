/**
 * Scales (GLOSSARY: Scale): values to pixels along one screen direction, and back. A scale knows nothing of
 * orientation or reading direction: layout gives it a range already turned (`[bottom, top]` for an upright axis,
 * `[end, start]` when mirrored).
 */
import type { Scale } from './series-type.js';
import type { Affine } from './scene.js';

const flat = (d0: number, mid: number, log: boolean): Affine => ({ d0, r0: mid, k: 0, log });

/**
 * A continuous scale: `domain` onto `range`, linearly. An empty domain — or one so narrow that pixels per unit are not
 * a finite number (denormal values) — maps everything to the range's middle.
 */
export function linearScale(domain: readonly [number, number], range: readonly [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0 || !Number.isFinite((r1 - r0) / span)) {
    const mid = (r0 + r1) / 2;
    return { map: () => mid, invert: () => d0, bandwidth: 0, affine: flat(d0, mid, false) };
  }
  const k = (r1 - r0) / span;
  return { map: (v) => r0 + (v - d0) * k, invert: (p) => d0 + (p - r0) / k, bandwidth: 0, affine: { d0, r0, k, log: false } };
}

/**
 * A category scale: `count` bands over `range`, a category's rank mapped to its band's centre; `invert` gives the
 * band under a pixel, clamped to the categories.
 */
export function categoryScale(count: number, range: readonly [number, number], first = 0): Scale {
  const [r0, r1] = range;
  const n = Math.max(count, 1);
  const band = (r1 - r0) / n;
  // `first`: the rank shown in the first band (a zoomed axis shows a run of categories, zoom-pan.md 10).
  return {
    map: (rank) => r0 + (rank - first + 0.5) * band,
    invert: (p) => first + Math.min(n - 1, Math.max(0, Math.floor((p - r0) / band))),
    bandwidth: Math.abs(band),
    affine: { d0: first - 0.5, r0, k: band, log: false },
  };
}

/**
 * A logarithmic scale (log-scale.md 1): `domain` (positive) onto `range` by its powers of ten. A value of zero or below
 * has no place on it and maps to the range's start, the bottom of the axis, where columns and areas grow from
 * (log-scale.md 8).
 */
export function logScale(domain: readonly [number, number], range: readonly [number, number]): Scale {
  const [r0, r1] = range;
  const l0 = Math.log10(domain[0]);
  const l1 = Math.log10(domain[1]);
  const span = l1 - l0;
  if (!(span > 0) || !Number.isFinite((r1 - r0) / span)) {
    const mid = (r0 + r1) / 2;
    return { map: () => mid, invert: () => domain[0], bandwidth: 0, affine: flat(l0, mid, true) };
  }
  const k = (r1 - r0) / span;
  return { map: (v) => (v > 0 ? r0 + (Math.log10(v) - l0) * k : r0), invert: (p) => 10 ** (l0 + (p - r0) / k), bandwidth: 0, affine: { d0: l0, r0, k, log: true } };
}
