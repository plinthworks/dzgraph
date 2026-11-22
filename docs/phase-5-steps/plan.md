# Phase 5 — Exploration : plan détaillé

> Rédigé le 2026-11-22, validé par le propriétaire le même jour (décisions en fin de page). Ce qui est déjà tranché : D.15, D.16,
> D.21 et `ARCHITECTURE.md` §14 (y compris les cas limites du 2026-11-21). Vocabulaire : `GLOSSARY.md` (Exploration,
> View, Crosshair, Measure, Comparison, Baseline, Selection, Lasso, Drill, Level, Breadcrumb, Aggregation, Period,
> Bucket, Link group).

## But

À la fin de la Phase 5, l'utilisateur explore les données sans quitter le graphique. Il dispose du viseur, de la
mesure entre deux points, de la comparaison (écart, %, base 100), de la sélection (rectangle, plage, lasso, clavier),
de l'exploration par clic avec un fil d'Ariane, de l'agrégation par période, d'un petit menu (type, agrégation,
échelle, comparaison) et des graphiques liés. Tout l'état tient dans une vue que l'app lit, sauve et rend
(`getView` / `setView` / `viewChange`). Chaque fonction est un module importé (ADR 0006), et chacune va jusqu'au
survol, au clavier, au lecteur d'écran, au tableau, à l'animation et au RTL.

## Les étapes

1. **Fiches et ADR 0009** : `crosshair.md`, `measure.md`, `compare.md`, `selection.md`, `drilldown.md`,
   `aggregation.md`, `menu.md`, `linked-charts.md`, `view-state.md`, toutes avant le code. L'ADR 0009 décrit la vue
   comme seul état d'exploration : sérialisable, sans données de l'app, rejouée par `setView`.
2. **La vue complète** (`ChartView`) : séries masquées, plage, comparaison, sélection (par `key` ou par index), niveau
   de détail et agrégation. Elle vient avec `getView`, `setView` et l'événement `viewChange`. Une vue invalide
   devient un `Problem`, jamais une exception.
3. **Viseur** : ligne verticale, horizontale en option, et la valeur écrite sur chaque axe. Au clavier, il suit le
   point qui a le focus.
4. **Comparaison** : `compare` sur l'axe y (écart, %, base 100), par rapport au premier point visible ou à une date
   choisie. Elle est recalculée au zoom, et les ticks, l'infobulle et le tableau la montrent.
5. **Mesure** : un geste d'un point à un autre affiche l'écart en valeur, en % et en durée. Il existe aussi au clavier.
6. **Sélection** : rectangle, plage d'x et lasso exact en direct (D.21 : seules les cases touchées par le nouveau
   segment sont retestées). Maj ajoute, Alt retire, Échap vide. Au clavier, Espace et Maj + flèches. Les points
   sélectionnés sont mis en avant, les autres atténués. Événement `select` avec les `key`, et le lot WebGL2 garde
   l'atténuation.
7. **Agrégation** : par période dans le fuseau (heure, jour, semaine, mois, trimestre, année) ou par cases de valeurs.
   Sélectionner un point agrégé sélectionne ceux qu'il regroupe.
8. **Exploration par clic** : le détail est donné dans les options ou chargé par l'app (`loadDetail` qui renvoie une
   promesse, avec les états « chargement » et erreur traduite). Un fil d'Ariane au clavier et Retour arrière
   permettent de remonter. Sur un axe de temps, l'exploration est automatique (année → mois → jour).
9. **Menu** (motif ARIA « menu button ») : type d'une série, agrégation et période, échelle, comparaison. L'export
   viendra en Phase 6. L'app choisit ce que le menu propose.
10. **Graphiques liés** : `linkCharts([a, b], { crosshair, zoom: 'x', selection })`, par valeur de x ou par `key`. Le
    niveau de détail y est partagé comme la plage.
11. **Clôture** : références, trois navigateurs, revue de code, vérification d'architecture, tailles, bancs (lasso
    sur 1 M points).

## Décisions du propriétaire (2026-11-22)

1. **Modes à la souris** : une barre de modes en haut, au bout du graphique : Zoom (par défaut), Sélection, Mesure.
   Elle n'apparaît que si l'app importe ces modules.
