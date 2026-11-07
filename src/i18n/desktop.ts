/**
 * Libellés propres à l'application Windows : ils remplacent ceux qui parlent de Google Drive,
 * puisque les photos et les collages sont alors des fichiers du PC.
 * Seules les clés qui changent sont listées ; les variables `{nom}` restent celles du libellé d'origine.
 */
import type { MessageKey } from './fr'

/** Libellés de remplacement, par langue. */
export const desktopTexts: Record<'fr' | 'en', Partial<Record<MessageKey, string>>> = {
  fr: {
    'signin.title': 'Bienvenue sur Collimo',
    'signin.text': 'Créez des collages à partir des photos de votre PC.',
    'signin.button': 'Commencer',
    'signin.privacy':
      'Vos photos restent sur votre PC. Collimo ne lit que les dossiers que vous choisissez et n’écrit que ses propres fichiers.',
    'signin.loading': 'Ouverture…',
    'setup.step2': 'Choisissez le dossier qui contient vos photos',
    'setup.collimoNote':
      'Collimo créera un sous-dossier « Collimo » dans ce dossier pour y ranger vos collages. Un dossier Google Drive pour ordinateur (lecteur G:) ou un dossier réseau convient aussi.',
    'setup.noWriteAccess': 'Collimo ne peut pas écrire dans « {name} ». Choisissez un autre dossier.',
    'gallery.location': '{folder}',
    'sticker.mineText': 'Ajoutez une image de votre PC, par exemple un logo en PNG transparent.',
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
    'signin.text': 'Create collages from the photos on your PC.',
    'signin.button': 'Get started',
    'signin.privacy': 'Your photos stay on your PC. Collimo only reads the folders you choose and only writes its own files.',
    'signin.loading': 'Opening…',
    'setup.step2': 'Choose the folder that holds your photos',
    'setup.collimoNote':
      'Collimo will create a “Collimo” subfolder in this folder to store your collages. A Google Drive for desktop folder (G: drive) or a network folder works too.',
    'setup.noWriteAccess': 'Collimo cannot write to “{name}”. Choose another folder.',
    'gallery.location': '{folder}',
    'sticker.mineText': 'Add an image from your PC, for example a logo as a transparent PNG.',
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
