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
