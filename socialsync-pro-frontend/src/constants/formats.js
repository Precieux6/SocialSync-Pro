// socialsync-pro-frontend/src/constants/formats.js
// Formats et champs de référence. Doit rester aligné avec backend/src/config/formats.js.

export const FORMATS = [
  'Photo',
  'Carrousel',
  'Vidéo courte',
  'Vidéo long format',
  'Séance YouTube',
  'Story',
  'Question',
  'Live',
];

export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const MAX_SLOTS = 10;

const VIDEO_FIELDS = ['brief', 'caption_example', 'thumbnail_prompt', 'script_example', 'note'];

// Champs affichés pour chaque format dans la configuration d'un créneau
export const FORMAT_FIELDS = {
  'Photo': ['brief', 'caption_example', 'image_prompt', 'note'],
  'Carrousel': ['brief', 'caption_example', 'image_prompt', 'slides', 'note'],
  'Story': ['brief', 'caption_example', 'image_prompt', 'note'],
  'Question': ['brief', 'caption_example', 'note'],
  'Vidéo courte': VIDEO_FIELDS,
  'Vidéo long format': VIDEO_FIELDS,
  'Séance YouTube': VIDEO_FIELDS,
  'Live': VIDEO_FIELDS,
};

export const FIELD_META = {
  brief: {
    label: 'Brief type',
    rows: 2,
    max: 2000,
    placeholder: 'Intention habituelle de ce créneau',
  },
  caption_example: {
    label: 'Exemple de légende (ton, structure, longueur)',
    rows: 4,
    max: 2200,
    placeholder: 'Collez une légende validée',
  },
  image_prompt: {
    label: 'Prompt image de référence',
    rows: 4,
    max: 4000,
    mono: true,
    placeholder: 'IMAGE : ...\nTEXTE À INTÉGRER : ...\nTYPOGRAPHIE : ...\nSTYLE : ...',
  },
  thumbnail_prompt: {
    label: 'Prompt miniature de référence',
    rows: 3,
    max: 4000,
    mono: true,
    placeholder: 'Structure IMAGE / TEXTE / TYPOGRAPHIE / STYLE, format 16:9 ou 9:16',
  },
  script_example: {
    label: 'Exemple de script',
    rows: 5,
    max: 40000,
    placeholder: 'Texte à lire, indications de mise en scène entre crochets',
  },
  slides: {
    label: 'Diapositives types (une par ligne)',
    rows: 4,
    placeholder: '1. Accroche\n2. Conseil\n3. Invitation à échanger',
  },
  note: {
    label: 'Note pour Claude',
    rows: 2,
    max: 500,
    placeholder: 'Ex. : ton chaleureux, phrases courtes',
  },
};
