# Collimo

Application web interne de collages photo à partir de Google Drive. Réservée au domaine Workspace de l'entreprise, sans serveur de données : photos, projets et exports restent dans Drive.

Le cahier des charges complet est dans le document « Collimo — Cahier des charges ».

## État

**Étape 7 — usine à dispositions** (branche `etape-7`, réservée aux admins) :

- accès par le menu du compte, « Usine à dispositions », pour qui peut écrire dans le Drive partagé du catalogue ;
- bibliothèque par nombre de photos : dispositions créées dans l'usine (brouillon, publiée, masquée) et dispositions intégrées ;
- créer à partir d'une grille colonnes × lignes, d'un cadre vide, ou en dupliquant n'importe quelle disposition ;
- outils : couper une case en deux, glisser une séparation (toutes les cases alignées suivent, avec aimantation), rectangle, triangle, polygone (glisser un sommet, ajouter un point au milieu d'un côté, supprimer un point), 27 formes de la bibliothèque (déplacer, agrandir, tourner, étirer) ;
- coupes spéciales sur une séparation : courbe, vague, zigzag, éclair, déchirure, amplitude et nombre d'ondulations ; le bord est identique des deux côtés, même quand la séparation n'est partagée qu'en partie ;
- ordre des cases : toucher les cases dans l'ordre voulu, ou ordre de lecture automatique ;
- vérifications automatiques : nombre de cases, cases dans le cadre, chevauchements (sauf case cochée « Posée sur une autre »), cases trop petites ; publication impossible tant qu'il reste un problème ;
- aperçu avec les photos du dossier en cours, en 1:1, 4:5, 9:16 et 16:9 ; icône générée automatiquement ;
- famille et place dans la liste (en tête ou à la fin) ;
- brouillon, publication, masquage (les collages qui utilisent une disposition masquée restent lisibles) ; un brouillon se supprime, une disposition publiée se masque ; les dispositions intégrées se masquent aussi ;
- annuler / rétablir, Ctrl+Z, touche Suppr.

Le catalogue est le fichier `collimo-catalogue.json` à la racine du Drive partagé. Il est lu par tous au démarrage et vérifié à la lecture : une disposition invalide est ignorée. Chaque enregistrement relit d'abord le fichier, pour ne pas écraser le travail d'un autre admin. Drive garde l'historique des versions.

Vérifié dans Chrome (Drive simulé, bureau et mobile) : création, séparation déplacée, coupe en vague, publication, disposition proposée dans l'éditeur de collage, disposition intégrée masquée, demande d'autorisation sur un catalogue créé par un autre admin, simple lecteur sans accès à l'usine.

**Étape 6 — dispositions en forme** :

- catalogue complet de 1 à 20 photos : 541 dispositions, dont 208 en forme (cœurs, ronds, fleurs, étoiles, hexagones, losanges, puzzle, découpes courbes, en zigzag ou déchirées, feuilles, illustrations) ; décompte par nombre de photos : 24, 39, 40, 40, 38, 31, 26, 34, 32, 22, 25, 18, 26, 20, 22, 20, 24, 20, 20, 20 ;
- chaque disposition a été comparée à la capture de référence (planche de recette `/planche.html?n=N` en développement) ; l'inventaire de 8 photos est de 34 dispositions (et non 38 comme noté au départ) ;
- la forme reste fixe ; la photo à l'intérieur se déplace, se zoome et tourne comme dans un rectangle ; sélection et gestes suivent le contour réel de la forme ;
- Bords : « Contour des formes » (épaisseur et couleur) pour les dispositions en forme ; l'arrondi est masqué quand il n'y a que des formes ;
- l'écart sépare les photos voisines ; les photos éparses sur le fond gardent la taille et l'espacement de la capture ;
- médaillons (forme posée sur une autre photo) : un anneau de la couleur du fond les détache ;
- l'export redessine les formes en pleine résolution (même moteur que l'aperçu).

Vérifié dans Chrome (Drive simulé) : sélection et zoom d'une photo dans un cœur, contour, export conforme à l'aperçu, collage rouvert identique au pixel près.

**Étape 5 — filtres et réglages** :

