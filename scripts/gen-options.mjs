/**
 * `node scripts/gen-options.mjs`: website/src/generated/options.json, the facts of every option, read from the sources
 * (docs/phase-9-steps/plan.md, batch 3: the facts generated, the text written; taken from DzGrid's gen-options, our own
 * code). Per key: the type as written, whether it is required, its default (the comment's `@default`: a code literal
 * between backticks, or a `{token}` the site words in each language), the feature it needs (`@feature`, checked
 * against the chart's own `missing-module` problems by packages/dom/test/option-facts.test.ts), where it is declared.
 *
 *   chart        the keys of `ChartOptions`
 *   series       the keys every series has (`SeriesBase`)
 *   seriesTypes  each series type: its entry, its system, its own keys
 *   axis         the keys of an axis, each with the scales it applies to
 *   setup        the keys of `chart()`'s third argument (`ChartSetup`), with the `<dz-chart>` input of the same name
 *   features     each feature of `@dzgraph/dom`: the features it brings, the options that need it
 *
 * `--check` fails when the file differs from what the sources give.
 */
import ts from 'typescript';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const OUT = join(root, 'website', 'src', 'generated', 'options.json');
const at = (p) => join(root, p);
const OPTIONS = at('packages/core/src/options.ts');
const SETUP = at('packages/dom/src/chart.ts');
const FEATURES = at('packages/dom/src/features.ts');
const ANGULAR = at('packages/angular/src/chart.component.ts');
/** The series types, one page each: the type's name, its options interface, its file. */
const SERIES_TYPES = [
  ['line', 'LineSeriesOptions', 'line'], ['area', 'AreaSeriesOptions', 'area'], ['column', 'ColumnSeriesOptions', 'column'],
  ['bar', 'BarSeriesOptions', 'column'], ['scatter', 'ScatterSeriesOptions', 'scatter'], ['pie', 'PieSeriesOptions', 'pie'],
  ['donut', 'DonutSeriesOptions', 'pie'], ['gauge', 'GaugeSeriesOptions', 'gauge'],
];
/** An axis's interfaces, by the scale they describe; `AxisBase` holds for all four. */
const SCALES = [['linear', 'LinearAxisOptions'], ['log', 'LogAxisOptions'], ['category', 'CategoryAxisOptions'], ['time', 'TimeAxisOptions']];

const sources = new Map();
function parse(file) {
  if (!sources.has(file)) sources.set(file, ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true));
  return sources.get(file);
}
function iface(file, name) {
  const src = parse(file);
  const found = src.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === name);
  if (!found) throw new Error(`gen-options: no interface ${name} in ${relative(root, file)}`);
  return found;
}
const source = (file, node) => {
  const src = parse(file);
  return `${relative(root, file)}#L${src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1}`;
};
/** The JSDoc tags we read: `@default` (a `code` literal or a `{token}`) and `@feature`. */
function tags(file, node) {
  const text = parse(file).text;
  const comments = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  const doc = comments.map((c) => text.slice(c.pos, c.end)).filter((c) => c.startsWith('/**')).at(-1) ?? '';
  const d = /@default\s+(?:`([^`]+)`|\{(\w+)\})/.exec(doc);
  if (/@default/.test(doc) && !d) throw new Error(`gen-options: a @default neither \`code\` nor {token} at ${source(file, node)}`);
  const f = /@feature\s+(\w+)/.exec(doc);
  return { default: d ? (d[1] !== undefined ? { code: d[1] } : { token: d[2] }) : null, feature: f ? f[1] : null };
}
/** An interface's own keys, as written. */
function members(file, name) {
  return iface(file, name).members.filter(ts.isPropertySignature).map((m) => ({
    name: m.name.getText(),
    type: m.type ? m.type.getText().replace(/\s+/g, ' ').replace(/ \| undefined\b/g, '') : 'unknown',
    required: !m.questionToken,
    ...tags(file, m),
    source: source(file, m),
  }));
}

