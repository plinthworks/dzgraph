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

export function writeTable(box: HTMLElement, model: ChartModel, layout: ChartLayout, view: View, locale: string, messages: Messages): void {
  const t = dataTable(model, layout, view, locale, messages);
  const table = document.createElement('table');
  table.className = 'dzgraph-table';
  const caption = document.createElement('caption');
  caption.textContent = model.title?.text ?? messages.tableCaption;
  // The x column's header: the axis's title, else a word for what x is (review 10).
  const xa = model.xAxes[0];
  const xHeader = xa?.title ?? (xa?.scale === 'category' ? messages.category : messages.xValue);
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
  // Shown, it is a `.dzgraph` too: it takes the theme's fonts and colours (review 12).
  if (model.dataTable) {
    box.className = 'dzgraph dzgraph-table-box';
    box.removeAttribute('style');
  } else {
    box.className = 'dzgraph-sr-only';
    hideVisually(box);
  }
}
