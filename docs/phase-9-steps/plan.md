# Phase 9 — le site de documentation : plan détaillé

> Rédigé le 2026-11-23 ; décisions du propriétaire le même jour. Modèle : le site de DzGrid (`/Users/nadou/Dev/dzgrid/website`,
> `docs/website-plan.md`), notre propre code, repris.

## Décisions du propriétaire (2026-11-23)

- Astro Starlight dans `website/` (son propre `package.json`, hors workspace, la bibliothèque lue dans
  `../packages/*/src`), versions figées comme DzGrid : `astro` 7.3.8, `@astrojs/starlight` 0.42.6,
  `@astrojs/markdown-remark` 7.3.2. Serveur de dev sur 4760 (le playground tient 4750).
- Anglais à la racine, français sous `/fr/` ; mêmes exemples et mêmes démos, données inventées dans la langue de la page.
- Contenu : prise en main → guides par tâche (graphiques vivants, code TypeScript et Angular en onglets, chaque exemple
  compilé) → une page par option → référence de l'API tirée de `api/*.api.txt` → **une galerie** (un graphique vivant
  par type et par usage d'exploration). `llms.txt` généré.
- GitHub Pages : `https://plinthworks.github.io/dzgraph/`, workflow `.github/workflows/docs.yml` (tests puis build) ; le
  propriétaire active Pages, rien n'est poussé par moi.

## Lots (un commit par lot, sur le mot du propriétaire)

1. **Squelette** : configuration, deux langues, la barre latérale entière et ses pages en attente, l'accueil (ce
   qu'est DzGraph, un graphique vivant), la prise en main TypeScript et Angular écrite ; `LiveChart` (un vrai graphique
   par démo, fait à l'approche de l'écran), `CodeTabs` ; les tests (chaque exemple compilé avec ngc strict, chaque
   page a sa jumelle de même forme, chaque lien arrive) ; le workflow.
2. **Guides** par tâche, chacun avec au moins une démo.
3. **Une page par option** (`ChartOptions`, les options de série, d'axe, de module), faits tirés des types.
4. **Référence de l'API** (depuis `api/*.api.txt`), **galerie**, `llms.txt`, le README pointe vers le site.
5. **Clôture** : revue, vérification dans les trois navigateurs (clair, sombre, droite à gauche), accessibilité (axe).

## Lot 1 — le squelette (fait le 2026-11-23)

`website/` (versions figées, fichier de verrouillage repris de DzGrid), les deux langues, la barre latérale entière (prise
en main, galerie, 12 guides, options, API) et ses 15 pages en attente dans chaque langue, chacune pointant vers sa fiche ;
l'accueil (un graphique vivant de visiteurs inventés), la prise en main TypeScript et Angular écrites dans les deux langues
(même code, données et titres dans la langue de la page) ; `LiveChart` (options en JSON, fonctions par nom, langue de la
page, jeux de données inventés générés : `walk`, `cloud`), `CodeTabs` (TypeScript, Angular) ; les tests
(`website/test/pages.test.ts`, `examples.test.ts`, repris de DzGrid : chaque exemple compilé par ngc strict, chaque page a
sa jumelle de même forme, chaque lien arrive) dans le projet `tools` ; le workflow `.github/workflows/docs.yml`.
37 pages construites. Chrome : en et fr, clair et sombre, chaque démo dessinée, aucun message dans la console.

## Lot 2 — les guides (fait le 2026-11-23)

Les 12 guides dans les deux langues (données, types de séries, axes et temps, interactions, exploration, gros volumes,
export et impression, accessibilité, thème et droite à gauche, Angular, DzTooltip, DzGrid), 26 démos vivantes, chaque
exemple compilé. Écrits par quatre agents en parallèle sur les sources et les fiches, relus et vérifiés ensuite :
tests du site, construction, Chrome (en et fr, clair et sombre : chaque démo dessinée, aucun message), images regardées.
Le zoom, le navigateur et la vue sont dans « exploration » (comme le disaient les pages en attente).

Trouvé par les démos et corrigé (test d'abord) : un axe de temps à une seule valeur (une année agrégée seule) montrait
des millisecondes, et une colonne seule ajoutait une demi-unité ; descendre dans une année que les données ne font que
commencer décalait l'année pour tenir dans les données. Le README d'Angular (`$event.point`) et deux phrases de la prise
en main Angular (le détail des sorties ; `types`/`features` ne réduisent pas le paquet livré) corrigés.

À décider par le propriétaire : `DzChart` prend `allTypes` et `allFeatures` par défaut, si bien qu'une app Angular
embarque tout quoi qu'elle passe. `drilldown: 'time'` part toujours des années, même avec `xAxis.aggregate` donné.

## Lot 3 — une page par option (fait le 2026-11-23)

Décision du propriétaire : une page par clé, comme DzGrid. Six groupes sous `options/` (graphique, séries, types de
séries, axes, création, fonctions), 69 pages par langue et la page d'ensemble. Les faits viennent des sources : balises
`@default` et `@feature` dans les commentaires des types (ôtés de la surface d'API), `scripts/gen-options.mjs`, le
composant `OptionFacts` ; deux tests (les faits à jour et chaque option sa page ; chaque `@feature` tenu par le graphique
lui-même). Pages écrites par quatre agents sur un pilote (`crosshair`), puis vérifiées : tests, construction, Chrome
(142 pages, chaque démo dessinée, aucun message, chaque lien répond), images regardées.

Trouvé et corrigé : le `drilldown` d'une série sans sa fonction était ignoré sans un mot (maintenant `missing-module`) ;
un tableau de données montré débordait d'une démo de hauteur fixe (la démo prend alors la hauteur automatique, et la
page `dataTable` dit pourquoi).

À décider par le propriétaire, en plus du lot 2 : les `messages` donnés remplacent un groupe de mots entier (`menu`,
`exporting`, `drill`, `shapes`) au lieu de le compléter ; les commentaires de `DzChart` promettent encore « pass only
those you use to ship less », ce qui est faux tant que `allTypes`/`allFeatures` sont ses valeurs par défaut.
