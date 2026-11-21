// S6: two keyboard / screen-reader patterns for the same chart. Made-up data only.
const SVG = 'http://www.w3.org/2000/svg';
const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin'];
const series = [
  { name: 'Pommes', unit: 'kg', data: [120, 135, 160, 150, 190, 210], color: '#1d4ed8', dash: '' },
  { name: 'Poires', unit: 'kg', data: [80, 95, 90, 130, 125, 140], color: '#b45309', dash: '6 4' },
];
const nf = new Intl.NumberFormat('fr-FR');
const W = 640, H = 260, P = 40;
const px = (i: number) => P + (i * (W - 2 * P)) / (months.length - 1);
const py = (v: number) => H - P - ((v - 50) / 200) * (H - 2 * P);
const label = (s: number, i: number) =>
  `${series[s]!.name}, ${months[i]} : ${nf.format(series[s]!.data[i]!)} ${series[s]!.unit}. Point ${i + 1} sur ${months.length}.`;
const summary =
  'Graphique en lignes : kilos vendus par mois, de janvier à juin, 2 séries. Pommes de 120 à 210, en hausse. Poires de 80 à 140, en hausse.';

function base(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  let html = `<g aria-hidden="true">`;
  for (const v of [50, 100, 150, 200, 250]) html += `<line x1="${P}" x2="${W - P}" y1="${py(v)}" y2="${py(v)}" stroke="#ddd"/><text x="${P - 6}" y="${py(v) + 4}" text-anchor="end" font-size="11">${v}</text>`;
  months.forEach((m, i) => (html += `<text x="${px(i)}" y="${H - P + 18}" text-anchor="middle" font-size="11">${m.slice(0, 4)}.</text>`));
  for (const s of series) html += `<path d="M${s.data.map((v, i) => `${px(i)} ${py(v)}`).join('L')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-dasharray="${s.dash}"/>`;
  html += `</g>`;
  svg.innerHTML = html;
  return svg;
}

function keys(e: KeyboardEvent, at: { s: number; i: number }): boolean {
  const n = months.length;
  if (e.key === 'ArrowRight') at.i = Math.min(n - 1, at.i + 1);
  else if (e.key === 'ArrowLeft') at.i = Math.max(0, at.i - 1);
  else if (e.key === 'ArrowDown') at.s = Math.min(series.length - 1, at.s + 1);
  else if (e.key === 'ArrowUp') at.s = Math.max(0, at.s - 1);
  else if (e.key === 'Home') at.i = 0;
  else if (e.key === 'End') at.i = n - 1;
  else return false;
  e.preventDefault();
  return true;
}

// Pattern A: one focusable region; a polite live region speaks the point.
{
  const host = document.getElementById('a')!;
  const wrap = document.createElement('div');
  wrap.className = 'chart';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'application');
  wrap.setAttribute('aria-roledescription', 'graphique');
  wrap.setAttribute('aria-label', summary + ' Flèches pour parcourir les points.');
  const svg = base();
  const ring = document.createElementNS(SVG, 'circle');
  ring.setAttribute('r', '7');
  ring.setAttribute('class', 'focus-ring');
  ring.style.display = 'none';
  svg.appendChild(ring);
  const live = document.createElement('div');
  live.className = 'sr';
  live.setAttribute('aria-live', 'polite');
  wrap.append(svg, live);
  host.appendChild(wrap);
  const at = { s: 0, i: -1 };
  wrap.addEventListener('keydown', (e) => {
    if (at.i < 0 && e.key.startsWith('Arrow')) at.i = -1;
    if (!keys(e, at)) return;
    if (at.i < 0) at.i = 0;
    ring.style.display = '';
    ring.setAttribute('cx', String(px(at.i)));
    ring.setAttribute('cy', String(py(series[at.s]!.data[at.i]!)));
    live.textContent = label(at.s, at.i);
  });
}

// Pattern B: a list per series, a list item per point, roving tabindex (one point in the tab order).
{
  const host = document.getElementById('b')!;
  const wrap = document.createElement('figure');
  wrap.style.margin = '0';
  const cap = document.createElement('figcaption');
  cap.textContent = summary;
  const svg = base();
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Graphique : kilos vendus par mois');
  const items: SVGElement[][] = [];
  series.forEach((s, si) => {
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('role', 'list');
    g.setAttribute('aria-label', `${s.name}, ${months.length} points`);
    items.push([]);
    s.data.forEach((v, i) => {
      const c = document.createElementNS(SVG, 'circle');
      c.setAttribute('cx', String(px(i)));
      c.setAttribute('cy', String(py(v)));
      c.setAttribute('r', '4');
      c.setAttribute('fill', s.color);
      c.setAttribute('role', 'listitem');
      c.setAttribute('aria-label', label(si, i));
      c.setAttribute('tabindex', si === 0 && i === 0 ? '0' : '-1');
      g.appendChild(c);
      items[si]!.push(c);
    });
    svg.appendChild(g);
  });
  const at = { s: 0, i: 0 };
  svg.addEventListener('keydown', (e) => {
    const prev = items[at.s]![at.i]!;
    if (!keys(e, at)) return;
    const next = items[at.s]![at.i]!;
    prev.setAttribute('tabindex', '-1');
    next.setAttribute('tabindex', '0');
    next.focus();
  });
  wrap.append(cap, svg);
  host.appendChild(wrap);
}

// The equivalent data table.
{
  const t = document.createElement('table');
  t.innerHTML = `<caption>Kilos vendus par mois</caption><thead><tr><th scope="col">Mois</th>${series.map((s) => `<th scope="col">${s.name} (${s.unit})</th>`).join('')}</tr></thead><tbody>${months
    .map((m, i) => `<tr><th scope="row">${m}</th>${series.map((s) => `<td>${nf.format(s.data[i]!)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  const box = document.getElementById('table')!;
  box.appendChild(t);
  const btn = document.getElementById('toggle')!;
  btn.addEventListener('click', () => {
    const open = box.hidden;
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Masquer le tableau de données' : 'Afficher le tableau de données';
  });
}

export {};
