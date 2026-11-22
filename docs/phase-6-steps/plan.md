# Phase 6 — Export et impression : plan détaillé

> Rédigé le 2026-11-22 ; décisions du propriétaire le même jour (en fin de page). Déjà tranché : D.3 (fait maison,
> aucun service distant), D.23 (le CSV suit le choix du tableau : plage visible ou toutes les données), ADR 0001 (une
> scène, plusieurs sorties), ADR 0006 (une fonction = un module importé), §14 (le menu propose l'export).

## But

À la fin de la Phase 6, l'utilisateur emporte le graphique : une image (PNG, SVG), ses données (CSV) ou une page
imprimée. Tout vient du même modèle et de la même scène que l'écran, sans serveur ni dépendance. L'app a l'API
(`exportSvg`, `exportPng`, `exportCsv`, `download`, `print`) ; l'utilisateur a les entrées du menu.

## Les étapes

1. **Fiches** : `export.md` (image PNG et SVG, nom de fichier, téléchargement), `csv.md`, `print.md` ; terme Export
   dans le glossaire.
2. **La scène d'export** (cœur) : la vue telle qu'à l'écran (plage, séries masquées, sélection, comparaison,
   agrégation, niveau de détail), titre et légende compris, sans les calques de commande (navigateur, survol, viseur,
   mesure) ; à la taille de l'écran ou à une taille donnée (nouvelle mise en page, pas une mise à l'échelle). Le SVG
   autonome porte `role="img"`, `<title>`, `<desc>` (le résumé), `lang` et `direction`, couleurs et polices résolues.
3. **CSV** (cœur, `csv.ts`) : les lignes de `dataRows` sans limite ; RFC 4180 (virgule, point, guillemets doublés,
   CRLF), dates ISO avec décalage dans le fuseau de l'axe, valeurs brutes ; BOM UTF-8 ; option `locale` (`;` et
   virgule décimale) ; une cellule de texte commençant par `=`, `+`, `-`, `@`, tabulation ou retour est neutralisée
   (injection de formules). Les colonnes suivent le tableau (séries visibles, comparé, sélection, nombre de points
   agrégés).
4. **Module `exporting`** (DOM) : `exportSvg()` (chaîne), `exportPng({ scale, width, height })` (Blob, toute la
   scène repeinte sur un Canvas hors écran, texte compris, polices de la page attendues), `exportCsv()` (chaîne),
   `download('png' | 'svg' | 'csv')` (nom tiré du titre). Sans le module, chaque méthode signale `missing-module`.
5. **Impression** : `print()` imprime le graphique seul (iframe cachée, thème clair, le tableau en option) ; et
   `@media print` dans le thème pour une page imprimée entière (couleurs claires, commandes masquées, le graphique ne
   se coupe pas entre deux pages).
6. **Menu et Angular** : entrées « Télécharger » (PNG, SVG, CSV) et « Imprimer » quand l'app les autorise
   (`menu: { items: [..., 'export', 'print'] }`) ; méthodes du `<dz-chart>`.
7. **Clôture** : références (l'export SVG comparé à l'écran), trois navigateurs, revue de code, vérification
   d'architecture, tailles.

## Décisions du propriétaire (2026-11-22)

1. **Contenu de l'image** : la vue, sans les boutons — ce que voit l'utilisateur (plage zoomée, séries masquées,
   sélection, comparaison), avec titre et légende ; sans barre de modes, menu, bouton de retour du zoom, fil
   d'Ariane.
2. **Thème** : PNG et SVG comme à l'écran (sombre si l'écran l'est) ; l'impression toujours en clair. L'app peut
   forcer `theme: 'light' | 'dark'`.
3. **CSV** : universel par défaut (virgule, point décimal, dates ISO avec décalage, valeurs brutes, UTF-8 avec BOM) ;
   option `locale: true` pour `;` et la virgule décimale (Excel en français).
4. **Accès** : menu (« Télécharger », « Imprimer ») et API.

## Choix faits seul (à relire)

