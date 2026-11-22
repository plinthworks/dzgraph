// Export and printing in a real browser (export.md, csv.md, print.md): the view as SVG and PNG without the controls,
// colours as on screen or forced, the data as CSV, the file's name, printing in a hidden frame, the menu's entries.
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { commands } from 'vitest/browser';
import { canvas, chart, exporting, menu, navigatorStrip, timeAxis, zoom, type Chart, type Feature } from '@dzgraph/dom';

// The theme's built CSS: the colours an export reads are the theme's, as on screen.
let theme: HTMLStyleElement;
beforeAll(async () => {
  theme = document.createElement('style');
  theme.textContent = (await import('../../theme/dzgraph.css?raw')).default;
  document.head.appendChild(theme);
});
afterAll(() => theme.remove());

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1], features: readonly Feature[] = [exporting], lang = 'en') {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = lang;
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features });
  made.push({ el, c });
  return { el, c };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
  document.documentElement.removeAttribute('data-theme');
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const LINES = { title: 'Fruit sales 2026!', series: [{ type: 'line' as const, id: 'a', name: 'Apples', data: [1, 2, 3] }, { type: 'line' as const, id: 'b', name: 'Pears', data: [3, 2, 1] }] };
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
/** The chart's background as the export painted it. */
const background = (svg: string) => parse(svg).querySelector('[data-layer="background"] rect')!.getAttribute('fill');

describe('SVG (export.md 1–2, 4, 6)', () => {
  it('a standalone picture: role img, title, the summary as description, colours and fonts as values', async () => {
    const { el, c } = mount(LINES);
    await raf2();
    const svg = c.exportSvg()!;
    const doc = parse(svg);
    expect([doc.getAttribute('role'), doc.getAttribute('lang'), doc.querySelector('title')!.textContent]).toEqual(['img', 'en', 'Fruit sales 2026!']);
    expect(doc.querySelector('desc')!.textContent).toBe(el.querySelector('[id$="-summary"]')!.textContent);
    // Nothing that needs the theme: no variable, no font class.
    expect([svg.includes('var('), svg.includes('dzgraph-font-'), /style="font:[^"]+"/.test(svg)]).toEqual([false, false, true]);
    expect([doc.getAttribute('width'), doc.getAttribute('height')]).toEqual(['600', '400']);
  });

  it('the view without the controls: zoomed like the screen, no navigator strip', async () => {
    const options = { navigator: true, xAxis: { scale: 'time' as const, zone: 'UTC' }, series: [{ type: 'line' as const, id: 'a', data: Array.from({ length: 60 }, (_, i) => [i * 86_400_000, i % 7] as [number, number]) }] };
    const { c } = mount(options, [exporting, navigatorStrip, timeAxis]);
    c.setRange({ min: 10 * 86_400_000, max: 20 * 86_400_000 });
    await raf2();
    const doc = parse(c.exportSvg()!);
    expect(doc.querySelector('[data-layer="navigator"]')).toBeNull();
    // The x axis's labels are the zoomed range's (11 to 21 January, days), not the whole data's (months).
    const labels = [...doc.querySelectorAll('[data-layer="labels"] text')].map((t) => t.textContent);
    expect(labels).toContain('15');
    expect(labels.some((t) => t?.startsWith('Feb'))).toBe(false);
  });

  it('a size of its own: laid out again at that size', async () => {
    const { c } = mount(LINES);
    await raf2();
    const doc = parse(c.exportSvg({ width: 900, height: 300 })!);
    expect([doc.getAttribute('width'), doc.getAttribute('height')]).toEqual(['900', '300']);
  });

  it('colours as on screen, or the theme asked for (export.md 3)', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { c } = mount(LINES);
    await raf2();
    const dark = background(c.exportSvg({ theme: 'dark' })!);
    const light = background(c.exportSvg({ theme: 'light' })!);
    expect(dark).not.toBe(light);
    expect(background(c.exportSvg()!)).toBe(dark);
    // A plain colour any SVG reader takes.
    expect(light).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
  });
});

