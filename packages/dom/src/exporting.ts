/**
 * Export and printing (export.md, csv.md, print.md): the view as a picture without the controls — SVG as a
 * standalone document, PNG painted on a Canvas off screen, text included — the data as CSV, a download named after
 * the title, and printing in a hidden frame. Comes with the `exporting` module; nothing leaves the browser.
 */
import type { FontRole, Scene, TextMeasurer } from '@dzgraph/core';
import { sceneToSvg } from '@dzgraph/core';
import type { ChartLayout, ChartModel, SeriesType, View } from '@dzgraph/core/internal';
import { csvOf, exportScene } from '@dzgraph/core/internal';
import type { Messages } from './messages.js';
import { drawGroups } from './canvas-draw.js';
import { writeTable, xHeaderOf } from './table.js';

/** What an export reads from the chart, as it is now. */
export interface ExportState {
  readonly model: ChartModel;
  readonly types: readonly SeriesType[];
  /** The screen's layout: the CSV's columns read its piles, comparisons and slices. */
  readonly layout: ChartLayout;
  readonly view: View;
  readonly locale: string;
  readonly messages: Messages;
  readonly width: number;
  readonly height: number;
  readonly dir: 'ltr' | 'rtl';
  readonly measureText: TextMeasurer;
  readonly font: (role: FontRole) => string;
  /** The chart's root: colours are read inside it, under its theme. */
  readonly host: HTMLElement;
  /** What screen readers hear: the picture's description. */
  readonly summary: string;
  /** The rows the table shows (D.23): the CSV and the printed table follow it. */
  readonly rows: 'visible' | 'all';
}

export interface ExportOptions {
  /** A size of its own: the chart laid out again at it (export.md 4). */
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  /** The picture's colours; default: the app's `exporting.theme`, else as on screen (export.md 3). */
  readonly theme?: 'light' | 'dark' | undefined;
}

export interface PngOptions extends ExportOptions {
  /** Device pixels per CSS pixel; default: the screen's, at least 2 (export.md 5). */
  readonly scale?: number | undefined;
}

export type ExportFormat = 'png' | 'svg' | 'csv';

const ROLES: readonly FontRole[] = ['title', 'subtitle', 'axis-title', 'tick-label', 'legend', 'data-label'];
const MIME: Readonly<Record<ExportFormat, string>> = { png: 'image/png', svg: 'image/svg+xml', csv: 'text/csv;charset=utf-8' };

/**
 * The theme's colours as plain values any reader takes, under a colour scheme when one is asked: a probe inside the
 * chart (its variables, its scheme), read back through a 1×1 Canvas so `light-dark()` and `color-mix()` become plain
 * hexadecimal colours.
 */
