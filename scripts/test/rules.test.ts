// The source rules (CLAUDE.md): no colour literal, no literal visible text in the DOM layer, logical sides only
// (dir.ts aside), no HTML sink, no raw invisible character. Each is first caught when planted.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkScss, checkSource } from '../guards/rules.js';
import { ROOT, rel, walk } from './files.js';

const rules = (src: string, file = 'src/a.ts', text = true) => checkSource(src, file, { text }).map((f) => f.rule);

describe('the rules catch what is planted', () => {
  it('a colour: literal, through style, through an SVG attribute', () => {
    expect(rules("ctx.fillStyle = '#2563eb';")).toContain('colour');
    expect(rules("el.style.color = 'red';")).toContain('colour');
    expect(rules("el.setAttribute('fill', 'red');")).toContain('colour');
    expect(rules("el.setAttribute('fill', 'var(--dzgraph-series-1)');")).toEqual([]);
    expect(rules("el.setAttribute('fill', 'none');")).toEqual([]);
    // paint.ts alone may write color-mix() of variables; never a literal colour, there either.
    expect(rules('const c = `color-mix(in oklab, ${a}, ${b} 50%)`;', 'src/paint.ts')).toEqual([]);
    expect(rules('const c = `color-mix(in oklab, ${a}, ${b} 50%)`;', 'src/svg.ts')).toContain('colour');
    expect(rules("const c = 'rgb(0, 0, 0)';", 'src/paint.ts')).toContain('colour');
  });

  it('literal text reaching the screen, in the DOM layer only', () => {
    expect(rules("el.textContent = 'Reset zoom';")).toContain('literal-text');
    expect(rules("el.setAttribute('aria-label', 'Chart');")).toContain('literal-text');
    expect(rules("el.textContent = 'Reset zoom';", 'src/a.ts', false)).toEqual([]);
    expect(rules("el.textContent = msg('zoom.reset');")).toEqual([]);
  });

  it('a physical side, outside dir.ts; x is a coordinate, not a side', () => {
    expect(rules('const s = r.left;')).toContain('physical');
    expect(rules("const a = 'text-align: right';")).toContain('physical');
    expect(rules("el.style.margin = '0 4px';")).toContain('physical');
    expect(rules('const s = r.left;', 'src/dir.ts')).toEqual([]);
    expect(rules('const px = p.x + e.clientX - box.x;')).toEqual([]);
    expect(rules("if (e.key === 'ArrowLeft') {}")).toContain('physical');
    expect(rules("if (e.key === 'ArrowLeft') {}", 'src/keys.ts')).toEqual([]);
  });

  it('an HTML sink, and a raw invisible character', () => {
    expect(rules('el.innerHTML = h;')).toContain('html');
    expect(rules("el['outerHTML'] = h;")).toContain('html');
    expect(rules("const s = 'a\u200fb';")).toContain('invisible');
    // A combining mark in a comment is fine, even after a template literal type (the raw scanner lost its place there).
    expect(rules('type T = `s-${number}`;\n/** `e\u0301` */\nconst a = 1;')).toEqual([]);
    expect(rules('const s = "e\u0301";')).toContain('invisible');
  });

  it('SCSS: a colour outside the palette, a physical side', () => {
    expect(checkScss('.dzgraph-x { color: #000; }\n.dzgraph-y { margin-left: 2px; }').map((f) => `${f.line}:${f.rule}`)).toEqual(['1:colour', '2:physical']);
    expect(checkScss('$tz-palette: (\n  blue: #2563eb,\n);\n.a { color: var(--tz-blue); }')).toEqual([]);
  });
});

describe('the rules hold', () => {
  for (const [pkg, text] of [['core', false], ['dom', true], ['angular', true], ['dztooltip', true], ['dzgrid', true]] as const) {
    it(`in every source of @dzgraph/${pkg}`, () => {
      const src = join(ROOT, `packages/${pkg}/src`);
      const found = [...walk(src, /\.ts$/)].flatMap((f) =>
        checkSource(readFileSync(f, 'utf8'), rel(f), { text }).map((x) => `${rel(f)}:${x.line} ${x.rule} ${x.why}`),
      );
      expect(found).toEqual([]);
    });
  }

  it('in the theme', () => {
    const found = [...walk(join(ROOT, 'packages/theme'), /\.scss$/)].flatMap((f) => checkScss(readFileSync(f, 'utf8')).map((x) => `${rel(f)}:${x.line} ${x.rule}`));
    expect(found).toEqual([]);
  });
});
