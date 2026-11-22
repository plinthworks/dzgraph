/**
 * Angular 19 to 22 (angular.md 6, ARCHITECTURE §1): the built `@dzgraph/angular`, with `core` and `dom`, compiled in a
 * fresh app of each major by that major's own compiler (`ngc`, strict templates). Needs the network (npm); not in the
 * gate — run at a phase close and before a release: `npm run build && node scripts/angular-compat.mjs [19 20 21 22]`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const majors = process.argv.slice(2).length ? process.argv.slice(2) : ['19', '20', '21', '22'];
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

// The packages as an app installs them: packed from their dist/.
const packed = mkdtempSync(join(tmpdir(), 'dzgraph-packed-'));
for (const p of ['core', 'dom', 'angular']) run('npm', ['pack', '--pack-destination', packed], join(root, 'packages', p, 'dist'));
const tarballs = readdirSync(packed).map((f) => join(packed, f));

const APP = `import { Component, signal } from '@angular/core';
import { DzChart, DzSparkline } from '@dzgraph/angular';
import type { ChartOptions } from '@dzgraph/core';

@Component({
  selector: 'app-root',
  imports: [DzChart, DzSparkline],
  template: \`<dz-chart [options]="options()" (pointClick)="clicked = $event.seriesId" (drill)="path = $event.path" (viewChange)="changed = $event.changed" />
<dz-sparkline [values]="values()" [options]="{ type: 'area', label: 'Visits' }" />\`,
})
export class App {
  readonly options = signal<ChartOptions>({ series: [{ type: 'line', data: [1, 2, 3] }] });
  readonly values = signal<readonly number[]>([1, 5, 4]);
  clicked = '';
  path: readonly string[] = [];
  changed: readonly string[] = [];
}
`;

let failed = 0;
for (const major of majors) {
  const dir = mkdtempSync(join(tmpdir(), `dzgraph-ng${major}-`));
  try {
    // The newest TypeScript that major's compiler takes (its peer range).
    // Asked for a major, npm answers per version: the last is the newest.
    const range = [JSON.parse(run('npm', ['view', `@angular/compiler-cli@${major}`, 'peerDependencies', '--json'], dir))].flat().at(-1).typescript;
    const versions = JSON.parse(run('npm', ['view', `typescript@${range}`, 'version', '--json'], dir));
    const typescript = [versions].flat().filter((v) => !v.includes('-')).at(-1);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `compat-${major}`, private: true, type: 'module' }));
    const ng = ['core', 'common', 'compiler', 'compiler-cli', 'platform-browser'].map((p) => `@angular/${p}@${major}`);
    run('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps', ...ng, 'rxjs@7', 'tslib@2', `typescript@${typescript}`, ...tarballs], dir);
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'app.ts'), APP);
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'ES2022', moduleResolution: 'bundler', strict: true, skipLibCheck: false, lib: ['ES2023', 'DOM', 'DOM.Iterable'], outDir: 'out', rootDir: 'src', declaration: false, useDefineForClassFields: false },
        files: ['src/app.ts'],
        angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true },
      }),
    );
    const version = run('node', ['-e', "console.log(require('@angular/core/package.json').version)"], dir).trim();
    run('npx', ['ngc', '-p', 'tsconfig.json'], dir);
    console.log(`ok   Angular ${version} (TypeScript ${typescript})`);
  } catch (e) {
    failed++;
    console.error(`FAIL Angular ${major}\n${e.stdout ?? ''}${e.stderr ?? e.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
rmSync(packed, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
