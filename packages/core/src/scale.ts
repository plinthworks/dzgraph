/**
 * Scales (GLOSSARY: Scale): values to pixels along one screen direction, and back. A scale knows nothing of
 * orientation or reading direction: layout gives it a range already turned (`[bottom, top]` for an upright axis,
 * `[end, start]` when mirrored).
 */
import type { Scale } from './series-type.js';

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
    return { map: () => mid, invert: () => d0, bandwidth: 0 };
  }
  const k = (r1 - r0) / span;
  return { map: (v) => r0 + (v - d0) * k, invert: (p) => d0 + (p - r0) / k, bandwidth: 0 };
}

/**
 * A category scale: `count` bands over `range`, a category's rank mapped to its band's centre; `invert` gives the
 * band under a pixel, clamped to the categories.
 */
export function categoryScale(count: number, range: readonly [number, number]): Scale {
  const [r0, r1] = range;
  const n = Math.max(count, 1);
  const band = (r1 - r0) / n;
  return {
    map: (rank) => r0 + (rank + 0.5) * band,
    invert: (p) => Math.min(n - 1, Math.max(0, Math.floor((p - r0) / band))),
    bandwidth: Math.abs(band),
  };
}
