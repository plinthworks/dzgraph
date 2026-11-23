// DzGraph's documentation site: Astro Starlight, English at the root and French under /fr/ (owner, 2026-11-23).
// The library is read from source (../packages/*/src), so every page shows the current code. Taken from DzGrid's site.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

/**
 * Every entry the packages publish, read from their own `exports` (which point at `src/` in the repository):
 * `@dzgraph/dom/sparkline` → packages/dom/src/sparkline.ts. Exact matches, so no entry swallows a longer one, and a new
 * entry needs no line here. The theme's sheets are files of the package itself.
 */
function aliases() {
  const out = [];
  for (const dir of readdirSync(repo('packages'))) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(repo(`packages/${dir}/package.json`), 'utf8'));
    } catch {
      continue;
    }
    for (const [key, target] of Object.entries(manifest.exports ?? {})) {
      const file = typeof target === 'string' ? target : target.default;
      if (typeof file !== 'string') continue;
      const name = `${manifest.name}${key.slice(1)}`;
      out.push({ find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`), replacement: repo(`packages/${dir}/${file.slice(2)}`) });
    }
  }
  return out;
}

/** The guides, by task (batch 2), in reading order. */
/** The option pages' groups (options/<dir>/): the chart's keys, every series', each series type, an axis's, `chart()`'s setup, the features. */
export const OPTION_GROUPS = [
  ['chart', 'Chart', 'Graphique'],
  ['series', 'Series', 'Séries'],
  ['series-types', 'Series types', 'Types de séries'],
  ['axis', 'Axes', 'Axes'],
  ['setup', 'Setup', 'Création'],
  ['features', 'Features', 'Fonctions'],
];
export const GUIDES = ['data', 'series-types', 'axes-time', 'interactions', 'exploring', 'big-data', 'exporting', 'accessibility', 'theming-rtl', 'angular', 'dztooltip', 'dzgrid'];

export default defineConfig({
  site: 'https://plinthworks.github.io',
  base: '/dzgraph/',
  trailingSlash: 'always',
  // The playground holds 4750 (`npm run playground` at the root).
  server: { port: 4760 },
  integrations: [
    starlight({
      title: 'DzGraph',
      description: 'Charts for showing and exploring data, written from scratch in TypeScript: accessible, right to left, no dependency.',
      logo: { src: './src/assets/logo.svg', alt: '' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/plinthworks/dzgraph' }],
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' },
      },
      // The charts' theme on every page: its palette (--tz-*) is the site's accent too.
      customCss: ['@dzgraph/theme/dzgraph.css', './src/styles/custom.css'],
      sidebar: [
        { label: 'Getting started', translations: { fr: 'Prise en main' }, items: ['typescript', 'angular'].map((page) => ({ slug: `getting-started/${page}` })) },
        { label: 'Gallery', translations: { fr: 'Galerie' }, items: [{ autogenerate: { directory: 'gallery' } }] },
        { label: 'Guides', translations: { fr: 'Guides' }, items: GUIDES.map((page) => ({ slug: `guides/${page}` })) },
        // One page per option (batch 3): the overview, then a group per kind, each page's facts from the sources.
        {
          label: 'Options',
          translations: { fr: 'Options' },
          items: [
            { slug: 'options' },
            ...OPTION_GROUPS.map(([dir, label, fr]) => ({ label, translations: { fr }, collapsed: true, items: [{ autogenerate: { directory: `options/${dir}` } }] })),
          ],
        },
        // Generated from api/*.api.txt (batch 4).
        { label: 'API reference', translations: { fr: 'Référence de l’API' }, items: [{ autogenerate: { directory: 'api' } }] },
      ],
    }),
  ],
  vite: {
    resolve: { alias: aliases() },
    // The packages' sources live outside website/.
    server: { fs: { allow: [repo('')] } },
  },
});
