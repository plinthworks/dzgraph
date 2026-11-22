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
