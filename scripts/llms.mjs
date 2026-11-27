/**
 * `llms.txt` and `llms-full.txt`, made from the documentation site's English pages (docs/phase-9-steps/plan.md,
 * batch 4; taken from DzGrid's) so they never drift from it.
 *
 *   node scripts/llms.mjs           writes llms.txt and llms-full.txt at the repository's root
 *   node scripts/llms.mjs --check   says which one is out of date, exit 1 (website/test/llms.test.ts does the same)
 *
 * The order is the site's sidebar (website/astro.config.mjs): the getting-started pages, the guides, then the
 * options' overview and every option page, group by group. `llms.txt` (the llmstxt.org shape: a title, a quote,
 * sections of links) links the first two and the overview; `llms-full.txt` holds every one of them, its MDX made plain
 * Markdown: the code tabs flattened to their TypeScript block, the live demos, the workshop and the imports dropped, an
 * option's facts written as a line, links made absolute (https://plinthworks.github.io/dzgraph/…). The site serves
 * both (website/src/pages/). Text only: no clock, no randomness.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SITE = 'https://plinthworks.github.io/dzgraph/';
export const BLOB = 'https://github.com/plinthworks/dzgraph/blob/main/';
const DOCS = 'website/src/content/docs/';

/** The file of a page: `guides/data` → guides/data.mdx, `options` → options/index.mdx. */
const fileOf = (root, slug) => {
  const own = join(root, `${DOCS}${slug}.mdx`);
  return existsSync(own) ? own : join(root, `${DOCS}${slug}/index.mdx`);
};

