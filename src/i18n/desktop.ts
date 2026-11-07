/**
 * Libellés propres à l'application de bureau (Windows, macOS, Linux) : ils remplacent ceux qui parlent
 * de Google Drive, puisque les photos et les collages sont alors des fichiers de l'ordinateur.
 * Seules les clés qui changent sont listées ; les variables `{nom}` restent celles du libellé d'origine.
 */
import type { MessageKey } from './fr'

/** Libellés de remplacement, par langue. */
export const desktopTexts: Record<'fr' | 'en', Partial<Record<MessageKey, string>>> = {
  fr: {
    'signin.title': 'Bienvenue sur Collimo',
    'signin.text': 'Créez des collages à partir des photos de votre ordinateur.',
    'signin.button': 'Commencer',
    'signin.privacy':
      'Vos photos restent sur votre ordinateur. Collimo ne lit que les dossiers que vous choisissez et n’écrit que ses propres fichiers.',
    'signin.loading': 'Ouverture…',
    'setup.step2': 'Choisissez le dossier qui contient vos photos',
    'setup.collimoNote':
      'Collimo créera un sous-dossier « Collimo » dans ce dossier pour y ranger vos collages. Un dossier synchronisé (Google Drive pour ordinateur, OneDrive, iCloud Drive…) ou un dossier réseau convient aussi.',
    'setup.noWriteAccess': 'Collimo ne peut pas écrire dans « {name} ». Choisissez un autre dossier.',
    'gallery.location': '{folder}',
    'sticker.mineText': 'Ajoutez une image de votre ordinateur, par exemple un logo en PNG transparent.',
    'export.save': 'Enregistrer',
    'export.uploading': 'Enregistrement…',
    'export.download': 'Enregistrer une copie sous…',
    'export.doneHint':
      'L’image et le fichier projet sont dans le dossier Collimo, à côté de vos photos. Le collage reste ouvert : chaque nouvel enregistrement crée un nouveau collage.',
    'factory.intro':
      'Créez, modifiez et publiez des dispositions. Elles sont enregistrées dans le dossier « {drive} » ; placez-le sur un dossier partagé pour les proposer à toute l’équipe.',
    'factory.history': 'Afficher le fichier',
    'factory.grant.text': 'Collimo ne peut pas modifier « {file} ». Vérifiez vos droits sur ce fichier, puis réessayez.',
    'error.expired': 'Le dossier n’est plus accessible.',
  },
  en: {
    'signin.title': 'Welcome to Collimo',
    'signin.text': 'Create collages from the photos on your computer.',
    'signin.button': 'Get started',
    'signin.privacy': 'Your photos stay on your computer. Collimo only reads the folders you choose and only writes its own files.',
    'signin.loading': 'Opening…',
    'setup.step2': 'Choose the folder that holds your photos',
    'setup.collimoNote':
      'Collimo will create a “Collimo” subfolder in this folder to store your collages. A synced folder (Google Drive for desktop, OneDrive, iCloud Drive…) or a network folder works too.',
    'setup.noWriteAccess': 'Collimo cannot write to “{name}”. Choose another folder.',
    'gallery.location': '{folder}',
    'sticker.mineText': 'Add an image from your computer, for example a logo as a transparent PNG.',
    'export.save': 'Save',
    'export.uploading': 'Saving…',
    'export.download': 'Save a copy as…',
    'export.doneHint':
      'The image and the project file are in the Collimo folder, next to your photos. The collage stays open: each new save creates a new collage.',
    'factory.intro':
      'Create, edit and publish layouts. They are stored in the folder “{drive}”; point it to a shared folder to offer them to the whole team.',
    'factory.history': 'Show the file',
    'factory.grant.text': 'Collimo cannot modify “{file}”. Check your rights on this file, then try again.',
    'error.expired': 'The folder is no longer accessible.',
  },
}

