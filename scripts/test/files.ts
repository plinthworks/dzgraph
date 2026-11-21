// The repository's files, for the guards. Skips what nobody writes (dependencies, builds, spike outputs).
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage', 'results', 'fonts', 'packed']);

export function* walk(dir: string, ext: RegExp): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p, ext);
    else if (ext.test(name)) yield p;
  }
}

export const rel = (p: string): string => p.slice(ROOT.length).split('\\').join('/');
