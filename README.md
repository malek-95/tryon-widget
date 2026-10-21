# TryOn Widget — essayage virtuel pour sites e-commerce

![Licence MIT](https://img.shields.io/badge/licence-MIT-blue) ![Sans service tiers](https://img.shields.io/badge/100%25-dans%20le%20navigateur-green)

Un widget JavaScript qu'on ajoute à n'importe quel site (Shopify, WooCommerce, PrestaShop, site sur mesure…) pour permettre aux clients d'essayer **t-shirts, pantalons et chaussures** :

- **Photo** : le client importe une photo de lui en pied, le vêtement est posé dessus, il peut l'ajuster et télécharger le résultat.
- **Caméra** : essayage en direct devant la webcam ou le téléphone, avec capture.
- **Tenue complète** : haut + bas + chaussures en même temps.

**100 % gratuit et sans service tiers.** La détection du corps tourne dans le navigateur du client (MediaPipe Pose, open source Apache‑2.0) et tous les fichiers sont servis par votre propre serveur. Les photos et la vidéo du client ne quittent jamais son appareil — aucun envoi, aucune clé API, aucun coût à l'usage.

---

## 1. Installation

Prérequis : Node.js 18 ou plus.

```bash
npm install        # installe et copie le moteur dans public/tryon/vendor, télécharge le modèle
npm start          # http://localhost:3000  → boutique de démo
```

`npm install` télécharge **une seule fois** le modèle de pose (`pose_landmarker_lite.task`, ~5 Mo) dans `public/tryon/models/`. Si le téléchargement échoue (réseau d'entreprise, pare-feu), le script affiche le lien : téléchargez le fichier et placez-le dans ce dossier.

Pour un suivi plus précis (un peu plus lent) : `npm run setup -- --full`, puis `TryOn.init({ modelUrl: '/tryon/models/pose_landmarker_full.task' })`.

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port du serveur | `3000` |
| `ALLOWED_ORIGINS` | Sites autorisés à intégrer le widget, séparés par des virgules | `*` (tous) |

Exemple : `ALLOWED_ORIGINS=https://maboutique.tn,https://www.maboutique.tn npm start`

> **HTTPS obligatoire pour la caméra.** Les navigateurs n'autorisent la caméra qu'en HTTPS (ou sur `localhost`). Le mode photo fonctionne partout.

---

## 2. Intégration sur un site

### Option A — sans écrire de JavaScript

Ajoutez le script une fois dans le gabarit du site :

```html
<script src="https://VOTRE-SERVEUR/tryon/tryon.js" data-lang="fr" data-accent="#111111" defer></script>
```

Puis un bouton sur chaque fiche produit :

```html
<button data-tryon-type="top"
        data-tryon-image="/images/tshirt-bleu.png"
        data-tryon-name="T-shirt coton bleu">Essayer</button>
```

| Attribut | Valeurs |
|---|---|
| `data-tryon-type` | `top` (haut), `bottom` (pantalon, jupe, short), `shoes` (chaussures) |
| `data-tryon-image` | Image du vêtement (voir section 3) |
| `data-tryon-name` | Nom affiché dans le widget |
| `data-tryon-image-front` | *Chaussures* : vue de face, utilisée quand le client est face à la caméra |
| `data-tryon-thumb` | Miniature (sinon l'image principale) |
| `data-tryon-fit` | Réglages JSON, ex. `'{"width":2.0,"length":1.3}'` (voir section 4) |
| `data-tryon-remove-background` | `false` pour désactiver le détourage automatique |

**Tenue complète** : donnez le même `data-tryon-in` à plusieurs articles, et un bouton `data-tryon-group` :

```html
<button data-tryon-type="top"    data-tryon-image="/tshirt.png" data-tryon-in="look-1">Essayer</button>
<button data-tryon-type="bottom" data-tryon-image="/jean.png"   data-tryon-in="look-1">Essayer</button>
<button data-tryon-group="look-1">Essayer la tenue</button>
```

### Option B — en JavaScript

```js
TryOn.init({ lang: 'fr', accent: '#0a7d5a' });

TryOn.open({ type: 'top', image: '/tshirt.png', name: 'T-shirt' });

TryOn.open([
  { type: 'top',    image: '/tshirt.png' },
  { type: 'bottom', image: '/jean.png' },
  { type: 'shoes',  image: '/basket-profil.png', imageFront: '/basket-face.png' }
]);

TryOn.preload();   // charge le moteur à l'avance (sinon fait automatiquement au survol du bouton)
TryOn.close();
```

Options de `TryOn.init` :

| Option | Défaut | Rôle |
|---|---|---|
| `lang` | langue de la page | `fr`, `en`, `ar` (l'arabe passe le widget en RTL) |
| `accent` | `#111111` | Couleur des boutons principaux |
| `baseUrl` | dossier de `tryon.js` | Où trouver `vendor/` et `models/` |
| `modelUrl` | modèle lite | Chemin d'un autre modèle |
| `delegate` | `GPU` | `GPU` (repli auto sur CPU) ou `CPU` |
| `autoBind` | `true` | Active les boutons `data-tryon-*` |

Événements (pour vos statistiques) : `tryon:open`, `tryon:close`, `tryon:download` sur `window`.

```js
window.addEventListener('tryon:download', (e) => console.log(e.detail.items));
```

### Exemples par plateforme

- **Shopify** : collez la balise `<script>` dans `theme.liquid` avant `</body>`, et le bouton dans le bloc produit avec `data-tryon-image="{{ product.metafields.tryon.image | image_url }}"`.
- **WooCommerce** : ajoutez le script via *Apparence → Éditeur de thème* ou un plugin d'en-têtes, et le bouton via le hook `woocommerce_after_add_to_cart_button`.
- **Site sur mesure / React / Vue** : chargez le script une fois, puis appelez `window.TryOn.open(...)` dans le gestionnaire de clic.

---

## 3. Préparer les images des vêtements

C'est ce qui fait la qualité du résultat.

- **PNG à fond transparent** de préférence. Un fond **uni** (blanc, gris) est détouré automatiquement ; un fond chargé (photo portée, décor) ne l'est pas.
- Le vêtement **seul, à plat, vu de face**, cadré serré (les marges transparentes sont retirées automatiquement).
- **Haut** : à plat, manches visibles, col en haut.
- **Bas** : jambes droites et parallèles, taille en haut. L'image est découpée en bloc taille + deux jambes qui suivent les jambes du client.
- **Chaussures** : une chaussure **de profil, pointe vers la droite**. Ajoutez `imageFront` (vue de face) pour un meilleur rendu quand le client est face à la caméra.
- Taille conseillée : 600–1200 px sur le grand côté.
- Images hébergées sur un autre domaine : elles doivent envoyer l'en-tête CORS `Access-Control-Allow-Origin`, sinon le détourage et le téléchargement sont désactivés.

## 4. Ajuster le placement par produit (`fit`)

Les valeurs sont relatives au corps du client, donc valables quelle que soit sa taille sur la photo.

| Type | Clé | Défaut | Effet |
|---|---|---|---|
| `top` | `width` | 1.9 | Largeur de l'image ÷ largeur d'épaules (augmentez pour les manches longues ou l'oversize) |
| | `length` | 1.25 | Hauteur ÷ longueur du torse (augmentez pour un sweat long) |
| | `top` | 0.14 | Dépassement au-dessus des épaules (col) |
| `bottom` | `width` | 2.1 | Largeur ÷ écart des hanches |
| | `length` | 1.12 | Longueur ÷ longueur de jambe (≈0.55 pour un short) |
| | `top` | 0.12 | Hauteur de la taille au-dessus des hanches |
| | `waist` | 0.3 | Part de l'image (en haut) qui reste rigide (ceinture, bassin) |
| `shoes` | `width` | 1.5 | Largeur ÷ longueur du pied |
| | `sole` | 0.85 | Position de la semelle dans l'image |

Le client peut aussi ajuster lui-même (taille, hauteur, position, glisser sur l'image).

---

## 5. Limites à connaître

C'est une superposition 2D, pas une simulation de tissu : le vêtement suit la position, la taille et l'inclinaison du corps, mais ne se déforme pas avec les plis, ne passe pas derrière les bras et ne tient pas compte des vues de dos ou de profil prononcé. Les meilleurs résultats s'obtiennent avec une photo de face, en pied, bien éclairée, sur fond simple. Les chaussures sont le cas le plus approximatif.

Pour aller plus loin sans service tiers, des modèles de génération « virtual try-on » open source (IDM‑VTON, OOTDiffusion…) peuvent tourner sur votre propre serveur avec un GPU — rendu photoréaliste mais 10–30 s par image et une machine dédiée.

## 6. Structure

```
server.js               serveur Express (sert le widget + CORS + cache)
scripts/setup.mjs       copie le moteur et télécharge le modèle
public/tryon/tryon.js   le widget (un seul fichier, sans dépendance, sans build)
public/tryon/vendor/    moteur MediaPipe (généré)
public/tryon/models/    modèle de pose (généré)
demo/                   boutique de démonstration
```

Le dossier `public/tryon/` peut aussi être copié tel quel sur n'importe quel hébergement statique ou CDN (en gardant les en-têtes CORS et le type `application/wasm`) : Express n'est pas indispensable.

---

## Licence

Code publié sous licence **MIT** © 2026 Malek Maoua — voir [LICENSE](LICENSE). Usage commercial autorisé.

La détection du corps repose sur [MediaPipe](https://github.com/google-ai-edge/mediapipe) (© Google, licence Apache 2.0), téléchargé à l'installation et non inclus dans ce dépôt — voir [NOTICE](NOTICE).

## Contribuer

Les issues et pull requests sont les bienvenues : signalez un bug, proposez des réglages `fit` pour d'autres types de vêtements, ou ajoutez une traduction dans l'objet `I18N` de `public/tryon/tryon.js`.
