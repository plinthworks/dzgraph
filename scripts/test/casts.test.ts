// No unexplained `as never` / `as any` in the tests (DzGrid's rule, our own code): a cast that silences the type
// checker says why, in a comment on its line or the line before. DzGraph starts with none, so no baseline.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, rel, walk } from './files.js';

const CAST = /\bas\s+(never|any)\b/g;
const hasComment = (line: string | undefined) => line !== undefined && (/\/\/|\/\*/.test(line) || /^\s*\*/.test(line));

export function unexplained(text: string): number[] {
  const lines = text.split('\n');
  const out: number[] = [];
  lines.forEach((line, i) => {
    const n = line.match(CAST)?.length ?? 0;
    if (n === 0 || hasComment(line) || hasComment(lines[i - 1])) return;
    for (let k = 0; k < n; k++) out.push(i + 1);
  });
  return out;
}

describe('tests: no unexplained `as never` / `as any`', () => {
  it('finds a cast without a reason, and takes a comment beside it or just above it', () => {
    expect(unexplained('const a = x as never;')).toEqual([1]);
    expect(unexplained('const a = x as any, b = y as any;')).toEqual([1, 1]);
    expect(unexplained('const a = x as never; // an old caller, on purpose')).toEqual([]);
    expect(unexplained('// the wire carries no type\nconst a = x as any;')).toEqual([]);
    expect(unexplained('// one comment\nconst ok = 1;\nconst a = x as never;')).toEqual([3]);
    expect(unexplained('const a = x as Never; const b = y as anything;')).toEqual([]);
  });

  it('none in the repository', () => {
    const self = rel(new URL(import.meta.url).pathname);
    const found = [...walk(join(ROOT, 'packages'), /\.ts$/), ...walk(join(ROOT, 'scripts'), /\.ts$/)]
      .filter((f) => /\/test\//.test(rel(f)) && rel(f) !== self)
      .flatMap((f) => unexplained(readFileSync(f, 'utf8')).map((l) => `${rel(f)}:${l}`));
    expect(found).toEqual([]);
  });
});
