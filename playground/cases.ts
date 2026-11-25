// The playground's charts. Made-up data only (a fictional orchard), visibly so.
import type { ChartOptions } from '@dzgraph/core';
import type { Chart } from '@dzgraph/dom';

const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** mulberry32: the same made-up points on every run. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Case {
  readonly title: string;
  readonly options: (rtl: boolean) => ChartOptions;
  /** What to do once drawn (zoom, for the navigator's case). */
  readonly after?: (chart: Chart) => void;
  /** A case of exploration (Phase 5): every module, the mode bar with them. */
  readonly exploration?: boolean;
}

export const cases: Record<string, Case> = {
  line: {
    title: 'Lignes',
    options: (rtl) => ({
      title: { text: rtl ? 'مبيعات البستان الخيالي' : 'Ventes du verger fictif', subtitle: rtl ? 'بالكيلوغرام، 2026' : 'En kilos, 2026' },
      series: [
        { type: 'line', name: rtl ? 'تفاح' : 'Pommes', data: (rtl ? monthsAr : months).map((m, i) => [m, 120 + 40 * Math.sin(i / 2) + i * 6]) },
        { type: 'line', name: rtl ? 'إجاص' : 'Poires', data: (rtl ? monthsAr : months).map((m, i) => [m, 80 + 25 * Math.cos(i / 3) + i * 4]) },
      ],
      yAxis: { title: rtl ? 'كغ' : 'kg' },
    }),
  },
  area: {
    title: 'Aire',
    options: () => ({
      title: 'Visiteurs du verger fictif',
      series: [{ type: 'area', name: 'Visiteurs', data: months.map((m, i) => [m, Math.round(300 + 250 * Math.sin((i - 2) / 2.2))]) }],
    }),
  },
  columns: {
    title: 'Colonnes groupées',
    options: () => ({
      title: 'Récoltes par trimestre',
      series: ['Pommes', 'Poires', 'Prunes'].map((name, k) => ({ type: 'column', name, data: ['T1', 'T2', 'T3', 'T4'].map((q, i) => [q, 40 + ((i * 37 + k * 23) % 60)]) })),
    }),
  },
  bars: {
    title: 'Barres',
    options: () => ({
      title: 'Variétés les plus cueillies',
      series: [{ type: 'bar', name: 'Paniers', data: [['Reinette', 182], ['Gala', 154], ['Boskoop', 121], ['Conférence', 98], ['Williams', 77], ['Mirabelle', 45]] }],
    }),
  },
  scatter: {
    title: 'Nuage',
    options: () => {
      const r = prng(7);
      const cloud = (cx: number, cy: number, n: number) => Array.from({ length: n }, () => [cx + (r() + r() + r() - 1.5) * 30, cy + (r() + r() + r() - 1.5) * 20] as [number, number]);
      return { title: 'Poids et diamètre des fruits', series: [{ type: 'scatter', name: 'Pommes', data: cloud(80, 160, 120) }, { type: 'scatter', name: 'Poires', data: cloud(65, 190, 120) }], xAxis: { title: 'Diamètre (mm)' }, yAxis: { title: 'Poids (g)' } };
    },
  },
  negative: {
    title: 'Valeurs négatives',
    options: () => ({ title: 'Écart à l’objectif', series: [{ type: 'column', name: 'Écart', data: months.map((m, i) => [m, Math.round(30 * Math.sin(i / 1.7) - 5)]) }] }),
  },
  dual: {
    title: 'Deux axes',
    options: () => ({
      title: 'Récolte et pluie',
      series: [
        { type: 'column', name: 'Récolte (kg)', data: months.map((m, i) => [m, 200 + 80 * Math.sin(i / 2)]) },
        { type: 'line', name: 'Pluie (mm)', yAxis: 'y2', data: months.map((m, i) => [m, 40 + 30 * Math.cos(i / 2.5)]) },
      ],
      yAxis: [{ title: 'kg' }, { title: 'mm', opposite: true }],
    }),
  },
  stacked: {
    title: 'Colonnes empilées',
    options: () => ({
      title: 'Bilan des paniers fictifs',
      series: [
        { type: 'column', name: 'Pommes', stack: true, data: ['T1', 'T2', 'T3', 'T4'].map((q, i) => [q, 30 + i * 8]) },
        { type: 'column', name: 'Poires', stack: true, data: ['T1', 'T2', 'T3', 'T4'].map((q, i) => [q, 22 - i * 3]) },
        { type: 'column', name: 'Pertes', stack: true, data: ['T1', 'T2', 'T3', 'T4'].map((q, i) => [q, -6 - (i % 2) * 5]) },
        { type: 'column', name: 'Prunes', stack: 'autre', data: ['T1', 'T2', 'T3', 'T4'].map((q, i) => [q, 18 + ((i * 7) % 11)]) },
      ],
    }),
  },
  'stacked-area': {
    title: 'Aires empilées',
    options: () => ({
      title: 'Visiteurs par entrée (fictif)',
      series: ['Nord', 'Est', 'Sud'].map((name, k) => ({ type: 'area', name, stack: true, data: months.map((m, i) => [m, Math.round(60 + 40 * Math.sin((i + k * 3) / 2.4) + k * 20)]) })),
    }),
  },
  percent: {
    title: 'Parts empilées',
    options: () => ({
      title: 'Parts des variétés (fictif)',
      yAxis: { stacking: 'percent' },
      series: ['Reinette', 'Gala', 'Boskoop'].map((name, k) => ({ type: 'column', name, stack: true, data: ['T1', 'T2', 'T3', 'T4'].map((q, i) => [q, 10 + ((i * 13 + k * 29) % 40)]) })),
    }),
  },
  log: {
    title: 'Échelle log',
    options: () => ({
      title: 'Ruches fictives : abeilles et frelons',
      yAxis: { scale: 'log', title: 'individus' },
      series: [
        { type: 'line', name: 'Abeilles', data: months.map((m, i) => [m, Math.round(400 * 2.1 ** i)]) },
        { type: 'line', name: 'Frelons', data: months.map((m, i) => [m, Math.round(3 + 2.5 * i * i)]) },
      ],
    }),
  },
  pie: {
    title: 'Secteurs',
    options: () => ({
      title: 'Récolte fictive par variété',
      series: [{ type: 'pie', name: 'Récolte', data: [['Reinette', 182], ['Gala', 154], ['Boskoop', 121], ['Conférence', 98], ['Williams', 77], ['Mirabelle', 45], ['Quetsche', 21], ['Coing', 12], ['Nèfle', 4]] }],
    }),
  },
  donut: {
    title: 'Anneau',
    options: () => ({
      title: 'Paniers fictifs vendus',
      series: [{ type: 'donut', name: 'Paniers', data: [['Marché', 420], ['Boutique', 260], ['En ligne', 180], ['Cantines', 90]] }],
    }),
  },
  gauge: {
    title: 'Jauge',
    options: () => ({
      title: 'Remplissage du pressoir fictif',
      series: [{ type: 'gauge', name: 'Remplissage', data: 72, thresholds: [{ from: 0, to: 60, label: 'Normal' }, { from: 60, to: 85, label: 'Élevé' }, { from: 85, to: 100, label: 'Plein' }] }],
    }),
  },
  'gauge-rich': {
    title: 'Jauge de −2000 à 2000, zones sur l’arc (gauge.md 13–15)',
    options: () => ({
      title: 'Bilan fictif du réservoir',
      series: [{ type: 'gauge', name: 'Bilan', min: -2000, max: 2000, origin: 0, data: -1700, ticks: { step: 100, labels: 500 }, thresholdsOn: 'track', thresholds: [{ from: -2000, to: -1500, color: 'cold', label: 'Froid' }, { from: -500, to: 500, color: 'calm', label: 'Normal' }] }],
    }),
  },
  'gauge-bar': {
    title: 'Jauge en barre, de −2000 à 2000 (gauge.md 19–23)',
    options: () => ({
      title: 'Bilan fictif du réservoir',
      series: [{ type: 'gauge', shape: 'bar', name: 'Bilan', min: -2000, max: 2000, origin: 0, data: -1700, ticks: { step: 100, labels: 500 }, thresholdsOn: 'track', thresholds: [{ from: -2000, to: -1500, color: 'cold', label: 'Froid' }, { from: -500, to: 500, color: 'calm', label: 'Normal' }] }],
    }),
  },
  'gauge-bar-upright': {
    title: 'Jauge en barre debout, comme un thermomètre (gauge.md 20, 22)',
    options: () => ({
      title: 'Température fictive de la serre',
      series: [{ type: 'gauge', shape: 'bar', orientation: 'vertical', name: 'Température (°C)', min: -10, max: 40, origin: 0, data: 23, ticks: { step: 5, labels: 10 }, thresholdsOn: 'track', thresholds: [{ from: -10, to: 0, color: 'cold', label: 'Gel' }, { from: 18, to: 26, color: 'calm', label: 'Idéal' }] }],
    }),
  },
  many: {
    title: 'Beaucoup de catégories',
    options: () => ({ title: 'Rangs du verger', series: [{ type: 'column', name: 'Arbres', data: Array.from({ length: 30 }, (_, i) => [`Rang nord n° ${i + 1}`, 10 + ((i * 17) % 23)]) }] }),
  },
  dense: {
    title: '50 000 points',
    options: () => {
      const r = prng(3);
      let v = 50;
      const y = new Float64Array(50_000);
      for (let i = 0; i < y.length; i++) y[i] = v += (r() - 0.5) * 2;
      return { title: 'Capteur d’humidité (fictif), une mesure par minute', series: [{ type: 'line', name: 'Humidité', data: { y } }] };
    },
  },
  crowd: {
    title: 'Nuage de 5 000 points (Canvas)',
    options: () => {
      const r = prng(11);
      const cloud = (cx: number, cy: number, n: number) => Array.from({ length: n }, () => [cx + (r() + r() + r() - 1.5) * 30, cy + (r() + r() + r() - 1.5) * 20] as [number, number]);
      return { title: 'Calibre des fruits au tri (fictif)', series: [{ type: 'scatter', name: 'Pommes', data: cloud(80, 160, 2_500) }, { type: 'scatter', name: 'Poires', data: cloud(65, 190, 2_500) }], xAxis: { title: 'Diamètre (mm)' }, yAxis: { title: 'Poids (g)' } };
    },
  },
  cloud: {
    title: 'Nuage de 200 000 points (WebGL2)',
    options: () => {
      const r = prng(13);
      const cloud = (cx: number, cy: number, n: number) => {
        const x = new Float64Array(n);
        const y = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          x[i] = cx + (r() + r() + r() - 1.5) * 30;
          y[i] = cy + (r() + r() + r() - 1.5) * 20;
        }
        return { x, y };
      };
      // The first on WebGL2 (past 100 000 points), the second on Canvas, above it (ADR 0008).
      return { title: 'Calibre des fruits au tri, toute la saison (fictif)', series: [{ type: 'scatter', name: 'Pommes', data: cloud(80, 160, 200_000) }, { type: 'scatter', name: 'Poires', data: cloud(65, 190, 3_000) }], xAxis: { title: 'Diamètre (mm)' }, yAxis: { title: 'Poids (g)' } };
    },
  },
  compare: {
    exploration: true,
    title: 'Comparaison en pourcentage, viseur',
    options: (rtl) => {
      const r = prng(17);
      let a = 40;
      let b = 25;
      const apples = months.map(() => (a += (r() - 0.4) * 6));
      const pears = months.map(() => (b += (r() - 0.5) * 5));
      return {
        title: 'Prix fictifs au marché, depuis janvier',
        crosshair: { horizontal: true },
        xAxis: { scale: 'category', categories: rtl ? monthsAr : months },
        yAxis: { compare: 'percent' },
        series: [{ type: 'line', name: 'Pommes', data: apples }, { type: 'line', name: 'Poires', data: pears }],
      };
    },
  },
  selected: {
    exploration: true,
    title: 'Sélection',
    options: () => {
      const r = prng(19);
      const data = Array.from({ length: 300 }, () => [40 + (r() + r() + r() - 1.5) * 30, 160 + (r() + r() + r() - 1.5) * 40] as [number, number]);
      return { title: 'Fruits retenus pour le concours (fictif)', selection: { shapes: ['rectangle', 'lasso'] }, xAxis: { title: 'Diamètre (mm)' }, yAxis: { title: 'Poids (g)' }, series: [{ type: 'scatter', name: 'Pommes', data }, { type: 'column', name: 'Lot', data: [[20, 60], [30, 80], [50, 70]] }] };
    },
    after: (c) => {
      c.setMode('selection');
      c.setView({ selection: { '#1': Array.from({ length: 300 }, (_, i) => i).filter((i) => i % 7 === 0), '#2': [1] } });
    },
  },
  aggregated: {
    exploration: true,
    title: 'Agrégation par semaine, menu',
    options: () => {
      const r = prng(23);
      const day = 86_400_000;
      const start = Date.UTC(2026, 0, 5, 11);
      const data = Array.from({ length: 84 }, (_, i) => [start + i * day, Math.round(20 + r() * 30)] as [number, number]);
      return { title: 'Cagettes livrées par jour, regroupées par semaine (fictif)', menu: true, xAxis: { scale: 'time', zone: 'Europe/Paris', aggregate: 'week' }, series: [{ type: 'column', name: 'Cagettes', data }] };
    },
  },
  time: {
    title: 'Axe de temps',
    options: () => {
      const r = prng(5);
      let v = 12;
      // One reading a day at noon, Paris, from 1 March to 30 April 2026: the clock changes on 29 March.
      const data = Array.from({ length: 61 }, (_, i) => [Date.UTC(2026, 2, 1 + i, 11), (v += (r() - 0.45) * 2)] as [number, number]);
      return { title: 'Température de la serre à midi (fictif)', xAxis: { scale: 'time', zone: 'Europe/Paris' }, yAxis: { title: '°C' }, series: [{ type: 'line', name: 'Serre', data }] };
    },
  },
  navigator: {
    title: 'Navigateur et boutons de plage',
    options: () => {
      const r = prng(9);
      let v = 40;
      // A reading every six hours over a year (2025), Paris.
      const data = Array.from({ length: 1460 }, (_, i) => [Date.UTC(2025, 0, 1) + i * 21_600_000, (v += (r() - 0.5) * 3)] as [number, number]);
      return { title: 'Niveau du réservoir (fictif)', navigator: true, xAxis: { scale: 'time', zone: 'Europe/Paris' }, yAxis: { title: 'cm' }, series: [{ type: 'area', name: 'Réservoir', data }] };
    },
    after: (c) => c.setRange({ min: Date.UTC(2025, 5, 1), max: Date.UTC(2025, 7, 1) }),
  },
  empty: {
    title: 'Sans données',
    options: () => ({ title: 'Récolte à venir', series: [{ type: 'line', name: 'Rien encore', data: [] }] }),
  },
};
