// The playground's charts. Made-up data only (a fictional orchard), visibly so.
import type { ChartOptions } from '@dzgraph/core';

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
  empty: {
    title: 'Sans données',
    options: () => ({ title: 'Récolte à venir', series: [{ type: 'line', name: 'Rien encore', data: [] }] }),
  },
};
