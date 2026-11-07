# Collimo

Application web interne de collages photo à partir de Google Drive. Réservée au domaine Workspace de l'entreprise, sans serveur de données : photos, collages et exports restent dans Drive. Le site est statique, hébergé sur Firebase Hosting dans le projet GCP existant, cloisonné du reste du projet.

Cahier des charges complet : document « [Collimo — Cahier des charges](https://claude.ai/artifact/1aj7VEJHhgdgBSEEJ72PVZ) ».

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Installation sous Windows](#installation-sous-windows)
- [Mise en place manuelle (autres systèmes)](#mise-en-place-manuelle-autres-systèmes)
- [Sécurité et cloisonnement](#sécurité-et-cloisonnement)
- [Développement](#développement)
- [À vérifier avec un vrai compte](#à-vérifier-avec-un-vrai-compte)
- [Conventions de code](#conventions-de-code)
- [Structure du projet](#structure-du-projet)

## Fonctionnalités

**Connexion et Drive**

- connexion Google (SSO de l'entreprise), refus des comptes hors domaine ;
- chaque utilisateur choisit Mon Drive ou un Drive partagé, puis son dossier de photos ; un sous-dossier `Collimo` y est créé pour les collages ;
- emplacement et langue mémorisés par utilisateur (espace caché `appDataFolder` de son Drive) ;
- galerie de miniatures, sélection ordonnée de 1 à 20 photos ; photos HEIC des iPhone décodées dans le navigateur ;
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
- stickers Fluent Emoji (1 591 émojis en couleur) et Phosphor (1 512 icônes recolorables), recherche en français ou en anglais ; image personnelle (logo) prise dans Drive ;
- chaque élément se déplace, s'agrandit, tourne ; dupliquer, devant, derrière, supprimer.

**Filtres et réglages**

- 20 filtres en 5 familles, appliqués à tout le collage, intensité de 0 à 100 ;
- 11 réglages et un réglage automatique, sur tout le collage ou sur une seule photo (les deux s'additionnent) ; bouton avant/après ;
- calcul sur la carte graphique (WebGL 2), avec un calcul de secours identique sur le processeur.

**Export et collages enregistrés**

- JPG ou PNG en Standard (2048 px), HD (5000 px, 4000 px sur iPhone et iPad) ou Maximum ; qualité JPG réglable (90 par défaut) ;
- chaque enregistrement crée un nouveau collage dans le dossier `Collimo` : l'image et son fichier projet `.collimo.json`, sous un nom daté (`Collimo_AAAA-MM-JJ_HH-MM-SS`) jamais écrasé ;
- « Mes collages » : rouvrir un collage enregistré pour le retravailler ;
- annuler / rétablir (boutons, Ctrl+Z, Ctrl+Maj+Z) pour toutes les actions.

**Usine à dispositions** (admins seulement)

- accès par le menu du compte, pour qui est « Gestionnaire de contenu » du Drive partagé « Collimo – Catalogue » ;
- créer une disposition à partir d'une grille, d'un cadre vide ou d'une disposition existante ;
- outils : couper une case, glisser une séparation, polygones (sommets), 27 formes, coupes spéciales sur une séparation (courbe, vague, zigzag, éclair, déchirure), ordre des cases ;
- vérifications automatiques (nombre de cases, cadre, chevauchements, cases trop petites) avant toute publication ; aperçu avec les photos du dossier en cours, sur 4 formats ;
- brouillon, publication, masquage ; les dispositions intégrées se masquent aussi ; un collage qui utilise une disposition masquée reste lisible.

Le catalogue de l'usine est le fichier `collimo-catalogue.json` à la racine du Drive partagé. Il est lu par tous au démarrage et vérifié à la lecture : une disposition invalide est ignorée. Chaque enregistrement relit d'abord le fichier, pour ne pas écraser le travail d'un autre admin ; Drive garde l'historique des versions. Sans ce Drive partagé, Collimo fonctionne avec les dispositions intégrées.

## Installation sous Windows

Trois scripts, à la racine du projet, se lancent d'un double-clic, sans ligne de commande ni droits d'administrateur :

| Script | Quand | Ce qu'il fait |
| --- | --- | --- |
| `install.bat` | une fois par PC | installe Node.js et Git en version portable si besoin, télécharge le projet depuis GitHub, installe l'outil Firebase, connecte le compte Google ; la première fois seulement, configure le site (projet GCP, site d'hébergement dédié, identifiants) et partage cette configuration via GitHub |
| `sync.bat` | en arrivant sur un PC | met la copie du PC à jour depuis GitHub, sans perdre de travail local |
| `deploy.bat` | pour publier | envoie le travail sur GitHub, construit le site, publie une version de test, puis le site pour tout le domaine après confirmation (O/N) |

**Premier PC** : télécharger `install.bat` depuis la page GitHub du dépôt (ouvrir le fichier, bouton « Download raw file »), double-clic, répondre aux questions. Les pages de la console Google Cloud à régler s'ouvrent une par une, avec les valeurs exactes à saisir ; le script vérifie le format de ce qu'on colle. Le numéro du projet est retrouvé automatiquement.

**PC suivants** : même `install.bat` ; la configuration est déjà sur GitHub, seuls les outils et le compte sont à installer.

**Au quotidien** : `sync.bat` en arrivant sur un PC, `deploy.bat` pour publier.

**Version de test** : `deploy.bat` la publie à une adresse du type `https://SITE--test-xxxx.web.app`, fixe tant qu'elle est republiée au moins tous les 30 jours. La première fois, la connexion Google n'y marche qu'après avoir ajouté cette adresse à l'ID client OAuth et à la clé API : le script affiche les lignes à ajouter et ouvre la page.

La configuration est enregistrée dans `.firebaserc` et `.env.production`, versionnés. Ces valeurs ne sont pas secrètes : elles sont visibles dans le site publié.

**À demander une fois à l'administrateur Workspace** :

- autoriser l'ID client OAuth de Collimo si l'organisation filtre les apps qui accèdent à Drive ;
- créer le Drive partagé « Collimo – Catalogue » pour l'usine : tout le domaine (ou un groupe qui contient tous les utilisateurs) en **Lecteur**, les admins de Collimo en **Gestionnaire de contenu**. Son identifiant (la fin de son adresse, après `/folders/`) se donne à `install.bat` ; sinon Collimo le cherche par son nom.

## Mise en place manuelle (autres systèmes)

Ce que fait `install.bat`, à la main, avec Node.js, Git et `firebase-tools` installés :

1. **Écran de consentement OAuth** (API et services › Écran de consentement) : vérifier qu'il est en **Interne**. Ne modifier ni son nom ni son logo, ils sont partagés par tout le projet.
2. **Activer les API** Google Drive API et Google Picker API.
3. **ID client OAuth** « Collimo – Web », type *Application Web*. Origines JavaScript autorisées : `https://SITE.web.app`, `https://SITE.firebaseapp.com`, `http://localhost:5173` (et l'adresse de la version de test). → `VITE_GOOGLE_CLIENT_ID`
4. **Clé API** « Collimo – Picker », restreinte à l'API Google Picker et aux mêmes sites (`https://SITE.web.app/*`…). → `VITE_GOOGLE_API_KEY`
5. **Numéro du projet** (Paramètres IAM) → `VITE_GOOGLE_APP_ID` ; **domaine** de l'entreprise → `VITE_ALLOWED_DOMAIN` ; Drive partagé du catalogue → `VITE_CATALOGUE_DRIVE_ID` (facultatif).
6. **Site d'hébergement dédié** : `firebase hosting:sites:create NOM-DU-SITE --project ID-PROJET`, puis remplacer les deux valeurs `REMPLACER-PAR-…` de `.firebaserc` par l'identifiant du projet et celui du site.
7. Écrire les valeurs des étapes 3 à 5 dans `.env.production` (modèle : `.env.example`).
8. Publier, toujours vers la seule cible `collimo` :

   ```bash
   npm run deploy:preview   # version de test (canal « test », 30 jours)
   npm run deploy           # site Collimo en ligne
   ```

## Sécurité et cloisonnement

**Dans le projet GCP partagé**

- Collimo n'utilise qu'un site d'hébergement dédié. `install.bat` affiche les sites existants et propose d'en créer un ; il ne réutilise un site existant qu'après une double confirmation (retaper son nom), pour ne pas écraser une autre application.
- `firebase.json` ne déclare que l'hébergement de ce site, et les publications visent la seule cible `hosting:collimo` : jamais de déploiement global, ni règles Firestore ou Storage, ni Functions.
- `install.bat` ne modifie rien dans la console Google Cloud : il ouvre les pages et donne les valeurs, l'utilisateur valide. L'écran de consentement est seulement vérifié.
- Les outils (Node.js, Git, Firebase) s'installent dans le profil Windows de l'utilisateur (`%USERPROFILE%\outils`), sans toucher au système.

**Autorisations Google demandées**

| Autorisation | Usage |
| --- | --- |
| `drive.readonly` | parcourir les Drive, lire les photos et le catalogue de l'usine |
| `drive.file` | créer et modifier les seuls fichiers de Collimo : dossier `Collimo`, collages, catalogue de l'usine ; aucun autre fichier n'est modifiable |
| `drive.appdata` | mémoriser l'emplacement et la langue de chaque utilisateur |

L'usine ne demande aucune autorisation de plus. L'admin qui crée le fichier du catalogue peut le modifier directement ; un autre admin doit, une seule fois, choisir ce fichier dans le sélecteur Google que Collimo lui ouvre : c'est ce choix qui autorise Collimo à le modifier pour lui.

**Dans le navigateur** : le jeton Google reste en mémoire (jamais dans une adresse ni sur disque) ; le contenu lu dans Drive (projets, catalogue, stickers) est vérifié avant usage, les SVG sont filtrés (ni script ni lien externe).

## Développement

```bash
npm install
cp .env.example .env.local   # puis compléter (inutile en mode démo)
npm run dev
```

**Mode démo sans compte Google** : `VITE_MOCK=1 npm run dev`. Le Drive est simulé, aucune donnée réelle. Le compte démo est admin de l'usine ; ajouter `?catalogue=lecteur` à l'adresse pour un simple lecteur, ou `?catalogue=autoriser` pour un catalogue créé par un autre admin.

| Commande | Rôle |
| --- | --- |
| `npm test` | tests automatiques (moteur, catalogue, Drive simulé, documentation du code) |
| `npm run lint` | lint (oxlint, documentation TSDoc complète) et contrôle de la mise en forme |
| `npm run format` | met tout le code en forme (Prettier) |
| `npm run typecheck` | vérification des types TypeScript |
| `npm run build` | construction du site dans `dist/` |
| `npm run gen:assets` | régénère les catalogues de stickers et de polices dans `public/data/` (seulement pour mettre à jour les bibliothèques) |

**Planche de recette** : `npm run dev` puis `/planche.html?n=5` affiche toutes les dispositions de 5 photos dans l'ordre du catalogue, dessinées comme les icônes de l'app de référence. Page de développement, jamais publiée.

**Performances** : le code a été relu par des relecteurs indépendants après l'étape 7. Retenu : taille de source exacte à l'export, textures gardées sur la carte graphique pendant les réglages, contexte WebGL recréé après une perte, géométrie des cases mise en mémoire pendant un geste, usine chargée à la demande, réessais Drive (quota, erreurs 5xx, réseau) et reprise des envois interrompus. Les fichiers `/assets/` de Vite (nommés par empreinte) sont en cache un an, les catalogues `/data/` un jour, `index.html` jamais.

## À vérifier avec un vrai compte

Le code est testé avec un Drive simulé et dans Chrome ; les scripts Windows n'ont pas encore tourné sur un vrai PC. Au premier usage, vérifier :

- `install.bat`, `sync.bat` et `deploy.bat` sur un PC sans droits d'administrateur, derrière le proxy de l'entreprise ;
- la connexion, et le refus d'un compte hors domaine ;
- le sélecteur Google sur Mon Drive et sur un Drive partagé ; la création du dossier `Collimo` dans un Drive partagé ;
- l'affichage des miniatures ;
- l'export d'un collage dans Mon Drive et dans un Drive partagé (fichiers de plus de 5 Mo) ;
- l'usine : menu visible pour un Gestionnaire de contenu du Drive du catalogue, absent pour un lecteur ; première publication, puis publication par un second admin (autorisation par le sélecteur) ; disposition publiée visible par un utilisateur ordinaire ;
- les photos HEIC d'iPhone, sur Safari et sur Chrome ;
- les polices Google dans l'aperçu et l'export (non chargées pendant les tests automatiques, faute d'accès réseau) ;
- le pincement à deux doigts et la fluidité des réglages avec 20 photos sur un vrai téléphone.

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
install.bat, sync.bat, deploy.bat   installation et publication sous Windows
firebase.json, .firebaserc          hébergement : la seule cible « collimo »
.env.example, .env.production       configuration (modèle, et valeurs écrites par install.bat)
src/
  config.ts            configuration et constantes (autorisations, 20 photos max…)
  google/              connexion (GIS), client Drive, sélecteur Picker, Drive simulé
  catalogue/           lecture et écriture du catalogue de l'usine sur le Drive partagé, droits admin
  collage/             moteur : modèle, géométrie, rendu, couleurs, export, projet, validation
  collage/catalog/     les 541 dispositions intégrées et le format du catalogue de l'usine
  collage/factory/     opérations de l'usine (séparations, sommets, coupes, ordre)
  ui/                  écrans : connexion, emplacement, galerie
  ui/editor/           écran du collage (aperçu, gestes, panneaux, export)
  ui/factory/          usine à dispositions
  i18n/                libellés FR et EN
  stickers/            catalogues d'icônes et de polices, recherche FR/EN
  lib/                 logique pure : nommage, sélection, erreurs
  dev/                 planche de recette (développement uniquement)
  docs.test.ts         contrôle de la documentation du code
public/data/           catalogues de stickers et de polices, chargés à la demande
tools/gen-assets.mjs   génération de public/data
```

## Licences

Le décodeur HEIC (`heic-to`, basé sur libheif) est sous licence LGPL-3.0 ; il est chargé comme un module séparé, seulement quand une photo HEIC est utilisée. Icônes Phosphor (MIT) et Fluent Emoji (MIT) ; polices Google Fonts (licences libres, chargées depuis Google).
