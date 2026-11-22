import type { Summary } from '@dzgraph/core/internal';
import type { Messages } from '../messages.js';

const KINDS: Readonly<Record<string, string>> = { line: 'Graphique en lignes', area: 'Graphique en aires', column: 'Graphique en colonnes', bar: 'Graphique en barres', scatter: 'Nuage de points', pie: 'Graphique en secteurs', donut: 'Graphique en anneau', gauge: 'Jauge' };
const PLURAL: Readonly<Record<string, string>> = { line: 'lignes', area: 'aires', column: 'colonnes', bar: 'barres', scatter: 'points' };
const STACKED: Readonly<Record<string, string>> = { area: 'Graphique en aires empilées', column: 'Graphique en colonnes empilées', bar: 'Graphique en barres empilées' };

export const fr: Messages = {
  seriesName: (n) => `Série ${n}`,
  noData: 'Aucune donnée',
  ellipsis: '…',
  seriesHidden: (name) => `${name} masquée`,
  seriesShown: (name) => `${name} affichée`,
  chart: 'Graphique',
  summary: (s) => {
    if (s.meter) return `Jauge. ${s.meter.name} : ${s.meter.value}, entre ${s.meter.min} et ${s.meter.max}.${s.meter.threshold ? ` ${s.meter.threshold}.` : ''}`;
    if (s.slices !== undefined) {
      const kind = KINDS[s.types[0]!] ?? 'Graphique';
      const largest = s.largest ? ` La plus grande : ${s.largest.name}, ${s.largest.share}.` : '';
      return `${kind}, ${s.slices} ${s.slices > 1 ? 'parts' : 'part'}.${largest}`;
    }
    const kind = s.types.length === 1 ? ((s.stacked ? STACKED[s.types[0]!] : undefined) ?? KINDS[s.types[0]!] ?? 'Graphique') : `Graphique combiné : ${new Intl.ListFormat('fr').format(s.types.map((t) => PLURAL[t] ?? t))}`;
    const on = (a: NonNullable<Summary['series'][number]['axis']>) => (a.title ? `, axe ${a.title}` : `, ${['premier', 'second'][a.index] ?? `${a.index + 1}e`} axe`);
    const series = s.series.map((r) => ` ${r.name} : de ${r.min} à ${r.max}${r.axis ? on(r.axis) : ''}.`).join('');
    const x = s.x ? ` Axe x : de ${s.x.from} à ${s.x.to}.` : '';
    return `${kind}, ${s.series.length} ${s.series.length > 1 ? 'séries' : 'série'}.${series}${x}`;
  },
  seriesList: (name, count) => `${name}, ${count} points`,
  point: (p) =>
    p.meter
      ? `${p.x} : ${p.y}, entre ${p.meter.min} et ${p.meter.max}.${p.meter.threshold ? ` ${p.meter.threshold}.` : ''}`
      : p.share && p.total === undefined
      ? `${p.x} : ${p.y ? `${p.y}, ` : ''}${p.share}. Part ${p.position} sur ${p.count}.`
      : `${p.series}, ${p.x} : ${p.y}${p.share ? `, ${p.share} de ${p.total}` : ''}. Point ${p.position} sur ${p.count}.`,
  total: 'Total',
  stackTotal: (stack) => (stack === null ? 'Total' : `Total ${stack}`),
  seriesOnAxis: (name, axis) => `${name} (${axis})`,
  pointName: (n) => `Part ${n}`,
  others: 'Autres',
  share: 'Part',
  moreSlices: (count) => `et ${count} autres`,
  sliceLabel: (name, share) => `${name} ${share}`,
  gaugeNote: (min, max, threshold) => `${min}–${max}${threshold ? ` · ${threshold}` : ''}`,
  meter: { min: 'Minimum', max: 'Maximum', threshold: 'Seuil' },
  tableCaption: 'Données du graphique',
  rowsOmitted: (count) => `${count} lignes de plus`,
  category: 'Catégorie',
  xValue: 'Valeur x',
  resetZoom: 'Réinitialiser le zoom',
  rangeShown: (from, to) => `Plage affichée : de ${from} à ${to}`,
  rangeWhole: 'Toutes les données affichées',
  rangeStart: 'Début de la plage',
  rangeEnd: 'Fin de la plage',
  range1m: '1 m',
  range3m: '3 m',
  rangeYtd: 'Début d’année',
  range1y: '1 an',
  rangeAll: 'Tout',
  tableRange: (from, to) => `de ${from} à ${to}`,
  tableAll: 'Afficher toutes les données',
  tableVisible: 'Afficher la plage visible',
};
