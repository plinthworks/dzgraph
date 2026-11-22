# Phase 3 — Temps, volumes, zoom : plan détaillé

> Rédigé le 2026-11-21. **À valider par le propriétaire avant tout code.** Décisions : `ARCHITECTURE.md` (D.1, D.9,
> D.12, D.20, D.23), ADR 0002 (choix du peintre, contraintes d'ordre), ADR 0004 (temps), spikes S1, S3, S4, S5, S7, S8 ;
> ce que les Phases 1 et 2 ont laissé : fin de leurs plans.

## But

À la fin de la Phase 3, DzGraph montre et explore des **séries temporelles** et de **gros volumes** : un axe de temps
juste dans n'importe quel fuseau (changements d'heure compris), des millions de points fluides, un zoom et un
déplacement à la souris, au doigt et au clavier, un navigateur sous le graphique et des boutons de plage.

## Ce qui sort de la phase

- **Cœur**
  - `time.ts` : heure murale par `Intl` (spike S4), instants d'une heure murale (aucun, un, deux), lecture des dates
    ISO (`ambiguous-instant` refusé), `Day`.
  - Échelle `time` et graduations temporelles dans le fuseau (minuit local, heure sautée ou doublée), niveaux
    (années → minutes) et formats d'étiquettes par niveau, en deux étages quand c'est utile (jours, et le mois dessous).
  - La **plage visible** dans la vue (`View.range`), le zoom et le déplacement en données pures (bornes, limites, pas de
    zoom en deçà d'un pixel par point).
  - La visée des nuages denses par une grille de cases (spike S8), et sa propriété contre une recherche exhaustive.
- **DOM**
  - Le **peintre Canvas** derrière l'interface `Painter` : groupes routés par la scène (ADR 0002), calé sur les pixels
    physiques (S5), sous les calques SVG ; le banc S5 rejoué sur le vrai peintre.
  - Le **peintre WebGL2** pour les nuages au-delà d'environ un million de points (D.20), ses fondations réutilisables
    pour la 3D.
  - **Zoom et déplacement** : glisser pour zoomer sur x, Maj + glisser pour déplacer, molette avec Ctrl/⌘, pincement et
    glissement au doigt, bouton « Réinitialiser le zoom », clavier (+ / − / flèches avec Maj), événement `rangeChange`.
  - Le **navigateur** (un mini-graphique de toute la série, deux poignées et une fenêtre déplaçable, au clavier aussi)
    et les **boutons de plage** (1 m, 3 m, début d'année, 1 an, tout — D.12).
  - Le tableau de données qui suit la plage visible, avec le bouton « toutes les données » (D.23).
- **Bancs** : `npm run bench` (les spikes S1, S3, S7, S8 devenus tests de non-régression, avec des seuils).
- **Fiches** : `time-axis.md`, `zoom-pan.md`, `navigator.md`, `range-buttons.md`, `big-data.md`, et `data-table.md` 5.

## Les étapes

1. Fiches de comportement.
2. Le temps dans le cœur (`time.ts`, échelle et graduations temporelles) ; tests à la main sur les jours de changement
   d'heure (repris du spike S4), propriétés, et `test:tz`.
3. La plage visible et le zoom en données pures ; la grille de visée.
4. Le peintre Canvas, le routage par la scène, le calage S5 ; images de référence avec Canvas.
5. Le zoom et le déplacement dans le DOM (souris, doigt, clavier) ; le bouton de réinitialisation.
6. Le navigateur et les boutons de plage.
7. Le peintre WebGL2 (nuages denses).
8. Les bancs, les images de référence, les trois navigateurs, la clôture (revue, architecture, tailles).

## Questions pour le propriétaire

1. **Gestes de zoom** — je propose : glisser = zoomer sur x ; Maj + glisser = déplacer ; molette = la page défile
   (zoom à la molette seulement avec Ctrl/⌘, pour ne pas piéger le défilement) ; au doigt : pincer pour zoomer,
   glisser pour déplacer quand on est zoomé.
2. **Étiquettes de temps** — je propose deux étages quand c'est utile (« 3 4 5 6 » puis « mars 2026 » dessous) plutôt
   qu'une seule ligne répétitive (« 3 mars, 4 mars… »).
3. **Navigateur** — je propose : désactivé par défaut, `navigator: true` l'affiche (il prend de la place).
4. **Découpage** — la phase est grosse : WebGL2 (étape 7) dans la Phase 3, ou dans une Phase 3 bis juste après ?

## Décisions du propriétaire (2026-11-21)

1. Glisser = zoomer sur x ; Maj + glisser = déplacer ; la molette fait défiler la page (zoom à la molette avec
   Ctrl/⌘) ; au doigt : pincer pour zoomer, glisser pour déplacer une fois zoomé.
2. Étiquettes de temps en deux étages quand c'est utile.
3. Navigateur désactivé par défaut (`navigator: true`).
4. Le peintre WebGL2 dans une **Phase 3 bis**, juste après ; l'étape 7 en sort.

## Notes en cours de phase

- Maj + ← / → déplace la plage quand le graphique est zoomé (zoom-pan.md 8) ; non zoomé, ces touches restent celles de
  la navigation. **Phase 5** : la sélection au clavier ne pourra pas prendre Maj + flèches telles quelles ; à trancher
  avec le propriétaire à ce moment-là.
- Le tableau suit la plage visible depuis 3.6 (D.23).
- Taille : le navigateur, les boutons de plage, le zoom et le temps sont dans chaque graphique (+10 KB gzip sur la
  Phase 2). À la vérification d'architecture : en faire des modules qu'on importe (comme les types de séries) ?

## Clôture (2026-11-21) : revue de code et vérification d'architecture

Corrigé, avec un test qui échouait d'abord :
- un peintre par série, les groupes Canvas en tête de chaque calque : l'écran et l'export dessinent dans le même ordre
  (ADR 0002 complété) ;
- le fuseau par défaut vient du DOM (`normalize(options, types, { zone })`) ; sans lui UTC, jamais l'hôte ;
- zoom sur catégories : l'axe des valeurs suit les catégories montrées (arrondies) ; + sur des données trop courtes
  pour zoomer ne laisse pas un « zoom » égal à tout ; un nuage plus étroit qu'une unité se zoome ; un jour sauté (Apia)
  ne donne plus deux graduations ; pas de 2 et 10 minutes dans les fuseaux à 15 et 45 minutes ; le navigateur trie
  une fois par colonne, sans les x NaN, et lit les bornes en cache ;
- poignées superposées : le premier mouvement choisit ; pincement à trois doigts arrêté ; gestes et navigateur
  écoutent avant le survol ; Canvas aligné sur l'origine du SVG en RTL (largeur fractionnaire) ; direction et langue
  relues à chaque dessin ; `setRange` mal appelé → `invalid-option`, ISO accepté sur un axe de temps ;
  `rangeButtons: true` hors axe de temps → `not-available`, pas de rangée ;
- vocabulaire : `rangeButtonSpan` (plus de « preset »), `dataTable: { show, rows }`, glossaire : Extent, Window,
  Plane, Second tier, Layer précisé ; ARCHITECTURE §4 et §5 à jour.

Écarts assumés :
- les bancs mesurent et rapportent, sans seuil (CLAUDE.md : mesuré, jamais affirmé) ;
- le zoom s'arrête à deux points sur la largeur (la fiche), pas à « un pixel par point » ;
- la bande du navigateur fait 40 px (fiche mise à jour).

Pour plus tard :
- **Phase 4 (question au propriétaire)** : faire du temps, du zoom, du navigateur et du Canvas des modules qu'on
  importe, comme les types de séries (ADR 0006 à écrire) ; le graphique en ligne reviendrait vers 29 KB gzip (36,9
  aujourd'hui). Aussi : n'embarquer que la langue utilisée (2,3 KB minifiés).
- **Phase 5** : le résumé pour lecteurs d'écran nomme la plage visible ; que font les flèches au bord de la plage
  (déplacer la plage ou s'arrêter) — règles à écrire dans les fiches d'abord ; Maj + flèches pris par le
  déplacement.
- **Phase 6** : le CSV suit le choix du tableau (D.23) ; boutons de plage dans l'export et l'impression (la rangée
  reste vide aujourd'hui) ; l'export PNG peint les groupes Canvas dans l'ordre de l'écran.
- **Phase 3 bis** : le nuage de 100 000 points zoome à 19 ms par image (Canvas) : WebGL2.
- `clientWidth` arrondit une largeur fractionnaire vers le haut (600,5 → 601) : le SVG déborde d'un demi-pixel ;
  mesurer par `getBoundingClientRect` (petit correctif, avec test).
- Opacité d'un groupe : Canvas l'applique marque par marque, SVG au groupe ; une série atténuée dense diffère un peu.

