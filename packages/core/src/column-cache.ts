/**
 * What is computed from a column of numbers (a min/max pyramid, its bounds) is kept with the column, so a frame does
 * not walk millions of values again. A column the app gave is used without a copy (big-data.md 5): when it is read
 * again — the app may have written into it — everything kept for it is forgotten (`forgetColumn`).
 */
const caches: WeakMap<Float64Array, unknown>[] = [];

/** A cache keyed by column, forgotten with it. */
export function columnCache<T>(): WeakMap<Float64Array, T> {
  const m = new WeakMap<Float64Array, T>();
  caches.push(m);
  return m;
}

/** Called when a column the app owns is read: nothing computed from its old values survives. */
export function forgetColumn(a: Float64Array): void {
  for (const m of caches) m.delete(a);
}
