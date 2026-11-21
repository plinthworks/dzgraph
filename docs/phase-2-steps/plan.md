# Phase 2 — Interactions : plan détaillé

> Rédigé le 2026-11-21. **À valider par le propriétaire avant tout code.** Vocabulaire : `GLOSSARY.md` ; décisions :
> `ARCHITECTURE.md` (D.1–D.22), `docs/adr/` ; ce que la Phase 1 a laissé pour celle-ci : fin de
> `docs/phase-1-steps/plan.md`.

## But

À la fin de la Phase 2, un graphique se lit **avec la souris, le doigt, le clavier et un lecteur d'écran** : survol
du point le plus proche, infobulle (partagée sur la verticale pour les lignes et aires, par marque pour colonnes,
barres, nuages), légende qui masque et affiche les séries, navigation point à point au clavier avec annonce, tableau
de données équivalent, animations d'apparition et de mise à jour (coupées par `prefers-reduced-motion`). Une app
Angular peut écrire `<dz-chart [options]="…" />`.

## Ce qui sort de la phase

- **Cœur** (pur, testé en node et dans les navigateurs) :
  - `hit.ts` — le point le plus proche : par x (recherche dichotomique sur une série triée), par distance (nuage :
    grille de cases, comme le spike S8), dans une colonne ou sa bande ; vérifié par propriétés contre une recherche
    exhaustive ;
  - `tooltip.ts` — le contenu de l'infobulle en données (en-tête : la valeur x formatée ; une ligne par série : signe,
    nom, valeur formatée) ; le DOM l'écrit, jamais en HTML ;
  - `a11y.ts` — l'ordre de navigation (série → point), le résumé généré (type, séries, étendues, en clés de messages +
    valeurs formatées), le modèle du tableau de données ;
  - `interpolate.ts` — une scène entre deux autres, par `sceneId` : nombres interpolés, chemins de même forme
    interpolés, fondu sinon ; ce qui apparaît vient de la ligne de base.
- **DOM** : un calque de survol (SVG au-dessus de tout, sans redessiner les séries, spike S1), l'infobulle (un élément
  HTML placé dans le graphique, côtés logiques, retournée au bord), le viseur vertical des lignes, la mise en avant
  (les autres séries atténuées), la légende cliquable et focalisable, le clavier et la région `aria-live`, le tableau
  de données, l'animateur (`requestAnimationFrame`, hook `animate` comme DzTooltip), les événements `pointHover`,
  `pointClick`, `pointFocus`, `legendToggle`.
- **Angular** : `@dzgraph/angular`, un composant `<dz-chart>` minimal (entrées signaux `options`, `types` ; sorties
  par événement ; `destroy` à la destruction), compilé par ng-packagr, Angular 19 à 22.
- **Fiches** : `hover-tooltip.md`, `legend-interaction.md`, `keyboard.md`, `screen-reader.md`, `data-table.md`,
  `animation.md`, `angular.md` — écrites avant le code.

## Les étapes

1. **Fiches de comportement**, observées sur les démos publiques, avec nos écarts voulus (droite à gauche, clavier,
   mouvement réduit).
2. **Cœur** : `hit.ts`, `tooltip.ts`, `a11y.ts`, `interpolate.ts` ; tests à la main + propriétés.
3. **Survol et infobulle** : calque de survol, viseur, infobulle, mise en avant ; souris et toucher (un appui montre,
   un appui ailleurs cache ; pas de survol sur écran tactile).
4. **Légende** : clic, Entrée/Espace, `legendToggle` ; la vue (`View.hidden`) change, l'axe se recalcule, animé.
5. **Clavier et lecteur d'écran** : le motif choisi après l'écoute S6 ; annonce du point ; résumé ; tableau de données.
6. **Animation** : apparition (les lignes se dévoilent, les colonnes poussent de la ligne de base), mise à jour
   (interpolation), `prefers-reduced-motion` coupe tout, hook `animate`.
7. **Angular** : spike court d'abord (tests de composants Angular dans le mode navigateur de vitest **[À VÉRIFIER]**),
   puis `<dz-chart>`.
8. **Navigateurs et clôture** : images de référence des états (survol, infobulle, focus, série masquée) ; parcours
   clavier joués par Playwright dans Chrome, Firefox, WebKit ; revue de code, vérification d'architecture, gate,
   tailles.

## Questions pour le propriétaire

1. **Motif clavier (S6)** : votre écoute tranche. Sans écoute, je propose le motif B (chaque point prend le vrai
   focus : le lecteur le lit, et le parcours VoiceOver marche aussi).
2. **L'infobulle** : celle de DzGraph (simple, sans dépendance), le pont DzTooltip en Phase 7 ; ou le pont DzTooltip
   dès cette phase.
3. **Mise en avant** : au survol d'une série ou de son item de légende, les autres s'atténuent.
4. **Animation** : durées et activation par défaut.

## Décisions du propriétaire (2026-11-21)

1. Motif clavier **B** (chaque point prend le vrai focus), à ajuster après l'écoute S6.
2. Infobulle de DzGraph, sans dépendance ; le pont DzTooltip en Phase 7.
3. Mise en avant : au survol d'une série ou de son item de légende, les autres à 35 % d'opacité ; une option la coupe.
4. Animations activées et sobres : apparition 400 ms, mises à jour 250 ms ; aucune sous `prefers-reduced-motion` ;
   `animation: false` les coupe. *Précision (2026-11-21) :* l'apparition n'utilise que transform, opacité et une
   découpe ; une mise à jour de valeurs doit déformer les tracés eux-mêmes (animation.md).


## Après la clôture (2026-11-21) : reporté, d'après la revue et la vérification d'architecture

- **Phase 3** : la visée des nuages denses par une grille de cases dans le cœur (spike S8 ; aujourd'hui `hitMark` lit
  la scène, O(n) par mouvement, bon jusqu'au seuil Canvas) ; une propriété pour `hitMark` ; la plage visible dans la
  vue, et les aides (points au clavier, tableau) qui la suivent ou non — **question pour le propriétaire** : le
  tableau montre-t-il la plage visible ou toutes les données ?
- **Phase 5** : la navigation (`navigate.ts`) gagne Maj + flèches et Espace pour la sélection ; les événements portent
  déjà la clé (`withKey`).
- **Phase 7** : les ponts passent une liste de types réduite (`<dz-chart>` prend `allTypes` par défaut) ; la
  compatibilité Angular 19 à 22 vérifiée par `ngc` sur chaque version (comme DzTooltip).
