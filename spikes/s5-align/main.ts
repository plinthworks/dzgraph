// S5: the same geometry drawn by Canvas and by SVG, in a box of a given width and start offset. The runner takes a
// screenshot of each and compares them pixel by pixel.
const SVG = 'http://www.w3.org/2000/svg';
const H = 300;

/** Gridlines on half pixels (crisp at DPR 1), a zigzag line, columns: what a chart is made of. */
function geometry(w: number) {
  const grid: number[] = [];
  for (let y = 20.5; y < H; y += 40) grid.push(y);
  const line: [number, number][] = [];
  for (let x = 0; x <= w; x += 7.3) line.push([x, 150 + Math.sin(x / 23) * 100]);
  const cols: [number, number, number, number][] = [];
  for (let x = 13; x < w - 30; x += 61.7) cols.push([x, 220 - (x % 90), 24.4, 80 + (x % 90)]);
  return { grid, line, cols };
}

(window as any).draw = (mode: 'svg' | 'canvas', w: number, start: number) => {
  const host = document.getElementById('host')!;
  host.style.insetInlineStart = `${start}px`;
  host.style.width = `${w}px`;
  host.style.height = `${H}px`;
  const g = geometry(w);
  if (mode === 'svg') {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('width', String(w));
    s.setAttribute('height', String(H));
    s.style.display = 'block';
    let html = '';
    for (const y of g.grid) html += `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="#888" stroke-width="1"/>`;
    for (const [x, y, cw, ch] of g.cols) html += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#16a34a"/>`;
    html += `<path d="M${g.line.map(([x, y]) => `${x} ${y}`).join('L')}" fill="none" stroke="#2563eb" stroke-width="2"/>`;
    s.innerHTML = html;
    host.replaceChildren(s);
  } else {
    const c = document.createElement('canvas');
    const dpr = window.devicePixelRatio;
    // The backing store follows the box's device pixels; CSS size is the box.
    c.width = Math.round(w * dpr);
    c.height = Math.round(H * dpr);
    c.style.cssText = `display:block;width:${w}px;height:${H}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(c.width / w, 0, 0, c.height / H, 0, 0);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    for (const y of g.grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = '#16a34a';
    for (const [x, y, cw, ch] of g.cols) ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    g.line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    host.replaceChildren(c);
  }
};
(window as any).ready = true;

export {};
