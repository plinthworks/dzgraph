# Phase 3 bis — WebGL2 pour les nuages denses : plan

> 2026-11-22. Le propriétaire : « continue sans m'attendre ». Décisions prises seul, à relire : ADR 0008.

## Étapes

1. **Fiche et ADR** : `big-data.md` 6–11, ADR 0008 (lot de points en unités de données, WebGL2 maison).
2. **Cœur** : `Scale.affine` ; primitive `points` (au-delà de 2 000 marques) ; SVG (un chemin), interpolation,
   apparition, test de survol (grille typée, propriété contre les marqueurs) ; `painterFor` → `webgl2` au-delà du
   seuil ; ordre des groupes dans un calque : WebGL2, Canvas, SVG.
3. **Canvas** : le lot dessiné sans objet par point ; placement sur la grille des pixels partagé.
4. **Peintre WebGL2** (module `webgl`, amène `canvas`) : tampons haut/bas par colonne, shaders des symboles,
   couleurs du thème, découpe, opacité, contexte ouvert à la demande, perdu → Canvas, rendu → libéré.
5. **Bancs** : nuages de 100 k et 1 M (Canvas et WebGL2) ; le seuil WebGL2 fixé d'après eux.
6. **Références** : un cas `dense` ; trois navigateurs.
7. **Clôture** : revue de code, vérification d'architecture, tailles, documents.

## Notes
- **Fait 2026-11-22, étapes 1–6.** Fiche (`big-data.md` 6–11), ADR 0008 ; cœur : `Scale.affine`, primitive
  `points`, sortie SVG (un marqueur par point visible), animation (les points vont en ligne droite), apparition,
  survol par une grille typée (propriété contre les marqueurs), peintre choisi (WebGL2 au-delà de 100 000, puis
  Canvas, puis SVG ; dans un calque : WebGL2, Canvas, SVG) ; Canvas dessine le lot sans objet par point (mêmes pixels
  que les marqueurs, octet pour octet, et les images `crowd` inchangées) ; peintre WebGL2 (`webgl-painter.ts`,
  module `webgl` qui amène `canvas`), placement partagé (`raster.ts`).
- **Écart avec D.20** : le seuil WebGL2 est de 100 000 points, pas « ~1 M » ; mesuré (Canvas à 200 000 manque des
  images au zoom), à relire par le propriétaire.
- **Trouvé par le premier essai sur Mac** : un découpage haut/bas en flottants perd sa partie basse sous Metal (le
  compilateur réordonne les sommes) ; remplacé par pas entiers + reste (ADR 0008), testé à la milliseconde près sur
  1,76 × 10¹² ms.
- **Trouvé par les bancs** : ce qui ralentissait n'était pas le dessin. Le tableau de données construisait une ligne
  par point puis triait (0,5 s pour 1 M, 3 s pour 10 M) : une seule fusion en ordre de x, les séries non triées
  réduites à leurs 1 000 premiers points par un tas borné, plus un compte (propriété contre l'ancienne lecture, séries
  triées, non triées et mêlées). L'axe y ajusté à la plage visible parcourait tous les points à chaque image : cases
  sur x construites une fois par colonne (`x-buckets.ts`, propriété contre le parcours).
- **Mesures** (Chrome, `npm run bench`) : nuage 100 k sur Canvas 19 → 3,4 ms par image de zoom ; 200 k Canvas 4
  images de trop, WebGL2 0,9 ms ; 1 M et 10 M sur WebGL2 0,9 ms (premier dessin 94 ms et 400 ms). Survol de 10 M
  points juste après un zoom : 26 ms (la grille se construit une fois par scène).
- **Tailles** : dom 19,5 Ko gz (le peintre WebGL2), une app « une ligne » 38,4 Ko (+2 Ko : coutures communes —
  cases sur x, tas du tableau, lecture des lots par le SVG, le survol, l'animation). Budgets relevés à mesure + 5 %.

- **Clôture, revue de code** (agent, 2026-11-22) : pas de défaut grave. Corrigés, chacun par un test qui échouait :
  une différence d'entiers pouvait déborder en int32 (un point en haut de sa colonne, l'origine de la vue bornée de
  l'autre côté : dessiné 42 px à côté ; pas pris à 2²⁹) ; sans lecteur de couleur, le peintre dessinait en noir (il ne
  dessine plus rien) ; à l'apparition, marqueurs et nuages ne se fondaient pas (défaut ancien : l'interpolation prenait
  l'opacité d'arrivée ; elle va maintenant de l'une à l'autre). Écarté : une valeur infinie qui fausserait tableau et
  cases (la lecture des données en fait déjà des trous, `data.ts`).

## Restes

- Les coutures propres aux lots (~0,8 Ko gz : grille de survol des lots, `markersOf`, interpolation) pourraient sortir
  d'une app sans nuage par un registre des sortes de primitives.
- Survol de 10 M points juste après un zoom : 26 ms (une fois par scène) ; une grille gardée d'une scène à l'autre
  quand seules les cartes changent la ramènerait à rien.
- Pas de type « bulles » encore (D.20 les cite) : le lot a une taille unique ; des tailles par point iraient dans un
  attribut de plus.
- Un graphique dont le contexte WebGL2 n'a pu s'ouvrir (page déjà pleine) ne réessaie pas quand d'autres sont
  détruits ; il reste sur Canvas.
- Au-delà de ~130 M points, le tampon envoyé à la carte ne tient pas en mémoire (`RangeError` non rattrapée).
- Le survol admet un point jusqu'à 24 px hors du tracé alors qu'il est coupé à 6 px (comme avant, pour les marqueurs).