2. **Agrégation par défaut, selon le type** : somme pour les colonnes et les barres, moyenne pour les lignes et les
   aires. L'app ou le menu peut choisir min, max, somme, moyenne ou compte.
3. **Graphiques polaires** : on sélectionne par clic (Maj pour ajouter) ou par Espace. Ni rectangle, ni lasso, ni
   mesure, ni viseur.
4. **Découpage** : la phase 5a couvre les étapes 1 à 6 (vue, viseur, comparaison, mesure, sélection) ; la phase 5b
   couvre les étapes 7 à 10 (agrégation, exploration par clic, menu, graphiques liés). Une revue de code clôt chaque
   moitié.

## Notes

- **5a, étapes 1–4 faites (2026-11-22).** Fiches `view-state`, `modes`, `crosshair`, `compare`, `measure`,
  `selection` ; ADR 0009 ; terme Mode. Vue en JSON (`view-json.ts` : séries masquées, parts masquées par clé ou
  index, plage, comparaison ; `invalid-view`) ; `getView`, `setView`, `viewChange` (source, parties changées, une
  fois le geste au repos). Trouvé par le test : `getView` sans plage la taisait, et la redonner gardait la plage en
  cours ; elle est maintenant toujours écrite (null = tout). Viseur (`crosshair` : noyau pur qui rend des primitives,
  partie DOM sous la couche de survol, clavier par le point qui a le focus). Comparaison (`compare` : une affine par
  série composée avec l'échelle — types de séries, décimation et pyramides inchangés ; ligne de référence ;
  infobulle « Since … » et valeur brute ; tableau brut puis comparé ; résumé ; `no-baseline`). Écart à la fiche :
  une série sans référence garde son élément de légende tel quel (pas grisé : grisé veut dire masqué).
- **5a, étapes 5–6 faites.** Barre de modes (`modes.ts`, apportée par `measure` et `selection`, jamais par le zoom
  seul ; au début du bord haut du tracé, le bouton de retour du zoom gardant la fin), mesure (`measure` : cœur pur
  qui lit et dessine, mots du DOM ; souris, M au clavier, Échap ; événement `measure`), sélection (`selection` :
  rectangle, plage, lasso exact en direct par éventail de triangles — propriété contre un test pair-impair du contour
  entier ; aspect par le module ; clic, Maj, Alt, Espace, Maj + flèches ; tableau, résumé, étiquettes ; JSON par clé
  ou index ; `selectionChange` une fois au repos). Règle de Maj tranchée par le mode (modes.md 4).
- **Trouvé en chemin** : un lasso avec Maj combinait avec ce que ses propres mouvements avaient déjà changé (un point
  traversé puis laissé dehors restait ajouté) — il part maintenant de la sélection du début du geste (test d'abord) ;
  le viseur écrivait la valeur brute sur un axe comparé (« 0,5 » au lieu de « +0,52 % ») ; le garde des imports
  prenait `'measure/from'` pour un import (motif corrigé, auto-test).
- **Mesures** : lasso sur 1 M points, 22 → 5,4 ms par mouvement (95e centile 9,6 ; l'événement et l'annonce attendent
  le repos, chaque triangle ne lit que les cases qu'il couvre ligne par ligne). Premier mouvement 34 ms (positions et
  cases construites une fois).
- **Tailles** : une app « une ligne » 38,4 → 42,8 Ko gz : JSON de la vue (`getView`/`setView`, ADR 0009), mots des
  nouveaux modules dans les deux langues, lecture des nouvelles options. L'aspect de la sélection passe par le module.
  Budgets relevés (mesure + 5 %).
- **Références** : cas `compare`, `compare~hover`, `selected` (224 images). Le terrain de jeu n'importe `measure` que
  pour les cas d'exploration (sinon sa barre se poserait sur tous).

- **5a close (2026-11-22).** Code review (agent): 8 findings, each a test that failed first
  (`packages/dom/test/review-phase5a.test.ts`) — a view given back compared every axis like the first (`getView`
  now writes the user's comparison only); `setView` of the same view told a selection change (linked charts would
  loop); new data moved a keyed selection to other points or dropped it unsaid (carried by key, else by index, told
  when points go); a selection relaid the chart out (now the scene and the aids only; the test for this one passed
  before the fix: it checks the aids follow, not the layout kept); Shift + an arrow that moved nothing extended the
  next move; without zoom the first mode was one the chart did not have; any update dropped a measure; a cancelled
  lasso kept its half selection. Architecture check: every module reaches the chart through `features.ts`; the
  selection's look through the kit; `<dz-chart>` gained an output per new event (and `rangeChange`, missing since
  Phase 3). Gate green (894), three browsers green (1 488), 224 images match. Phase 5a closed.

