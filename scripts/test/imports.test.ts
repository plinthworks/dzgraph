// The package graph (ARCHITECTURE §2): core ← dom ← (angular, dztooltip, dzgrid). The core imports no package of
// ours; the DOM layer imports the core only; no package reaches another's sources by a relative path.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, rel, walk } from './files.js';

const ALLOWED: Record<string, readonly string[]> = {
  core: [],
  dom: ['@dzgraph/core'],
  angular: ['@dzgraph/core', '@dzgraph/dom', '@angular/core'],
  theme: [],
  // The bridges: the DOM layer and their host's package only (dztooltip.md 6).
  dztooltip: ['@dzgraph/dom', '@dztooltip/core'],
  // No import of DzGrid: its kernel described by structural types (dzgrid-link.md).
  dzgrid: ['@dzgraph/dom'],
};

export function specifiers(source: string): string[] {
  // Not a word inside a string (`k === 'from'`, `'measure/from'`): the keyword is never right after a quote, a dot, a
  // slash or a hyphen.
  return [...source.matchAll(/(?<!['"`./-])\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

describe('the package graph', () => {
  it('reads specifiers, static and dynamic', () => {
    expect(specifiers("import { a } from '@dzgraph/core';\nimport type { B } from './b.js';\nconst c = await import('../c.js');\nimport './d.css';")).toEqual(['@dzgraph/core', './b.js', '../c.js', './d.css']);
  });

  it('ignores the words inside strings and properties', () => {
    expect(specifiers("const ok = k === 'from' || k === 'to';\nconst f = t.from < t.to;")).toEqual([]);
    // Nor the end of a word in a string, after a slash or a hyphen (a scene id, Phase 5a).
    expect(specifiers("const p = { sceneId: 'measure/from', paint: ring, symbol: 'circle' };\nconst q = 'data-from', r = 'x';")).toEqual([]);
  });

  it('every package is listed', () => {
    const pkgs = readdirSync(join(ROOT, 'packages')).filter((p) => existsSync(join(ROOT, 'packages', p, 'package.json')));
    expect(pkgs.filter((p) => !(p in ALLOWED))).toEqual([]);
  });

  for (const [pkg, allowed] of Object.entries(ALLOWED)) {
    it(`@dzgraph/${pkg} imports only ${allowed.join(', ') || 'itself'}`, () => {
      const bad = [...walk(join(ROOT, 'packages', pkg, 'src'), /\.ts$/)].flatMap((f) =>
        specifiers(readFileSync(f, 'utf8'))
          .filter((s) => (s.startsWith('.') ? /\.\.\/\.\.\//.test(s) && /packages|\/src\//.test(s) : !allowed.some((a) => s === a || s.startsWith(a + '/'))))
          .map((s) => `${rel(f)}: ${s}`),
      );
      expect(bad).toEqual([]);
    });
  }
});
