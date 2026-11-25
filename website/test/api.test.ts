// @vitest-environment node
/**
 * The API reference (docs/phase-9-steps/plan.md, batch 4; taken from DzGrid's): one page per package, in both
 * languages, made by scripts/gen-api.mjs from the accepted type surface (api/*.api.txt) — up to date, and every public
 * name in it with its declaration.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error a plain .mjs script
import { page, pageFile } from '../../scripts/gen-api.mjs';
// @ts-expect-error a plain .mjs script
import { baselineFile, PACKAGES, parse } from '../../scripts/api.mjs';

describe('the API reference', () => {
  it('writes a package as its entries, each name a heading over its declaration', () => {
    // @dzgraph/dztooltip, written out by hand: one entry, two names, in the surface's order.
    const en: string = page('dztooltip', 'en');
    expect(en.startsWith('---\ntitle: "@dzgraph/dztooltip"\ndescription: "DzGraph\'s points\' tooltip drawn by DzTooltip: placements, tones, shapes, animations."\n')).toBe(true);
    expect(en).toContain(
      [
        '## `@dzgraph/dztooltip`',
        '',
        '### DzTooltipOptions',
        '',
        '```ts',
        'export interface DzTooltipOptions extends TipLook {',
        '    readonly nonce?: string;',
        '    readonly root?: HTMLElement;',
        '}',
        '```',
        '',
        '### dzTooltip',
        '',
        '```ts',
        'export declare function dzTooltip(options?: DzTooltipOptions): Feature;',
        '```',
        '',
      ].join('\n'),
    );
    // The French page: the same declarations, its own words.
    const fr: string = page('dztooltip', 'fr');
    expect(fr).toContain('Chaque nom public de `@dzgraph/dztooltip`');
    expect(fr).toContain('export declare function dzTooltip(options?: DzTooltipOptions): Feature;');
  });

  it('lists the theme’s sheets, which have no names of their own', () => {
    const en: string = page('theme', 'en');
    expect(en).toContain('- `@dzgraph/theme/dzgraph.css`\n- `@dzgraph/theme/dzgraph.unlayered.css`\n- `@dzgraph/theme/dzgraph.scss`\n');
    expect(en).not.toContain('```ts');
  });

  for (const name of PACKAGES as string[])
    it(`@dzgraph/${name}: its pages are what scripts/gen-api.mjs makes (node scripts/gen-api.mjs), with every public name`, () => {
      for (const lang of ['en', 'fr']) expect(readFileSync(pageFile(name, lang), 'utf8')).toBe(page(name, lang));
      const text: string = page(name, 'en');
      const { surface } = parse(readFileSync(baselineFile(name), 'utf8')) as { surface: Record<string, Record<string, string>> };
      const missing = Object.entries(surface)
        .flatMap(([entry, names]) => [!text.includes(`\`${entry}\``) ? entry : null, ...Object.values(names).filter((d) => !text.includes(d))])
        .filter(Boolean);
      expect(missing).toEqual([]);
    });
});
