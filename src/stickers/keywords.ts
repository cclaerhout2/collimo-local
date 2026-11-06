/**
 * Recherche de stickers en français : les bibliothèques sont indexées en anglais, on traduit donc
 * les mots français courants en termes anglais. Clés sans accents, en minuscules.
 */
export const FR_KEYWORDS: Record<string, string[]> = {
  // Émotions et visages
  sourire: ['smile', 'smiling', 'grin'], rire: ['laugh', 'joy', 'grin'], content: ['smile', 'happy'], heureux: ['happy', 'smile'],
  triste: ['sad', 'cry', 'frown'], pleurer: ['cry', 'tear'], colere: ['angry', 'pout', 'rage'], peur: ['fear', 'scream'],
  surprise: ['surprise', 'astonished', 'open-mouth'], amour: ['love', 'heart'], bisou: ['kiss'], clin: ['wink'],
  visage: ['face'], tete: ['face', 'head'], fatigue: ['tired', 'sleep'], dormir: ['sleep', 'zzz'], malade: ['sick', 'mask'],
  cool: ['sunglasses', 'cool'], fete: ['party', 'celebration', 'confetti'], anniversaire: ['birthday', 'cake'],
  // Cœurs et symboles
  coeur: ['heart'], etoile: ['star', 'sparkle'], eclair: ['lightning', 'zap', 'high-voltage'], feu: ['fire', 'flame'],
  check: ['check'], valide: ['check', 'checkmark'], croix: ['x', 'cross'], plus: ['plus'], moins: ['minus'],
  fleche: ['arrow'], cible: ['target', 'bullseye'], idee: ['lightbulb', 'idea'], question: ['question'], attention: ['warning'],
  info: ['info'], interdit: ['prohibited', 'no-entry'], cent: ['hundred'], ok: ['ok', 'thumbs-up'], top: ['top', 'thumbs-up'],
  // Personnes et gestes
  personne: ['person', 'people', 'user'], gens: ['people', 'users'], equipe: ['team', 'users', 'people'], homme: ['man'],
  femme: ['woman'], enfant: ['child', 'baby'], bebe: ['baby'], famille: ['family'], main: ['hand'], pouce: ['thumbs-up', 'thumb'],
  applaudir: ['clap', 'clapping'], salut: ['wave', 'waving'], poing: ['fist'], muscle: ['muscle', 'flexed'], priere: ['pray', 'folded-hands'],
  // Animaux et nature
  chat: ['cat'], chien: ['dog'], oiseau: ['bird'], poisson: ['fish'], cheval: ['horse'], vache: ['cow'], cochon: ['pig'],
  lapin: ['rabbit'], ours: ['bear'], lion: ['lion'], papillon: ['butterfly'], abeille: ['bee'], insecte: ['bug', 'insect'],
  animal: ['animal', 'paw'], patte: ['paw'], fleur: ['flower', 'blossom', 'tulip', 'rose'], arbre: ['tree'], feuille: ['leaf'],
  plante: ['plant', 'seedling'], soleil: ['sun', 'sunny'], lune: ['moon'], nuage: ['cloud'], pluie: ['rain', 'umbrella'],
  neige: ['snow', 'snowflake'], vent: ['wind'], arcenciel: ['rainbow'], 'arc-en-ciel': ['rainbow'], mer: ['wave', 'ocean', 'water'],
  montagne: ['mountain'], plage: ['beach', 'umbrella-on-ground'], eau: ['water', 'droplet'], terre: ['globe', 'earth'],
  // Nourriture et boissons
  nourriture: ['food'], manger: ['food', 'fork-knife'], repas: ['food', 'fork-knife'], cafe: ['coffee', 'hot-beverage'],
  the: ['tea'], biere: ['beer'], vin: ['wine'], champagne: ['champagne', 'bottle-with-popping-cork'], cocktail: ['cocktail'],
  gateau: ['cake', 'birthday'], pizza: ['pizza'], burger: ['hamburger'], frites: ['french-fries'], pain: ['bread'],
  fromage: ['cheese'], fruit: ['fruit', 'apple'], pomme: ['apple'], banane: ['banana'], fraise: ['strawberry'],
  citron: ['lemon'], raisin: ['grapes'], glace: ['ice-cream', 'soft-ice-cream'], bonbon: ['candy'], chocolat: ['chocolate'],
  croissant: ['croissant'], oeuf: ['egg'], legume: ['vegetable', 'carrot'],
  // Objets et travail
  travail: ['briefcase', 'work'], bureau: ['office', 'desk', 'building'], reunion: ['meeting', 'users', 'chats'],
  ordinateur: ['computer', 'laptop', 'desktop'], telephone: ['phone', 'mobile'], mail: ['envelope', 'mail'],
  courriel: ['envelope', 'mail'], message: ['chat', 'message', 'speech'], document: ['file', 'document'], dossier: ['folder'],
  calendrier: ['calendar'], date: ['calendar'], horloge: ['clock'], heure: ['clock'], temps: ['clock', 'timer'],
  argent: ['money', 'currency', 'coin'], euro: ['euro', 'currency-eur'], graphique: ['chart', 'graph'],
  croissance: ['trend-up', 'chart-line-up'], objectif: ['target', 'goal'], trophee: ['trophy'], medaille: ['medal'],
  cadeau: ['gift', 'present'], ballon: ['balloon'], musique: ['music', 'note'], photo: ['camera', 'image'],
  appareil: ['camera'], video: ['video', 'film'], livre: ['book'], crayon: ['pencil'], stylo: ['pen'], cle: ['key'],
  cadenas: ['lock'], maison: ['house', 'home'], voiture: ['car'], velo: ['bicycle', 'bike'], train: ['train'],
  avion: ['airplane', 'plane'], bateau: ['boat', 'ship'], fusee: ['rocket'], carte: ['map'], lieu: ['map-pin', 'pin'],
  monde: ['globe', 'world'], drapeau: ['flag'], sport: ['sport', 'ball', 'soccer'], foot: ['soccer'], football: ['soccer'],
  tennis: ['tennis'], jeu: ['game'], recherche: ['magnifying-glass', 'search'], reglage: ['gear', 'settings'],
  outil: ['wrench', 'tool', 'hammer'], lumiere: ['lightbulb', 'light'], ampoule: ['lightbulb'], cloche: ['bell'],
  noel: ['christmas', 'santa'], sapin: ['christmas-tree', 'tree'], halloween: ['halloween', 'pumpkin', 'jack-o-lantern'],
  citrouille: ['pumpkin', 'jack-o-lantern'], paques: ['egg', 'rabbit'], vacances: ['beach', 'airplane', 'palm-tree'],
  ecole: ['school', 'graduation'], diplome: ['graduation-cap'], sante: ['heartbeat', 'health', 'first-aid'],
  merci: ['thank', 'folded-hands', 'heart'], bravo: ['clap', 'trophy', 'party'], felicitations: ['party', 'confetti', 'trophy'],
  bienvenue: ['wave', 'hand-waving'], nouveau: ['new', 'sparkle'],
}