- Le PNG repeint la scène sur un Canvas (texte compris) au lieu de passer le SVG par une image : les polices de la
  page n'atteignent pas un SVG chargé comme image.
- Le navigateur temporel n'est pas dans l'image : c'est une commande, comme les boutons.
- `scale` du PNG : par défaut le `devicePixelRatio` de l'écran (au moins 2), pour une image nette.

## Notes

- **Étapes 1–6 faites (2026-11-22).** Fiches `export`, `csv`, `print` (et menu.md 9, angular.md 7) ; termes Export et
  Print. Cœur : `exportScene` (la vue sans navigateur ni boutons de plage, remise en page à la taille demandée),
  `sceneToSvg` autonome (`role="img"`, `<title>`, `<desc>`, `lang`, couleurs rendues simples par `color`), `tableOf`
  (le tableau en nombres : l'écran l'écrit, le CSV le garde brut — une seule source), `csvOf` et `isoOf`. DOM : module
  `exporting` (`exportSvg`, `exportPng`, `exportCsv`, `download`, `print`), dessin Canvas partagé entre l'écran et
  le PNG (`canvas-draw.ts`, le texte en plus pour le PNG), couleurs lues dans le graphique sous le schéma demandé puis
  écrites en hexadécimal, impression par une iframe cachée où le SVG est une image (jamais analysé dans la page),
  `@media print` dans le thème, Canvas et WebGL2 repeints aux couleurs d'impression, option `exporting`, entrées
  « Télécharger » et « Imprimer » du menu, `chart` sur `<dz-chart>`. Une commande de test `printMedia` (vitest.config)
  vérifie les règles d'impression dans les vrais navigateurs.
- **Trouvé en chemin** : les gardes ont refusé `rgb()` écrit par le code (les couleurs sont maintenant écrites en
  hexadécimal depuis les octets lus), `parseFromString` (l'impression passe par une image) et un BOM écrit en clair ;
  WebKit relit le type d'un blob sans son `charset`. Le test « repeint au moment même du passage en impression »
  n'a pas pu être rendu fiable (la média émulée annonce son changement à un moment instable) : le test vérifie les
  couleurs d'impression du Canvas, pas l'instant.
- **Regardé à l'œil** (terrain de jeu, `dzgraphCharts`) : ligne en sombre, secteur en RTL, nuages Canvas et WebGL2 —
  l'écran, le PNG et le SVG ouvert seul sont identiques. Un nuage de 200 000 points donne un SVG de 13,8 Mo
  (export.md 7 : le PNG est fait pour ça).
- **Tailles** : core 10,8 Ko, dom 32,3 Ko, l'app avec tout 76,6 Ko, thème 1,9 Ko ; budgets relevés (mesure + 5 %).
  L'app « une ligne » n'embarque pas l'export.
- **Clôture (2026-11-22).** Revue de code (agent) : 9 constats, corrigés avec un test qui échoue d'abord sauf mention
  — l'impression avec tableau imprimait la copie cachée des lecteurs d'écran (1 px) ; → sur « Imprimer » ouvrait un
  sous-menu vide ; `wallOf` donnait l'année de l'ère (1 av. J.-C. lue comme 1) : années astronomiques maintenant,
  pour les axes aussi ; une fraction de milliseconde donnait un ISO invalide ; les marques combinantes (devanagari)
  devenaient des tirets dans le nom du fichier ; une taille ou une échelle infinie n'était pas écartée ; un
  téléchargement en cours pendant `destroy()` cliquait encore ; un décodage d'image sans fin gardait l'iframe (délai
  de 5 s, sans test). Laissé : un CSV de plus de ~10 M lignes dépasse la longueur maximale d'une chaîne (à faire en
  flux, plus tard).

## Restes

- Le CSV géant (au-delà de ~10 M lignes) : une écriture en morceaux (`Blob` de parties) au lieu d'une chaîne.
- L'iframe d'impression n'a pas les polices web de la page (le SVG nomme ses polices ; une police chargée par
  `@font-face` retombe sur la suivante).
- Les mots de l'export sont dans les messages de chaque graphique (le découpage des mots par module, reste de 5a).
