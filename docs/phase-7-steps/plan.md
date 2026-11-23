# Phase 7 — Angular complet, sparklines, ponts : plan détaillé

> Rédigé le 2026-11-22 ; décisions du propriétaire le même jour (en fin de page). Déjà tranché : D.2 (sparklines en
> v1), D.4 (paquets `angular`, `dztooltip`, `dzgrid`), D.13 (Angular complet en Phase 7), D.15 (graphiques liés avec
> DzGrid), ARCHITECTURE §2 (graphe d'imports `core ← dom ← (angular, dztooltip, dzgrid)` ; un pont décrit DzGrid par
> des types structurels, sans l'importer).

## But

À la fin de la Phase 7, DzGraph se branche sur le reste de la famille : des sparklines pour les pages (tuiles,
phrases, cartes), un `<dz-chart>` et un `<dz-sparkline>` complets pour Angular, l'infobulle des points dessinée par
DzTooltip, et une grille DzGrid liée à un graphique (sélection dans les deux sens, filtre en option).

## 7a — sparklines et Angular

1. **Fiche `sparkline.md`**, sur le modèle de celle de DzGrid (même comportement, mêmes mots pour les lecteurs
   d'écran), dans le vocabulaire de DzGraph (`column`, pas `bar`).
2. **Cœur** (`sparkline.ts`, pur) : lecture des valeurs (nombres, trous ; le reste est un `Problem`), étendue (fixe ou
   tirée des valeurs, sans débordement près de ±1e308), géométrie en unités de la boîte (ligne, aire, colonnes,
   gagné / perdu), marques, résumé.
3. **DOM** (`@dzgraph/dom/sparkline`, son propre point d'entrée) : `sparkline(el, values, options)` → un SVG qui
   prend la taille de sa boîte sans la mesurer (`viewBox`, traits qui ne grossissent pas), `role="img"` et le résumé
   comme nom ; `update`, `destroy`, `problems`. Couleurs du thème (`--dzgraph-sparkline-*`). Budget de taille à part
   (cible : quelques Ko).
4. **Angular complet** : `<dz-sparkline>` ; `<dz-chart>` : chaque événement une sortie (vérifié), `chart` pour les
   méthodes (Phase 6), `exportPng` & co. via `chart`, SSR sans erreur, Angular 19 à 22 (`ngc`).
5. **Clôture 7a** : revue de code, trois navigateurs, tailles.

## 7b — ponts

6. **`@dzgraph/dztooltip`** : l'infobulle des points (survol, focus clavier) dessinée par `@dztooltip/core` —
   placements, tons, formes, animations — par une couture de DzGraph (le contenu reste le nôtre). Dépendance de pair :
   `@dztooltip/core` 1.x.
7. **`@dzgraph/dzgrid`** : `linkGrid(chart, grid, { by: 'key' })` — la sélection dans les deux sens par clé ; `filter:
   true` filtre la grille sur les points choisis ; `range: true` la filtre sur la plage visible. Types structurels,
   sans import de DzGrid.
8. **Clôture 7b et de la Phase 7** : revue de code, vérification d'architecture (graphe d'imports, ponts sans import
   de leurs hôtes à l'exécution), trois navigateurs, tailles.

## Décisions du propriétaire (2026-11-22)

1. **Sparklines hors grille seulement** : `@dzgraph/dom/sparkline` et `<dz-sparkline>` pour les pages ; en cellule,
   celles de DzGrid (`@dzgrid/dom/sparkline`). Pas de doublon.
2. **Lien grille ↔ graphique** : la sélection dans les deux sens par défaut ; filtre en option (sur les points choisis,
   ou sur la plage visible).
3. **DzTooltip** dessine l'infobulle des points ; les noms des boutons restent ceux du graphique.
4. **Découpage** : 7a (sparklines, Angular) puis 7b (ponts), une revue à la fin de chaque moitié.

## Notes

- **7a, étapes 1–4 faites (2026-11-22).** Fiche `sparkline` (celle de DzGrid dans nos mots). Cœur
  `@dzgraph/core/sparkline` (pur : lecture, étendue par moitiés, géométrie dans une boîte 100 × 100, marques, résumé) ;
  DOM `@dzgraph/dom/sparkline` (SVG étiré sur sa boîte, traits et points qui gardent leur épaisseur, `role="img"` et
  résumé, mots en / fr à part) : 1,8 Ko gz pour une app qui ne dessine que des sparklines. Thème `.dzgraph-sparkline`
  (palette posée sur l'élément, hors de tout graphique). Angular : `<dz-sparkline>`, sortie `drill` qui manquait à
  `<dz-chart>` (un test liste chaque événement, TypeScript refuse la liste quand un événement s'ajoute),
  `npm run check:angular` (le paquet construit compilé par Angular 19.2, 20.3, 21.2 et 22.3, gabarits stricts ; réseau,
  hors porte d'étape) : vert.
- **7a close.** Revue de code (agent) : une langue vide (`lang=""`) ou malformée levait dans `Intl` ; des options
  `null` levaient ; une longueur qui n'est pas un compte levait ; un point seul entre deux trous ne se voyait pas
  (maintenant un point de 3,5 px, vu à l'œil dans les trois moteurs ; Firefox calcule mal la boîte d'un trait non
  étiré : le test ne lit plus la taille du point). Le cas « borne donnée seule que les valeurs n'atteignent pas » était déjà juste : épinglé par un
  test. Budgets relevés : thème 2 240, sparkline 2 030 (1,94 Ko gz mesuré).

- **7b, étapes 6–7 faites (2026-11-22).** Fiches `dztooltip`, `dzgrid-link`. Couture dans DzGraph : un module peut
  dessiner l'infobulle des points (`Feature.tooltip` → `TooltipDrawer` : le contenu du graphique, le point dans la
  fenêtre, la direction) ; thème `.dzgraph-tooltip-content` (la palette posée sur le contenu, hors du graphique).
  `@dzgraph/dztooltip` : `dzTooltip(look)` sur une ancre virtuelle (règle 38 de DzTooltip), sans délai, sans groupe ;
  une défilement de la page cache la bulle (règle de DzTooltip, écrite dans la fiche). `@dzgraph/dzgrid` :
  `linkGrid(chart, grid, { selection, filter })`, types structurels du noyau de DzGrid ; les clés de ligne écrites comme
  DzGrid les écrit (`d:<longueur>:<id>`), un test les compare à `dataKey` / `idOfDataKey` de DzGrid. DzGrid n'a pas de
  filtre pour l'hôte : le lien filtre une colonne nommée (ensemble des clés, ou « entre » sur la plage). Tailles : pont
  DzTooltip 0,3 Ko, pont DzGrid 0,7 Ko (gz, hôtes à part).
- **Trouvé en chemin** : un défaut du peintre SVG depuis la Phase 1 — un élément qui gardait son id mais changeait de
  balise (une colonne qui prend un bout arrondi au zoom) était retiré alors qu'il marquait la place du suivant :
  `insertBefore` levait. Test qui échoue d'abord (`svg-painter.test.ts`), corrigé.
- **7b close (2026-11-22).** Revue de code (agent) : 7 constats corrigés, chacun avec un test qui échoue d'abord —
  une grille qui vide sa sélection quand on la filtre (`keepOnFilter: false`) perdait celle du graphique (le filtre
  passe maintenant avant la sélection) ; délier effaçait un filtre que l'utilisateur avait posé depuis sur la colonne ;
  chaque mouvement du pointeur replaçait la bulle deux fois (même point, même place : rien ; et le même point redonne
  la bulle après qu'un défilement l'a cachée) ; tout Échap de la page cachait la bulle (c'est au graphique de décider) ;
  l'ancre restait figée quand la page déplaçait le graphique (lue à chaque placement maintenant) ; le filtre de plage
  suivait chaque image d'un glisser (maintenant au repos du geste) et ignorait un graphique déjà zoomé au moment du
  lien. Laissés (faible confiance) : une échelle CSS (`transform: scale`) sur un ancêtre décale la bulle ; une option
  `dir` du graphique contraire à la direction calculée de son élément n'atteint pas le placement de DzTooltip (sans
  effet pour `top`, le défaut).
