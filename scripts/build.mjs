/**
 * Builds every package into its own dist/, ready for `npm publish dist` (the owner publishes). The repository's
 * manifests point at TypeScript sources (the workspace and the tests use them); each dist/ gets a manifest written
 * here from the source one. Refuses a manifest pointing at src/, and any runtime dependency outside @dzgraph/*.
 * Layout taken from DzTooltip's scripts/build.mjs (our own code).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = (name) => join(root, 'packages', name);
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

/** What every published manifest carries: the licence, the keywords, where the code and its issues live. */
const shared = (name) => ({
  license: 'MIT',
  author: 'Plinthworks',
  keywords: ['chart', 'charts', 'data-visualization', 'svg', 'canvas', 'rtl', 'accessibility', 'no-dependency'],
  repository: { type: 'git', url: 'git+https://github.com/plinthworks/dzgraph.git', directory: `packages/${name}` },
  homepage: 'https://github.com/plinthworks/dzgraph#readme',
  bugs: { url: 'https://github.com/plinthworks/dzgraph/issues' },
});

/** The workspace's own packages, pinned to the versions being built together. */
const internal = (deps = {}) =>
  Object.fromEntries(Object.entries(deps).map(([n, v]) => (n.startsWith('@dzgraph/') ? [n, `^${read(join(pkg(n.slice(9)), 'package.json')).version}`] : [n, v])));

function extras(name) {
  for (const file of ['README.md', 'LICENSE']) {
    const own = join(pkg(name), file);
    const source = existsSync(own) ? own : existsSync(join(root, file)) ? join(root, file) : null;
    if (source) cpSync(source, join(pkg(name), 'dist', file));
  }
}

function typescript(name) {
  const dir = pkg(name);
  rmSync(join(dir, 'dist'), { recursive: true, force: true });
  run('npx', ['tsc', '-p', join(dir, 'tsconfig.build.json')]);
  const source = read(join(dir, 'package.json'));
  const exports = Object.fromEntries(
    Object.keys(source.exports)
      .filter((k) => k !== './package.json')
      .map((k) => {
        const base = k === '.' ? 'index' : k.slice(2);
        return [k, { types: `./${base}.d.ts`, default: `./${base}.js` }];
      }),
  );
  const manifest = {
    name: source.name,
    version: source.version,
    description: source.description,
    ...shared(name),
    type: 'module',
    sideEffects: false,
    main: './index.js',
    module: './index.js',
    types: './index.d.ts',
    exports: { ...exports, './package.json': './package.json' },
    ...(source.dependencies ? { dependencies: internal(source.dependencies) } : {}),
    ...(source.peerDependencies ? { peerDependencies: source.peerDependencies } : {}),
  };
  writeFileSync(join(dir, 'dist', 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  extras(name);
}

function theme() {
  const dir = pkg('theme');
  rmSync(join(dir, 'dist'), { recursive: true, force: true });
  mkdirSync(join(dir, 'dist'));
  if (existsSync(join(root, 'scripts/build-theme.mjs'))) run('node', ['scripts/build-theme.mjs']);
  const source = read(join(dir, 'package.json'));
  for (const file of source.files) if (existsSync(join(dir, file))) cpSync(join(dir, file), join(dir, 'dist', file));
  const { files: _files, ...manifest } = source;
  writeFileSync(join(dir, 'dist', 'package.json'), JSON.stringify({ ...manifest, ...shared('theme') }, null, 2) + '\n');
  extras('theme');
}

function angular() {
  const dir = pkg('angular');
  rmSync(join(dir, 'dist'), { recursive: true, force: true });
  run('npx', ['ng-packagr', '-p', 'ng-package.json', '-c', 'tsconfig.lib.json'], dir);
  const file = join(dir, 'dist', 'package.json');
  const manifest = read(file);
  delete manifest.main;
  delete manifest.types;
  Object.assign(manifest, shared('angular'));
  manifest.dependencies = internal(manifest.dependencies);
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  extras('angular');
}

// Order matters: the DOM layer compiles against the core's declarations, Angular against both.
typescript('core');
typescript('dom');
typescript('dztooltip');
typescript('dzgrid');
angular();
theme();

let bad = 0;
for (const name of ['core', 'dom', 'angular', 'theme', 'dztooltip', 'dzgrid']) {
  const m = read(join(pkg(name), 'dist', 'package.json'));
  if (JSON.stringify(m).includes('src/')) {
    console.error(`packages/${name}/dist/package.json still points at src/`);
    bad++;
  }
  // tslib is the one dependency Angular's compiled output needs (DzTooltip's angular package has it too).
  const foreign = Object.keys(m.dependencies ?? {}).filter((d) => !d.startsWith('@dzgraph/') && !(name === 'angular' && d === 'tslib'));
  if (foreign.length) {
    console.error(`@dzgraph/${name} has a runtime dependency (${foreign.join(', ')}): it must have none`);
    bad++;
  }
}
if (Object.keys(read(join(pkg('core'), 'dist', 'package.json')).dependencies ?? {}).length) {
  console.error('@dzgraph/core depends on another package: it must depend on none');
  bad++;
}
if (bad) process.exit(1);
console.log('\nBuilt: packages/{core,dom,angular,theme,dztooltip,dzgrid}/dist');