describe('PNG (export.md 3, 5)', () => {
  const pixels = async (blob: Blob) => {
    const bitmap = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bitmap.width;
    cv.height = bitmap.height;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return { w: bitmap.width, h: bitmap.height, at: (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data], data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
  };

  it('a PNG at the scale asked, its background painted', async () => {
    const { c } = mount(LINES);
    await raf2();
    const blob = (await c.exportPng({ scale: 2 }))!;
    expect(blob.type).toBe('image/png');
    const p = await pixels(blob);
    expect([p.w, p.h, p.at(0, 0)[3], p.at(p.w - 1, p.h - 1)[3]]).toEqual([1200, 800, 255, 255]);
  });

  it('every mark drawn, those on Canvas too; text drawn', async () => {
    const many = { title: 'Cloud', series: [{ type: 'scatter' as const, id: 'a', data: Array.from({ length: 3000 }, (_, i) => [i % 97, (i * 7) % 89] as [number, number]) }] };
    const { c } = mount(many, [exporting, canvas]);
    await raf2();
    const shown = await pixels((await c.exportPng({ scale: 1 }))!);
    c.setSeriesVisible('a', false);
    await raf2();
    const hidden = await pixels((await c.exportPng({ scale: 1 }))!);
    let differ = 0;
    for (let i = 0; i < shown.data.length; i += 4) if (shown.data[i] !== hidden.data[i] || shown.data[i + 1] !== hidden.data[i + 1]) differ++;
    // 3 000 markers of 8 px, overlapping: far more than a few hundred pixels change.
    expect(differ).toBeGreaterThan(5000);
    // The title, at the top start (layout.md): some pixel of its row differs from the background.
    const bg = shown.at(0, 0).join();
    const row = Array.from({ length: 60 }, (_, k) => shown.at(8 + k, 18).join());
    expect(row.some((px) => px !== bg)).toBe(true);
  });
});

describe('CSV (csv.md)', () => {
  it('the table\'s rows, raw, with the x axis\'s word as header', async () => {
    const { c } = mount(LINES);
    await raf2();
    expect(c.exportCsv()).toBe('﻿X value,Apples,Pears\r\n0,1,3\r\n1,2,2\r\n2,3,1\r\n');
  });

  it('French separators with the option; the table switched to all data, all rows (D.23)', async () => {
    const { el, c } = mount({ ...LINES, dataTable: true, exporting: { csv: { locale: true } }, series: [{ type: 'line', id: 'a', name: 'Pommes', data: [1.5, 2, 3, 4] }] }, [exporting, zoom], 'fr');
    c.setRange({ min: 1, max: 2 });
    await raf2();
    expect(c.exportCsv()).toBe('﻿Valeur x;Pommes\r\n1;2\r\n2;3\r\n');
    el.querySelector<HTMLButtonElement>('.dzgraph-table-range')!.click();
    expect(c.exportCsv()).toBe('﻿Valeur x;Pommes\r\n0;1,5\r\n1;2\r\n2;3\r\n3;4\r\n');
  });
});

describe('download (export.md 8)', () => {
  /** The link the chart clicks, caught instead of followed. */
  const caught = async (go: () => Promise<void>) => {
    const original = HTMLAnchorElement.prototype.click;
    let got: { name: string; href: string; type: string } | null = null;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      got = { name: this.download, href: this.href, type: '' };
    };
    try {
      await go();
    } finally {
      HTMLAnchorElement.prototype.click = original;
    }
    const blob = await (await fetch(got!.href)).blob();
    return { name: got!.name, type: blob.type, text: blob.type.startsWith('text') || blob.type.startsWith('image/svg') ? await blob.text() : '' };
  };

  it('named after the title (letters, digits, hyphens), the extension by format', async () => {
    const { c } = mount(LINES);
    await raf2();
    const csv = await caught(() => c.download('csv'));
    // WebKit reads a blob's type back without its charset (the BOM says UTF-8 anyway).
    expect([csv.name, csv.type.split(';')[0]]).toEqual(['Fruit-sales-2026.csv', 'text/csv']);
    const svg = await caught(() => c.download('svg'));
    expect([svg.name, svg.type, svg.text.startsWith('<svg')]).toEqual(['Fruit-sales-2026.svg', 'image/svg+xml', true]);
    expect(await caught(() => c.download('png'))).toMatchObject({ name: 'Fruit-sales-2026.png', type: 'image/png' });
  });

  it('accents kept; no title: the word for a chart; the app\'s name wins', async () => {
    const fr = mount({ title: 'Ventes — été', series: LINES.series }, [exporting], 'fr');
    const none = mount({ series: LINES.series }, [exporting], 'fr');
    const named = mount({ title: 'x', exporting: { filename: 'rapport' }, series: LINES.series });
    await raf2();
    expect((await caught(() => fr.c.download('csv'))).name).toBe('Ventes-été.csv');
    expect((await caught(() => none.c.download('csv'))).name).toBe('graphique.csv');
    expect((await caught(() => named.c.download('csv'))).name).toBe('rapport.csv');
  });
});

