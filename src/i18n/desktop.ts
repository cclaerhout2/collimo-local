/**
 * Libellés propres aux applications locales (ordinateur, Android, iPhone, version web) : ils remplacent
 * ceux qui parlent de Google Drive, puisque les photos et les collages sont alors des fichiers de l'appareil.
 * Seules les clés qui changent sont listées ; les variables `{nom}` restent celles du libellé d'origine.
 */
import type { MessageKey } from './fr'

/** Libellés de remplacement, par langue, pour les applications à dossiers (ordinateur, Android). */
export const desktopTexts: Record<'fr' | 'en', Partial<Record<MessageKey, string>>> = {
  fr: {
    'signin.title': 'Bienvenue sur Collimo',
    'signin.text': 'Créez des collages à partir des photos de votre ordinateur.',
    'signin.button': 'Commencer',
    'signin.privacy':
      'Vos photos restent sur votre ordinateur. Collimo ne lit que les dossiers que vous choisissez et n’écrit que ses propres fichiers.',
    'signin.loading': 'Ouverture…',
    'setup.myDrive': 'Cet appareil',
    'locations.emptyText':
      'Un emplacement est un dossier de l’appareil qui contient vos photos (ou des sous-dossiers de photos). Vous pouvez en ajouter plusieurs et les retirer à tout moment : rien n’est déplacé ni modifié.',
    'locations.pick': 'Choisissez un emplacement dans la liste pour parcourir ses dossiers.',
    'add.title': 'Ajouter un emplacement',
    'add.text':
      'Choisissez un dossier de l’appareil : ses photos et ses sous-dossiers seront proposés. Un dossier synchronisé (Google Drive pour ordinateur, OneDrive…) ou un dossier réseau convient aussi.',
    'add.folder': 'Choisir un dossier…',
    'add.pickerTitle': 'Choisissez le dossier de vos photos',
    'gallery.readOnly': 'Collimo ne peut pas écrire dans ce dossier : les collages ne pourront pas y être enregistrés.',
    'sticker.mineText': 'Ajoutez une image de votre ordinateur, par exemple un logo en PNG transparent.',
    'export.save': 'Enregistrer',
    'export.uploading': 'Enregistrement…',
    'queue.confirm': 'Ce collage n’est pas enregistré.',
    'export.download': 'Enregistrer une copie sous…',
    'export.doneHint':
      'L’image est dans le dossier Collimo, à côté de vos photos, et son fichier projet dans Collimo › Projets. Le collage reste ouvert : chaque nouvel enregistrement crée un nouveau collage.',
    'projects.copyLink': 'Ouvrir le collage',
    'projects.copyLinkHint': 'Ouvrir l’image dans l’application par défaut',
    'projects.renameHint': 'Renommer le collage (l’image et son fichier projet)',
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
    'setup.myDrive': 'This device',
    'locations.emptyText':
      'A location is a folder on this device that holds your photos (or subfolders of photos). You can add several and remove them at any time: nothing is moved or changed.',
    'locations.pick': 'Choose a location in the list to browse its folders.',
    'add.title': 'Add a location',
    'add.text':
      'Choose a folder on this device: its photos and subfolders will be offered. A synced folder (Google Drive for desktop, OneDrive…) or a network folder works too.',
    'add.folder': 'Choose a folder…',
    'add.pickerTitle': 'Choose your photo folder',
    'gallery.readOnly': 'Collimo cannot write to this folder: collages cannot be saved there.',
    'sticker.mineText': 'Add an image from your computer, for example a logo as a transparent PNG.',
    'export.save': 'Save',
    'export.uploading': 'Saving…',
    'queue.confirm': 'This collage is not saved.',
    'export.download': 'Save a copy as…',
    'export.doneHint':
      'The image is in the Collimo folder, next to your photos, and its project file in Collimo › Projets. The collage stays open: each new save creates a new collage.',
    'projects.copyLink': 'Open the collage',
    'projects.copyLinkHint': 'Open the image in the default app',
    'projects.renameHint': 'Rename the collage (the image and its project file)',
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
    'add.text':
      'Choisissez un dossier du téléphone : ses photos et ses sous-dossiers seront proposés. Les photos de l’appareil photo sont dans DCIM › Camera.',
    'sticker.mineText': 'Ajoutez une image de votre téléphone, par exemple un logo en PNG transparent.',
    'export.doneHint':
      'L’image est dans le dossier Collimo, à côté de vos photos (application Fichiers, et en général la galerie du téléphone) ; son fichier projet dans Collimo › Projets. Le collage reste ouvert : chaque nouvel enregistrement crée un nouveau collage.',
  },
  en: {
    'signin.text': 'Create collages from the photos on your phone.',
    'signin.privacy': 'Your photos stay on your phone. Collimo only reads the folders you choose and only writes its own files.',
    'add.text': 'Choose a folder on the phone: its photos and subfolders will be offered. Camera photos are in DCIM › Camera.',
    'sticker.mineText': 'Add an image from your phone, for example a logo as a transparent PNG.',
    'export.doneHint':
      'The image is in the Collimo folder, next to your photos (Files app, and usually the phone’s gallery); its project file in Collimo › Projets. The collage stays open: each new save creates a new collage.',
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
    'locations.add': 'Ajouter des photos',
    'locations.emptyTitle': 'Ajoutez vos premières photos',
    'locations.emptyText':
      'Les photos choisies dans votre photothèque sont copiées dans l’album de Collimo, sur cet appareil ; vos collages y sont rangés aussi. Le bouton Partager les enregistre dans Photos ou les envoie.',
    'add.pickerTitle': 'Choisissez des photos',
    'gallery.empty': 'Aucune photo dans l’album.',
    'gallery.emptyHint': 'Ajoutez des photos avec le bouton « Ajouter des photos ».',
    'gallery.refresh': '+ Ajouter des photos',
    'sticker.mineText': 'Ajoutez une image de votre appareil, par exemple un logo en PNG transparent.',
    'projects.empty': 'Aucun collage pour l’instant.',
    'export.download': 'Télécharger',
    'export.doneHint':
      'Le collage est rangé dans « Mes collages ». Partager l’enregistre dans Photos ou l’envoie. Le collage reste ouvert : chaque nouvel enregistrement crée un nouveau collage.',
  },
  en: {
    'signin.text': 'Create collages from the photos on your device.',
    'signin.privacy': 'Your photos stay on your device. Collimo only reads the photos you choose; nothing is sent over the internet.',
    'locations.add': 'Add photos',
    'locations.emptyTitle': 'Add your first photos',
    'locations.emptyText':
      'The photos chosen from your library are copied into Collimo’s album, on this device; your collages are stored there too. The Share button saves them to Photos or sends them.',
    'add.pickerTitle': 'Choose photos',
    'gallery.empty': 'No photos in the album.',
    'gallery.emptyHint': 'Add photos with the “Add photos” button.',
    'gallery.refresh': '+ Add photos',
    'sticker.mineText': 'Add an image from your device, for example a logo as a transparent PNG.',
    'projects.empty': 'No collages yet.',
    'export.download': 'Download',
    'export.doneHint':
      'The collage is stored in “My collages”. Share saves it to Photos or sends it. The collage stays open: each new save creates a new collage.',
  },
}
