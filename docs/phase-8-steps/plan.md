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
