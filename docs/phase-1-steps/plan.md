# Phase 1 — Le socle : plan détaillé

> Rédigé le 2026-11-21, après la Phase 0. **À valider par le propriétaire avant tout code.** Vocabulaire :
> `GLOSSARY.md` ; décisions : `ARCHITECTURE.md` (D.1–D.22) et `docs/adr/`.

## But

À la fin de la Phase 1, une app peut écrire `chart(el, options)` et obtenir un graphique **statique et beau** en
ligne, aire, colonnes, barres ou nuage, avec axes, titre et légende, en clair et en sombre, de gauche à droite et de
droite à gauche, net à tous les DPR. Le même graphique s'exporte en SVG autonome, en node, sans navigateur. Pas
encore de survol, de clavier ni d'animation (Phase 2), ni de temps (Phase 3).

## Ce qui sort de la phase

- `@dzgraph/core` : `Problem`, options et leur normalisation, données (toutes les formes, colonnes typées), échelles
  linéaire et catégories, graduations numériques, formats `Intl`, mise en page, marques des cinq types, M4 sur
  pyramide, scène, `sceneToSvg`, le registre des types (ADR 0005), `dir.ts`.
- `@dzgraph/dom` : `chart(el, options, { types })`, peintre SVG à éléments réutilisés par clé, mesure du texte
  (`measureText`, cache, polices en retard), taille depuis le conteneur et repli `aspectRatio`, `update(partiel)`,
  `destroy()`, `problems`.
