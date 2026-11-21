# S6 — Écoute au lecteur d'écran

## Question

Quel motif clavier / lecteur d'écran un utilisateur comprend-il sans explication ?

- **Motif A** : le graphique est une seule zone (`role="application"`) ; les flèches déplacent un repère et une région
  `aria-live` annonce le point.
- **Motif B** : chaque série est une liste, chaque point un élément qui prend le vrai focus (tabindex mobile). Le
  lecteur lit l'élément ; son mode navigation (VO + flèches) parcourt aussi les points.

Règle de décision : le propriétaire écoute les deux ; on garde celui qu'il comprend sans explication.

## Écoute (propriétaire)

1. `node spikes/s6-screen-reader/serve.mjs`, ouvrir l'adresse dans Safari, puis dans Chrome.
2. VoiceOver : Cmd + F5.
3. Tab jusqu'au graphique A, puis flèches gauche/droite, haut/bas, Début/Fin. Même chose pour B.
4. Essayer aussi VO + flèches (navigation VoiceOver) sur B, et le bouton « Afficher le tableau de données ».
5. Noter : ce qui est lu, si c'est compréhensible, et le motif préféré.

Données inventées (un verger fictif).