/** Normalise une saisie : minuscules, sans accents ni espaces superflus. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[œ]/g, 'oe')
    .trim()
}

/**
 * Termes anglais à chercher pour une saisie : le mot lui-même (les noms anglais marchent aussi),
 * plus ses traductions. Accepte le pluriel simple (« fleurs » → « fleur »).
 */
export function searchTerms(query: string): string[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const terms = new Set<string>()
  for (const w of words) {
    terms.add(w)
    const singular = w.endsWith('s') || w.endsWith('x') ? w.slice(0, -1) : w
    for (const key of [w, singular]) for (const t of FR_KEYWORDS[key] ?? []) terms.add(t)
  }
  return [...terms]
}

export interface Searchable {
  /** Nom anglais, mots séparés par des tirets. */
  name: string
  tags?: string[]
}

/** Score d'une icône pour les termes : nom exact > début de mot du nom > mot-clé. 0 = pas trouvée. */
export function score(item: Searchable, terms: string[]): number {
  let best = 0
  const parts = item.name.split('-')
  for (const t of terms) {
    if (item.name === t) best = Math.max(best, 4)
    else if (parts.includes(t) || item.name.startsWith(`${t}-`)) best = Math.max(best, 3)
    else if (t.length >= 3 && item.name.includes(t)) best = Math.max(best, 2)
    else if (item.tags?.some((g) => g === t || (t.length >= 4 && g.startsWith(t)))) best = Math.max(best, 1)
  }
  return best
}