- `@dzgraph/theme` : jetons `--dzgraph-*` sur `--tz-*`, clair et sombre, palette validée par script.
- Le playground (port **4750** ; DzGrid 4700, DzTooltip 4740, l'app du propriétaire 4730/4731).

## Les étapes

Chaque étape : fiche de comportement d'abord (si elle imite un comportement), tests qui échouent d'abord, attentes
écrites à la main, puis le code. Pendant le travail, seuls les tests concernés ; `gate:step` à la fin de chaque lot.

### 1.1 Outillage

Espaces de travail `packages/core`, `dom`, `theme` ; vitest en projets (core en node, dom en jsdom, theme, tools) ;
`tsconfig` strict avec `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` **[À VALIDER]** ; `scripts/build.mjs`
(esbuild, refuse une dépendance d'exécution et un manifeste vers `src/`) ; `test:ci`, `test:tz` (Auckland, Los Angeles),
`typecheck`, `check:size`, `gate:step`.

Gardes, reprises de DzGrid et DzTooltip (notre code), chacune testée contre une violation plantée :
- pureté du cœur (aucun DOM, `Date`, Temporal, horloge, hasard ; `Intl` permis) ;
- côtés logiques (pas de `left`/`right` hors `dir.ts`) ;
- aucune couleur littérale hors du thème ;
- graphe d'imports entre paquets ;
- mots bannis (le domaine du propriétaire, comme DzGrid) ;
- `as never` / `as any` d'un test toujours commenté.

### 1.2 Les types publics, avant le code

Les fichiers de types seuls, sans implémentation : `ChartOptions`, `SeriesOptions`, `AxisOptions`, `LegendOptions`,
les formes de données, `Problem` et ses codes, `Scene` et ses primitives, `ColorToken`, l'interface d'un module de
type (`SeriesType`), `Chart`. Relus par `pr-review-toolkit:type-design-analyzer`, puis par le propriétaire.

Esquisse (à relire, pas encore figée) :

```ts
// Données : une série accepte l'une de ces formes ; une valeur nulle est un trou.
type Datum = number | null;
type DataInput =
  | readonly Datum[]                                   // y seul ; x = catégorie ou index
  | readonly (readonly [x: number | string, y: Datum])[]
  | readonly PointInput[]                              // { x, y, key?, name? }
  | ColumnsInput;                                      // { x?, y, key? } en Float64Array : gros volumes

interface SeriesOptions<T extends string = string> {
  readonly type: T;               // un type enregistré : 'line', 'column'…
  readonly id?: string;           // sinon dérivé de la position ; requis pour update(partiel) ciblé
  readonly name?: string;
  readonly data: DataInput;
  readonly axis?: { readonly x?: string; readonly y?: string };
  readonly color?: number;        // rang dans la palette, jamais une couleur littérale
  readonly hidden?: boolean;
}

interface Problem { readonly code: ProblemCode; readonly path: string; readonly detail?: string }

// La scène : en pixels, couleurs par jetons, une clé stable par primitive.
interface Scene { readonly width: number; readonly height: number; readonly dir: 'ltr' | 'rtl'; readonly layers: readonly Layer[] }
type Primitive = PathPrim | RectPrim | LinePrim | TextPrim | ArcPrim;

// Un type de série : le cœur n'en connaît aucun par son nom.
interface SeriesType<T extends string> {
  readonly name: T;
  readonly coords: 'cartesian' | 'polar' | 'none';
  extent(series: NormalizedSeries): Extent;
  marks(ctx: MarkContext): readonly Primitive[];
}
```

### 1.3 Fiches de comportement

`docs/behaviors/` : axes et graduations, mise en page (titre, légende, marges, étiquettes qui se chevauchent),
ligne et aire (trous, valeurs nulles, aire jusqu'à zéro ou au bas de l'axe), colonnes et barres (groupées, largeur,
valeurs négatives), nuage, légende statique, droite à gauche. Observé sur les démos publiques, écrit avec nos mots.

### 1.4 Problèmes, options, données

Normalisation pure : options inconnues, types inconnus, données mal formées, `NaN`, infinis, x non triés pour une
ligne, clés en double → chacun un `Problem` (code, chemin), jamais une exception, jamais une valeur dans le détail.
Tests par propriétés (`fast-check`, dépendance de développement **[À VALIDER]**) : « toute entrée donne un modèle ou
des problèmes, jamais une exception ».

### 1.5 Échelles, graduations, formats

Échelles linéaire et catégories (`domain → range`, `invert`) ; graduations par la règle de `axes.md` 7 (pas ronds,
nombre le plus proche de la cible, axe au plus 2,5 fois les données). *Changé le 2026-11-21 :* l'algorithme de
Talbot, Lin et Hanrahan, essayé à la main sur le premier cas de la fiche (13–87 → 0–100), donne 10–90 tous les 20
avec ses poids publiés ; la fiche validée fait foi. Formats `Intl.NumberFormat` (locale, unités compactes « 1,2 k »).
Propriétés : graduations croissantes, dans le domaine « arrondi », pas constant, nombre proche de la cible.

### 1.6 Mise en page

Titre, légende (en haut, en bas, au début, à la fin — côtés logiques), axes (largeur des étiquettes mesurées,
marge de 2 px de S2, rotation puis saut d'étiquettes qui se chevauchent), zone de tracé. Mesure injectée : les tests
utilisent une police fictive à chasse fixe, d'où des attentes écrites à la main au pixel.

### 1.7 Marques et décimation

Ligne, aire, colonnes, barres (groupées), nuage → primitives à clés stables. M4 sur pyramide (S3) pour lignes et
aires. Propriétés : « M4 garde le min et le max de chaque colonne », « une série d'au plus un point par colonne est
rendue telle quelle ». Choix du peintre par marques dessinées (ADR 0002) : en Phase 1 tout est SVG ; le seuil de
2 000 marques est écrit et testé, le Canvas arrive en Phase 3.

### 1.8 Scène, SVG, `chart()`

`sceneToSvg` (pur, node) ; peintre SVG du DOM qui réutilise les éléments par clé ; `chart(el, options, { types })` ;
taille par `ResizeObserver` (hauteur du conteneur, repli `aspectRatio`) ; `update(partiel)` (séries appariées par
`id`) ; `destroy()` (tout est rendu, rien ne fuit : écouteurs, observateurs). Tests de scène en JSON pour le cœur.

### 1.9 Thème

Méthode du skill `dataviz` : palette catégorielle de 10, contrastes vérifiés par script (texte 4,5:1, marques 3:1),
clair et sombre, `forced-colors`, tirets et formes de marqueurs pour ne jamais dépendre de la couleur seule.
`dzgraph.scss` → `dzgraph.css` (couche `dzgraph.theme`) et version sans couche ; un test échoue s'ils divergent.

### 1.10 Dans de vrais navigateurs

Playground (4750, données inventées). Images de référence par type × clair/sombre × LTR/RTL × DPR 1/2, d'abord
Chrome, puis Firefox et WebKit. Le banc S5 sur le vrai peintre (le Canvas viendra en Phase 3, le banc est prêt).

### 1.11 Clôture

Vérification d'architecture contre ce plan et `ARCHITECTURE.md` ; revue de code (`code-review`) puis passe de
simplification (`simplify`) ; corrections ; `gate:step` vert ; tailles mesurées (minifiées, gzippées) et soumises au
propriétaire, qui fixe les budgets.

## Questions pour le propriétaire

1. `exactOptionalPropertyTypes` (plus strict : « absent » et « `undefined` » ne se confondent plus) : je le propose.
2. `fast-check` en dépendance de **développement** seulement, pour les tests par propriétés : je le propose.
3. Une image de référence par type × thème × direction × DPR, d'abord dans Chrome : d'accord ?


## Après la clôture (2026-11-21) : reporté aux phases suivantes, d'après la vérification d'architecture

- **Phase 2** : l'identité des séries denses sans couleur — une ligne dense n'a pas de marqueurs ; proposer au
  propriétaire des marqueurs clairsemés (un tous les ~80 px) ou des tirets par rang (question ouverte).
- **Phase 3** : le peintre Canvas reçoit ses groupes par l'interface `Painter` (`dom/src/painter.ts`) ; contraintes
  d'ordre de l'ADR 0002 ; le banc S5 rejoué sur le vrai peintre ; `npm run bench` (§15) avec les bancs de la Phase 0 ;
  les plages visibles entrent dans `View`.
- **Phase 4** : l'empilement demande une étape de préparation commune aux séries (bases, étendue empilée) avant
  `bounds` et `marks` ; la mise en page doit séparer la partie « axes » pour que le polaire place titre, légende et
  zone sans axes cartésiens (les types non cartésiens sont signalés `not-available` d'ici là).
- **Phase 6** : l'export SVG ou PNG autonome a besoin d'une table jeton → valeur en JavaScript, générée par
  `build-theme` depuis le SCSS (le thème n'existe aujourd'hui qu'en CSS).
