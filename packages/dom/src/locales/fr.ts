import type { Messages } from '../messages.js';

const KINDS: Readonly<Record<string, string>> = { line: 'Graphique en lignes', area: 'Graphique en aires', column: 'Graphique en colonnes', bar: 'Graphique en barres', scatter: 'Nuage de points' };

export const fr: Messages = {
  seriesName: (n) => `Série ${n}`,
  noData: 'Aucune donnée',
  ellipsis: '…',
  seriesHidden: (name) => `${name} masquée`,
  seriesShown: (name) => `${name} affichée`,
  chart: 'Graphique',
  summary: (s) => {
    const kind = s.types.length === 1 ? (KINDS[s.types[0]!] ?? 'Graphique') : 'Graphique combiné';
    const series = s.series.map((r) => ` ${r.name} : de ${r.min} à ${r.max}.`).join('');
    const x = s.x ? ` Axe x : de ${s.x.from} à ${s.x.to}.` : '';
    return `${kind}, ${s.series.length} ${s.series.length > 1 ? 'séries' : 'série'}.${series}${x}`;
  },
  seriesList: (name, count) => `${name}, ${count} points`,
  point: (p) => `${p.series}, ${p.x} : ${p.y}. Point ${p.position} sur ${p.count}.`,
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
