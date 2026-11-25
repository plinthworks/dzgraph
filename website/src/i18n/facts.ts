/**
 * The words of an option's facts table (<OptionFacts>), in each language. The facts themselves come from the sources
 * (scripts/gen-options.mjs → src/generated/options.json); a default the code cannot write as a literal is a token
 * here, and every token the sources use has its words in both languages (website/test/options.test.ts). The words'
 * only markup is `code`.
 */
export interface FactWords {
  type: string;
  typeOn: (scale: string) => string;
  default: string;
  required: string;
  needs: string;
  live: string;
  angular: string;
  source: string;
  entry: string;
  system: string;
  brings: string;
  enables: string;
  keys: string;
  key: string;
  none: string;
  yes: string;
  noFeature: string;
  liveChart: (name: string) => string;
  liveSeries: string;
  liveAxis: string;
  liveSetup: string;
  angularOptions: string;
  angularInput: (name: string, def: string | null) => string;
  systems: Record<string, string>;
  onScale: (scale: string) => string;
  tokens: Record<string, string>;
}

export const FACTS: Record<'en' | 'fr', FactWords> = {
  en: {
    type: 'Type',
    typeOn: (scale) => `Type (${scale})`,
    default: 'Default',
    required: 'Required',
    needs: 'Needs',
    live: 'Live update',
    angular: 'Angular',
    source: 'Declared in',
    entry: 'Import',
    system: 'Drawn',
    brings: 'Brings',
    enables: 'Options that need it',
    keys: 'Its own options',
    key: 'Option',
    none: 'not set',
    yes: 'Yes',
    noFeature: 'nothing: built in',
    liveChart: (name) => `Yes: \`update({ ${name} })\``,
    liveSeries: 'Yes: give the series again (`update({ series })`), matched by `id`',
    liveAxis: 'Yes: give the axis again (`update({ xAxis })` or `yAxis`)',
    liveSetup: 'No: read once, when the chart is made',
    angularOptions: 'in the `options` input',
    angularInput: (name, def) => `the \`[${name}]\` input${def ? `, default \`${def}\`` : ''}; a new value draws a new chart`,
    systems: { cartesian: 'against axes', polar: 'around a centre, without axes' },
    onScale: (scale) => `on a \`${scale}\` axis`,
    tokens: {
      guessedAxis: 'one axis, its scale guessed from the data',
      legendTwo: 'shown when there are two series or more',
      pageLanguage: 'the page’s language (`lang`)',
      elementDirection: 'the element’s (`dir` attribute or CSS `direction`)',
      withNavigator: 'shown with the navigator, on a time axis',
      byPosition: '`#1`, `#2`… by position',
      seriesN: '« Series 1 », « Series 2 »… in the chart’s language',
      firstAxis: 'the first axis',
      paletteOrder: 'the palette’s next colour, by position',
      aggregateByType: '`\'sum\'` for columns and bars, `\'mean\'` otherwise',
      axisIds: '`x` and `y`, then `x2`, `y2`…',
      scaleGuessed: '`\'linear\'`, or `\'category\'` when the x values are strings',
      fromData: 'from the data, rounded to ticks',
      firstInView: 'the first point in view',
      fromDataOrder: 'the data’s, in order of appearance',
      pageZone: 'the page’s zone',
      markerRoom: 'markers when the points are far enough apart to read them',
      totalCenter: 'the total, and « Total »',
      scaleMin: 'the scale’s start (`min`)',
      gaugeThickness: 'a quarter of the radius for the arc, 24 px for the bar',
      pageLanguageWords: 'the built-in words of the page’s language (English or French)',
    },
  },
  fr: {
    type: 'Type',
    typeOn: (scale) => `Type (${scale})`,
    default: 'Par défaut',
    required: 'Obligatoire',
    needs: 'Demande',
    live: 'Mise à jour',
    angular: 'Angular',
    source: 'Déclarée dans',
    entry: 'Import',
    system: 'Dessiné',
    brings: 'Apporte',
    enables: 'Options qui la demandent',
    keys: 'Ses propres options',
    key: 'Option',
    none: 'aucun',
    yes: 'Oui',
    noFeature: 'rien : fournie',
    liveChart: (name) => `Oui : \`update({ ${name} })\``,
    liveSeries: 'Oui : redonnez les séries (`update({ series })`), appariées par `id`',
    liveAxis: 'Oui : redonnez l’axe (`update({ xAxis })` ou `yAxis`)',
    liveSetup: 'Non : lue une fois, à la création du graphique',
    angularOptions: 'dans l’entrée `options`',
    angularInput: (name, def) => `l’entrée \`[${name}]\`${def ? `, par défaut \`${def}\`` : ''} ; une nouvelle valeur dessine un nouveau graphique`,
    systems: { cartesian: 'sur des axes', polar: 'autour d’un centre, sans axes' },
    onScale: (scale) => `sur un axe \`${scale}\``,
    tokens: {
      guessedAxis: 'un axe, son échelle devinée d’après les données',
      legendTwo: 'montrée à partir de deux séries',
      pageLanguage: 'la langue de la page (`lang`)',
      elementDirection: 'celui de l’élément (attribut `dir` ou `direction` en CSS)',
      withNavigator: 'montrés avec le navigateur, sur un axe de temps',
      byPosition: '`#1`, `#2`… selon la position',
      seriesN: '« Série 1 », « Série 2 »… dans la langue du graphique',
      firstAxis: 'le premier axe',
      paletteOrder: 'la couleur suivante de la palette, selon la position',
      aggregateByType: '`\'sum\'` pour les colonnes et les barres, `\'mean\'` sinon',
      axisIds: '`x` et `y`, puis `x2`, `y2`…',
      scaleGuessed: '`\'linear\'`, ou `\'category\'` quand les x sont des chaînes',
      fromData: 'd’après les données, arrondies aux graduations',
      firstInView: 'le premier point visible',
      fromDataOrder: 'celles des données, dans leur ordre d’apparition',
      pageZone: 'le fuseau de la page',
      markerRoom: 'des marqueurs quand les points sont assez écartés pour être lus',
      totalCenter: 'le total, et « Total »',
      scaleMin: 'le début de l’échelle (`min`)',
      gaugeThickness: 'un quart du rayon pour l’arc, 24 px pour la barre',
      pageLanguageWords: 'les mots fournis de la langue de la page (anglais ou français)',
    },
  },
};