describe('printing (print.md 1, 2, 4)', () => {
  it('a hidden frame with the picture in light colours, and the table when asked; removed afterwards', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { c } = mount(LINES);
    await raf2();
    let printed: { svg: string; table: boolean } | null = null;
    // The frame's print() caught before it runs: added to the page, then printed on a later task.
    const seen = new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes)
          if (n instanceof HTMLIFrameElement)
            n.contentWindow!.print = () => {
              const d = n.contentDocument!;
              // The picture's file, read while its link lives (it is let go once printed).
              const read = new XMLHttpRequest();
              read.open('GET', d.querySelector('img')!.src, false);
              read.send();
              // Review 1: the table printed in sight, not as the screen readers' hidden copy.
              const box = d.querySelector('table.dzgraph-table')?.parentElement;
              printed = { svg: read.responseText, table: !!box && box.style.clipPath === '' && !box.classList.contains('dzgraph-sr-only') };
            };
    });
    seen.observe(document.body, { childList: true });
    c.print({ table: true });
    await new Promise((r) => setTimeout(r, 300));
    seen.disconnect();
    expect(printed).not.toBeNull();
    expect(background(printed!.svg)).toBe(background(c.exportSvg({ theme: 'light' })!));
    expect(printed!.table).toBe(true);
    expect(document.querySelector('iframe')).toBeNull();
  });
});

describe('the page printed (print.md 3)', () => {
  afterEach(() => commands.printMedia(false));

  it('light colours, the controls hidden, the chart kept on one sheet', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { el, c } = mount({ ...LINES, menu: { items: ['print'] } }, [exporting, menu, zoom]);
    // The reset button as when zoomed: the print rule is what is tested here (zoom-pan.md tests when it shows).
    el.querySelector<HTMLButtonElement>('.dzgraph-reset')!.hidden = false;
    // The chart's background as drawn on screen: its colour through the theme.
    // Written as a Canvas writes it, to compare a computed `rgb()` with the export's hexadecimal.
    const norm = (c: string) => {
      const x = document.createElement('canvas').getContext('2d')!;
      x.fillStyle = c;
      return x.fillStyle;
    };
    const bg = () => norm(getComputedStyle(el.querySelector('rect[fill="var(--dzgraph-background)"]')!).fill);
    const shown = (sel: string) => getComputedStyle(el.querySelector(sel)!).display !== 'none';
    const screen = bg();
    expect([shown('.dzgraph-menu-button'), shown('.dzgraph-reset')]).toEqual([true, true]);
    await commands.printMedia(true);
    expect(bg()).toBe(norm(background(c.exportSvg({ theme: 'light' })!)!));
    expect(bg()).not.toBe(screen);
    expect([shown('.dzgraph-menu-button'), shown('.dzgraph-reset')]).toEqual([false, false]);
    expect(getComputedStyle(el.querySelector('.dzgraph')!).breakInside).toBe('avoid');
  });

  it('marks drawn on Canvas painted again in print colours', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const many = { series: [{ type: 'scatter' as const, id: 'a', data: Array.from({ length: 3000 }, (_, i) => [i % 97, (i * 7) % 89] as [number, number]) }] };
    const { el } = mount(many, [exporting, canvas]);
    await raf2();
    const cv = el.querySelector('canvas')!;
    const snap = () => cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data.join();
    const screen = snap();
    // Printed, the marks take the print colours. (Painted at once on the media change, not a frame later — a printing
    // browser does not wait for one; emulated media tell their change at no stable moment, so that part is not tested.)
    await commands.printMedia(true);
    await raf2();
    expect(snap()).not.toBe(screen);
  });
});

