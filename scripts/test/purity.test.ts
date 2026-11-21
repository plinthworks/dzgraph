// The core's purity (CLAUDE.md): no DOM, Date, Temporal, clock, randomness, package or dynamic import; Intl allowed.
// The guard is checked against planted violations first: a guard that never fires guards nothing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { purityViolations } from '../guards/purity.js';
import { ROOT, rel, walk } from './files.js';

const SRC = join(ROOT, 'packages/core/src');

describe('the purity guard catches what is planted', () => {
  const planted = [
    'const d = new Date();',
    'const t = Date.now();',
    'const D = Date; new D();',
    'const d = new globalThis.Date();',
    'const d = Reflect.construct(Date, []);',
    'let d: Date;',
    'if (x instanceof Date) {}',
    'const r = Math.random();',
    'const t = performance.now();',
    'Temporal.Now.instant();',
    'document.body;',
    'typeof window;',
    'setTimeout(f, 0);',
    'requestAnimationFrame(f);',
    'const p = new Path2D();',
    "import x from 'lodash';",
    "import 'side-effect';",
    "const m = await import('./x.js');",
    "const m = require('x');",
    'const s = `${Date.now()}`;',
    "const s = 'a // b'; const d = new Date();",
    'const x = c ? window : 1;',
    "export * from 'lodash';",
    'const { now } = performance;',
    // A template literal type, then a backtick in a comment, then real code: the raw scanner lost its place here.
    'type T = `s-${number}`;\n/** `x` */\nconst d = new Date();',
  ];
  for (const source of planted) it(`catches: ${source}`, () => expect(purityViolations(source)).not.toEqual([]));

  it('reads a template literal type, then comments with backticks, as what they are', () => {
    expect(purityViolations('type T = `series-${number}` | `color-${string}`;\n/**\n * `navigator` when shown.\n */\nconst a = 1;')).toEqual([]);
  });

  it('lets comments, strings, property names and Intl through', () => {
    expect(purityViolations("// new Date() is banned\n/* Math.random */ const s = 'Date and Temporal';")).toEqual([]);
    expect(purityViolations('interface W { readonly window: number; location?: string } const w = v.window; const o = { window: 1 };')).toEqual([]);
    expect(purityViolations("const f = new Intl.NumberFormat('fr-FR'); import { x } from './scale.js';")).toEqual([]);
  });
});

describe('@dzgraph/core is pure', () => {
  const files = [...walk(SRC, /\.ts$/)];
  it('finds its sources', () => expect(files.some((f) => f.endsWith('/index.ts'))).toBe(true));
  it('names no forbidden global, package or dynamic import', () => {
    const offenders = files.flatMap((f) => {
      const v = purityViolations(readFileSync(f, 'utf8'));
      return v.length ? [`${rel(f)}: ${[...new Set(v)].join(', ')}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
