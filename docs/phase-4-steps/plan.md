# Phase 4 — Modules, empilement, échelle log, secteurs, anneau, jauge : plan détaillé

> Rédigé le 2026-11-21. **À valider par le propriétaire avant tout code.** Vocabulaire : `GLOSSARY.md` ; décisions :
> `ARCHITECTURE.md` (D.1–D.23), `docs/adr/` ; ce que la Phase 3 a laissé : fin de `docs/phase-3-steps/plan.md`.
> Le propriétaire a dit oui (2026-11-21) aux modules qu'on importe (ADR 0006) et à passer à la Phase 4 ; la Phase 3 bis
> (WebGL2) vient après.

## But

À la fin de la Phase 4, une app n'embarque que ce qu'elle importe (types de séries **et** fonctions : temps, zoom,
navigateur, Canvas), et DzGraph dessine les séries empilées (normal et pourcentage), l'échelle logarithmique, les
graphiques combinés sur un ou deux axes, les secteurs, l'anneau et la jauge — avec survol, clavier, lecteur d'écran,
tableau, animation et RTL comme le reste.

## Les étapes

1. **ADR 0006, modules de fonctions** : `chart(el, options, { types, features })`, `allFeatures` comme `allTypes` ;
   `timeAxis`, `zoom`, `navigator` (avec les boutons de plage ; demande `zoom`), `canvas` (sans lui, tout en SVG).
   Une option utilisée sans son module devient un `Problem` (`missing-module`). Coutures : `normalize` (échelles),
   `layout` (places réservées), `composeScene` (groupes ajoutés), crochets du DOM dans les étapes du graphique.
   Mesure avant/après ; budgets par application (ligne seule, tout).
2. **Fiches** : `stacking.md`, `log-scale.md`, `combined.md`, `pie-donut.md`, `gauge.md` — avant le code.
3. **Empilement** : colonnes, barres et aires empilées, normal et pourcentage ; valeurs négatives empilées à part ;
   trous ; l'axe et l'infobulle (total, part) ; le tableau.
4. **Échelle log** : graduations par décade (1, 2, 5 × 10ⁿ selon la place), étiquettes ; valeurs nulles ou négatives.
5. **Combinés et double axe** : déjà possibles ; fiche, cas de référence, ce qui manque (colonnes + ligne + second axe
   aligné, légende).
6. **Repère polaire** (ADR 0005 : un système de coordonnées enregistré) : secteurs, anneau (texte au centre), jauge ;
   survol, clavier (flèches autour du cercle), lecteur d'écran, tableau, animation (les secteurs s'ouvrent), RTL
   (sens de rotation).
7. **Navigateurs et clôture** : références, trois navigateurs, revue de code, vérification d'architecture, tailles.

## Questions pour le propriétaire

1. **Empilement, comment l'écrire ?** Proposé : `stack: 'nom'` sur chaque série (les séries du même nom s'empilent ;
   `true` = le groupe par défaut), et `stacking: 'percent'` sur l'axe y pour les parts.
