# DzGraph

Une bibliothèque de graphiques pour montrer **et explorer** des données. Les termes sont ceux du code (anglais) ; le
mot entre parenthèses est celui que voit l'utilisateur français.

## Le graphique et ses parties

**Chart** (graphique) :
Ce que l'app monte dans un élément : des séries, leurs axes, leur légende, dans une seule zone.
_Avoid_: graph, graphe, plot, visualisation

**Plot area** (zone de tracé) :
Le rectangle où les séries sont dessinées, à l'intérieur des axes.
_Avoid_: canvas, drawing area, chart area

**Series** (série) :
Une suite de points de même nature, dessinée d'une seule façon et nommée dans la légende.
_Avoid_: dataset, trace, line (pour une série en général)

**Series type** (type) :
La façon de dessiner une série : ligne, aire, colonnes, barres, nuage, secteurs… Un graphique combiné mélange plusieurs
types ; l'utilisateur le change série par série.
_Avoid_: chart type, kind

**Point** (point) :
Un enregistrement d'une série : sa position (x, y ou valeur), sa clé, et ce que l'app y attache.
_Avoid_: datum, data point, row, sample

**Key** (clé) :
L'identité stable d'un point, fournie par l'app ; c'est elle qui relie un point à une ligne de DzGrid ou à un point
d'un autre graphique.
_Avoid_: id, index (un index est une position, pas une identité)

**Mark** (marque) :
Ce qui est dessiné pour un point : un marqueur, une colonne, un secteur, un sommet de ligne.
_Avoid_: shape, glyph, element

**Coordinate system** (repère) :
La façon dont un graphique place ses points : plan x/y, polaire, sans axes (hiérarchies), 3D, géographique.
_Avoid_: projection (réservé aux cartes), frame

**Orientation** (orientation) :
Le sens d'un graphique en x/y : vertical (colonnes qui montent) ou horizontal (barres couchées) ; une seule par
graphique.
_Avoid_: inverted, rotated

