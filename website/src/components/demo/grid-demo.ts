/**
 * The DzGrid guide's live demos (owner 2026-11-27: « un vrai exemple pour utiliser dzgrid »): a real DzGrid grid beside
 * a real chart, joined by the bridge as the page's examples show it. Loaded only when a demo comes near the screen.
 *
 * - `link`: the chart drawn from the rows (the first text column names the points, the first number column is the
 *   series, each point's key its row's id), then `linkGrid()`: ticking rows selects points, selecting points ticks rows.
 * - `from-grid`: an empty chart filled by `chartFromGrid()` from the grid's block of cells, else its rows ticked. The
 *   whole table is the first block, so the chart starts full; the reader then drags another.
 *
 * The words (title, headers, rows) are the page's, in its language; the grid's own words are DzGrid's English or French.
 */
import { column, line } from '@dzgraph/core';
import { chart, selection, type Chart } from '@dzgraph/dom';
import { chartFromGrid, linkGrid } from '@dzgraph/dzgrid';
import { dataKey } from '@dzgrid/core';
import { createGrid } from '@dzgrid/dom';
import { EN } from '@dzgrid/dom/locales/en';
import { EN_RANGE } from '@dzgrid/dom/locales/en-range';
import { FR } from '@dzgrid/dom/locales/fr';
import { FR_RANGE } from '@dzgrid/dom/locales/fr-range';
import { range } from '@dzgrid/dom/range';

type Cell = string | number;
type Row = Readonly<Record<string, Cell>> & { readonly id: string };
export interface GridDemoSpec {
  readonly kind: 'link' | 'from-grid';
  readonly title: string;
  readonly columns: readonly { readonly id: string; readonly header: string; readonly type?: 'number' }[];
  readonly rows: readonly Row[];
}

/** The grid's words in the page's language, the block's included. */
const wordsOf = (lang: string) => (lang === 'fr' ? { ...FR, text: { ...FR.text, ...FR_RANGE.text } } : { ...EN, text: { ...EN.text, ...EN_RANGE.text } });

/** Makes the demo in its two hosts; returns what takes it down. */
export function mountGridDemo(gridHost: HTMLElement, chartHost: HTMLElement, spec: GridDemoSpec, lang: string): () => void {
  const blocks = range();
  const grid = createGrid<Row>(gridHost, {
    rows: spec.rows,
    getRowId: (r) => r.id,
    messages: wordsOf(lang),
    // The columns share the half page the grid has (150 px each by default would hide the numbers).
    columns: spec.columns.map((c) => ({ id: c.id, header: c.header, ...(c.type ? { type: c.type } : {}), flex: 1, minWidth: 72 })),
    selection: { mode: 'multi', checkbox: true },
    features: spec.kind === 'from-grid' ? [blocks] : [],
  });

  let c: Chart;
  let stop: () => void;
  if (spec.kind === 'link') {
    const name = spec.columns.find((col) => !col.type)!;
    const value = spec.columns.find((col) => col.type === 'number')!;
    c = chart(
      chartHost,
      {
        title: { text: spec.title },
        selection: true,
        xAxis: { scale: 'category', categories: spec.rows.map((r) => String(r[name.id])) },
        series: [{ type: 'column', id: value.id, name: value.header, data: spec.rows.map((r) => ({ x: String(r[name.id]), y: Number(r[value.id]), key: r.id })) }],
      },
      { types: [column], features: [selection] },
    );
    stop = linkGrid(c, grid);
  } else {
    c = chart(chartHost, { title: { text: spec.title }, series: [] }, { types: [column, line] });
    stop = chartFromGrid(c, grid, { range: blocks });
    // The whole table as the first block: the chart starts with what a reader would select first.
    const first = dataKey(spec.rows[0]!.id);
    const last = dataKey(spec.rows[spec.rows.length - 1]!.id);
    if (first && last) blocks.api(grid)?.set({ anchor: { row: first, column: spec.columns[0]!.id }, focus: { row: last, column: spec.columns[spec.columns.length - 1]!.id } });
  }
  return () => {
    stop();
    c.destroy();
    grid.destroy();
  };
}
