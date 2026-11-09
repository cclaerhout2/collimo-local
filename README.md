# Collimo local (Windows, macOS, Linux, Android, iPhone)

Application pour créer des collages photo **à partir des photos de l'ordinateur, du téléphone ou de la tablette** : pas de compte, pas de serveur, rien à configurer, et aucun droit d'administrateur nécessaire. Les photos restent sur l'appareil. Une seule base de code pour Windows, macOS (Apple Silicon et Intel), Linux, Android, iPhone et iPad, et une version web installable sur l'écran d'accueil.

> **Deux versions, deux dépôts.** Ce dépôt est la **version locale** (ordinateur, téléphone, web sans compte). La **version web**, qui travaille dans Google Drive avec le compte de l'entreprise, est dans [cclaerhout2/collimo](https://github.com/cclaerhout2/collimo). Les deux partagent le même éditeur (dispositions, textes, stickers, filtres, export, usine) ; une évolution du moteur faite d'un côté se reporte de l'autre en copiant les dossiers `src/collage`, `src/ui`, `src/stickers`, `src/i18n` et `src/lib`.

## Sommaire

- [Installation](#installation)
- [Premier lancement](#premier-lancement)
- [Questions fréquentes](#questions-fréquentes)
- [Fonctionnalités](#fonctionnalités)
- [Sécurité](#sécurité)
- [Android](#android)
- [iPhone et iPad](#iphone-et-ipad)
- [Développement](#développement)
- [Publier une version](#publier-une-version)
- [Conventions de code](#conventions-de-code)
- [Structure du projet](#structure-du-projet)

## Installation

Pour Android, voir [Android](#android) ; pour l'iPhone et l'iPad, [iPhone et iPad](#iphone-et-ipad). Pour l'ordinateur, tous les fichiers sont dans la [dernière version](https://github.com/cclaerhout2/collimo-local/releases/latest). Aucun ne demande de droits d'administrateur, sauf le paquet `.deb` de Linux (installation pour tout l'ordinateur).

### Windows

| Fichier | Pour qui | Ce qu'il fait |
| --- | --- | --- |
| `Collimo-X.Y.Z-portable.exe` | essayer, ou utiliser sans rien installer (clé USB, PC partagé) | un seul fichier : double-clic, Collimo s'ouvre. Rien n'est installé ; le démarrage prend quelques secondes de plus |
| `Collimo-Setup-X.Y.Z.exe` | usage régulier | installe Collimo pour l'utilisateur seul (`%LOCALAPPDATA%\Programs\Collimo`), avec raccourcis sur le Bureau et dans le menu Démarrer ; se désinstalle par « Paramètres › Applications » |

Les fichiers ne sont pas signés : au premier lancement, Windows SmartScreen affiche « Windows a protégé votre ordinateur ». Cliquer sur « Informations complémentaires », puis « Exécuter quand même ». Cela ne se produit qu'une fois.

### macOS

| Fichier | Pour quel Mac |
| --- | --- |
| `Collimo-X.Y.Z-mac-arm64.dmg` | Apple Silicon (M1, M2, M3, M4…) : tous les Mac depuis fin 2020 |
| `Collimo-X.Y.Z-mac-x64.dmg` | Mac Intel |

(Menu Pomme › « À propos de ce Mac » : la ligne « Puce » ou « Processeur » indique lequel prendre.) Ouvrir le `.dmg`, glisser **Collimo** dans **Applications**. Les `.zip` contiennent la même application, sans image disque.

L'application n'est pas signée par Apple : au premier lancement, macOS refuse de l'ouvrir (« Apple ne peut pas vérifier… »). Pour l'autoriser, une seule fois :

1. ouvrir Collimo une première fois (le message s'affiche), cliquer sur **Terminé** ;
2. Réglages Système › **Confidentialité et sécurité**, en bas : « Collimo a été bloqué… » › **Ouvrir quand même**, puis confirmer.

Ou, dans le Terminal : `xattr -dr com.apple.quarantine /Applications/Collimo.app`.

### Linux

| Fichier | Pour qui | Ce qu'il fait |
| --- | --- | --- |
| `Collimo-X.Y.Z-linux-amd64.deb` | Ubuntu, Debian, Linux Mint… | `sudo apt install ./Collimo-X.Y.Z-linux-amd64.deb` : Collimo apparaît dans le menu des applications (catégorie Graphisme) ; `sudo apt remove collimo` pour le retirer |
| `Collimo-X.Y.Z-linux-x86_64.AppImage` | toutes les distributions (Fedora, Arch…), sans installation ni droits | rendre le fichier exécutable (`chmod +x`, ou Propriétés › Autoriser l'exécution), puis double-clic. Peut demander le paquet `libfuse2` |

## Premier lancement

1. Collimo s'ouvre directement, sans connexion.
2. **Choisir un dossier** : la fenêtre de sélection du système s'ouvre ; choisir le dossier qui contient les photos (par exemple `Images/Vacances 2026`), puis **Continuer**.
3. La galerie affiche les photos du dossier. Toucher les photos à assembler (jusqu'à 20, dans l'ordre voulu), puis **Créer un collage**.
4. Dans l'éditeur, choisir la disposition, les bords, le fond, ajouter textes et stickers, puis **Exporter › Enregistrer**.

Le collage est enregistré dans le sous-dossier `Collimo` du dossier de photos : l'image (JPG ou PNG) et son fichier projet `.collimo.json`, sous un nom daté. Chaque enregistrement crée un nouveau collage, rien n'est jamais écrasé. « Mes collages », en haut de la galerie, les rouvre pour les retravailler.

Au lancement suivant, Collimo rouvre le même dossier, dans la même langue. Pour en changer : menu du compte (rond en haut à droite) › **Changer d'emplacement**.

## Questions fréquentes

**Quels dossiers peut-on utiliser ?** Tout dossier de l'ordinateur : Images, Documents, Bureau, clé USB, disque externe, dossier réseau, OneDrive, iCloud Drive, ou un dossier Google Drive grâce à [Google Drive pour ordinateur](https://www.google.com/drive/download/) (lecteur `G:` sous Windows), ce qui garde les collages dans Drive. Les sous-dossiers se parcourent depuis Collimo (fil d'Ariane) ; il faut pouvoir écrire dans le dossier ouvert pour y enregistrer des collages.

**Quels formats de photos ?** JPG, PNG, WebP, GIF, AVIF et HEIC/HEIF (photos d'iPhone). Les autres fichiers du dossier sont ignorés ; un format non pris en charge (TIFF, par exemple) apparaît grisé.

**Faut-il internet ?** Non, sauf pour les polices Google des textes, chargées à la demande. Tout le reste fonctionne hors ligne.

**Où sont mes réglages ?** Dossier choisi, langue et catalogue de l'usine sont dans :

| Système | Dossier |
| --- | --- |
| Windows | `%APPDATA%\collimo` |
| macOS | `~/Library/Application Support/collimo` |
| Linux | `~/.config/collimo` |

Supprimer ce dossier remet Collimo à zéro ; les collages, eux, restent dans les dossiers de photos.

**J'ai déplacé ou renommé mon dossier de photos.** Collimo ne retrouve plus l'emplacement : en ajouter un nouveau (et retirer l'ancien de la liste). Les collages déjà enregistrés retrouvent leurs photos par leur nom dans le nouveau dossier. Cela marche aussi pour un collage ouvert sur un autre ordinateur, même d'un autre système.

**Peut-on partager les dispositions créées dans l'usine ?** Oui : menu du compte › **Dossier du catalogue…**, puis choisir un dossier partagé par l'équipe (réseau, OneDrive, Drive). Toute personne qui pointe vers ce dossier voit les mêmes dispositions ; celles qui peuvent y écrire peuvent les modifier.

**L'entreprise bloque le lancement.** Certaines entreprises interdisent les programmes non signés (AppLocker sous Windows, gestion des Mac). Il faut alors demander au service informatique d'autoriser Collimo, ou faire signer les fichiers (certificat de signature de code pour Windows, compte développeur Apple pour macOS).

**Un problème ?** Les étapes du démarrage et le détail des erreurs inattendues sont notés dans le fichier `collimo-erreurs.log` du dossier temporaire (`%TEMP%` sous Windows, `$TMPDIR` sous macOS, `/tmp` sous Linux) ; joindre ce fichier au signalement. `F12` (`⌘⌥I` sur Mac) ouvre les outils de développement.

## Fonctionnalités

**Photos de l’appareil**

- aucun compte : l'application s'ouvre directement ;
- panneau « Mes emplacements » (ordinateur, Android) : des dossiers de l'appareil ajoutés par le sélecteur du système (Images, dossier réseau, OneDrive, Google Drive pour ordinateur…), retirés d'un clic (rien n'est déplacé ni modifié), renommés (crayon, double-clic ou F2) et réordonnés par glisser-déposer ; « Épingler ce dossier » ajoute le dossier ouvert ; les 5 derniers dossiers ouverts sont proposés en « Récents » ;
- navigation dans les dossiers depuis Collimo (fil d'Ariane, sous-dossiers, photos du dossier ouvert) ; le sous-dossier `Collimo` des collages n'est créé qu'au premier collage, et un dossier en lecture seule se parcourt sans pouvoir y enregistrer ;
- iPhone et version web : un album à la place des dossiers, alimenté depuis la photothèque (« Ajouter des photos ») ;
- emplacements, dernier dossier ouvert et langue retrouvés au lancement suivant ;
- galerie de miniatures calculées par le système (Windows, macOS, Android) ou par Collimo, sélection ordonnée jusqu'à 100 photos (20 au plus par collage) ; diaporama plein écran (bouton de la galerie, ou loupe sur une miniature) pour regarder chaque photo en grand et la sélectionner (← →, Espace, Échap, glissement du doigt, bande de miniatures) ; photos HEIC des iPhone décodées par Collimo ;
- interface en français et en anglais.

**Plusieurs collages d'un coup**

- « Plusieurs collages… » (dès 4 photos sélectionnées, obligatoire au-delà de 20) ouvre la répartition : les photos à placer en haut, une carte par collage ; glisser une photo vers une carte, ou la toucher puis toucher la carte ; répartition automatique par nombre de photos par collage, ajout et retrait de collages ; loupe (ou double-clic) sur une vignette : la photo en grand, avec un bouton par collage pour l'y placer ; une croix sur chaque vignette écarte une photo de la sélection ; de 2 à 20 photos par collage ;
- les collages s'ouvrent ensuite l'un après l'autre dans l'éditeur : une barre indique « Collage 2 / 4 », un point par collage (✓ enregistré) ; Précédent, Collage suivant, ou un point pour y aller directement ; quitter un collage non enregistré demande confirmation ; chaque collage garde ses modifications quand on passe à un autre ;
- brouillon automatique : le collage en cours (ou la série) est gardé sur l'appareil à chaque modification ; après une coupure ou une fermeture, le lancement propose de le reprendre ou de l'ignorer ; il est effacé une fois tout enregistré ou au retour volontaire à la galerie.

**Dispositions**

- 541 dispositions de 1 à 20 photos, transcrites depuis l'app de référence et comparées une à une aux captures : 333 en rectangles, 208 en forme (cœurs, ronds, fleurs, étoiles, hexagones, losanges, puzzle, découpes courbes, en zigzag ou déchirées, feuilles, illustrations) ;
- format (1:1 par défaut, 4:5, 9:16, 16:9, A4…), bouton « mélanger » ;
- bords : écart entre les photos, marge, arrondi, contour des formes (épaisseur et couleur), couleur de fond ;
- dans une forme, la forme reste fixe et la photo se déplace, se zoome et tourne à l'intérieur ;
- le panneau d'outils du bas se replie (chevron à droite des onglets) pour voir le collage en plus grand ; le choix est mémorisé sur l'appareil.

**Travail sur chaque photo**

- toucher une photo pour la sélectionner ; glisser pour recadrer ; molette, pincement ou double-clic pour zoomer ; poignée ronde ou deux doigts pour tourner, avec aimantation ;
- poignées sur les séparations des dispositions en découpe, pour agrandir une case aux dépens de sa voisine ;
- menu : Échanger (bouton ou appui long puis glisser), Inverser, Rotation, Recadrer, Réglages, Masquer, Remplacer, Supprimer ;
- Masquer : la photo entière en grand, où l'on trace des rectangles sur ce qu'il faut cacher (écran, document, badge, visage) ; trois modes (Flou, Pixels, Plein), une intensité et une rotation par zone, zones déplaçables et redimensionnables ; zoom et déplacement de la vue ; les zones suivent la photo quels que soient le cadrage, le zoom ou la rotation ; le masque est cuit dans l'image exportée, la photo d'origine n'est pas touchée ;
- clavier : flèches, + et −, Échap.

**Texte et stickers**

- textes en polices Google (25 populaires, recherche dans les 1 580 du catalogue), 10 styles prédéfinis, contour, ombre, lueur, étiquette, opacité ;
- stickers Fluent Emoji (1 591 émojis en couleur) et Phosphor (1 512 icônes recolorables), recherche en français ou en anglais ; image personnelle (logo) prise sur l’ordinateur ;
- chaque élément se déplace, s'agrandit, tourne ; dupliquer, devant, derrière, supprimer.

**Filtres et réglages**

- 20 filtres en 5 familles, appliqués à tout le collage, intensité de 0 à 100 ;
- 11 réglages et un réglage automatique, sur tout le collage ou sur une seule photo (les deux s'additionnent) ; bouton avant/après ;
- calcul sur la carte graphique (WebGL 2), avec un calcul de secours identique sur le processeur.

**Export et collages enregistrés**

- rappel de confidentialité pendant le choix des photos (rien de confidentiel, arrière-plan vérifié, photos recadrées sur les personnes), et case à cocher obligatoire avant chaque enregistrement ;
- JPG ou PNG en Standard (2048 px), HD (5000 px) ou Maximum ; qualité JPG réglable (90 par défaut) ;
- chaque enregistrement crée un nouveau collage : l'image dans le dossier `Collimo`, et son fichier projet `.collimo.json` dans le sous-dossier `Collimo/Projets` (le dossier Collimo ne montre ainsi que les images), sous un nom daté (`Collimo_AAAA-MM-JJ_HH-MM-SS`) jamais écrasé ; à l'ouverture d'un dossier, les projets anciens restés à la racine sont déplacés dans `Projets` (une fois) ;
- « Mes collages » : vignettes des collages du dossier, avec leur nom et leur date, à reprendre d'un clic ; bouton qui ouvre l'image dans l'application par défaut (ordinateur) ; crayon pour renommer le collage (l'image et son projet ensemble, qui restent reliés par leur nom commun) ;
- sur téléphone : bouton Partager (Enregistrer dans Photos, Messages, mail…) ; sur ordinateur : « Enregistrer une copie sous… » ;
- annuler / rétablir (boutons, Ctrl+Z, Ctrl+Maj+Z) pour toutes les actions.

**Usine à dispositions**

- accès par le menu du compte ;
- créer une disposition à partir d'une grille, d'un cadre vide ou d'une disposition existante ;
- outils : couper une case, glisser une séparation, polygones (sommets), 27 formes, coupes spéciales sur une séparation (courbe, vague, zigzag, éclair, déchirure), ordre des cases ;
- vérifications automatiques (nombre de cases, cadre, chevauchements, cases trop petites) avant toute publication ; aperçu avec les photos du dossier en cours, sur 4 formats ;
- brouillon, publication, masquage ; les dispositions intégrées se masquent aussi ; un collage qui utilise une disposition masquée reste lisible.

Le catalogue de l'usine est le fichier `collimo-catalogue.json`, dans `catalogue` du dossier des réglages par défaut (voir [Questions fréquentes](#questions-fréquentes)). Le menu « Dossier du catalogue… » permet de le placer dans un dossier partagé (réseau, OneDrive, Drive) pour proposer les mêmes dispositions à toute l'équipe : qui peut écrire dans ce dossier peut modifier le catalogue. Il est vérifié à la lecture (une disposition invalide est ignorée) et relu avant chaque enregistrement, pour ne pas écraser le travail d'un collègue.

## Sécurité

- La page n'a aucun accès au système ni à Node (isolation, bac à sable de Chromium) ; elle passe par un pont limité qui n'ouvre que les dossiers et fichiers choisis par l'utilisateur avec les sélecteurs du système (liste gardée dans `desktop.json`, dans le dossier des réglages, que la page ne peut ni lire ni modifier) et le dossier du catalogue.
- Collimo ne crée que des images JPG/PNG et des fichiers JSON, n'écrase jamais un collage, et ne fait ouvrir par le système que des dossiers, images et JSON, jamais un programme.
- Aucun contenu extérieur n'est chargé, sauf les polices Google ; les liens s'ouvrent dans le navigateur par défaut.
- Sur Linux, l'AppImage désactive le bac à sable de Chromium seulement là où le système l'empêche de démarrer (Ubuntu 24.04 et suivants, faute du profil AppArmor que le `.deb` installe) ; la page reste isolée.

## Android

**Installer** (Android 7 ou plus récent) :

1. sur le téléphone, ouvrir la [dernière version](https://github.com/cclaerhout2/collimo-local/releases/latest) et télécharger `Collimo-X.Y.Z-android.apk` (ou le copier depuis un ordinateur) ;
2. ouvrir le fichier téléchargé : Android demande d'autoriser l'installation depuis cette source (le navigateur ou le gestionnaire de fichiers) ; l'accepter, revenir, puis **Installer** ;
3. Google Play Protect peut avertir d'une « application inconnue » : **Plus de détails › Installer quand même**.

Pour une nouvelle version, même chose : elle s'installe par-dessus la précédente, réglages et collages conservés.

**Utiliser** : au premier lancement, **Choisir un dossier** ouvre le sélecteur d'Android ; choisir par exemple **DCIM › Camera** (les photos de l'appareil photo), puis **Utiliser ce dossier › Autoriser**. Android ne donne à Collimo accès qu'à ce dossier : aucune autorisation générale sur les photos ou le stockage n'est demandée. Les collages sont enregistrés dans son sous-dossier `Collimo`, visibles dans l'application Fichiers et, en général, dans la galerie du téléphone. Le bouton Retour ramène de l'éditeur aux photos.

Différences avec l'ordinateur : pas de bouton « Enregistrer une copie sous… » ni « Ouvrir le dossier » (le collage est déjà dans le dossier, visible dans l'application Fichiers ou la galerie) ; Android ne permet pas de choisir la racine du stockage ni le dossier Téléchargements, il faut un sous-dossier. Les dossiers Google Drive ne sont en général pas proposés par le sélecteur d'Android.

**Signature** : l'APK est signé avec une clé de démonstration gardée dans ce dépôt privé (`android/keystore/collimo-demo.jks`, mot de passe `collimo-demo`) : quiconque a accès au dépôt peut signer une version. Pour une diffusion plus large, créer une clé propre et la donner au workflow par les secrets GitHub `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD` et `ANDROID_KEY_ALIAS` (une fois changée, la clé ne peut plus changer : un téléphone refuse une mise à jour signée par une autre clé). Une publication sur Google Play demanderait un compte développeur (25 $, une fois).

## iPhone et iPad

Deux façons, au choix : la **version web** (rien à installer, la plus simple) ou l'**application** (à installer avec un outil de sideloading, à renouveler tous les 7 jours sans compte payant).

Sur l'iPhone, il n'y a pas de dossiers de photos : Collimo a son **album**. On y ajoute des photos depuis la photothèque (bouton **Ajouter des photos**, aussi dans le menu du compte), elles y sont copiées ; les collages y sont rangés, retrouvés dans « Mes collages », et en sortent par **Partager… › Enregistrer l'image** (dans Photos), Messages, Mail, AirDrop…

### Version web (recommandée)

1. Ouvrir l'adresse du site dans **Safari** (voir ci-dessous) ;
2. **Partager › Sur l'écran d'accueil › Ajouter** : Collimo apparaît comme une app, s'ouvre en plein écran, et fonctionne ensuite **sans réseau**.

Rien à installer ni à renouveler, aucun compte ; tout reste dans le stockage de Safari, sur l'iPhone (Collimo demande qu'il ne soit pas effacé ; il l'est si l'on supprime l'icône de l'écran d'accueil ou les données du site). Fonctionne aussi sur Android, iPad et ordinateur, dans tout navigateur récent.

**Mise en ligne du site**, une fois : le site est `Collimo-X.Y.Z-web.zip` de la [dernière version](https://github.com/cclaerhout2/collimo-local/releases/latest) (fichiers statiques, à servir tels quels, à la racine ou dans un sous-dossier, en HTTPS).

- **GitHub Pages**, automatique : Settings › Pages › Source : **GitHub Actions**. Le workflow publie alors le site à chaque envoi sur `main`, à l'adresse `https://cclaerhout2.github.io/collimo-local/`. Pour un dépôt privé, GitHub Pages demande un compte GitHub payant (Pro, Team) ; sinon rendre le dépôt public, ou :
- tout hébergeur de fichiers statiques gratuit (Cloudflare Pages, Netlify : glisser-déposer le contenu du `.zip`), ou le serveur web de l'entreprise.

### Application iPhone (IPA)

`Collimo-X.Y.Z-ios.ipa` (iOS 15 ou plus récent) n'est pas signée par Apple : on l'installe avec un outil qui la signe avec votre identifiant Apple (gratuit) :

- [SideStore](https://sidestore.io) : sur l'iPhone, renouvellement automatique tous les 7 jours sans ordinateur (un ordinateur une seule fois, pour l'installer) ;
- [Sideloadly](https://sideloadly.io) (Windows, Mac) ou [AltStore](https://altstore.io) : depuis l'ordinateur, renouvellement automatique quand l'iPhone est sur le même Wi-Fi.

Puis, sur l'iPhone : Réglages › Général › VPN et gestion de l'appareil › faire confiance à son identifiant ; et, depuis iOS 16, Réglages › Confidentialité et sécurité › **Mode développeur**. Avec un identifiant gratuit, l'app doit être renouvelée tous les 7 jours (3 apps installées ainsi au plus). Avec un compte développeur Apple (99 $ par an), elle se diffuse par **TestFlight**, sans ces limites : il suffit alors de signer l'IPA dans le workflow.

L'album de l'application est aussi visible dans l'app **Fichiers** (« Sur mon iPhone › Collimo ») : on peut y déposer des photos ou y récupérer les collages.

## Développement

```bash
npm install
npm run desktop:start
```

| Commande | Rôle |
| --- | --- |
| `npm run desktop:start` | construit et lance l'application |
| `npm run desktop:pack` | construit les paquets du système en cours dans `release/` |
| `npm run web:build` | construit la version web locale dans `dist-web/` (site statique à héberger) |
| `npm run test:e2e:web` | test de bout en bout de la version web (`--browser webkit` ou `chromium` avec les navigateurs de Playwright, `electron` sinon) |
| `npm run ios:sync` | prépare le projet Xcode (`ios/`) ; construction de l'IPA sur un Mac avec Xcode, comme dans le workflow |
| `npm run android:apk` | construit l'APK Android dans `android/app/build/outputs/apk/release/` (Android SDK et Java 21 nécessaires) |
| `npm run test:e2e:android` | test de bout en bout de la version de test Android (`fr.collimo.app.test`) installée sur un émulateur ou un téléphone branché (adb) |
| `npm run desktop:pack:win`, `:mac`, `:linux` | paquets d'un système donné (macOS seulement sur un Mac ; Windows depuis Linux avec Wine 32 et 64 bits) |
| `npm test` | tests automatiques (moteur, catalogue, accès aux fichiers, services, documentation du code) |
| `npm run test:e2e` | test de bout en bout de l'application (après `npm run desktop:build`) : dossier, galerie (HEIC compris), collage, enregistrement, réouverture, usine, relancement, dossier déplacé, cloisonnement ; `--exe chemin/de/l/executable` pour tester une application construite ou installée (sous Linux, lancer avec `xvfb-run -a` sans écran) |
| `npm run lint` | lint (oxlint, documentation TSDoc complète) et contrôle de la mise en forme |
| `npm run format` | met tout le code en forme (Prettier) |
| `npm run typecheck` | vérification des types TypeScript |
| `npm run gen:assets` | régénère les catalogues de stickers et de polices dans `public/data/` |

**Interface dans le navigateur** : `VITE_MOCK=1 npm run dev` affiche l'interface avec des photos simulées, pratique pour travailler sur l'éditeur sans relancer l'application ; `/planche.html?n=5` affiche toutes les dispositions de 5 photos.

Le workflow `.github/workflows/apps.yml` tourne à chaque envoi, sur trois vraies machines, un émulateur Android et un simulateur d'iPhone :

- **Windows** : types, lint et tests, construction, test de bout en bout de `Collimo.exe`, puis installation silencieuse, test de l'application installée et désinstallation ;
- **Linux** (Ubuntu 24.04) : tests, construction, test de bout en bout de l'application, de l'AppImage, puis du `.deb` installé, et désinstallation ;
- **macOS** (Apple Silicon) : tests, construction pour Apple Silicon et Intel, vérification de la signature, test de bout en bout de l'application, puis de l'application installée depuis le `.dmg` ;
- **Android** (émulateur Android 14) : tests, construction des APK, test de bout en bout de la version de test (dossier, galerie, collage, enregistrement, bouton Retour, réouverture, usine, relancement), puis démarrage de la version finale ;
- **iPhone** (Mac) : construction de l'IPA, puis auto-test de bout en bout sur le simulateur (photos, miniatures, collage exporté et enregistré, relecture du projet, réglages) ;
- **Version web** : test de bout en bout dans WebKit (moteur de Safari, iPhone 13 simulé) et Chromium (Pixel 7 simulé) : ajout de photos, collage, rechargement, ouverture sans réseau ; puis publication sur GitHub Pages si elle est activée.

Les paquets d'une nouvelle version vont directement dans la Release (les « artifacts » de GitHub, limités en place, ne gardent que les captures des tests en échec).

Les paquets sont dans les *Artifacts* de chaque exécution.

## Publier une version

Augmenter `version` dans `package.json` et l'envoyer sur `main` : une fois tous les systèmes au vert, le workflow crée la Release GitHub `vX.Y.Z` avec tous les paquets (une version déjà publiée n'est jamais remplacée).

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
electron/              ordinateur : fenêtre, protocole collimo://, accès aux fichiers (files.ts), préchargement
android/               Android : projet Capacitor ; module d'accès aux dossiers (app/src/main/java/fr/collimo/app/CollimoStoragePlugin.java)
ios/                   iPhone : projet Xcode (Capacitor) ; module d'accès aux photos (App/App/CollimoStoragePlugin.swift)
capacitor.config.json  configuration de l'application Android
build-resources/       icônes de l'application (Windows .ico, macOS .icns, Linux .png)
.github/workflows/     construction, tests et publication : Windows, Linux, macOS, Android, iPhone, web
src/
  config.ts            configuration et constantes (20 photos max…)
  desktop/             services sur les fichiers de l’appareil, et contrat avec electron/ et Android (bridge.ts)
  native/              pont des applications Android et iPhone (même contrat que l'ordinateur), auto-test, bouton Retour
  web/                 pont de la version web locale (album dans IndexedDB)
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
tools/                 construction (build-electron.mjs), tests de bout en bout (e2e-desktop.mjs, e2e-android.mjs, e2e-web.mjs), génération des catalogues
public/                fichiers servis tels quels, dont le manifeste, les icônes et le service worker de la version web
```

## Licences

L'application embarque Electron (MIT) et Chromium (licences dans `LICENSES.chromium.html`, livré avec l'application). Le décodeur HEIC (`heic-to`, basé sur libheif) est sous licence LGPL-3.0 ; il est chargé comme un module séparé, seulement quand une photo HEIC est utilisée. Icônes Phosphor (MIT) et Fluent Emoji (MIT) ; polices Google Fonts (licences libres, chargées depuis Google).