function colourReader(host: HTMLElement, theme: 'light' | 'dark' | null): { readonly colour: (css: string) => string; readonly done: () => void } {
  const box = document.createElement('span');
  box.hidden = true;
  if (theme) box.style.colorScheme = theme;
  const probe = document.createElement('span');
  probe.className = 'dzgraph-probe';
  box.appendChild(probe);
  host.appendChild(box);
  const pixel = document.createElement('canvas');
  pixel.width = pixel.height = 1;
  const ctx = pixel.getContext('2d', { willReadFrequently: true });
  const seen = new Map<string, string>();
  const colour = (css: string) => {
    let c = seen.get(css);
    if (c !== undefined) return c;
    // The theme's `.dzgraph-probe` takes its colour from this variable (no colour written through style).
    probe.style.setProperty('--dzgraph-probe', css);
    c = getComputedStyle(probe).color;
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      // The theme's colour as bytes, written as hexadecimal (alpha only when not opaque): not a colour of ours.
      const bytes = [...ctx.getImageData(0, 0, 1, 1).data];
      if (bytes[3] === 255) bytes.pop();
      c = `#${bytes.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    }
    seen.set(css, c);
    return c;
  };
  return { colour, done: () => box.remove() };
}

/** A size or a scale given: a finite number above 0, else none (review 6: Infinity would lay out forever). */
const positive = (v: number | undefined) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined);

/** The picture's scene: the view without the controls, at the size asked. */
function sceneOf(st: ExportState, opts: ExportOptions): Scene {
  const width = positive(opts.width) ?? st.width;
  const height = positive(opts.height) ?? st.height;
  return exportScene({ model: st.model, types: st.types, width, height, dir: st.dir, measureText: st.measureText, text: st.messages, locale: st.locale, view: st.view }).scene;
}

const themeOf = (st: ExportState, opts: ExportOptions) => opts.theme ?? st.model.exporting.theme;

export function exportSvg(st: ExportState, opts: ExportOptions = {}): string {
  const scene = sceneOf(st, opts);
  const reader = colourReader(st.host, themeOf(st, opts));
  try {
    return sceneToSvg(scene, { color: reader.colour, font: st.font, title: st.model.title?.text ?? st.messages.chart, desc: st.summary, lang: st.locale, prefix: 'dzgraph-export' });
  } finally {
    reader.done();
  }
}

export async function exportPng(st: ExportState, opts: PngOptions = {}): Promise<Blob | null> {
  const scene = sceneOf(st, opts);
  const scale = positive(opts.scale) ?? Math.max(2, window.devicePixelRatio || 1);
  // Text in the page's fonts, once they are there (spike S2: load, never wait for an event).
  await Promise.all(ROLES.map((r) => document.fonts.load(st.font(r)).catch(() => [])));
  // Destroyed meanwhile: nothing to draw from (review 9).
  if (!st.host.isConnected) return null;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(scene.width * scale));
  cv.height = Math.max(1, Math.round(scene.height * scale));
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const reader = colourReader(st.host, themeOf(st, opts));
  try {
    // Every group, whatever its painter on screen: a picture is one plane (export.md 5).
    drawGroups(ctx, scene.layers.flatMap((l) => l.groups), { colour: reader.colour, font: st.font, dir: scene.dir });
  } finally {
    reader.done();
  }
  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}

export function exportCsv(st: ExportState, opts: { readonly locale?: boolean | undefined } = {}): string {
  return csvOf(st.model, st.layout, st.view, st.messages, st.rows, { xHeader: xHeaderOf(st.model, st.messages), locale: st.locale, local: opts.locale ?? st.model.exporting.csvLocale });
}

/**
 * The file's name (export.md 8): the app's, else the title's letters (with their marks) and digits joined by hyphens, else the word for a
 * chart; never a character a file system refuses.
 */
export function fileName(st: ExportState, format: ExportFormat): string {
  const given = st.model.exporting.filename?.replace(/[\\/:*?"<>|\p{Cc}]+/gu, '-').trim();
  const title = st.model.title?.text.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return `${given || title || st.messages.exporting.filename}.${format}`;
}

/** Gives the browser a file to save: a link to it, clicked, then let go. */
export async function download(st: ExportState, format: ExportFormat, opts: PngOptions = {}): Promise<void> {
  const blob = format === 'png' ? await exportPng(st, opts) : new Blob([format === 'svg' ? exportSvg(st, opts) : exportCsv(st)], { type: MIME[format] });
  if (!blob || !st.host.isConnected) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(st, format);
  a.hidden = true;
  st.host.appendChild(a);
  a.click();
  a.remove();
  // Some browsers start the download after the click returns: the link lives a little longer.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** How the printed page is laid out: the picture across the page's width, the table under it. No colour. */
const PRINT_CSS = '@page { margin: 1.5cm } body { margin: 0 } img { inline-size: 100%; block-size: auto; display: block; break-inside: avoid } table { border-collapse: collapse; margin-block-start: 1em; font: 10pt system-ui, sans-serif } th, td { padding: 2px 8px; text-align: start; border-block-end: 1px solid } caption { text-align: start; font-weight: 600; padding-block-end: 4px }';

/**
 * Prints the chart alone (print.md 1–2, 4): its picture in light colours — the SVG export as an image, never parsed
 * into the page — and, when asked, its table, in a hidden frame removed afterwards. The page, its view and its focus
 * are left as they were.
 */
export function print(st: ExportState, opts: { readonly table?: boolean | undefined } = {}): void {
  const url = URL.createObjectURL(new Blob([exportSvg(st, { theme: 'light' })], { type: MIME.svg }));
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', inlineSize: '0', blockSize: '0', border: '0', insetBlockStart: '0', insetInlineStart: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  const done = () => {
    frame.remove();
    URL.revokeObjectURL(url);
  };
  if (!doc || !win) return done();
  doc.documentElement.lang = st.locale;
  doc.documentElement.dir = st.dir;
  const style = doc.createElement('style');
  style.textContent = PRINT_CSS;
  doc.head.appendChild(style);
  const img = doc.createElement('img');
  img.alt = st.model.title?.text ?? st.messages.chart;
  img.src = url;
  doc.body.appendChild(img);
  if (opts.table) {
    const box = doc.createElement('div');
    writeTable(box, st.model, st.layout, st.view, st.locale, st.messages, st.rows);
    // In sight on paper, whether or not the screen shows it (review 1: the screen readers' copy is clipped).
    box.removeAttribute('class');
    box.removeAttribute('style');
    doc.body.appendChild(box);
  }
  // Once the picture is decoded (a failure prints what there is; a decoding that never ends, after 5 s, review 7).
  void Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 5000))])
    .then(() => {
      try {
        win.print();
      } finally {
        done();
      }
    });
}
