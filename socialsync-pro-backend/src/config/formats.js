// socialsync-pro-backend/src/config/formats.js
// Source unique des formats : planificateur, calendrier, rappels, routes.

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

// Formats filmés : rappels de tournage, script, miniature
export const VIDEO_FORMATS = ['Vidéo courte', 'Vidéo long format', 'Séance YouTube', 'Live'];

// Rédaction lourde (un par lot) et légère (jusqu'à 10 par lot)
export const HEAVY_FORMATS = VIDEO_FORMATS;
export const LIGHT_FORMATS = ['Photo', 'Carrousel', 'Story', 'Question'];

// Scripts rédigés en plusieurs appels successifs
export const LONG_SCRIPT_PARTS = { 'Vidéo long format': 5, 'Séance YouTube': 4, Live: 6 };
export const PART_WORDS = { 'Vidéo long format': 1200, 'Séance YouTube': 900, Live: 1000 };

// Modèle par défaut (index 0 = lundi), identique à l'ancien DAY_TEMPLATE
export const DEFAULT_TEMPLATE = [
  ['Photo'],
  ['Carrousel', 'Story', 'Live'],
  ['Vidéo courte'],
  ['Question'],
  ['Séance YouTube', 'Story'],
  ['Photo'],
  ['Vidéo courte'],
];
