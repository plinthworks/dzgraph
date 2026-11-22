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
    const modes = { value: 'en écart', percent: 'en pourcentage', index: 'en base 100' } as const;
    const compare = s.compare ? ` Comparé ${s.compare.baseline ? `à ${s.compare.baseline}` : 'au premier point visible'}, ${modes[s.compare.mode]}.` : '';
    const selected = s.selected ? ` ${s.selected} ${s.selected > 1 ? 'points sélectionnés' : 'point sélectionné'}.` : '';
    const PERIODS = { hour: 'heure', day: 'jour', week: 'semaine', month: 'mois', quarter: 'trimestre', year: 'année' } as const;
    const FNS = { sum: 'somme', mean: 'moyenne', min: 'minimum', max: 'maximum', count: 'nombre' } as const;
    const by = s.aggregation ? ('period' in s.aggregation.by ? `Par ${PERIODS[s.aggregation.by.period]}` : `Par tranches de ${s.aggregation.by.step}`) : '';
    const aggregated = s.aggregation ? ` ${by}, ${new Intl.ListFormat('fr').format(s.aggregation.fns.map((f) => FNS[f]))}.` : '';
    return `${kind}, ${s.series.length} ${s.series.length > 1 ? 'séries' : 'série'}.${series}${x}${compare}${selected}${aggregated}`;
  },
  seriesList: (name, count) => `${name}, ${count} points`,
  point: (p) =>
    p.meter
      ? `${p.x} : ${p.y}, entre ${p.meter.min} et ${p.meter.max}.${p.meter.threshold ? ` ${p.meter.threshold}.` : ''}`
      : p.share && p.total === undefined
      ? `${p.x} : ${p.y ? `${p.y}, ` : ''}${p.share}. Part ${p.position} sur ${p.count}.`
      : `${p.series}, ${p.x} : ${p.y}${p.raw ? ` (${p.raw})` : ''}${p.share ? `, ${p.share} de ${p.total}` : ''}${p.selected ? ', sélectionné' : ''}${p.detail ? ', détail disponible' : ''}. Point ${p.position} sur ${p.count}.`,
  total: 'Total',
  menu: {
    button: 'Options du graphique',
    type: 'Type',
    aggregation: 'Agrégation',
    scale: 'Échelle',
    compare: 'Comparaison',
    types: { line: 'Ligne', area: 'Aire', column: 'Colonnes' },
    none: 'Aucune',
    periods: { hour: 'Par heure', day: 'Par jour', week: 'Par semaine', month: 'Par mois', quarter: 'Par trimestre', year: 'Par année' },
    linear: 'Linéaire',
    log: 'Logarithmique',
    compares: { value: 'Écart', percent: 'Pourcentage', index: 'Base 100' },
  },
  exporting: { download: 'Télécharger', print: 'Imprimer', png: 'Image PNG', svg: 'Image SVG', csv: 'Données CSV', filename: 'graphique' },
  drill: { breadcrumb: 'Niveaux', root: 'Tout', loading: 'Chargement…', failed: 'Le détail n’a pas pu être chargé.', retry: 'Réessayer' },
  pointsIn: (n) => `${n} ${n === '1' ? 'point' : 'points'}`,
  shapes: { rectangle: 'Rectangle', range: 'Plage', lasso: 'Lasso' },
  selectedCount: (n) => (n === '0' ? 'Sélection vidée' : `${n} ${n === '1' ? 'point sélectionné' : 'points sélectionnés'}`),
  selectedColumn: 'Sélection',
  modeBar: 'Mode du graphique',
  modes: { zoom: 'Zoom', selection: 'Sélection', measure: 'Mesure' },
  measureTag: (r) => `${r.value}${r.percent ? ` (${r.percent})` : ''}${r.along.kind === 'text' ? ` · ${r.along.text}` : ` · ${r.along.count} ${r.along.count > 1 ? 'catégories' : 'catégorie'}`}`,
  measured: (r) => `Écart : ${r.value}${r.percent ? ` (${r.percent})` : ''}, ${r.along.kind === 'text' ? `sur ${r.along.text}` : `sur ${r.along.count} ${r.along.count > 1 ? 'catégories' : 'catégorie'}`}.`,
  since: (baseline) => `Depuis ${baseline}`,
  compared: (name) => `${name} (comparé)`,
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
