// @vitest-environment node
/**
 * `llms.txt` and `llms-full.txt` (docs/phase-9-steps/plan.md, batch 4; taken from DzGrid's): what scripts/llms.mjs
 * makes of the site's English pages today, so they never drift from it — the short index in the llmstxt.org shape, the
 * full text with every getting-started page, guide and option page in the sidebar's order, made plain Markdown.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error a plain .mjs script
import { build, plain, absolute, sections, facts } from '../../scripts/llms.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('llms.txt and the site’s text', () => {
  it('turns a page into plain Markdown with absolute links, its code left as written', () => {
    const mdx = [
      "import CodeTabs from '../../../components/CodeTabs.astro';",
      '',
      'See [zoom](../exploring/#zoom) and [out](https://e.org).',
      '',
      '<CodeTabs>',
      '<Fragment slot="ts">',
      '',
      '```ts',
      'export const options: ChartOptions = { series: [] };',
      'const link = "[a](../b/)";',
      '```',
      '',
      '</Fragment>',
      '<Fragment slot="angular">',
      '',
      '```ts',
      'const b = 2;',
      '```',
      '',
      '</Fragment>',
      '</CodeTabs>',
      '',
      '<LiveChart',
      '  height={300}',
      "  options={{ series: [{ type: 'line', id: 'a', data: [1, 2] }] }}",
      '/>',
      '',
      '<Aside type="tip">',
      'Two lines',
      'of advice.',
      '</Aside>',
      '',
      '<GaugeWorkshop />',
      '',
      'End.',
    ].join('\n');
    expect(plain(mdx, 'guides/data')).toBe(
      [
        'See [zoom](https://plinthworks.github.io/dzgraph/guides/exploring/#zoom) and [out](https://e.org).',
        '',
        '```ts',
        'export const options: ChartOptions = { series: [] };',
        'const link = "[a](../b/)";',
        '```',
        '',
        '> Two lines',
        '> of advice.',
        '',
        'End.',
      ].join('\n'),
    );
    expect(absolute('[a](../../setup/types/)', 'options/chart/title')).toBe('[a](https://plinthworks.github.io/dzgraph/options/setup/types/)');
  });

  it('writes an option’s facts as a line of text', () => {
    const data = {
      chart: [{ name: 'aspectRatio', type: 'number', required: false, default: { code: '2' }, feature: null, source: 'x' }],
      series: [{ name: 'drilldown', type: 'Drill', required: false, default: null, feature: 'drilldown', source: 'x' }],
      seriesTypes: [{ name: 'pie', entry: '@dzgraph/core', options: 'PieSeriesOptions', system: 'polar', keys: [], source: 'x' }],
      axis: [],
      setup: [{ name: 'types', type: 'readonly SeriesType[]', required: true, default: null, feature: null, source: 'x' }],
      features: [{ name: 'zoom', needs: [], source: 'x', enables: [] }],
    };
    const words = { tokens: {} };
    expect(facts('<OptionFacts chart="aspectRatio" />', data, words)).toBe('Type: `number`. Default: `2`.');
    expect(facts('<OptionFacts series="drilldown" />', data, words)).toBe('Type: `Drill`. Needs the `drilldown` feature.');
    expect(facts('<OptionFacts setup="types" />', data, words)).toBe('Type: `readonly SeriesType[]`. Required.');
    expect(facts('<OptionFacts seriesType="pie" />', data, words)).toBe('Import: `pie` from `@dzgraph/core`. Options: `PieSeriesOptions`.');
    expect(facts('<OptionFacts feature="zoom" />', data, words)).toBe('Import: `zoom` from `@dzgraph/dom`.');
  });

  it('are what scripts/llms.mjs makes of the site’s English pages (node scripts/llms.mjs)', async () => {
    const out = (await build(ROOT)) as Record<string, string>;
    for (const [file, made] of Object.entries(out)) expect(readFileSync(join(ROOT, file), 'utf8'), file).toBe(made);
    // The short index stays short; the full one holds every page of the sidebar, in its order, without MDX.
    expect(Buffer.byteLength(out['llms.txt']!)).toBeLessThan(8_000);
    const slugs = (sections(readFileSync(join(ROOT, 'website/astro.config.mjs'), 'utf8'), ROOT) as { slugs: string[] }[]).flatMap((s) => s.slugs);
    // 2 getting-started pages, 12 guides, the options' overview and its 69 pages.
    expect(slugs.length).toBeGreaterThanOrEqual(84);
    expect(slugs.slice(0, 3)).toEqual(['getting-started/typescript', 'getting-started/angular', 'guides/data']);
    const at = slugs.map((s) => out['llms-full.txt']!.indexOf(`<!-- https://plinthworks.github.io/dzgraph/${s}/ -->`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // No MDX left in the prose (the code keeps its own imports).
    const prose = out['llms-full.txt']!.replace(/^```[\s\S]*?^```$/gm, '');
    expect(prose).not.toMatch(/<(LiveChart|CodeTabs|Fragment|OptionFacts|GaugeWorkshop|Aside)\b|^import /m);
    expect(out['llms-full.txt']).toContain('# aspectRatio\n\nWidth ÷ height, for an element without a height of its own.\n\nType: `number`.');
  });
});
