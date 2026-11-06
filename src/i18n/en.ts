import type { MessageKey } from './fr'

/** English strings. Must define exactly the same keys as fr.ts (checked by the tests). */
export const en: Record<MessageKey, string> = {
  'app.tagline': 'Your photos, put together in a single move.',
  'lang.label': 'Language',
  'lang.fr': 'Français',
  'lang.en': 'English',

  'signin.title': 'Welcome to Collimo',
  'signin.text': 'Sign in with your Google work account to create collages from your Drive photos.',
  'signin.button': 'Sign in with Google',
  'signin.privacy':
    'Your photos stay in your Drive. Collimo only reads the folders you choose and only writes its own files.',
  'signin.loading': 'Signing in…',

  'error.config': 'Incomplete configuration: {vars}. See the README for setup.',
  'error.domain': 'This account ({email}) is not part of the allowed domain ({domain}).',
  'error.scopes':
    'Collimo needs every requested permission to work. Sign in again and tick all of them.',
  'error.popup': 'The sign-in window was closed or blocked. Please try again.',
  'error.expired': 'Your session has expired.',
  'error.reconnect': 'Sign in again',
  'error.generic': 'Something went wrong: {message}',
  'error.retry': 'Try again',

  'menu.changeLocation': 'Change location',
  'menu.signOut': 'Sign out',

  'setup.title': 'Where are your photos?',
  'setup.step1': '1. Choose a Drive',
  'setup.myDrive': 'My Drive',
  'setup.sharedDrives': 'Shared drives',
  'setup.noSharedDrives': 'You are not a member of any shared drive.',
  'setup.loadingDrives': 'Loading shared drives…',
  'setup.step2': '2. Choose the folder that holds your photos',
  'setup.pickFolder': 'Choose a folder',
  'setup.pickerTitle': 'Choose your photo folder',
  'setup.selected': 'Selected folder: {name}',
  'setup.collimoNote':
    'Collimo will create a “Collimo” subfolder in this folder to store your collages.',
  'setup.confirm': 'Continue',
  'setup.cancel': 'Cancel',
  'setup.checking': 'Checking the folder…',
  'setup.noWriteAccess':
    'You are not allowed to add files to “{name}”. Choose another folder, or ask for the Contributor role on this drive.',
  'setup.wrongDrive': 'This folder is not in “{drive}”. Choose a folder from that drive.',

  'gallery.location': '{drive} › {folder}',
  'gallery.count': '{count} photo(s)',
  'gallery.loading': 'Loading photos…',
  'gallery.empty': 'No photos in this folder.',
  'gallery.emptyHint': 'Add JPG, PNG or WebP photos to this folder, or choose another one.',
  'gallery.selected': '{count} / {max} selected',
  'gallery.clear': 'Clear selection',
  'gallery.create': 'Create a collage',
  'gallery.max': 'A collage holds at most {max} photos.',
  'gallery.unsupported': 'Format not supported yet ({type})',
  'gallery.refresh': 'Refresh',

  'collage.title': 'New collage',
  'collage.placeholder': 'The collage screen arrives in step 2. You selected {count} photo(s).',
  'collage.back': 'Back to photos',

  'mock.banner': 'Demo mode: simulated Drive, no real data.',
}
