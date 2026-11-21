// S2: what measuring axis labels costs (Canvas measureText vs SVG vs a span), whether they agree, and what happens
// when the font arrives late.
import { prng } from '../lib/data.ts';

const r = prng(7);
const words = ['Électricité', 'Consommation', 'Prévision', 'Écart', 'مبيعات', 'Total général', 'Q3', 'N-1'];
const nf = new Intl.NumberFormat('fr-FR');
const df = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const labels: string[] = [];
for (let i = 0; i < 1000; i++) {
  const k = i % 3;
  labels.push(k === 0 ? nf.format(Math.round((r() - 0.3) * 10 ** (1 + Math.floor(r() * 7)))) : k === 1 ? df.format(r() * 2e12) : words[i % words.length]!);
}

function measureAll(font: string, family: string) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = font;
  const t = document.getElementById('t') as unknown as SVGTextElement;
  t.setAttribute('style', `font:${font}`);
  const span = document.getElementById('span')!;
  span.style.font = font;
  const time = (f: (s: string) => number) => {
    const out = new Float64Array(labels.length);
    const t0 = performance.now();
    for (let i = 0; i < labels.length; i++) out[i] = f(labels[i]!);
    return { ms: +(performance.now() - t0).toFixed(2), out };
  };
  const canvas = time((s) => ctx.measureText(s).width);
  const svg = time((s) => { t.textContent = s; return t.getComputedTextLength(); });
  const bbox = time((s) => { t.textContent = s; return t.getBBox().width; });
  const dom = time((s) => { span.textContent = s; return span.getBoundingClientRect().width; });
  let maxDiffSvg = 0;
  let maxDiffDom = 0;
  for (let i = 0; i < labels.length; i++) {
    maxDiffSvg = Math.max(maxDiffSvg, Math.abs(canvas.out[i]! - svg.out[i]!));
    maxDiffDom = Math.max(maxDiffDom, Math.abs(canvas.out[i]! - dom.out[i]!));
  }
  const m = ctx.measureText('Hg');
  return {
    family,
    ms: { canvas: canvas.ms, svgComputedLength: svg.ms, svgBBox: bbox.ms, span: dom.ms },
    maxDiffPx: { svg: +maxDiffSvg.toFixed(3), span: +maxDiffDom.toFixed(3) },
    metrics: { fontAscent: m.fontBoundingBoxAscent, fontDescent: m.fontBoundingBoxDescent, actualAscent: +m.actualBoundingBoxAscent.toFixed(2) },
    sample: +canvas.out[0]!.toFixed(2),
    widths: canvas.out,
  };
}

(window as any).run = async () => {
  const sys = measureAll('12px system-ui, sans-serif', 'system-ui');
  // A font declared but not yet loaded: Canvas measures the fallback.
  const buf = await (await fetch('./fonts/Verdana.ttf')).arrayBuffer();
  const face = new FontFace('Late', buf);
  let loadingDone = false;
  document.fonts.addEventListener('loadingdone', () => { loadingDone = true; });
  const before = measureAll('12px Late, serif', 'Late (not loaded)');
  document.fonts.add(face);
  await face.load();
  await document.fonts.ready;
  const after = measureAll('12px Late, serif', 'Late (loaded)');
  let changed = 0;
  for (let i = 0; i < labels.length; i++) if (Math.abs(before.widths[i]! - after.widths[i]!) > 0.5) changed++;
  const strip = ({ widths, ...rest }: ReturnType<typeof measureAll>) => (void widths, rest);
  return { systemUi: strip(sys), lateBefore: strip(before), lateAfter: strip(after), labelsChangedByLateFont: changed, loadingDoneEvent: loadingDone };
};
(window as any).ready = true;