**Axis** (axe) :
La règle graduée le long d'un bord de la zone de tracé, avec ses graduations et son titre.
_Avoid_: scale (une échelle n'est pas un axe)

**Scale** (échelle) :
La correspondance entre des valeurs et des positions à l'écran : linéaire, logarithmique, catégories, temps.
_Avoid_: axis, mapping, transform

**Tick** (graduation) :
Une valeur remarquable de l'axe, marquée d'un trait et en général d'une étiquette.
_Avoid_: gridline (la ligne de grille prolonge une graduation, elle n'en est pas une)

**Hidden series** (série masquée) :
Une série retirée de la vue, par l'utilisateur (légende) ou au départ par l'app ; elle disparaît de tout ce qui
montre ce qu'on voit : dessin, infobulle, tableau de données, export. C'est un état de la vue, pas une option.
_Avoid_: disabled, filtered, invisible

**Legend** (légende) :
La liste des séries (ou des secteurs), qui sert aussi à les masquer et les afficher.
_Avoid_: key (réservé à l'identité d'un point)

**Tooltip** (infobulle) :
La bulle qui montre les valeurs du ou des points sous le pointeur ou le focus.
_Avoid_: popup, hover card, label

## Dessin

**Scene** (scène) :
La description complète de ce qu'il faut dessiner, en pixels, produite par le cœur ; l'écran, l'export et
l'impression la dessinent tous.
_Avoid_: render tree, virtual DOM, display list

**Layer** (calque) :
Une tranche de la scène dessinée d'un seul tenant (grille, séries, axes, étiquettes, légende, surcouche).
_Avoid_: pane, level

**Painter** (peintre) :
Ce qui dessine une scène sur un support : SVG, Canvas, WebGL2.
_Avoid_: renderer, backend, engine

**Decimation** (décimation) :
Le choix des seuls points qui changent l'image quand une série en a plus que l'écran ne peut en montrer.
_Avoid_: sampling, downsampling, simplification

## Temps

**Instant** (instant) :
Un moment du temps, sans fuseau, compté en millisecondes.
_Avoid_: timestamp, date, datetime

**Day** (jour) :
Une date du calendrier, sans heure ni fuseau.
_Avoid_: date (ambigu entre jour et instant)

**Zone** (fuseau) :
Le fuseau horaire IANA dans lequel un axe de temps lit ses instants.
_Avoid_: timezone offset, locale (une locale règle la langue, pas l'heure)

**Wall clock** (heure locale) :
L'heure qu'affiche une horloge dans un fuseau ; elle peut sauter ou se répéter au changement d'heure.
_Avoid_: local time (ambigu : local à qui ?)

## Exploration

**Exploration** (exploration) :
Tout ce que l'utilisateur fait pour interroger les données sans changer l'app : zoomer, entrer dans le détail,
sélectionner, comparer, changer le type, l'agrégation ou l'échelle.
_Avoid_: interaction (plus large), analysis

**View** (vue) :
L'état complet d'une exploration à un moment donné ; on peut l'enregistrer et y revenir.
_Avoid_: state, snapshot, session

**Visible range** (plage visible) :
L'intervalle de l'axe x que montre la zone de tracé ; le zoom et le déplacement le changent.
_Avoid_: window, viewport, extent, zoom (le zoom est le geste, pas la plage)

**Navigator** (navigateur) :
Le petit graphique de toute la série sous le graphique principal, avec des poignées qui règlent la plage visible.
_Avoid_: scrollbar, minimap, overview

**Range button** (bouton de plage) :
Un raccourci qui règle la plage visible sur une durée (1 mois, 1 an, tout).
_Avoid_: preset, period selector

**Crosshair** (viseur) :
Les lignes qui suivent le pointeur ou le focus et lisent la valeur sur chaque axe.
_Avoid_: cursor, guide, tracker

**Measure** (mesure) :
L'écart entre deux points choisis : en valeur, en pour cent, en durée.
_Avoid_: ruler, delta tool

**Comparison** (comparaison) :
Le mode où chaque série est montrée par rapport à une référence : en écart, en pour cent, ou en base 100.
_Avoid_: normalisation, relative mode

**Baseline** (référence) :
Le point ou l'instant par rapport auquel la comparaison est calculée.
_Avoid_: origin, anchor, zero

**Selection** (sélection) :
Les points de l'app que l'utilisateur a choisis, désignés par leurs clés ; choisir un point agrégé choisit tous les
points qu'il regroupe. Elle survit au zoom et au changement d'agrégation.
_Avoid_: highlight, brush (le geste), filter

**Highlight** (mise en avant) :
L'accent visuel passager sur un point ou une série, au survol ou au focus ; ce n'est pas une sélection.
_Avoid_: selection, hover state

**Lasso** (lasso) :
Le geste de sélection qui entoure des points d'un tracé libre ; le **rectangle** et la **plage** sont ses deux autres
formes.
_Avoid_: brush, freehand

**Drill** (entrer dans le détail) :
Le passage d'un point à la série qui le détaille (une année vers ses mois) ; on remonte par le fil d'Ariane.
_Avoid_: drilldown (en un mot, dans le code), zoom, expand

**Level** (niveau) :
Une étape d'un drill : ce que montre le graphique entre deux descentes.
_Avoid_: depth, layer (réservé au dessin)

**Breadcrumb** (fil d'Ariane) :
La liste des niveaux traversés, de la racine au niveau affiché ; chacun permet de remonter.
_Avoid_: path, history

**Aggregation** (agrégation) :
Le regroupement de points en un seul par période ou par intervalle (somme, moyenne, min, max, nombre).
_Avoid_: rollup, grouping, binning

**Period** (période) :
Une durée du calendrier qui découpe le temps dans un fuseau : jour, semaine, mois, trimestre, année.
_Avoid_: interval, bucket (réservé aux intervalles de nombres)

**Bucket** (intervalle) :
Une tranche de valeurs numériques qui regroupe les points (histogramme, agrégation par nombres).
_Avoid_: bin, class, period

**Link group** (graphiques liés) :
Des graphiques qui partagent leur viseur, leur plage visible, leur niveau ou leur sélection.
_Avoid_: sync, dashboard, linked charts (dans le code)

## Qualité des entrées

**Problem** (problème) :
Une entrée mauvaise ou ambiguë que le graphique signale au lieu d'échouer : un code, un chemin, un détail brut ; jamais
les données de l'app.
_Avoid_: error, warning, exception
