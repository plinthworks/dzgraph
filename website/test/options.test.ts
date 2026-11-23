// @vitest-environment node
/**
 * One page per option (docs/phase-9-steps/plan.md, batch 3; taken from DzGrid's): the facts in
 * `src/generated/options.json` are what scripts/gen-options.mjs reads in the sources today; a page under
 * `options/<group>/` is the option its slug names (`aspect-ratio` → `aspectRatio`), titled with it and showing its
 * facts, in both languages, and every option has one; every default the sources write as a `{token}` has its words in
 * both languages. Whether each `@feature` is true is held to the chart in packages/dom/test/option-facts.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error a plain .mjs script
import { generate, OUT } from '../../scripts/gen-options.mjs';
import { FACTS } from '../src/i18n/facts';

const DOCS = fileURLToPath(new URL('../src/content/docs', import.meta.url));
type Named = { name: string; default?: { token?: string } | null; keys?: Named[] };
const data = generate() as Record<'chart' | 'series' | 'seriesTypes' | 'axis' | 'setup' | 'features', Named[]>;
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const pagesIn = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => /\.mdx?$/.test(f)) : []);
/** Each group: its folder under options/, its facts, the <OptionFacts> attribute that names one. */
const GROUPS = [
  ['chart', data.chart, 'chart'],
  ['series', data.series, 'series'],
  ['series-types', data.seriesTypes, 'seriesType'],
  ['axis', data.axis, 'axis'],
  ['setup', data.setup, 'setup'],
  ['features', data.features, 'feature'],
] as const;

describe('one page per option', () => {
  it('options.json is up to date (node scripts/gen-options.mjs)', () => {
    expect(readFileSync(OUT, 'utf8')).toBe(JSON.stringify(data, null, 2) + '\n');
  });

  it('a default written as a {token} has its words in both languages', () => {
    const all = Object.values(data).flat().flatMap((o) => [o, ...(o.keys ?? [])]);
    const tokens = [...new Set(all.flatMap((o) => (o.default?.token ? [o.default.token] : [])))];
    expect(tokens.length).toBeGreaterThan(5);
    for (const lang of ['en', 'fr'] as const) expect(tokens.filter((t) => !FACTS[lang].tokens[t]), lang).toEqual([]);
    // And no words left for a token the sources no longer use.
    expect(Object.keys(FACTS.en.tokens).filter((t) => !tokens.includes(t))).toEqual([]);
    expect(Object.keys(FACTS.fr.tokens).sort()).toEqual(Object.keys(FACTS.en.tokens).sort());
  });

  for (const [dir, list, attr] of GROUPS) {
    it(`options/${dir}: each page is the option its slug names, with its facts; each option has its page, in both languages`, () => {
      const slugs = new Map(list.map((o) => [kebab(o.name), o.name]));
      const wrong: string[] = [];
      for (const d of [`options/${dir}`, `fr/options/${dir}`]) {
        for (const file of pagesIn(join(DOCS, d))) {
          const name = slugs.get(file.replace(/\.mdx?$/, ''));
          const text = readFileSync(join(DOCS, d, file), 'utf8');
          if (!name) wrong.push(`${d}/${file}: no option of that name`);
          else if (!text.includes(`title: "${name}"`) || !text.includes(`<OptionFacts ${attr}="${name}" />`)) wrong.push(`${d}/${file}: not titled ${name}, or no <OptionFacts ${attr}="${name}" />`);
        }
        for (const [slug] of slugs) if (!existsSync(join(DOCS, d, `${slug}.mdx`))) wrong.push(`${d}/${slug}: missing`);
      }
      expect(wrong).toEqual([]);
    });
  }
});
