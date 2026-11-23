# Phase 8 — graphique tiré de DzGrid, vérification complète, préparation de la 1.0 : plan détaillé

> Rédigé le 2026-11-23 ; décisions du propriétaire le même jour (en fin de page). Déjà tranché : D.14 (0.x jusqu'à la
> fin du périmètre v1, puis 1.0.0), D.15 (exploration avec DzGrid), ARCHITECTURE §2 (un pont décrit DzGrid par des
> types structurels, sans l'importer).

## But

À la fin de la Phase 8, une sélection dans DzGrid (bloc de cellules, lignes cochées, pivot) devient un graphique que
l'app place où elle veut et qui la suit ; tout DzGraph est vérifié une dernière fois ; les paquets sont prêts pour la
1.0.0, que le propriétaire publie.

## 8a — un graphique tiré de la grille

1. **Fiche `chart-from-grid.md`** (écrite avant le code).
2. **`chartFromGrid(chart, grid, options)`** dans `@dzgraph/dzgrid` : la source (pivot, bloc, lignes cochées), les
   colonnes (la première non numérique nomme les points : temps, jour ou catégorie ; chaque colonne numérique une
   série), les valeurs telles que la grille les lit, le type, le suivi (une fois par image ; pas les changements faits
   par code), l'arrêt. `gridTable(grid, options)` donne la même table sans graphique.
3. **`chartMenuItem(label, open)`** : l'entrée du menu de cellule de DzGrid.
4. **Clôture 8a** : revue de code, trois navigateurs, tailles.

## 8b — vérification complète et 1.0

5. **Vérification complète** : contrôle complet, trois navigateurs, images de référence, contrastes, mesures de
   performance, Angular 19 à 22, garde-fous ; relecture de chaque fiche contre ses tests (une règle sans test est
   testée ou retirée).
6. **API figée** : l'API publique de chaque paquet listée et relue (noms, options, événements, `Problem`), ce qui est
   interne retiré des exports ; un rapport d'API versionné qui échoue quand l'API change sans qu'on le dise.
7. **Paquets** : README par paquet, CHANGELOG, licence, champs du manifeste, versions 1.0.0, `npm pack` à blanc
   (contenu des archives vérifié). Le propriétaire publie.
8. **Clôture de la Phase 8** : vérification d'architecture, revue de code, `STATUS.md`.

## Décisions du propriétaire (2026-11-23)

- Source : le bloc de cellules, sinon les lignes cochées ; et le pivot.
- Le graphique est là où l'app le place et suit la sélection en direct (option pour un instantané) ; une entrée pour
  le menu de cellule de DzGrid, qui appelle l'app.
- Seuil WebGL des nuages : 100 000 points, mesuré (D.20 disait ~1 M) — tranché.
- 1.0 : tout prêt, le propriétaire publie ; le site de documentation reste en Phase 9.

## Choix faits seul (à relire)

- `chartFromGrid` reçoit un graphique déjà créé plutôt qu'un élément : l'app garde ses modules (et donc sa taille),
  son titre et ses options ; le pont ne remplace que `series` et `xAxis`.
- Sans sélection, le graphique garde ce qu'il montre : un clic hors de la grille efface son bloc, et l'utilisateur
  qui va vers le graphique ne doit pas le voir se vider.
- Des lignes cochées par code (source `api`) ne remplissent pas le graphique (un bloc posé par code, si) : sinon `linkGrid` à côté le réduirait aux
  points sélectionnés.

## Clôture 8a (2026-11-23)

Revue de code (agent) : 2 défauts corrigés, chacun par un test qui échouait d'abord — une colonne oui/non nommait les
points « true » / « false » (option `yesNo` : les mots de la grille) ; sur un axe de temps, les points gardaient le tri
de la grille (`unsorted-x`), ils sont maintenant dans l'ordre du temps. Trouvés en route, venus de la 7b : `linkGrid`
refusait une vraie grille à la compilation ; le pont DzTooltip dépassait son budget.

## 8b — relecture des fiches contre les tests (agent, 2026-11-23)

Règles sans test (chacune testée, ou retirée de sa fiche si elle n'est pas tenue) :
angular 5, 7 ; linked-charts 4, 6 ; drilldown 5, 8 ; columns-bars 5, 6 ; stacking 7, 13, 15 ; combined 7, 8 ;
hover-tooltip 12 ; crosshair 6, 8, 9 ; measure 6 ; zoom-pan 4 ; animation 4, 5 ; layout 7 ; legend-interaction 4 ;
selection 11 ; sparkline 11 ; print 5 ; export 10 ; dzgrid-link 3, 5, 6 (2ᵉ moitié), 7 ; dztooltip 5 ;
chart-from-grid 9 ; log-scale 6 ; compare 8, 10 ; aggregation 6 ; direction 6 (contradiction possible : `TextPrimitive.dir`
n'est jamais réglé selon le texte).
Couvertes faiblement : animation 3 ; range-buttons 4 ; modes 4 ; legend 3, 5 ; combined 6 ; axes 17 ; time-axis 3 ;
keyboard 5 ; aggregation 4 ; data-table 3, export 9, view-state 6 (cœur seulement) ; hover-tooltip 9.

Résultat : chaque règle de la liste a son test (`packages/core/test/audit-8b.test.ts`, `text-dir.test.ts`,
`packages/dom/test/audit-8b.test.ts`, et les fichiers des ponts et d'Angular). Quatre étaient fausses dans le code, chacune
corrigée après un test qui échouait :
- direction.md 6 : un libellé prend la direction de sa première lettre (« °C » s'affichait « C° » à droite à gauche) ;
  4 images de référence refaites, regardées avant ;
- hover-tooltip.md 12 / combined.md 7 : la portée d'une colonne large débordait sur la catégorie voisine (plafonnée à
  celle d'un point, 24 px) ;
- legend-interaction.md 4 : toutes les séries masquées, le tracé dit « Aucune donnée » ;
- angular.md 5 : les composants ne dessinent que dans le navigateur (`isPlatformBrowser`), quoi qu'exécute les crochets.
Couvertes faiblement, laissées pour plus tard (aucune n'est fausse à notre connaissance) : animation 3 ; range-buttons 4 ;
modes 4 ; legend 3, 5 ; combined 6 ; axes 17 ; time-axis 3 ; keyboard 5 ; aggregation 4 ; data-table 3, export 9,
view-state 6 (cœur seulement) ; hover-tooltip 9.

## Clôture 8b (2026-11-23)

Revue de code (agent) : 1 défaut corrigé après un test qui échouait — le plafond de portée d'une colonne (24 px)
s'appliquait aussi aux graphiques de colonnes seules, où une colonne répond dans toute sa bande (hover-tooltip.md 2, 3) :
il ne vaut plus qu'à côté de lignes. Un doute levé par un test (un secteur aux parts toutes masquées dit bien « Aucune
donnée »). Contrôle complet (1 163), trois navigateurs (2 046), 232 images, `release:check` avec Angular 19 à 22, bancs
au niveau d'avant.