## Restes (5a)

- Les mots des modules (modes, mesure, sélection, comparaison) sont dans les messages de chaque graphique : un découpage
  des messages par module les sortirait d'une app qui ne les importe pas (~1 Ko gz).

## 5b (2026-11-22)

- **Étapes 7–10 faites.** Fiches `aggregation`, `drilldown`, `menu`, `linked-charts`. Agrégation (`aggregation` :
  périodes sur le calendrier du fuseau — semaine ISO —, pas numériques ; somme pour colonnes et barres, moyenne
  sinon ; un modèle source et un modèle dessiné, la sélection passant de l'un à l'autre ; libellés en plages par
  `Intl.formatRange` ; nombre de points dans l'infobulle ; résumé). Drilldown (`drilldown` : détail par clé ou chargé,
  « Chargement… », échec et « Réessayer », délai de 10 s ; fil d'Ariane HTML au-dessus du graphique, sa hauteur ôtée ;
  Retour arrière, Alt + flèche vers le début de lecture ; chaque niveau garde sa vue ; temps automatique année → mois
  → jour ; chemin dans la vue ; événement `drill` ; sur un secteur, le clic descend et ne sélectionne pas). Menu
  (`menu` : bouton-menu WAI-ARIA, sous-menus de radios ; type d'une série, agrégation, échelle — log seulement si
  tout est positif —, comparaison ; choix dans la vue ; le calcul de ce qu'il offre vit dans le module). Graphiques
  liés (`linkCharts` : viseur par x, plage, sélection par clé ou x, drill ; drapeau contre les boucles ; API ajoutée :
  `showX`, `selectBy`, `x` dans `pointHover`, `xs` dans `selectionChange`).
- **Trouvé en chemin** : sous agrégation, `selectionChange` donnait les indices des mois dessinés, pas des points de
  l'app (lu dans la source désormais ; test ajouté après la correction) ; le bouton du menu s'affichait sur tous les
  graphiques (le `display` du thème l'emportait sur `hidden` ; test avec le thème chargé, d'abord en échec) ; l'espace
  autour du tiret des plages de dates diffère entre moteurs ICU (test qui compare les espaces comme des espaces) ;
  « remonter » au clavier par Alt + la flèche du début de lecture (garde des côtés physiques).
- **Tailles** : une app « une ligne » 46,5 Ko gz (mots des modules, lectures d'options, parties de la vue) ; budgets
  relevés (mesure + 5 %). Références : cas `aggregated` (232 images).

- **5b close (2026-11-22).** Code review (agent): 10 findings, each a test that failed first (`review-phase5b.test.ts`,
  `aggregation.test.ts` « review ») — `setView` with a drill path lost the view's other parts and stopped after one
  level (the level is now read at once, the drill applied first, a path not found reported); the layout kept a
  selection mapped to the old aggregation; the drill events came before the level was read (and a drill-driven range
  was not told); a load coming back after the user went elsewhere stacked its level (ticket moved by every
  navigation; the first test for this passed for a wrong reason and was rewritten); the breadcrumb dropped the
  keyboard focus; a bucket of 0.1 put 0.3 in 0.2; an x past the calendar's range threw; the view accepted a type, a
  scale or an aggregation the menu would not offer; the menu stayed open on a press outside and said « none » under an
  automatic time drill; time drill keys depended on the language (now the period's start). Gate green (937), three
  browsers green (1 587), 232 images match. Phase 5 closed.

## Restes (5b)

- Sur un axe de temps, une colonne agrégée est centrée sur le début de sa période ; elle devrait couvrir la période.
- Le pointeur en main au-dessus d'un point qui a un détail (drilldown.md 1) n'est pas fait ; l'annonce l'est.
- Les détails grandissent depuis le point (drilldown.md 2) : l'animation d'apparition habituelle est utilisée.
- Les mots des modules dans les messages de chaque graphique : un découpage par module (~2 Ko gz).
