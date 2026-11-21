// Compiles @dzgraph/theme: dzgraph.scss → dzgraph.css (layer dzgraph.theme) and dzgraph.unlayered.css. A test fails
// when the committed CSS drifts from the source (scripts/test/theme.test.ts). Taken from DzTooltip's (our own code).
import { compileString } from 'sass';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../packages/theme/', import.meta.url));
const source = readFileSync(`${dir}dzgraph.scss`, 'utf8');
export const compile = (layered) => compileString(`$layered: ${layered};\n${source}`, { style: 'expanded', loadPaths: [dir] }).css + '\n';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(`${dir}dzgraph.css`, compile(true));
  writeFileSync(`${dir}dzgraph.unlayered.css`, compile(false));
  console.log('Built: packages/theme/dzgraph.css, dzgraph.unlayered.css');
}