- 20 filtres en 5 familles (Naturel, Chaleur, Fraîcheur, Film, Noir et blanc), aperçus sur une photo du collage, intensité de 0 à 100, appliqués à tout le collage ;
- 11 réglages + Auto : exposition, luminosité, contraste, hautes lumières, ombres, chaleur, nuance, saturation, vibrance, netteté, vignettage ;
- réglages sur tout le collage (onglet Filtres › Ajuster) ou sur une seule photo (menu de la photo › Réglages) ; les deux s'additionnent ;
- bouton avant/après (maintenir pour voir l'original) ; Réinitialiser ;
- filtres et réglages ne touchent que les photos : fond, textes et stickers gardent leurs couleurs ;
- calcul sur la carte graphique (WebGL 2), avec un calcul de secours identique sur le processeur ; l'export utilise le même moteur, en pleine résolution.

Vérifié dans Chrome : carte graphique et calcul de secours donnent le même résultat (écart maximal 1/255) ; l'image exportée correspond à l'aperçu.

**Étape 4 — texte et stickers** :

- textes : saisie, 10 styles prédéfinis, polices Google (25 populaires + recherche dans les 1 580 du catalogue), gras et italique, alignement ;
- couleurs et effets du texte : texte, contour, ombre, lueur, étiquette de fond, opacité ; pipette, couleur libre et nuancier ;
- stickers : Fluent Emoji (1 591 émojis en couleur) et Phosphor (1 512 icônes, contour ou plein, recolorables), recherche en français ou en anglais, catégories ;
- image personnelle (logo, PNG transparent) choisie dans le Drive en cours ;
- chaque élément se déplace, s'agrandit (coin), tourne (poignée ronde), se pince à deux doigts ; largeur du texte réglable (poignée latérale) ; double-clic sur un texte pour le modifier ;
- dupliquer, passer devant ou derrière, supprimer ;
- annuler / rétablir (boutons, Ctrl+Z, Ctrl+Maj+Z) pour toutes les actions de l'éditeur ;
- les textes et stickers sont enregistrés dans le projet et exportés en pleine résolution (icônes redessinées à la taille finale).

Les catalogues d'icônes et de polices sont générés dans `public/data` par `npm run gen:assets` et chargés seulement à l'ouverture des panneaux. Les SVG relus depuis un projet sont filtrés (ni script ni lien externe).

**Étape 3 — travail sur chaque photo** :

- toucher ou cliquer une photo pour la sélectionner (cadre vert), toucher à côté pour désélectionner ;
- glisser pour recadrer ; molette, pincement (doigts ou trackpad) ou double-clic pour zoomer, centré sous le curseur ;
- poignée ronde pour tourner, à la souris ou au doigt, ou rotation à deux doigts ; aimantation à 0/90/180/270°, pas de 15° avec Maj ;
- poignées vertes sur les séparations pour agrandir une case aux dépens de sa voisine (dispositions en découpe) ;
- échanger deux photos : bouton « Échanger » puis toucher l'autre photo, ou appui long d'une demi-seconde puis glisser ;
- menu : Échanger, Inverser, Rotation, Recadrer (zoom et angle au curseur, Réinitialiser), Remplacer (une photo du Drive en cours), Supprimer (disposition la plus proche avec une photo de moins) ;
- clavier : flèches pour déplacer, + et − pour zoomer, Échap pour désélectionner.

**Étape 2 — écran du collage** :

- format (1:1 par défaut, 4:5, 9:16, 16:9, A4…), disposition, bords (écart, marge, arrondi), couleur de fond ;
- catalogue des dispositions en rectangles, transcrit depuis les captures de référence (`src/collage/catalog/`) ;
- bouton « mélanger » ;
- export JPG ou PNG en Standard (2048 px), HD (5000 px, 4000 px sur iPhone et iPad) ou Maximum, qualité JPG réglable (90 par défaut) ;
- enregistrement dans le dossier `Collimo` : l'image et son fichier projet `.collimo.json`, sous un nom daté jamais écrasé ;
- « Mes collages » : rouvrir un collage enregistré ; chaque nouvel enregistrement crée un nouveau collage ;
- photos HEIC des iPhone décodées dans le navigateur, en pleine résolution.

**Étape 1 — connexion et Drive** :

- connexion Google (SSO de l'entreprise), contrôle du domaine ;
- choix de Mon Drive ou d'un Drive partagé, puis du dossier de photos (Google Picker) ;
- vérification du droit d'écriture, création du sous-dossier `Collimo` ;
- emplacement et langue mémorisés par utilisateur (espace caché `appDataFolder` de son Drive) ;
- galerie de miniatures, sélection ordonnée de 1 à 20 photos ;
- interface en français et en anglais.


## Installation simplifiée (Windows)

Trois scripts, lancés d'un double-clic, sans ligne de commande ni droits d'administrateur :

| Script | Quand | Ce qu'il fait |
| --- | --- | --- |
| `install.bat` | une fois par PC | installe Node.js et Git en version portable si besoin, télécharge le projet depuis GitHub, installe l'outil Firebase, connecte le compte Google ; la première fois seulement, configure le site (projet GCP, site d'hébergement dédié, identifiants), puis partage cette configuration via GitHub |
| `sync.bat` | en arrivant sur un PC | met la copie du PC à jour depuis GitHub, sans perdre de travail local |
| `deploy.bat` | pour publier | envoie le travail sur GitHub, construit le site, publie une version de test (adresse fixe tant qu'elle sert au moins tous les 30 jours ; la première fois, le script indique comment l'autoriser pour la connexion Google), puis le site pour tout le domaine après confirmation |

**Premier PC** : télécharger `install.bat` depuis GitHub (bouton « Download raw file »), double-clic, répondre aux questions. Les pages de la console Google Cloud à régler s'ouvrent une par une, avec les valeurs exactes à saisir ; le script vérifie le format de ce qu'on colle.

**PC suivants** : même `install.bat` ; la configuration est déjà sur GitHub, il n'y a que les outils et le compte à installer.

**Cloisonnement dans le projet GCP partagé** :

- Collimo n'utilise qu'un site d'hébergement dédié. `install.bat` affiche les sites existants et propose d'en créer un nouveau. Il ne réutilise un site existant qu'après une double confirmation (retaper son nom), pour ne pas écraser une autre application.
- `deploy.bat` ne publie que la cible `hosting:collimo` : jamais de déploiement global, ni règles Firestore ou Storage, ni Functions.
- `install.bat` ne modifie rien dans la console Google Cloud. Il ouvre les pages et donne les valeurs à saisir ; c'est toi qui valides.
- L'écran de consentement est seulement vérifié, jamais modifié.
- Les outils (Node.js, Git, Firebase) s'installent dans le profil Windows de l'utilisateur, sans toucher au système.

La configuration est enregistrée dans `.firebaserc` et `.env.production`, versionnés : ces valeurs ne sont pas secrètes (elles sont visibles dans le site publié). `deploy.bat` ne publie que la cible `hosting:collimo` : les autres sites et bases du projet ne sont jamais touchés.

## Relecture et optimisations

Après l'étape 7, tout le code a été relu par des relecteurs indépendants (moteur, interface, Drive et build). Corrigé :

- **export** : la taille de source demandée pour chaque photo tient compte de ses proportions et de son angle (plus de flou léger sur les photos panoramiques dans les cases hautes, plus de sources inutilement géantes) ;
- **réglages** : les textures restent sur la carte graphique pendant qu'on bouge un curseur (plus de renvoi des 20 photos à chaque pas) ; le repli processeur ne fait plus d'allocations par pixel ; un contexte WebGL perdu (onglet en arrière-plan sur mobile) est recréé ;
- **gestes** : la géométrie des cases est mise en mémoire pendant un geste ; le canvas de l'aperçu n'est plus réalloué à chaque image ; la disposition n'est recalculée que si elle change ;
- **usine** : les vérifications et l'aperçu suivent le glissé avec un temps de retard, pour qu'il reste fluide ; l'usine n'est chargée qu'à son ouverture ;
- **Drive** : réessais automatiques (quota, erreurs 5xx, réseau) ; reprise d'un envoi interrompu ; miniature expirée redemandée à Drive avant de lire le fichier entier ; moins de requêtes à l'enregistrement ;
- **cache** : les catalogues d'icônes et de polices sont servis depuis `/data/` avec un cache d'un jour (les fichiers `/assets/` de Vite, nommés par empreinte, restent en cache un an) ; `index.html` n'est jamais mis en cache.

Jugé inutile : découper davantage le code (le catalogue des 541 dispositions se construit en 23 ms), dédoubler le canvas de l'aperçu, ou changer le décodage HEIC (déjà chargé à la demande).

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis compléter
npm run dev
```

**Mode démo sans compte Google** : `VITE_MOCK=1 npm run dev`. Le Drive est simulé, aucune donnée réelle. Le compte démo est admin de l'usine ; ajouter `?catalogue=lecteur` à l'adresse pour un simple lecteur, ou `?catalogue=autoriser` pour un catalogue créé par un autre admin.

Commandes utiles : `npm test` (tests unitaires), `npm run typecheck`, `npm run build`.

**Planche de recette** : `npm run dev` puis ouvrir `/planche.html?n=5` pour voir toutes les dispositions de 5 photos dans l'ordre du catalogue, à comparer aux captures de référence (branche `captures-reference`). Cette page n'est jamais publiée.

## Mise en place dans le projet GCP existant

Tout est isolé : un site d'hébergement dédié, un identifiant OAuth et une clé API dédiés. Rien d'autre du projet n'est touché.

1. **Vérifier l'écran de consentement OAuth** (API et services › Écran de consentement) : il doit être en **Interne**. Ne modifier ni son nom ni son logo, ils sont partagés par tout le projet.
2. **Activer les API** Google Drive API et Google Picker API.
3. **Créer l'identifiant OAuth** « Collimo – Web », type *Application Web*. Origines JavaScript autorisées : l'adresse du site Collimo (et `http://localhost:5173` pour le développement). → `VITE_GOOGLE_CLIENT_ID`
4. **Créer la clé API** « Collimo – Picker », restreinte à l'API Google Picker et aux référents HTTP du site Collimo (et de localhost). → `VITE_GOOGLE_API_KEY`
5. **Numéro du projet** (Paramètres IAM du projet) → `VITE_GOOGLE_APP_ID`.
6. **Domaine** de l'entreprise → `VITE_ALLOWED_DOMAIN` (contrôle supplémentaire côté app).
7. **Créer le site d'hébergement** dédié et le relier à la cible `collimo` :

   ```bash
   firebase hosting:sites:create collimo-app        # un nom libre, unique au monde
   ```

   Puis remplacer les deux valeurs `REMPLACER-PAR-…` dans `.firebaserc` par l'identifiant du projet et celui du site.
8. **Faire autoriser l'app** par l'administrateur Workspace si votre organisation filtre les apps qui accèdent à Drive (identifiant client de l'étape 3).
9. **Drive partagé du catalogue** (usine à dispositions), créé par l'administrateur Workspace :
   - nom « Collimo – Catalogue » ;
   - membres : tout le domaine (ou un groupe qui contient tous les utilisateurs) en **Lecteur**, les admins de Collimo en **Gestionnaire de contenu** ;
   - son identifiant (dans l'adresse du Drive partagé) → `VITE_CATALOGUE_DRIVE_ID`, sinon Collimo le cherche par son nom (`VITE_CATALOGUE_DRIVE_NAME`).

   Sans ce Drive partagé, Collimo fonctionne avec les seules dispositions intégrées.

## Déployer

Toujours vers la seule cible `collimo`, jamais un déploiement global :

```bash
npm run deploy:preview   # canal de prévisualisation « test », adresse temporaire
npm run deploy           # site Collimo en ligne
```

`firebase.json` ne déclare que l'hébergement de ce site : aucune règle Firestore, Storage ou Functions ne peut être écrasée.

## Autorisations demandées

| Autorisation | Usage |
| --- | --- |
| `drive.readonly` | Parcourir les Drive et lire les photos |
| `drive.file` | Créer le dossier `Collimo` et, plus tard, les collages ; aucun autre fichier n'est modifiable |
| `drive.appdata` | Mémoriser l'emplacement et la langue de chaque utilisateur |

Aucune autorisation supplémentaire pour l'usine : le catalogue se lit avec `drive.readonly` et s'écrit avec `drive.file`. L'admin qui crée le fichier du catalogue peut le modifier directement. Un autre admin doit, une seule fois, choisir ce fichier dans le sélecteur Google que Collimo lui ouvre : c'est ce choix qui autorise Collimo à le modifier pour lui.

## À vérifier avec un vrai compte

Le code est testé avec un Drive simulé. Avant d'aller plus loin, vérifier sur le site de prévisualisation :

- la connexion et le refus d'un compte hors domaine ;
- l'ouverture du sélecteur sur Mon Drive et sur un Drive partagé ;
- la création du dossier `Collimo` dans un Drive partagé ;
- l'affichage des miniatures (repli automatique sur le fichier si une miniature ne s'affiche pas) ;
- l'export d'un collage dans Mon Drive et dans un Drive partagé (envoi de fichiers de plus de 5 Mo) ;
- l'usine : menu visible pour un Gestionnaire de contenu du Drive du catalogue, absent pour un lecteur ; première publication (création du fichier), puis publication par un second admin (autorisation par le sélecteur) ; disposition publiée visible par un utilisateur ordinaire ;
- les photos HEIC d'iPhone, sur Safari (décodage natif) et sur Chrome (décodeur chargé à la demande) ;
- les polices Google dans l'aperçu et l'export (elles n'ont pas pu être chargées pendant les tests automatiques, faute d'accès réseau) ;
- le pincement à deux doigts sur un vrai téléphone ;
- la fluidité des réglages avec 20 photos sur un téléphone d'entrée de gamme.

Le décodeur HEIC (`heic-to`, basé sur libheif) est sous licence LGPL-3.0. Il est chargé comme un module séparé, seulement quand une photo HEIC est utilisée.

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

## Structure

```
src/
  config.ts            configuration et constantes (autorisations, 20 photos max…)
  google/              connexion (GIS), client Drive, sélecteur Picker, Drive simulé
  i18n/                libellés FR et EN
  collage/             moteur : modèle, géométrie, rendu, export, projet, catalogue des dispositions
  collage/factory/     opérations de l'usine (séparations, sommets, coupes, ordre) ; collage/validate.ts : vérifications
  catalogue/           lecture et écriture du catalogue sur le Drive partagé, droits admin
  lib/                 logique pure testée : nommage, sélection, erreurs
  ui/                  écrans (ui/editor : écran du collage, ui/factory : usine à dispositions)
  stickers/            catalogues d'icônes et de polices, recherche FR/EN
  dev/                 planche de recette (développement uniquement)
tools/gen-assets.mjs   génération des catalogues dans public/data
```
