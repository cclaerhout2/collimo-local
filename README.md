# Collimo

Application web interne de collages photo à partir de Google Drive. Réservée au domaine Workspace de l'entreprise, sans serveur de données : photos, projets et exports restent dans Drive.

Le cahier des charges complet est dans le document « Collimo — Cahier des charges ».

## État

**Étape 3 — travail sur chaque photo** (branche `etape-3`) :

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


## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis compléter
npm run dev
```

**Mode démo sans compte Google** : `VITE_MOCK=1 npm run dev`. Le Drive est simulé, aucune donnée réelle.

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

## À vérifier avec un vrai compte

Le code est testé avec un Drive simulé. Avant d'aller plus loin, vérifier sur le site de prévisualisation :

- la connexion et le refus d'un compte hors domaine ;
- l'ouverture du sélecteur sur Mon Drive et sur un Drive partagé ;
- la création du dossier `Collimo` dans un Drive partagé ;
- l'affichage des miniatures (repli automatique sur le fichier si une miniature ne s'affiche pas) ;
- l'export d'un collage dans Mon Drive et dans un Drive partagé (envoi de fichiers de plus de 5 Mo) ;
- les photos HEIC d'iPhone, sur Safari (décodage natif) et sur Chrome (décodeur chargé à la demande).

Le décodeur HEIC (`heic-to`, basé sur libheif) est sous licence LGPL-3.0. Il est chargé comme un module séparé, seulement quand une photo HEIC est utilisée.

## Structure

```
src/
  config.ts            configuration et constantes (autorisations, 20 photos max…)
  google/              connexion (GIS), client Drive, sélecteur Picker, Drive simulé
  i18n/                libellés FR et EN
  collage/             moteur : modèle, géométrie, rendu, export, projet, catalogue des dispositions
  lib/                 logique pure testée : nommage, sélection, erreurs
  ui/                  écrans (ui/editor : écran du collage)
  dev/                 planche de recette (développement uniquement)
```