describe('without the module (export.md 11)', () => {
  it('nothing exported, reported', async () => {
    const { c } = mount(LINES, []);
    await raf2();
    expect([c.exportSvg(), c.exportCsv(), await c.exportPng()]).toEqual([null, null, null]);
    // Reported with the next drawing, as a wrong `setRange` is.
    await raf2();
    expect(c.problems).toContainEqual({ code: 'missing-module', path: 'exporting', detail: 'exporting' });
  });
});

describe('the menu (menu.md 9)', () => {
  it('Download › PNG, SVG, CSV and Print, with the module', async () => {
    const { el } = mount({ ...LINES, menu: { items: ['export', 'print'] } }, [exporting, menu]);
    await raf2();
    const button = el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!;
    button.click();
    const items = [...el.querySelectorAll('[role="menu"]:not([hidden]) > [role="menuitem"]')];
    expect(items.map((i) => i.textContent)).toEqual(['Download', 'Print']);
    (items[0] as HTMLElement).click();
    expect([...el.querySelectorAll('.dzgraph-submenu [role="menuitem"]')].map((i) => i.textContent)).toEqual(['PNG image', 'SVG image', 'CSV data']);
    // Print opens no submenu: it is a plain item.
    expect(items[1]!.hasAttribute('aria-haspopup')).toBe(false);
  });

  it('without the module, no such entries', async () => {
    const { el } = mount({ ...LINES, menu: { items: ['export', 'print'] } }, [menu]);
    await raf2();
    expect(el.querySelector<HTMLElement>('.dzgraph-menu-button')!.hidden).toBe(true);
  });
});

describe('review (Phase 6 close)', () => {
  it('review 2: an arrow on Print opens nothing', async () => {
    const { el } = mount({ ...LINES, menu: { items: ['export', 'print'] } }, [exporting, menu]);
    await raf2();
    el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!.click();
    const print = [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent === 'Print')!;
    print.focus();
    print.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect([el.querySelector('.dzgraph-submenu'), print.hasAttribute('aria-expanded'), document.activeElement]).toEqual([null, false, print]);
  });

  it('review 5: a title with combining marks keeps them in the file name', async () => {
    const { c } = mount({ title: 'हिन्दी डेटा', series: LINES.series });
    await raf2();
    const original = HTMLAnchorElement.prototype.click;
    let name = '';
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      name = this.download;
    };
    try {
      await c.download('csv');
    } finally {
      HTMLAnchorElement.prototype.click = original;
    }
    expect(name).toBe('हिन्दी-डेटा.csv');
  });

  it('review 6: a size or scale that is not a finite number falls back to the default', async () => {
    const { c } = mount(LINES);
    await raf2();
    const doc = parse(c.exportSvg({ width: Infinity, height: Number.NaN })!);
    expect([doc.getAttribute('width'), doc.getAttribute('height')]).toEqual(['600', '400']);
    const bitmap = await createImageBitmap((await c.exportPng({ scale: Infinity }))!);
    expect(bitmap.width).toBe(600 * Math.max(2, devicePixelRatio));
  });

  it('review 9: a download under way when the chart is destroyed gives no file', async () => {
    const { c } = mount(LINES);
    await raf2();
    const original = HTMLAnchorElement.prototype.click;
    let clicked = false;
    HTMLAnchorElement.prototype.click = function () {
      clicked = true;
    };
    try {
      const going = c.download('png');
      c.destroy();
      await going;
    } finally {
      HTMLAnchorElement.prototype.click = original;
    }
    expect(clicked).toBe(false);
  });
});
