/**
 * The data table (data-table.md): after the chart, hidden from sight for screen readers, or shown under it with
 * `dataTable: true`. Its content is the core's (`dataTable`, from the raw `dataRows`); this writes it as HTML text.
 */
import type { ChartLayout, ChartModel, View } from '@dzgraph/core/internal';
import { dataTable } from '@dzgraph/core/internal';
import type { Messages } from './messages.js';

/** Out of sight, still read by screen readers. */
export function hideVisually(el: HTMLElement): void {
  Object.assign(el.style, { position: 'absolute', inlineSize: '1px', blockSize: '1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' });
}

export function writeTable(box: HTMLElement, model: ChartModel, layout: ChartLayout, view: View, locale: string, messages: Messages, which: 'visible' | 'all' = 'visible', toggle?: () => void): void {
  const t = dataTable(model, layout, view, locale, messages, which);
  const table = document.createElement('table');
  table.className = 'dzgraph-table';
  const caption = document.createElement('caption');
  const name = model.title?.text ?? messages.tableCaption;
  // Zoomed, the caption says which part it shows (data-table.md 5).
  caption.textContent = t.range ? `${name} (${messages.tableRange(t.range.from, t.range.to)})` : name;
  // The x column's header: the axis's title, else a word for what x is (review 10).
  const xa = model.xAxes[0];
  // A polar chart's rows are its named points (slices): categories, whatever its unused x axis says.
  const xHeader = model.system === 'polar' ? messages.category : (xa?.title ?? (xa?.scale === 'category' ? messages.category : messages.xValue));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const name of [xHeader, ...t.columns]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = name;
    hr.appendChild(th);
  }
  head.appendChild(hr);
  const body = document.createElement('tbody');
  for (const row of t.rows) {
    const tr = document.createElement('tr');
    row.forEach((cell, i) => {
      const c = document.createElement(i === 0 ? 'th' : 'td');
      if (c instanceof HTMLTableCellElement && i === 0) c.scope = 'row';
      c.textContent = cell;
      tr.appendChild(c);
    });
    body.appendChild(tr);
  }
  if (t.omitted) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = t.columns.length + 1;
    td.textContent = messages.rowsOmitted(new Intl.NumberFormat(locale).format(t.omitted));
    tr.appendChild(td);
    body.appendChild(tr);
  }
  table.append(caption, head, body);
  box.replaceChildren(table);
  // Zoomed, a button switches between the visible range and all the data (data-table.md 5, D.23).
  const zoomed = model.xAxes[0] !== undefined && view.range?.[model.xAxes[0].id] !== undefined;
  if (zoomed && toggle) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dzgraph-table-range';
    b.textContent = which === 'all' ? messages.tableVisible : messages.tableAll;
    b.addEventListener('click', toggle);
    box.appendChild(b);
  }
  // Shown, it is a `.dzgraph` too: it takes the theme's fonts and colours (review 12).
  if (model.dataTable) {
    box.className = 'dzgraph dzgraph-table-box';
    box.removeAttribute('style');
  } else {
    box.className = 'dzgraph-sr-only';
    hideVisually(box);
  }
}
