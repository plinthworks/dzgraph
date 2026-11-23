# DzGraph : architecture complète

> Rédigé le 2026-11-20, avant toute ligne de code. **Aucune ligne de Highcharts, ni d'aucune autre bibliothèque de
> graphiques, n'a été lue** (voir `CLEANROOM.md`). Seuls comptent le comportement observable, la documentation publique
> et les algorithmes publiés. Ce que je n'ai pas vérifié est marqué **[À VÉRIFIER]** ; ce qui doit être mesuré,
> **[À MESURER]** (Phase 0).

## Décisions validées par le propriétaire (2026-11-20)

Elles priment sur le reste du document quand il dit autre chose.

| Sujet | Décision |
|---|---|
| D.1 Rendu | SVG par défaut ; Canvas automatiquement pour les grosses séries (seuil mesuré en Phase 0, S1). |
| D.2 Périmètre v1 | Cartésiens (ligne, aire, colonnes/barres groupées et empilées, nuage, combinés, double axe — gardé en connaissance de cause, 2026-11-21, bien que la méthode dataviz le déconseille), secteurs/anneau/jauge, séries temporelles (fuseaux, zoom, navigateur, gros volumes), sparklines. |
| D.3 Interactions v1 | Légende cliquable, infobulle partagée, zoom/déplacement, export PNG/SVG/CSV/impression fait maison (aucun service distant), accessibilité avancée (clavier point à point, lecteur d'écran, tableau de données équivalent). |
| D.4 Paquets | `core`, `dom`, `theme`, `angular`, pont `dztooltip`, pont `dzgrid`. |
| D.5 API | Objet d'options typé : `chart(el, options)` puis `update(partiel)`. |
| D.6 Animation | Faite maison, coupée par `prefers-reduced-motion`, avec un hook `animate` comme DzTooltip. |
| D.7 Variables CSS | `--dzgraph-*` (propres) et `--tz-*` (palette partagée de la famille). |
| D.8 Dépôt | git local au départ ; sur GitHub depuis le 2026-11-21 (`git@github.com:plinthworks/dzgraph.git`, branche `main`), à la demande du propriétaire. |
| D.9 Pas de Three.js | Ni Three.js ni autre moteur. Si le Canvas ne suffit pas (S7), on écrit notre propre peintre WebGL2, réservé au calque des séries (`@dzgraph/dom/webgl`, sans dépendance). |
| D.10 Droite à gauche | La légende et les titres suivent le sens d'écriture ; l'axe x n'est pas inversé par défaut (option `mirror`). |
| D.11 Hauteur | Elle vient du conteneur ; repli `aspectRatio` quand le conteneur n'a pas de hauteur. |
| D.12 Boutons de plage | 1 m, 3 m, 1 an, depuis le début de l'année, tout : en v1, avec le navigateur. |
| D.13 Angular tôt | Un `<dz-chart>` minimal à la fin de la Phase 2, pour l'essayer dans une vraie app ; complet en Phase 7. |
| D.14 Versions | 0.x jusqu'à la fin du périmètre v1, puis 1.0.0. |
| D.15 Exploration | DzGraph sert à **explorer** les données, pas seulement à les montrer. En v1 : exploration par clic (drilldown), graphiques liés (entre eux et avec DzGrid), sélection de points, viseur et comparaison (§14). |
| D.17 Tout le catalogue (2026-11-21) | DzGraph proposera ce que proposent les bibliothèques pro actuelles, **plus** l'exploration **et** la 3D. Étalé : la 1.0 = D.2 + D.3 + D.15/D.16, puis une vague 1.x par famille (§9). |
| D.18 3D | Moteur WebGL2 maison, sans dépendance, paquet séparé `@dzgraph/3d` : rotation à la souris et au clavier, éclairage simple, texte des axes en SVG par-dessus. |
| D.19 Cartes | Oui, dans une vague tardive : paquet séparé `@dzgraph/maps` (GeoJSON fourni par l'app, projections). |
| D.20 Nuages denses (S7) | Le peintre WebGL2 pour les nuages et bulles denses (seuil : 100 000 points, mesuré en Phase 3 bis, validé le 2026-11-23) entre **dans la 1.0** ; ses fondations (tampons, shaders, choix des contextes) servent ensuite la 3D (D.18). |
| D.21 Lasso exact (S8) | Objectif : sélection **exacte en direct** même à 1 M points, en ne retestant que les cases touchées par le nouveau segment du lasso ; l'aperçu par cases ne sert que si la mesure de la Phase 5 montre qu'on n'y arrive pas. |
| D.22 Exigence de qualité | « Du code craft » : voir §15. |
| D.23 Tableau et zoom (2026-11-21) | Zoomer sert à montrer une partie : par défaut le tableau de données (et l'export CSV, Phase 6) suit la **plage visible** ; un bouton bascule sur **toutes les données**, pour voir les deux. Choix de l'app par option. |
| D.24 Graphique tiré de DzGrid (2026-11-23) | Le bloc de cellules, sinon les lignes cochées, et le pivot ; le graphique est là où l'app le place et suit la sélection en direct (instantané en option) ; une entrée pour le menu de cellule de DzGrid. La 1.0 est préparée en Phase 8, publiée par le propriétaire ; le site de documentation en Phase 9. |
| D.16 Liberté de l'utilisateur | « Un peu » : depuis un petit menu, il change le type (ligne, aire, colonnes), l'agrégation et l'échelle. Pas d'éditeur de graphiques complet. |

## 1. Technologies

| Rôle | Choix | Pourquoi |
|---|---|---|
| Langage | TypeScript 5.9, `strict`, `noUncheckedIndexedAccess` | comme DzGrid et DzTooltip |
| Cœur | lib ES2023 seule, sans DOM, sans dépendance | testable en node, réutilisable (export SVG côté serveur) |
| Dépôt | npm workspaces (`packages/*`), Node 24 | comme les projets frères |
| Tests | vitest 4 (projets core/browser/theme/tools) ; **pas de jsdom** : le DOM se teste dans de vrais navigateurs (mode navigateur de vitest, Chrome ; Firefox et WebKit par `test:browsers`), le cœur en node et dans Chrome (propriétaire, 2026-11-21) | jsdom ne voit ni mise en page, ni pixels, ni différences de moteurs |
| Navigateurs réels | `playwright-core` (Chrome, puis Firefox et WebKit), un à la fois | jsdom ne voit ni la mise en page ni les pixels |
| Build | esbuild via `scripts/build.mjs` ; refuse une dépendance d'exécution et un manifeste pointant vers `src/` | idem DzTooltip |
| Angular | Angular 21 en développement, compatibilité 19 à 22 vérifiée par `ngc`, composants à signaux | idem DzTooltip |
| Thème | SCSS → CSS (couche `dzgraph.theme` et version sans couche) | idem DzTooltip |
| Rendu | SVG 2 et Canvas 2D natifs ; ni WebGL ni bibliothèque | D.1 |

Aucune dépendance d'exécution, dans aucun paquet (sauf les dépendances de pair : Angular, `@dztooltip/core`, DzGrid).

## 2. Paquets

```
@dzgraph/core       pur : options → modèle → scène. Aucun DOM.
@dzgraph/dom        chart(el, options) : peintres SVG/Canvas, interactions, animation, export.
                    sous-chemin ./sparkline : petit point d'entrée sans axes ni interactions.
@dzgraph/theme      dzgraph.scss → dzgraph.css (+ unlayered).
@dzgraph/angular    <dz-chart>, <dz-sparkline> ; une sortie par événement.
@dzgraph/dztooltip  l'infobulle dessinée par @dztooltip/core (ancre virtuelle sur le point).
@dzgraph/dzgrid     linkGrid : sélection dans les deux sens, filtre en option (types structurels, sans DzGrid) ;
                    chartFromGrid : graphique tiré du pivot, d'un bloc de cellules ou des lignes cochées. Les sparklines en cellule restent celles de DzGrid
                    (propriétaire, 2026-11-22).
```

**Extensibilité (D.17)** : chaque type de série et chaque système de coordonnées (cartésien, polaire, sans axes pour
les hiérarchies, 3D projeté) est un module qui s'enregistre : `chart(el, options, { types: [line, column] })`, ou un
point d'entrée « tout inclus » pour qui ne compte pas les octets. Une app ne paie que ce qu'elle importe ; le cœur ne
connaît aucun type en dur. C'est fixé dès la Phase 1 pour que les vagues 1.x n'aient rien à casser.

**Fonctions importées (ADR 0006, Phase 4)** : de même, les axes de temps (`timeAxis`), le zoom (`zoom`), le
navigateur et ses boutons de plage (`navigatorStrip`, qui amène `zoom`) et le plan Canvas (`canvas`) sont des modules :
`chart(el, options, { types, features: [timeAxis, zoom] })`, ou `allFeatures`. Le cœur reçoit ce qu'ils lui prêtent
(un *kit* : lire et nommer les instants, placer et dessiner le navigateur) avec les options et le garde dans le
modèle ; il n'importe pas leur code. Une option sans son module devient un `Problem` `missing-module`. La plage
visible reste au cœur : `setRange()` marche sans module.

Le cœur a deux points d'entrée : `@dzgraph/core` (public, semver) et `@dzgraph/core/internal` (pour nos propres paquets
seulement, sans promesse avant 1.0 : `normalize`, `layout`, `composeScene`, `svgOf`, le contrat des types). `@dzgraph/angular`
importe `core` (types, `allTypes`) et `dom`. Graphe d'imports : `core` ← `dom` ← (`angular`, `dztooltip`, `dzgrid`). Un test le vérifie. Les ponts déclarent des
types structurels (pas d'import de DzGrid à l'exécution), comme `@dztooltip/dzgrid`.

## 3. Le principe : une scène, plusieurs sorties

```
options + données ──normalize──▶ Model ──layout(size, measure)──▶ Scene ──▶ peintre SVG
   (Problems)                   (séries,     (axes, ticks, aire           ──▶ peintre Canvas
                                 échelles,    de tracé, légende,          ──▶ export SVG (chaîne, pur)
                                 empilement)  marques en pixels)          ──▶ export PNG (Canvas hors écran)
                                                                          ──▶ impression
                    Model ──▶ tableau de données, CSV, descriptions pour lecteur d'écran
```

- **`Model`** : options normalisées, séries rangées en colonnes (`Float64Array`), échelles, empilement, étendues.
  Indépendant de la taille.
- **`Scene`** : liste de primitives en pixels (`path`, `rect`, `arc`, `text`, `line`, `marker`), groupées en calques
  (`grid`, `series`, `axes`, `labels`, `legend`, `overlay`), avec une clé stable par élément (animation, a11y,
  mise à jour ciblée). Les couleurs y sont des **noms de variables** (`series-3`, `axis-line`), jamais des valeurs.
- **Mesure du texte** : le cœur reçoit `measure(text, font) → { width, ascent, descent }`. Le DOM la fournit (Canvas
  `measureText`, avec cache). Les tests utilisent une police fictive à chasse fixe, d'où des attentes écrites à la main.
- Conséquence : la règle « un seul calcul, toutes les sorties » de DzGrid devient structurelle, et une revue vérifie
  qu'une règle nouvelle atteint bien l'écran, l'export, l'impression et le tableau.

## 4. Modules du cœur (`@dzgraph/core`)

*Mis à jour le 2026-11-21, après la Phase 1 : les noms réels.*

| Module | Rôle |
|---|---|
| `problem.ts` | `Problem { code, path, seriesId?, detail? }` ; codes ouverts (`ProblemCodes`, fusion de déclarations) ; jamais de données de l'app dedans. |
| `options.ts` | types publics des options ; les types de série s'y ajoutent par `SeriesOptionsByType`. |
| `normalize.ts` | `normalize(options, types, { zone }) → { model, problems }` : options vérifiées et complétées, données lues, catégories, orientation ; le fuseau de la page vient du DOM (UTC sans lui : le cœur ne lit jamais l'hôte). |
| `model.ts` | le modèle (`ChartModel`, `AxisModel`), indépendant de la taille. |
| `data.ts` | lecture des quatre formes x/y en colonnes (`y` typé lu sans copie, `x` toujours recopié) ; trous, clés. |
| `time.ts` | `InstantMs`, `Day`, `ZoneName` ; l'horloge murale d'un fuseau par `Intl` (`wallOf`, `instantsOf`, `dayStart`), lecture ISO (`parseInstant`), graduations sur l'horloge murale et étiquettes en deux étages (`timeTicks`, `timeLabels`), `formatInstant` (Phase 3, spike S4). |
| `scale.ts` | échelles linéaire (aussi pour le temps, en millisecondes) et catégories, ces dernières zoomables par catégories entières (`log` : Phase 4, signalée `not-available`). |
| `ticks.ts` | graduations : pas ronds, nombre proche de la cible, axe au plus 2,5 × les données, second axe aligné. |
| `format.ts` | étiquettes par `Intl` : décimales exactes dans la notation de la langue, formes courtes, scientifique. |
| `layout.ts` | titre, légende, axes (passes jusqu'à stabilité), zone de tracé ; côtés logiques. |
| `view.ts` | la vue (séries masquées, plage visible de chaque axe x zoomé ; le reste en Phase 5) ; `isShown`. |
| `zoom.ts` | la plage visible en données pures : `extentOf` (l'étendue, gardée par modèle), `clampRange`, `zoomAround`, `panBy`. |
| `navigator.ts` | le navigateur (place de la bande, dessin, fenêtre, poignées) et les intervalles des boutons de plage (`rangeButtonSpan`, sur le calendrier du fuseau). |
| `column-cache.ts` | ce qui est calculé d'une colonne (pyramide, bornes, ordre) gardé avec elle, oublié quand une colonne de l'app est relue. |
| `geometry.ts` | les formes que tous les peintres dessinent pareil (contour d'un marqueur, bout arrondi d'une colonne). |
| `series-type.ts` | le contrat d'un type de série et des repères (`FramesBySystem`, `MarkSet`). |
| `series/` | `line`, `area`, `column` (+ `bar`), `scatter`, et ce qu'ils partagent (`shared.ts`) ; Phase 4 : `pie` (+ `donut`) et `gauge`, les premiers types polaires, qui se placent eux-mêmes (`place()`, ADR 0007). |
| `decimate.ts` | M4 exact sur pyramide min/max (blocs de 16 points) ; `rangeMinMax` d'une plage d'indices en O(log n). |
| `compose.ts` | la scène : calques, traits sur les centres de pixels, textes sur leur ligne de base alphabétique ; un peintre par série (Canvas dès qu'un lot de marques dépasse le seuil), les groupes Canvas en tête de chaque calque (ADR 0002). |
| `scene.ts` | les types de la scène (primitives, jetons de couleur, `PathData`). |
| `svg.ts` | `svgOf` (une primitive → un élément, partagé avec le peintre du DOM) et `sceneToSvg(scene, { resolve, font, prefix })`. |
| `paint.ts` | le seul module qui écrit une couleur en CSS (`var()`, `color-mix()` de variables). |
| `dir.ts` | le seul module qui sait quel côté physique est le début. |
| `hit.ts` | le point visé : partagé par x (recherche dichotomique), par marque (colonne, bande, point à 24 px) dans une grille de cases construite une fois par scène (spike S8). |
| `points.ts` | `pointAt` (la position d'un point, une seule réponse pour le survol, le clavier, les tests de visée) et `withKey`. |
| `navigate.ts` | la navigation au clavier (flèches selon l'écran, Début/Fin, pages) et l'ordre des points valués. |
| `tooltip.ts` | le contenu de l'infobulle, en données. |
| `a11y.ts` | le résumé, les libellés des points, `dataRows` (valeurs brutes, pour le CSV de la Phase 6) et `dataTable` (texte). |
| `interpolate.ts` | les scènes entre deux états, et l'état de départ de l'apparition (`appearFrom`). |
| `stack.ts` | les piles (Phase 4) : pour chaque série empilée visible, le début et la fin de chaque segment, sa part, le total de la pile ; calculées une fois par mise en page (`layout.stacks`) et lues par les types, `pointAt`, l'infobulle, le lecteur d'écran et le tableau. |
| `csv.ts`, `aggregate.ts` | Phases 5 et 6, comme prévu. |

La pureté est imposée par un test (`purity.test.ts`, repris de DzGrid) qui se teste lui-même sur des violations plantées.

## 5. La couche DOM (`@dzgraph/dom`)

- **`chart(el, options) → Chart`** : monte un conteneur, observe sa taille (`ResizeObserver`). **La hauteur vient du
  conteneur**, comme pour DzGrid (repli `aspectRatio` si le conteneur n'a pas de hauteur, D.11).
- **Peintres** : `svg-painter.ts` (éléments réutilisés par clé de scène) et `canvas-painter.ts` (DPR pris en compte,
  variables CSS résolues à chaque dessin par un élément sonde). **Hybride** : une série passe en Canvas au-delà du seuil (S1) ; le Canvas se place
  sous les calques SVG (axes, étiquettes, survol, focus) qui restent nets et accessibles.
- **Interactions** : survol (point le plus proche, infobulle partagée sur la verticale), légende (clic, clavier),
  zoom à la sélection (x, y ou xy), molette, pincement, déplacement, bouton « réinitialiser », navigateur temporel
  (mini-graphique avec poignées) et boutons de plage (D.12).
- **Infobulle intégrée** minimale (une `div` placée, `aria-hidden`) ; le pont DzTooltip la remplace.
- **Clavier et lecteur d'écran** : le graphique est un arrêt de tabulation ; flèches gauche/droite d'un point à
  l'autre, haut/bas d'une série à l'autre, Début/Fin, Échap ; une région `aria-live` annonce le point ; un tableau
  de données équivalent (masqué visuellement ou affiché sur demande) ; descriptions en clés de messages (en + fr).
  Séries distinguables sans la couleur (tirets, formes de marqueurs). `forced-colors` respecté.
- **Animation** : apparition (révélation par découpe) et mise à jour (interpolation entre deux scènes à clés égales,
  fondu sinon) ; `prefers-reduced-motion` coupe tout ; hook `animate(ctx)` pour piloter soi-même (GSAP par exemple).
- **Export** : `exportSvg()` (scène → `sceneToSvg`, variables résolues), `exportPng({ scale })` (scène peinte sur un
  Canvas hors écran), `exportCsv()` (modèle → `csv.ts`), `print()`. Ni serveur ni dépendance.
- **API du `Chart`** : `update(partiel)`, `setData(id, data)`, `addPoints(id, points, { shift })` (direct),
  `setRange(range | null)` (bornes en nombres, ou ISO sur un axe de temps), `setSeriesVisible(id, on)`, `problems`,
  `destroy()` ; événements `pointHover`, `pointClick`, `pointFocus`, `legendToggle`, `rangeChange`, `problems`.
- **Sparkline** (`@dzgraph/dom/sparkline`) : ligne, aire, colonnes, gagnant/perdant ; SVG seul, sans axes ni
  interactions, pour des milliers de cellules ; budget de taille propre.

*Fichiers réels après la Phase 2 (2026-11-21) :* `chart.ts` (les étapes : lecture, mise en page, scène, aides),
`svg-painter.ts` derrière l'interface `painter.ts` (WebGL2 en Phase 3 bis), `hover.ts` (survol, viseur,
infobulle, affichage du focus), `keyboard.ts` (`PointItems` : les éléments des points pour le clavier et les lecteurs
d'écran), `legend.ts` (les boutons de légende), `table.ts` (le tableau de données), `animator.ts`, `measure.ts`,
`messages.ts` et `locales/`. `Chart` a `setSeriesVisible(id, visible)` ; les événements portent la clé du point.

*Ajouts de la Phase 3 (2026-11-21) :* trois plans empilés dans la racine — un SVG du fond et de la grille, le
Canvas (`canvas-painter.ts`) des séries de plus de 2 000 marques, le SVG principal (premier dans le document,
`z-index: 1`) pour le reste, le survol et les aides ; `gestures.ts` (glisser, Maj + glisser, Ctrl/⌘ + molette,
pincer, touches + − 0 et Maj + flèches), `navigator.ts` (poignées, fenêtre, curseurs clavier), le bouton de
réinitialisation, les boutons de plage, le bouton du tableau (plage visible ou tout) ; les aides lourdes (résumé,
points, tableau) attendent la fin d'un geste (200 ms).

*Phase 4, étape 1 (2026-11-22) :* `features.ts` (les quatre modules, `allFeatures`, leur résolution) ; `chart.ts`
n'importe plus que les types de `gestures.ts`, `navigator.ts` et `canvas-painter.ts`. Le bouton de réinitialisation
vit avec les gestes (`ZoomControls`), les boutons de plage avec le navigateur (`NavigatorPart`). Sans `canvas`, les
groupes Canvas de la scène sont peints en SVG, dans le même ordre.

## 6. Thème (`@dzgraph/theme`)

Variables `--dzgraph-*` pour tout : palette catégorielle (`--dzgraph-series-1` à `-10`), grille, axes, texte,
infobulle, focus, sélection de zoom, navigateur ; elles retombent sur `--tz-*`. Clair et sombre. Contraste vérifié par
script : 4,5:1 pour le texte, 3:1 pour les marques sur le fond. Aucune couleur littérale dans le code ni le SCSS (test
de garde, comme DzTooltip).

## 7. Temps et fuseaux

- L'axe temporel porte des `InstantMs`, et l'option `zone` (IANA, par défaut le fuseau de la page côté DOM).
- Les ticks sont calculés en **heure murale du fuseau** : un tick « jour » tombe à minuit local, même les jours de
  23 h ou 25 h ; une heure doublée a deux ticks distincts, une heure sautée n'en a aucun.
- Une série de `Day` (catégories calendaires) n'est jamais convertie en instant sans fuseau.
- Vérifié par `test:tz` (Auckland et Los Angeles), comme DzGrid.

## 8. Gros volumes

Données en colonnes typées, décimation par fenêtre visible (M4 : rendu visuellement identique à l'original pour une
ligne), Canvas au-delà de 2 000 marques, recherche du point survolé en O(log n) ou par cases. Nuages : un lot de points
en unités de données (ADR 0008), dessiné par Canvas puis, au-delà de 100 000 points, par notre WebGL2 (module `webgl`).
Mesuré (Chrome, 2026-11-22) : ligne de 10 M points, zoom 3 ms par image ; nuage de 1 M et de 10 M points, zoom
0,9 ms par image.

## 9. Après la 1.0 : les vagues 1.x (D.17)

La 1.0 couvre D.2, D.3, D.15 et D.16. Ensuite, une vague par famille ; chaque vague a ses fiches de comportement, sa
revue et sa version. L'ordre après 1.1 est une proposition **[À VALIDER]**.

| Vague | Contenu |
|---|---|
| 1.1 Cartésiens étendus (choix du propriétaire) | spline, escalier, plages (aire et colonnes min-max), cascade, histogramme, courbe de densité, boîte à moustaches, barres d'erreur, bulles, flux (streamgraph), carte de chaleur, x-range ; annotations, étiquettes de données, bandes et lignes de repère, règles responsives. |
| 1.2 Finance et projets | chandeliers, OHLC, indicateurs techniques (moyennes, bandes, MACD, RSI…), axe ordinal sans trous (week-ends), Gantt (dépendances, jalons), chronologie. |
| 1.3 Hiérarchies et flux | treemap, sunburst, sankey, roue de dépendances, réseau (forces), organigramme ; exploration par clic dans les niveaux. |
| 1.4 Circulaires et divers | entonnoir, pyramide, jauge pleine, bullet, polaire, radar, rose des vents, bulles groupées, nuage de mots, Venn ; import CSV ; sonification. |
| 1.5 3D (`@dzgraph/3d`, D.18) | colonnes, barres, secteurs, nuage et surfaces en 3D ; spike WebGL2 avant (texte, rotation, export PNG, accessibilité). |
| 1.6 Cartes (`@dzgraph/maps`, D.19) | choroplèthe, bulles et points sur carte, projections, zoom géographique ; fonds GeoJSON fournis par l'app. |

## 10. Questions ouvertes pour le propriétaire

Aucune pour l'instant : les cinq premières sont tranchées (D.10 à D.14), l'exploration aussi (D.15, D.16).

## 11. Phases

Chaque phase se ferme par une vérification d'architecture, une revue de code et `gate:step` au vert.

| Phase | Contenu |
|---|---|
| 0 | Spikes (§12) dans de vrais navigateurs ; décisions chiffrées. |
| 1 | Socle : outillage, `Problem`, options, données, échelles linéaire/catégorie, ticks numériques, mise en page, scène, peintre SVG, `sceneToSvg` ; ligne, aire, colonnes, barres, nuage, statiques ; thème. |
| 2 | Interactions : survol, infobulle partagée, légende, clavier, lecteur d'écran, tableau de données, animation ; `<dz-chart>` Angular minimal (D.13). |
| 3 | Temps et volumes : échelle temporelle à fuseau, ticks temporels, données en colonnes, décimation, peintre Canvas, hybride, zoom/déplacement, navigateur. |
| 4 | Empilement, combinés, double axe, échelle log ; secteurs, anneau, jauge. |
| 5 | Exploration (§14) : viseur, mesure et comparaison, sélection de points, drilldown, menu (type, agrégation, échelle), `ChartView`, graphiques liés entre eux. |
| 6 | Export PNG/SVG/CSV, impression. |
| 7 | Angular complet, sparklines (hors grille), pont DzTooltip, pont DzGrid (liens grille ↔ graphique). |
| 8 | Graphique tiré d'une sélection DzGrid ; vérification complète ; préparation de la 1.0. |
| 9 | Site de documentation (en dernier, comme DzGrid). |

## 12. Phase 0 : spikes

Chaque spike a une règle de décision écrite avant la mesure.

| Spike | Question | Règle de décision |
|---|---|---|
| S1 | À partir de combien de points le SVG décroche-t-il (survol, zoom, redimensionnement) en Chrome, Firefox et WebKit ? | Le seuil Canvas = le plus petit nombre de points où une image dépasse 16 ms dans un navigateur, arrondi vers le bas. |
| S2 | Coût de la mesure du texte (Canvas `measureText` contre SVG `getComputedTextLength`) et stabilité quand la police se charge en retard. | Le plus rapide s'il donne des largeurs à ±1 px de l'autre ; relayout sur `document.fonts.ready`. |
| S3 | M4 contre LTTB sur 1 et 10 millions de points : temps, fidélité visuelle (différence de pixels avec le tracé complet). | M4 par défaut s'il est fidèle à 0 pixel près et plus rapide ; LTTB reste une option. |
| S4 | Coût des ticks temporels via `Intl` (`formatToParts`) sur 10 ans de ticks horaires, fuseaux à changement d'heure. | Acceptable sous 2 ms par mise en page ; sinon cache des décalages par plage. |
| S5 | Calques Canvas + SVG superposés : alignement au pixel près avec un DPR de 1, 2 et 1,5, et pendant le zoom. | Écart nul visible ; sinon tout passe en Canvas pour la série, survol compris. |
| S6 | Le motif clavier/lecteur d'écran (VoiceOver avec Safari et Chrome) : le point annoncé est-il compris ? | Écoute par le propriétaire ; on garde le motif qu'il comprend sans explication. |
| S7 | Limites du Canvas 2D à 1 et 10 millions de points, pour une ligne (décimée) et pour un nuage dense (non décimable) : temps par image pendant zoom et déplacement, en Chrome, Firefox et WebKit. | Le peintre WebGL2 (D.9) n'est écrit que si le Canvas dépasse 16 ms par image dans un de ces cas ; sinon il n'est pas fait. |
| S8 | Sélection au lasso et au rectangle sur 1 million de points : temps de calcul des points retenus pendant le geste. | Sous 16 ms par mouvement ; sinon grille de cases (comme `hit.ts`) et calcul final au relâchement seulement. |

### Résultats (2026-11-21, Mac Studio M4 Max ; « Chrome ×4 » = processeur bridé quatre fois, notre machine moyenne)

Détails et chiffres bruts : `spikes/<spike>/README.md` et `results/result.json`. Décisions **validées par le propriétaire le 2026-11-21** (« donne-moi la meilleure des choses, on a le temps ») ; deux sont relevées au meilleur niveau, voir D.20 et D.21 :

| Spike | Résultat | Décision proposée |
|---|---|---|
| S1 | Une ligne décimée reste fluide en SVG même à 10 M points de données (elle ne dessine que ~4 × largeur points). Les marqueurs SVG (`<circle>`) décrochent les premiers : 5 000 (Firefox, WebKit), 2 000 (Chrome ×4). | Le moteur se choisit sur les **marques dessinées**, pas les points des données. Lignes et aires : toujours décimées, toujours en SVG. **Canvas au-delà de 2 000 marques** (marqueurs, colonnes, bulles). |
| S7 | Ligne 10 M : fluide partout avec M4 sur pyramide (≤ 1,2 ms par image, même bridé). Nuage dense : Canvas `fillRect` échoue dès 1 M (167–450 ms) ; en pixels, 1 M tient partout, 10 M non (67 ms bridé, 27 ms WebKit). | La règle se déclenche **pour les nuages et bulles denses (≥ ~1 M points) seulement** : peintre WebGL2 pour ce cas, qui partagera ses fondations avec la 3D (D.18). Quand : **à décider** (1.0 ou vague 1.x). |
| S3 | Aucune décimation n'est exacte au pixel près avec un trait anticrénelé (le halo d'un demi-pixel) ; à l'œil, M4 donne la même ligne et garde les pics. M4 sur pyramide : 0,1–0,4 ms pour 10 M. | **M4 sur pyramide** par défaut ; LTTB en option. Le test « à l'œil » remplace le « 0 pixel » impossible. |
| S2 | Canvas `measureText` aussi rapide ou plus, d'accord avec le HTML à 0,014 px ; WebKit dessine le texte SVG jusqu'à 1,8 px plus large. `loadingdone` ne se déclenche pas pour une police ajoutée par `FontFace`. | `measureText` avec cache ; **marge de 2 px** autour des étiquettes ; `document.fonts.check` puis `document.fonts.load(police)` et nouvelle mise en page. |
| S4 | Les 6 cas de changement d'heure justes partout (Paris, Los Angeles, Auckland, Lord Howe, La Havane sans minuit). Coût p95 ≤ 1 ms par mise en page. | `Intl` seul, formateur en cache par fuseau, **pas de cache d'offsets**. |
| S5 | Boîte sur pixels entiers : identique à DPR 1 et 2. Boîte à un demi-pixel : décalage jusqu'à 1 px dans Firefox et WebKit. | Garder l'hybride **en calant le Canvas sur la grille des pixels physiques** ; revérifié en Phase 3 avec ce banc ; sinon la règle s'applique (série entière en Canvas). |
| S8 | Lasso sur 1 M points : test de chaque point 45–82 ms par mouvement ; grille 9–17 ms (p95 22). Rectangle : 4–5 ms. | Grille toujours ; à 1 M, aperçu par cases pendant le geste et sélection exacte au relâchement. |
| S6 | Page prête (`spikes/s6-screen-reader/`, deux motifs). | **En attente de l'écoute du propriétaire.** |

## 13. Budgets de taille **[À MESURER]**

Minifiés et gzippés, mesurés après la Phase 1 puis fixés par le propriétaire : `core` + `dom` pour un graphique en
ligne ; tout le périmètre ; la sparkline seule (cible : très petite, car il y en a une par cellule).

## 14. Exploration des données (D.15, D.16)

Chaque fonction aura sa fiche dans `docs/behaviors/` avant le code.

- **Viseur** : une ligne verticale (et horizontale en option) qui suit le pointeur, avec la valeur affichée sur chaque
  axe. Au clavier, il suit le point qui a le focus.
- **Mesure** : glisser d'un point à un autre affiche l'écart en valeur, en % et en durée.
- **Comparaison** : `compare: 'value' | 'percent' | 'index'` (écart, %, base 100), par rapport au premier point visible
  ou à une date de référence choisie. Elle se recalcule au zoom.
- **Sélection de points** : rectangle, plage d'axe x et lasso ; Maj pour ajouter, Alt pour retirer ; Échap pour vider.
  Au clavier : Espace sélectionne le point qui a le focus, Maj + flèches étend la sélection. Les points sélectionnés
  sont mis en avant et les autres atténués. Un mode (zoom ou sélection) se choisit dans la barre d'outils ; le geste par
  défaut reste le zoom. Événement `select` avec les `key` des points, jamais leurs valeurs dans un `Problem`.
- **Exploration par clic (drilldown)** : un clic (ou Entrée) sur une colonne, une barre ou un secteur ouvre son détail.
  Le détail est fourni dans les options ou chargé par l'app (`loadDetail(point) → Promise`, avec un état « chargement »
  et une erreur traduite). Un fil d'Ariane, accessible au clavier, permet de remonter ; Retour arrière aussi.
  Sur un axe temporel, l'exploration peut être automatique : année → mois → jour, par agrégation dans le fuseau.
- **Menu de l'utilisateur** (D.16) : un bouton-menu (motif ARIA « menu button ») propose le type (parmi ceux qui ont
  du sens pour les données), l'agrégation et sa période, l'échelle linéaire ou log, la comparaison et l'export.
  L'app choisit ce que le menu propose.
- **Graphiques liés** : `linkCharts([a, b, c], { crosshair, zoom: 'x', selection })` synchronise le viseur, le zoom et
  la sélection par valeur de x ou par `key`. Avec DzGrid (Phase 7) : une sélection dans le graphique filtre ou
  sélectionne les lignes de la grille, et une sélection dans la grille met les points en avant.
- **Cas limites tranchés (2026-11-21)** : le menu Type agit sur une seule série (celle choisie), le graphique combiné
  reste combiné ; dans un groupe de liens, le niveau de détail est partagé comme la plage visible ; sélectionner un
  point agrégé sélectionne les points de l'app qu'il regroupe ; une série masquée disparaît aussi de l'infobulle, du
  tableau de données et de l'export (un export « toutes les données » reste possible par option).
- **État d'exploration** : `getView()` / `setView(view)` et l'événement `viewChange`. L'app peut sauver une exploration,
  la mettre dans l'URL, ou revenir en arrière.

## 15. Exigence de qualité (D.22)

Le produit doit être beau à l'écran et dans le code. En plus des règles de `CLAUDE.md` :

- **Vocabulaire** : un `GLOSSARY.md` (skill `domain-modeling`) avant la Phase 1. Un mot = une idée, partout (code, docs,
  messages). Chaque décision structurante a son ADR dans `docs/adr/`.
- **Design des graphiques** : le thème, la palette, les marques, le survol et la légende suivent la méthode du skill
  `dataviz` (palette validée par script, en clair et en sombre, contrastes, jamais la couleur seule).
- **API** : chaque type public est relu avant d'être écrit (relecture de types, `pr-review-toolkit:type-design-analyzer`) ;
  les invariants vivent dans les types, pas dans des commentaires.
- **Tests** : attentes écrites à la main ; tests par propriétés pour les échelles, les ticks et la décimation (par
  exemple « M4 garde le min et le max de chaque colonne ») ; **images de référence** dans de vrais navigateurs pour
  chaque type de graphique, en clair, sombre, RTL et DPR 2 ; scènes comparées en JSON pour le cœur.
- **Performance** : les bancs de la Phase 0 deviennent des tests de non-régression (`npm run bench`), avec des seuils
  fixés par le propriétaire.
- **Revue** : à chaque fin de phase, une revue de code et une passe de simplification (skills `code-review` et `simplify`),
  en plus de la vérification d'architecture.
- **Questions de design** : une maquette jetable (skill `prototype`) avant de coder une interaction dont la forme
  n'est pas évidente (lasso, drilldown, menu de l'utilisateur).