/** Libellés propres à l'application Android, qui complètent ceux de l'application de bureau. */
export const androidTexts: Record<'fr' | 'en', Partial<Record<MessageKey, string>>> = {
  fr: {
    'signin.text': 'Créez des collages à partir des photos de votre téléphone.',
    'signin.privacy':
      'Vos photos restent sur votre téléphone. Collimo ne lit que les dossiers que vous choisissez et n’écrit que ses propres fichiers.',
    'setup.collimoNote':
      'Collimo créera un sous-dossier « Collimo » dans ce dossier pour y ranger vos collages. Les photos de l’appareil photo sont dans DCIM › Camera.',
    'sticker.mineText': 'Ajoutez une image de votre téléphone, par exemple un logo en PNG transparent.',
    'export.doneHint':
      'L’image et le fichier projet sont dans le dossier Collimo, à côté de vos photos (application Fichiers, et en général la galerie du téléphone). Le collage reste ouvert : chaque nouvel enregistrement crée un nouveau collage.',
  },
  en: {
    'signin.text': 'Create collages from the photos on your phone.',
    'signin.privacy': 'Your photos stay on your phone. Collimo only reads the folders you choose and only writes its own files.',
    'setup.collimoNote':
      'Collimo will create a “Collimo” subfolder in this folder to store your collages. Camera photos are in DCIM › Camera.',
    'sticker.mineText': 'Add an image from your phone, for example a logo as a transparent PNG.',
    'export.doneHint':
      'The image and the project file are in the Collimo folder, next to your photos (Files app, and usually the phone’s gallery). The collage stays open: each new save creates a new collage.',
  },
}

/**
 * Libellés des versions sans dossiers (iPhone, version web locale) : les photos choisies dans la
 * photothèque sont copiées dans un album de Collimo, d'où les collages sortent par Partager.
 */
export const albumTexts: Record<'fr' | 'en', Partial<Record<MessageKey, string>>> = {
  fr: {
    'signin.text': 'Créez des collages à partir des photos de votre appareil.',
    'signin.privacy':
      'Vos photos restent sur votre appareil. Collimo ne lit que les photos que vous choisissez ; rien n’est envoyé sur internet.',
    'setup.title': 'Vos photos',
    'setup.step2': 'Choisissez dans votre photothèque les photos à assembler',
    'setup.pickFolder': 'Ajouter des photos',
    'setup.pickerTitle': 'Choisissez des photos',
    'setup.selected': 'Album : {name}',
    'setup.collimoNote':
      'Les photos choisies sont copiées dans l’album de Collimo, sur cet appareil ; vos collages y sont rangés aussi. Le bouton Partager les enregistre dans Photos ou les envoie.',
    'menu.changeLocation': 'Ajouter des photos',
    'gallery.empty': 'Aucune photo dans l’album.',
    'gallery.emptyHint': 'Ajoutez des photos par le menu (rond en haut à droite) › Ajouter des photos.',
    'sticker.mineText': 'Ajoutez une image de votre appareil, par exemple un logo en PNG transparent.',
    'projects.empty': 'Aucun collage pour l’instant.',
    'export.download': 'Télécharger',
    'export.doneHint':
      'Le collage est rangé dans « Mes collages ». Partager l’enregistre dans Photos ou l’envoie. Le collage reste ouvert : chaque nouvel enregistrement crée un nouveau collage.',
  },
  en: {
    'signin.text': 'Create collages from the photos on your device.',
    'signin.privacy': 'Your photos stay on your device. Collimo only reads the photos you choose; nothing is sent over the internet.',
    'setup.title': 'Your photos',
    'setup.step2': 'Choose the photos to combine from your photo library',
    'setup.pickFolder': 'Add photos',
    'setup.pickerTitle': 'Choose photos',
    'setup.selected': 'Album: {name}',
    'setup.collimoNote':
      'The chosen photos are copied into Collimo’s album, on this device; your collages are stored there too. The Share button saves them to Photos or sends them.',
    'menu.changeLocation': 'Add photos',
    'gallery.empty': 'No photos in the album.',
    'gallery.emptyHint': 'Add photos from the menu (round button, top right) › Add photos.',
    'sticker.mineText': 'Add an image from your device, for example a logo as a transparent PNG.',
    'projects.empty': 'No collages yet.',
    'export.download': 'Download',
    'export.doneHint':
      'The collage is stored in “My collages”. Share saves it to Photos or sends it. The collage stays open: each new save creates a new collage.',
  },
}
