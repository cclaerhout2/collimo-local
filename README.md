# Collimo pour Windows

Application de bureau Windows de collages photo, sur les fichiers du PC : sans compte, sans serveur, sans configuration. Construite avec Electron à partir du code de [Collimo](https://github.com/cclaerhout2/collimo) (version web sur Google Drive), dont elle reprend l'éditeur, les dispositions, les textes, stickers, filtres, l'export et l'usine à dispositions.

## Sommaire

- [Installation](#installation)
- [Utilisation](#utilisation)
- [Fonctionnalités](#fonctionnalités)
- [Sécurité](#sécurité)
- [Développement](#développement)
- [Publier une version](#publier-une-version)
- [Conventions de code](#conventions-de-code)
- [Structure du projet](#structure-du-projet)

## Installation

Sans droits d'administrateur, depuis la page **Releases** du dépôt :

- `Collimo-Setup-X.Y.Z.exe` : installeur, en français. Installe pour l'utilisateur seul dans `%LOCALAPPDATA%\Programs\Collimo`, avec raccourcis sur le Bureau et dans le menu Démarrer ; désinstallation par « Ajouter ou supprimer des programmes » ;
- `Collimo-X.Y.Z-portable.exe` : un seul fichier, à lancer sans installation (depuis une clé USB, par exemple).

Les fichiers ne sont pas signés : au premier lancement, Windows SmartScreen affiche « Windows a protégé votre ordinateur » ; cliquer sur « Informations complémentaires », puis « Exécuter quand même ».

## Utilisation

Au premier lancement, choisir le dossier des photos. Collimo y crée le sous-dossier `Collimo` pour les collages : chaque enregistrement y ajoute une image (JPG ou PNG) et son fichier projet `.collimo.json`, sous un nom daté, sans jamais rien écraser. « Mes collages » les rouvre pour les retravailler. Si le dossier de photos est déplacé ou renommé (ou si un collage vient d'un autre PC), les photos sont retrouvées par leur nom dans le dossier choisi.

Les polices Google se chargent depuis internet ; tout le reste fonctionne hors ligne.

## Fonctionnalités

**Photos du PC**

- aucun compte : l'application s'ouvre directement ;
- choix du dossier de photos avec le sélecteur de Windows : Images, dossier réseau, OneDrive, ou dossier Google Drive via Google Drive pour ordinateur (lecteur `G:`) ; un sous-dossier `Collimo` y est créé pour les collages ;
- dossier et langue retrouvés au lancement suivant ;
- galerie de miniatures calculées par Windows, sélection ordonnée de 1 à 20 photos ; photos HEIC des iPhone décodées par Collimo ;
- interface en français et en anglais.

**Dispositions**

- 541 dispositions de 1 à 20 photos, transcrites depuis l'app de référence et comparées une à une aux captures : 333 en rectangles, 208 en forme (cœurs, ronds, fleurs, étoiles, hexagones, losanges, puzzle, découpes courbes, en zigzag ou déchirées, feuilles, illustrations) ;
- format (1:1 par défaut, 4:5, 9:16, 16:9, A4…), bouton « mélanger » ;
- bords : écart entre les photos, marge, arrondi, contour des formes (épaisseur et couleur), couleur de fond ;
- dans une forme, la forme reste fixe et la photo se déplace, se zoome et tourne à l'intérieur.

**Travail sur chaque photo**

- toucher une photo pour la sélectionner ; glisser pour recadrer ; molette, pincement ou double-clic pour zoomer ; poignée ronde ou deux doigts pour tourner, avec aimantation ;
- poignées sur les séparations des dispositions en découpe, pour agrandir une case aux dépens de sa voisine ;
- menu : Échanger (bouton ou appui long puis glisser), Inverser, Rotation, Recadrer, Remplacer, Supprimer, Réglages ;
- clavier : flèches, + et −, Échap.

**Texte et stickers**

- textes en polices Google (25 populaires, recherche dans les 1 580 du catalogue), 10 styles prédéfinis, contour, ombre, lueur, étiquette, opacité ;
- stickers Fluent Emoji (1 591 émojis en couleur) et Phosphor (1 512 icônes recolorables), recherche en français ou en anglais ; image personnelle (logo) prise sur le PC ;
- chaque élément se déplace, s'agrandit, tourne ; dupliquer, devant, derrière, supprimer.

**Filtres et réglages**

- 20 filtres en 5 familles, appliqués à tout le collage, intensité de 0 à 100 ;
- 11 réglages et un réglage automatique, sur tout le collage ou sur une seule photo (les deux s'additionnent) ; bouton avant/après ;
- calcul sur la carte graphique (WebGL 2), avec un calcul de secours identique sur le processeur.

**Export et collages enregistrés**

- JPG ou PNG en Standard (2048 px), HD (5000 px) ou Maximum ; qualité JPG réglable (90 par défaut) ;
- chaque enregistrement crée un nouveau collage dans le dossier `Collimo` : l'image et son fichier projet `.collimo.json`, sous un nom daté (`Collimo_AAAA-MM-JJ_HH-MM-SS`) jamais écrasé ;
- « Mes collages » : rouvrir un collage enregistré pour le retravailler ;
- annuler / rétablir (boutons, Ctrl+Z, Ctrl+Maj+Z) pour toutes les actions.

**Usine à dispositions**

- accès par le menu du compte ;
- créer une disposition à partir d'une grille, d'un cadre vide ou d'une disposition existante ;
- outils : couper une case, glisser une séparation, polygones (sommets), 27 formes, coupes spéciales sur une séparation (courbe, vague, zigzag, éclair, déchirure), ordre des cases ;
- vérifications automatiques (nombre de cases, cadre, chevauchements, cases trop petites) avant toute publication ; aperçu avec les photos du dossier en cours, sur 4 formats ;
- brouillon, publication, masquage ; les dispositions intégrées se masquent aussi ; un collage qui utilise une disposition masquée reste lisible.

Le catalogue de l'usine est le fichier `collimo-catalogue.json`, dans `%APPDATA%\collimo\catalogue` par défaut. Le menu « Dossier du catalogue… » permet de le placer dans un dossier partagé (réseau, OneDrive, Drive) pour proposer les mêmes dispositions à toute l'équipe : qui peut écrire dans ce dossier peut modifier le catalogue. Il est vérifié à la lecture (une disposition invalide est ignorée) et relu avant chaque enregistrement, pour ne pas écraser le travail d'un collègue.

## Sécurité

- La page n'a aucun accès à Windows ni à Node (isolation, bac à sable de Chromium) ; elle passe par un pont limité qui n'ouvre que les dossiers et fichiers choisis par l'utilisateur avec les sélecteurs de Windows (liste gardée dans `%APPDATA%\collimo\desktop.json`, que la page ne peut ni lire ni modifier) et le dossier du catalogue.
- Collimo ne crée que des images JPG/PNG et des fichiers JSON, n'écrase jamais un collage, et ne fait ouvrir par Windows que des dossiers, images et JSON, jamais un programme.
- Aucun contenu extérieur n'est chargé, sauf les polices Google ; les liens s'ouvrent dans le navigateur par défaut.
- En cas d'erreur inattendue, le détail est noté dans `%TEMP%\collimo-erreurs.log`. `F12` ouvre les outils de développement, pour le diagnostic.

## Développement

```bash
npm install
npm run desktop:start
```

| Commande | Rôle |
| --- | --- |
| `npm run desktop:start` | construit et lance l'application |
| `npm run desktop:pack` | construit l'installeur et la version portable dans `release/` (sous Windows ; sous Linux, Wine 32 et 64 bits est nécessaire) |
| `npm test` | tests automatiques (moteur, catalogue, accès aux fichiers, services, documentation du code) |
| `npm run test:e2e` | test de bout en bout de l'application (après `npm run desktop:build`) : dossier, galerie (HEIC compris), collage, enregistrement, réouverture, usine, relancement, dossier déplacé, cloisonnement ; `--exe chemin\Collimo.exe` pour tester un exécutable construit ou installé |
| `npm run lint` | lint (oxlint, documentation TSDoc complète) et contrôle de la mise en forme |
| `npm run format` | met tout le code en forme (Prettier) |
| `npm run typecheck` | vérification des types TypeScript |
| `npm run gen:assets` | régénère les catalogues de stickers et de polices dans `public/data/` |

**Interface dans le navigateur** : `VITE_MOCK=1 npm run dev` affiche l'interface avec des photos simulées, pratique pour travailler sur l'éditeur sans relancer l'application ; `/planche.html?n=5` affiche toutes les dispositions de 5 photos.

Le workflow `.github/workflows/windows.yml` tourne à chaque envoi, sur une vraie machine Windows : types, lint et tests, construction, test de bout en bout de `Collimo.exe`, puis installation silencieuse, test de l'application installée et désinstallation. L'installeur et la version portable sont dans les *Artifacts* de chaque exécution.

## Publier une version

Augmenter `version` dans `package.json` et l'envoyer sur `main` : le workflow crée la Release GitHub `vX.Y.Z` avec les deux `.exe` (une version déjà publiée n'est jamais remplacée).

## Conventions de code

Le code suit deux standards, vérifiés automatiquement par `npm test` et `npm run lint` :

**Présentation** : [Prettier](https://prettier.io) (`.prettierrc.json` : sans point-virgule, apostrophes simples, lignes de 140 caractères au plus). `npm run format` met tout le code en forme.

**Documentation** : [TSDoc](https://tsdoc.org), le standard de TypeScript (l'équivalent de Javadoc en Java ou des docstrings en Python), en français :

- chaque fichier commence par un bloc `/** … */` qui dit à quoi il sert ;
- chaque fonction, composant, hook, type, interface et constante exportée a un bloc `/** … */` juste au-dessus ; la première phrase dit ce qu'il fait ;
- chaque paramètre a sa ligne `@param nom - rôle`, et toute valeur renvoyée sa ligne `@returns …` ; `@throws` signale une erreur levée volontairement, `@remarks` les explications plus longues, `@example` un exemple d'appel ;
- les propriétés d'un composant React sont documentées sur leur interface (`Props`), champ par champ ;
- les commentaires `//` à l'intérieur des fonctions expliquent le *pourquoi* d'un passage délicat, pas ce que le code dit déjà.

```ts
/**
 * Taille en pixels d'un collage dont le plus grand côté vaut `long`.
 * @param ratio - largeur / hauteur du collage
 * @param long - longueur du plus grand côté, en pixels
 * @returns la largeur et la hauteur, arrondies au pixel
 */
export function sizeForLongSide(ratio: number, long: number): { width: number; height: number } {
```

## Structure du projet

```
electron/              processus principal : fenêtre, protocole collimo://, accès aux fichiers (files.ts), préchargement
build-resources/       icônes de l'application
.github/workflows/     construction, tests et publication sur une machine Windows
src/
  config.ts            configuration et constantes (20 photos max…)
  desktop/             services sur les fichiers du PC, et contrat avec electron/ (bridge.ts)
  google/              interface commune des services (types.ts), Drive simulé ; client Google Drive de la version web
  catalogue/           lecture et écriture du catalogue de l'usine, droits
  collage/             moteur : modèle, géométrie, rendu, couleurs, export, projet, validation
  collage/catalog/     les 541 dispositions intégrées et le format du catalogue de l'usine
  collage/factory/     opérations de l'usine (séparations, sommets, coupes, ordre)
  ui/                  écrans : emplacement, galerie
  ui/editor/           écran du collage (aperçu, gestes, panneaux, export)
  ui/factory/          usine à dispositions
  i18n/                libellés FR et EN (desktop.ts : libellés propres à l'application)
  stickers/            catalogues d'icônes et de polices, recherche FR/EN
  lib/                 logique pure : nommage, sélection, erreurs
  dev/                 planche de recette (développement uniquement)
public/data/           catalogues de stickers et de polices, chargés à la demande
tools/                 construction (build-electron.mjs), test de bout en bout (e2e-desktop.mjs), génération des catalogues
```

## Licences

L'application embarque Electron (MIT) et Chromium (licences dans `LICENSES.chromium.html`, à côté de `Collimo.exe`). Le décodeur HEIC (`heic-to`, basé sur libheif) est sous licence LGPL-3.0 ; il est chargé comme un module séparé, seulement quand une photo HEIC est utilisée. Icônes Phosphor (MIT) et Fluent Emoji (MIT) ; polices Google Fonts (licences libres, chargées depuis Google).