/** The sidebar's sections of written pages, read from the site's config: `[{ title, slugs }]`. */
export function sections(config, root = ROOT) {
  const started = /\[('typescript'[^\]]*)\]\.map\(\(page\) => \(\{ slug: `getting-started\//.exec(config);
  const guides = /const GUIDES = \[([\s\S]*?)\];/.exec(config);
  const groups = /const OPTION_GROUPS = \[([\s\S]*?)\n\];/.exec(config);
  const names = (m) => (m ? m[1].match(/'([a-z-]+)'/g).map((s) => s.slice(1, -1)) : []);
  const dirs = groups ? [...groups[1].matchAll(/\['([a-z-]+)'/g)].map((m) => m[1]) : [];
  // Each group as the sidebar lists it: by file name (none of these pages sets an order).
  const options = dirs.flatMap((dir) =>
    readdirSync(join(root, `${DOCS}options/${dir}`))
      .filter((f) => f.endsWith('.mdx'))
      .sort()
      .map((f) => `options/${dir}/${f.slice(0, -4)}`),
  );
  return [
    { title: 'Getting started', slugs: names(started).map((s) => `getting-started/${s}`) },
    { title: 'Guides', slugs: names(guides).map((s) => `guides/${s}`) },
    { title: 'Options', slugs: ['options', ...options], short: ['options'] },
  ];
}

/** A page's frontmatter `title` and `description`, and its body. */
export function split(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const front = m ? m[1] : '';
  const field = (k) => {
    const f = new RegExp(`^${k}: (.*)$`, 'm').exec(front);
    return f ? f[1].trim().replace(/^"(.*)"$/, '$1') : '';
  };
  return { title: field('title'), description: field('description'), body: m ? text.slice(m[0].length) : text };
}

/** A relative link of the page `slug` made absolute on the site. */
export function absolute(markdown, slug) {
  return markdown.replace(/\]\((?!https?:|mailto:)([^)\s]+)\)/g, (_, href) => {
    const [path, hash = ''] = href.split('#');
    const url = path ? new URL(path, `${SITE}${slug}/`).href : `${SITE}${slug}/`;
    return `](${url}${hash ? `#${hash}` : ''})`;
  });
}

/**
 * `<OptionFacts kind="name" />` as a line of text, from the site's generated facts (`data`, options.json) and the
 * words of its defaults (`words.tokens`, src/i18n/facts.ts). An unknown name gives nothing (the site's build fails on it).
 */
export function facts(tag, data, words) {
  const m = /<OptionFacts (\w+)="([^"]+)"/.exec(tag);
  if (!m) return '';
  const [, kind, name] = m;
  const code = (s) => `\`${s}\``;
  if (kind === 'seriesType') {
    const t = data.seriesTypes.find((x) => x.name === name);
    return t ? `Import: ${code(name)} from ${code(t.entry)}. Options: ${code(t.options)}.` : '';
  }
  if (kind === 'feature') {
    const f = data.features.find((x) => x.name === name);
    if (!f) return '';
    const brings = f.needs.length ? ` Brings ${f.needs.map(code).join(', ')}.` : '';
    return `Import: ${code(name)} from ${code('@dzgraph/dom')}.${brings}`;
  }
  const k = (data[kind] ?? []).find((x) => x.name === name);
  if (!k) return '';
  const parts = [`Type: ${code(k.type)}.`];
  if (k.required) parts.push('Required.');
  else if (k.default?.code !== undefined) parts.push(`Default: ${code(k.default.code)}.`);
  else if (k.default?.token && words.tokens[k.default.token]) parts.push(`Default: ${words.tokens[k.default.token]}.`);
  if (k.feature) parts.push(`Needs the ${code(k.feature)} feature.`);
  return parts.join(' ');
}

/** MDX → Markdown: imports and demos dropped, the tabs flattened to their TypeScript block; code left as written. */
export function plain(body, slug, data = null, words = { tokens: {} }) {
  let t = body.replace(/<CodeTabs>([\s\S]*?)<\/CodeTabs>\n?/g, (_, inner) => {
    const ts = /<Fragment slot="ts">([\s\S]*?)<\/Fragment>/.exec(inner);
    return ts ? `${ts[1].trim()}\n` : '';
  });
  // Prose and code apart: only the prose is MDX.
  t = t
    .split(/(^```[^\n]*\n[\s\S]*?^```$)/m)
    .map((part, i) => {
      if (i % 2) return part;
      let p = part;
      p = p.replace(/^import .*\n/gm, '');
      p = p.replace(/<LiveChart\b[\s\S]*?\/>\n?/g, '');
      p = p.replace(/<GaugeWorkshop\s*\/>\n?/g, '');
      p = p.replace(/<GridDemo\b[\s\S]*?\/>\n?/g, '');
      p = p.replace(/<OptionFacts [^>]*\/>/g, (tag) => (data ? facts(tag, data, words) : ''));
      p = p.replace(/<Aside[^>]*>\n?([\s\S]*?)<\/Aside>/g, (_, inner) => `> ${inner.trim().replace(/\n/g, '\n> ')}`);
      return absolute(p, slug);
    })
    .join('');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

const HEAD = [
  '# DzGraph',
  '',
  '> Charts for showing and exploring data, written from scratch in TypeScript: a pure core (`@dzgraph/core`: options and data in, a scene out, every series type), a DOM layer that draws it in SVG, Canvas or WebGL2 with each feature its own export (`@dzgraph/dom`), a CSS theme (`@dzgraph/theme`), an Angular wrapper (`@dzgraph/angular`) and bridges to DzTooltip and DzGrid. Accessible, right to left, time zones designed in. No runtime dependency.',
  '',
  `Only the names written in these pages exist; do not borrow option names from other chart libraries. A chart is made with \`chart(element, options, { types, features })\`: each series type (\`line\`, \`column\`…) and each feature (\`zoom\`, \`timeAxis\`…) is imported and given, or it is not there. Every series has an \`id\`. Days (\`YYYY-MM-DD\`) and instants (epoch milliseconds, or ISO text with an offset) are different things. Bad input never throws: it is reported as a \`Problem\` (\`code\`, \`path\`, \`detail\`). Every sample on the documentation site (${SITE}) is type-checked against the published types.`,
];

/** `{ 'llms.txt': text, 'llms-full.txt': text }` for the site under `root`. */
export async function build(root = ROOT) {
  // The words of the defaults written as tokens (Node strips the file's types).
  const { FACTS } = await import(pathToFileURL(join(root, 'website/src/i18n/facts.ts')).href);
  const read = (f) => readFileSync(join(root, f), 'utf8');
  const data = JSON.parse(read('website/src/generated/options.json'));
  const parts = sections(read('website/astro.config.mjs'), root).map((s) => ({
    ...s,
    pages: s.slugs.map((slug) => ({ slug, ...split(readFileSync(fileOf(root, slug), 'utf8')) })),
  }));
  const short = [...HEAD];
  for (const s of parts) {
    short.push('', `## ${s.title}`, '');
    for (const p of s.pages) if (!s.short || s.short.includes(p.slug)) short.push(`- [${p.title}](${SITE}${p.slug}/): ${p.description}`);
  }
  short.push(
    '',
    '## Optional',
    '',
    `- [The whole documentation in one file](${SITE}llms-full.txt): every page above and every option page, one after another`,
    `- [API reference](${SITE}api/): every public name of the six packages, with its declaration`,
    `- [Gallery](${SITE}gallery/): a live chart for each type and each way of exploring`,
    `- [Behaviour sheets](${BLOB}docs/behaviors/README.md): one sheet per behaviour, the reference the tests follow`,
  );
  const full = [...HEAD, '', `This file is the documentation site's English pages (${SITE}) in one piece, made by scripts/llms.mjs; do not edit it by hand.`];
  for (const s of parts) {
    for (const p of s.pages) full.push('', '---', '', `<!-- ${SITE}${p.slug}/ -->`, '', `# ${p.title}`, '', plain(p.body, p.slug, data, FACTS.en));
  }
  return { 'llms.txt': short.join('\n') + '\n', 'llms-full.txt': full.join('\n') + '\n' };
}

async function main() {
  const out = await build();
  const check = process.argv.includes('--check');
  let stale = false;
  for (const [file, text] of Object.entries(out)) {
    const path = join(ROOT, file);
    let now = null;
    try {
      now = readFileSync(path, 'utf8');
    } catch {
      /* missing */
    }
    if (now === text) continue;
    if (check) {
      console.error(`${file} is out of date: node scripts/llms.mjs`);
      stale = true;
    } else {
      writeFileSync(path, text);
      console.log(`${file}: ${Buffer.byteLength(text)} B`);
    }
  }
  if (stale) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