/** Each series type: its keys beyond `SeriesBase`, its own interfaces included (`PieBase`). */
function seriesTypes() {
  return SERIES_TYPES.map(([name, options, file]) => {
    const path = at(`packages/core/src/series/${file}.ts`);
    const decl = iface(path, options);
    const extra = (decl.heritageClauses ?? []).flatMap((h) => h.types.map((t) => t.expression.getText())).filter((n) => n !== 'SeriesBase');
    const own = [...extra.flatMap((n) => members(path, n)), ...members(path, options)];
    const registration = parse(path).statements.find((s) => ts.isVariableStatement(s) && s.declarationList.declarations[0].name.getText() === name);
    if (!registration) throw new Error(`gen-options: no series type ${name} in ${relative(root, path)}`);
    const system = /system: '(\w+)'/.exec(registration.getText())?.[1];
    return { name, entry: '@dzgraph/core', options, system, keys: own, source: source(path, registration) };
  });
}

/** The keys of an axis, each with the scales it holds for (and its type there). */
function axis() {
  const keys = new Map();
  const add = (scale, m) => {
    const k = keys.get(m.name) ?? { name: m.name, default: null, feature: null, scales: [], source: m.source };
    // `stacking?: undefined` on a log axis says it is not there: not a scale of the key.
    if (m.type !== 'undefined') k.scales.push({ scale, type: m.type, ...(m.feature ? { feature: m.feature } : {}) });
    k.default ??= m.default;
    keys.set(m.name, k);
  };
  const base = members(OPTIONS, 'AxisBase');
  for (const [scale, name] of SCALES) {
    for (const m of base) add(scale, m);
    for (const m of members(OPTIONS, name)) add(scale, m);
  }
  // A key's feature, when every scale it needs one on agrees (`aggregate`); a scale's own otherwise (`scale: 'time'`).
  return [...keys.values()].map((k) => {
    const needs = [...new Set(k.scales.flatMap((s) => (s.feature ? [s.feature] : [])))];
    const all = needs.length === 1 && k.scales.every((s) => s.feature === needs[0] || s.scale === 'category' || s.scale === 'log');
    return { ...k, feature: all ? needs[0] : null };
  });
}

/** `chart()`'s setup, with the `<dz-chart>` input of the same name and its default there. */
function setup() {
  const cls = parse(ANGULAR).statements.find((s) => ts.isClassDeclaration(s) && s.name?.text === 'DzChart');
  const inputs = new Map(cls.members.filter((m) => ts.isPropertyDeclaration(m) && m.initializer && /^input\b/.test(m.initializer.getText())).map((m) => {
    const args = ts.isCallExpression(m.initializer) ? m.initializer.arguments : [];
    return [m.name.getText(), args.length ? args[0].getText() : null];
  }));
  return members(SETUP, 'ChartSetup').map((m) => ({ ...m, angular: inputs.has(m.name), angularDefault: inputs.get(m.name) ?? null }));
}

/** Each feature: the features it brings (`needs`), the options that need it. */
function features(options) {
  const src = parse(FEATURES);
  const list = [];
  for (const s of src.statements) {
    if (!ts.isVariableStatement(s) || !s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const d = s.declarationList.declarations[0];
    if (d.type?.getText() !== 'Feature') continue;
    const name = d.name.getText();
    const needs = /needs: \[([^\]]*)\]/.exec(d.initializer.getText())?.[1].split(',').map((x) => x.trim()).filter(Boolean) ?? [];
    list.push({ name, needs, source: source(FEATURES, s) });
  }
  const enabled = (name) => [
    ...options.chart.filter((o) => o.feature === name).map((o) => ({ section: 'chart', name: o.name })),
    ...options.series.filter((o) => o.feature === name).map((o) => ({ section: 'series', name: o.name })),
    ...options.axis.flatMap((o) => (o.feature === name ? [{ section: 'axis', name: o.name }] : o.scales.filter((s) => s.feature === name).map((s) => ({ section: 'axis', name: o.name, scale: s.scale })))),
  ];
  return list.map((f) => ({ ...f, enables: enabled(f.name) }));
}

export function generate() {
  sources.clear();
  const options = { chart: members(OPTIONS, 'ChartOptions'), series: members(OPTIONS, 'SeriesBase'), seriesTypes: seriesTypes(), axis: axis(), setup: setup() };
  return { ...options, features: features(options) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const text = JSON.stringify(generate(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    let old = '';
    try {
      old = readFileSync(OUT, 'utf8');
    } catch {}
    if (old !== text) {
      console.error(`${relative(root, OUT)} is out of date: node scripts/gen-options.mjs`);
      process.exit(1);
    }
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, text);
    console.log(`wrote ${relative(root, OUT)}`);
  }
}
