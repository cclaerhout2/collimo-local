/** Libellés français. Toute clé ajoutée ici doit l'être aussi dans en.ts (vérifié par les tests). */
export const fr = {
  'app.tagline': 'Vos photos, assemblées en un geste.',
  'lang.label': 'Langue',
  'lang.fr': 'Français',
  'lang.en': 'English',

  'signin.title': 'Bienvenue sur Collimo',
  'signin.text':
    'Connectez-vous avec votre compte professionnel Google pour créer des collages à partir de vos photos Drive.',
  'signin.button': 'Se connecter avec Google',
  'signin.privacy':
    'Vos photos restent dans votre Drive. Collimo ne lit que les dossiers que vous choisissez et n’écrit que ses propres fichiers.',
  'signin.loading': 'Connexion en cours…',

  'error.config':
    'Configuration incomplète : {vars}. Voir le fichier README pour la mise en place.',
  'error.domain': 'Ce compte ({email}) n’appartient pas au domaine autorisé ({domain}).',
  'error.scopes':
    'Collimo a besoin de toutes les autorisations demandées pour fonctionner. Reconnectez-vous et cochez-les toutes.',
  'error.popup': 'La fenêtre de connexion a été fermée ou bloquée. Réessayez.',
  'error.expired': 'Votre session a expiré.',
  'error.reconnect': 'Se reconnecter',
  'error.generic': 'Une erreur est survenue : {message}',
  'error.retry': 'Réessayer',

  'menu.changeLocation': 'Changer d’emplacement',
  'menu.signOut': 'Se déconnecter',

  'setup.title': 'Où sont vos photos ?',
  'setup.step1': '1. Choisissez un Drive',
  'setup.myDrive': 'Mon Drive',
  'setup.sharedDrives': 'Drive partagés',
  'setup.noSharedDrives': 'Vous n’êtes membre d’aucun Drive partagé.',
  'setup.loadingDrives': 'Chargement des Drive partagés…',
  'setup.step2': '2. Choisissez le dossier qui contient vos photos',
  'setup.pickFolder': 'Choisir un dossier',
  'setup.pickerTitle': 'Choisissez le dossier de vos photos',
  'setup.selected': 'Dossier choisi : {name}',
  'setup.collimoNote':
    'Collimo créera un sous-dossier « Collimo » dans ce dossier pour y ranger vos collages.',
  'setup.confirm': 'Continuer',
  'setup.cancel': 'Annuler',
  'setup.checking': 'Vérification du dossier…',
  'setup.noWriteAccess':
    'Vous n’avez pas le droit d’ajouter des fichiers dans « {name} ». Choisissez un autre dossier, ou demandez le rôle Contributeur sur ce Drive.',
  'setup.wrongDrive': 'Ce dossier n’est pas dans « {drive} ». Choisissez un dossier de ce Drive.',

  'gallery.location': '{drive} › {folder}',
  'gallery.count': '{count} photo(s)',
  'gallery.loading': 'Chargement des photos…',
  'gallery.empty': 'Aucune photo dans ce dossier.',
  'gallery.emptyHint': 'Ajoutez des photos JPG, PNG ou WebP dans ce dossier, ou choisissez-en un autre.',
  'gallery.selected': '{count} / {max} sélectionnée(s)',
  'gallery.clear': 'Tout désélectionner',
  'gallery.create': 'Créer un collage',
  'gallery.max': 'Un collage contient au maximum {max} photos.',
  'gallery.unsupported': 'Format non pris en charge pour l’instant ({type})',
  'gallery.refresh': 'Actualiser',

  'collage.title': 'Nouveau collage',
  'collage.placeholder':
    'L’écran du collage arrive à l’étape 2. Vous avez sélectionné {count} photo(s).',
  'collage.back': 'Retour aux photos',

  'mock.banner': 'Mode démo : Drive simulé, aucune donnée réelle.',
} as const

export type MessageKey = keyof typeof fr