2. **Secteurs, étiquettes et petites parts ?** Proposé : étiquettes dehors avec un trait de rappel, la part en % ; au-delà
   de 7 parts ou sous 2 %, les plus petites rejoignent « Autres » (option pour l'empêcher).
3. **Jauge, quelle forme ?** Proposé : un arc plein (demi-cercle) avec la valeur au centre, et des bandes de seuils en
   option ; pas d'aiguille.
4. **Échelle log et valeurs ≤ 0 ?** Proposé : le point devient un trou, signalé (`non-positive-log`), jamais deviné.

## Décisions du propriétaire (2026-11-21)

1. Empilement : `stack: 'nom'` sur chaque série (`true` = la pile par défaut), `stacking: 'percent'` sur l'axe y.
2. Secteurs et anneau : étiquettes dehors avec un trait de rappel et la part en % ; au-delà de 7 parts ou sous 2 %,
   les plus petites rejoignent « Autres » (une option l'empêche).
3. Jauge : arc plein en demi-cercle, valeur au centre, bandes de seuils en option ; pas d'aiguille.
4. Échelle log : une valeur nulle ou négative devient un trou, signalé `non-positive-log`.
5. Modules qu'on importe (ADR 0006) : oui, en première étape.

## Notes d'avancement

- **Étape 1 (2026-11-22), faite.** ADR 0006. Écart au plan : le module du navigateur s'appelle `navigatorStrip` (un
  export `navigator` cacherait la variable globale du navigateur web dans l'app) ; l'option reste `navigator: true`.
  Le zoom par l'app (`setRange`) ne demande aucun module ; le bouton « réinitialiser » vient avec `zoom`. Ligne seule
  37,3 → 30,6 KB gzip ; tout 39,1 KB.
- **Étape 2 (2026-11-22), faite.** Fiches `stacking.md`, `log-scale.md`, `combined.md`, `pie-donut.md`, `gauge.md` ;
  glossaire : pile, part, « Autres », seuil. Choix faits en route, à revoir si le propriétaire le veut : les lignes ne
  s'empilent pas (signalé) ; le tableau ajoute une colonne « Total » par pile ; les piles ne sont pas décimées ;
  secteurs dans l'ordre des données, sens horaire (anti-horaire seulement avec `mirror`, comme l'axe x) ; un seul
  secteur/anneau et une seule jauge par graphique en Phase 4 ; la jauge se remplit dans le sens de lecture et
  s'expose comme un `meter` ARIA ; l'option des seuils s'appelle `thresholds` (« band » et « zone » sont déjà pris).
- **Étape 3 (2026-11-22), faite.** Empilement ; `stack.ts`, `layout.stacks`. Écarts à la fiche, repris dans la fiche :
  `stack` n'est pas une option des lignes (`unknown-option`, le compilateur le refuse aussi) ; une pile ne mêle pas
  deux types. Le tableau donne désormais une ligne par x aux colonnes aussi (avant : une par point). 597 tests.
- **Étape 4 (2026-11-22), faite.** Échelle log. Écarts à la fiche, repris dans la fiche : la valeur ≤ 0 est un trou
  partout, aussi dans le tableau (pas d'autre colonne gardée pour elle) ; le zoom en rapports égaux sur un axe x log
  est laissé (règle retirée avant le code). Avec trop de décennies, une graduation toutes les deux puissances peut
  laisser le haut de l’axe sans étiquette (10 M au-dessus de 1 M) : gardé, le pas reste le même partout.
- **Étape 5 (2026-11-22), faite.** Combinés et double axe. Reste connu : dans un graphique horizontal, une ligne n'a pas
  d'infobulle partagée (le survol partagé est vertical seulement, depuis la Phase 2) ; la règle 12 (un seul repère)
  vient avec le repère polaire, étape 6.
- **Étape 6 (2026-11-22), faite.** Repère polaire, ADR 0007 (écrit avant le code ; à relire par le propriétaire). Choix :
  les parts d'un secteur sont des points, masquées par une clé de point dans la vue ; « Autres » est le point juste
  après les données ; la jauge est un `meter` ARIA dans un groupe ; le tableau d'un secteur ajoute une colonne
  « Part », celui d'une jauge ses bornes et son seuil. La ligne seule passe de 33,8 à 36,4 KB gzip : les coutures
  (log, polaire, légende des parts, tableau) sont dans le cœur ; à reprendre si le propriétaire veut un module.
- **Étape 7 (2026-11-22), faite.** Trois navigateurs, revue de code (9 défauts corrigés), vérification d'architecture.
  Restes : le test de propriété de la décimation a échoué une fois sans graine gardée (non reproduit) ; une ligne dans
  un graphique horizontal n'a pas d'infobulle partagée ; le poids des coutures (log, polaire) dans une app « une
  ligne » pourrait passer dans des modules ; un seul secteur ou une seule jauge par graphique.
