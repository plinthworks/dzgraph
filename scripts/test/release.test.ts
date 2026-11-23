// @vitest-environment node
// The release check (scripts/release.mjs, `npm run release:check`; Phase 8b): what stops a release, on planted manifests.
import { describe, it, expect } from 'vitest';
// @ts-expect-error a plain .mjs script
import { mapProblems, releaseProblems, typingProblems, toPublish, ORDER } from '../release.mjs';

const ANGULAR = '^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0';
/** A published manifest, as JSON. */
type Manifest = Record<string, unknown>;
const base = (name: string, extra: Manifest = {}): Manifest => ({
  name,
  version: '1.0.0',
  license: 'MIT',
  keywords: ['chart'],
  repository: { type: 'git', url: 'git+https://github.com/plinthworks/dzgraph.git' },
  exports: { '.': { types: './index.d.ts', default: './index.js' } },
  ...extra,
});
const good = (): Record<string, Manifest> => ({
  '@dzgraph/core': base('@dzgraph/core', { exports: { '.': { types: './index.d.ts', default: './index.js' }, './sparkline': { types: './sparkline.d.ts', default: './sparkline.js' } } }),
  '@dzgraph/theme': base('@dzgraph/theme', { exports: { './dzgraph.css': './dzgraph.css' } }),
  '@dzgraph/dom': base('@dzgraph/dom', { dependencies: { '@dzgraph/core': '^1.0.0' } }),
  '@dzgraph/dztooltip': base('@dzgraph/dztooltip', { dependencies: { '@dzgraph/dom': '^1.0.0' }, peerDependencies: { '@dztooltip/core': '^1.0.0' } }),
  '@dzgraph/dzgrid': base('@dzgraph/dzgrid', { dependencies: { '@dzgraph/dom': '^1.0.0' } }),
  '@dzgraph/angular': base('@dzgraph/angular', { dependencies: { '@dzgraph/core': '^1.0.0', '@dzgraph/dom': '^1.0.0', tslib: '^2.8.1' }, peerDependencies: { '@angular/core': ANGULAR, '@angular/common': ANGULAR } }),
});

describe('release check (scripts/release.mjs)', () => {
  it('passes six coherent manifests; publishes dependencies first', () => {
    expect(releaseProblems(good())).toEqual([]);
    expect(ORDER).toEqual(['core', 'theme', 'dom', 'dztooltip', 'dzgrid', 'angular']);
    expect(toPublish('1.0.0', { core: ['1.0.0'] })).toEqual(['theme', 'dom', 'dztooltip', 'dzgrid', 'angular']);
  });

  it('stops a version apart, a prerelease, a manifest pointing at src/, a runtime dependency, a peer range', () => {
    const m = good();
    m['@dzgraph/dom'] = { ...m['@dzgraph/dom'], version: '0.9.0' };
    m['@dzgraph/dzgrid'] = { ...m['@dzgraph/dzgrid'], dependencies: { '@dzgraph/dom': '^1.0.0', lodash: '^4' } };
    m['@dzgraph/dztooltip'] = { ...m['@dzgraph/dztooltip'], peerDependencies: { '@dztooltip/core': '*' } };
    m['@dzgraph/theme'] = { ...m['@dzgraph/theme'], exports: { './dzgraph.css': './src/dzgraph.css' } };
    expect(releaseProblems(m)).toEqual([
      '@dzgraph/theme points at src/',
      '@dzgraph/dom is 0.9.0, not 1.0.0',
      '@dzgraph/dztooltip asks @dztooltip/core *, not ^1.0.0',
      '@dzgraph/dzgrid has a runtime dependency lodash',
    ]);
    const pre = good();
    for (const k of Object.keys(pre)) pre[k] = { ...pre[k], version: '1.0.0-rc.1' };
    expect(releaseProblems(pre)).toContain('1.0.0-rc.1 is a prerelease: run npm run build');
  });

  it('stops a file the exports name that is not packed, and a package without README or LICENSE', () => {
    const has = (name: string, f: string) => !(name === '@dzgraph/core' && (f === './sparkline.js' || f === 'LICENSE'));
    expect(releaseProblems(good(), has)).toEqual(['@dzgraph/core: ./sparkline.js is not in the package', '@dzgraph/core has no LICENSE']);
  });

  it('stops typings importing an entry a package does not publish', () => {
    const files = [['packages/dom/dist/chart.d.ts', "import type { Scene } from '@dzgraph/core/internal';\nimport type { X } from '@dzgraph/core';"]];
    expect(typingProblems(good(), files)).toEqual(['packages/dom/dist/chart.d.ts imports @dzgraph/core/internal, which is not a published entry']);
  });

  it('stops a source map whose sources are not in the package (an app\'s bundler would warn)', () => {
    const files = [
      ['packages/core/dist/svg.js.map', JSON.stringify({ version: 3, sources: ['../src/svg.ts'], mappings: 'AAAA' })],
      ['packages/core/dist/time.js.map', JSON.stringify({ version: 3, sources: ['../src/time.ts'], sourcesContent: ['export {};'], mappings: 'AAAA' })],
    ];
    expect(mapProblems(files)).toEqual(['packages/core/dist/svg.js.map names ../src/svg.ts, which is not in the package']);
  });
});
