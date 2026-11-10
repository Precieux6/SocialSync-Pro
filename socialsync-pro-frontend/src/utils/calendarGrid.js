// socialsync-pro-frontend/src/utils/calendarGrid.js
// Constantes et dates du calendrier. Aucune donnée éditoriale ici.

export const MONTHS_LIST = [
  { code: 'JAN', name: 'Janvier', startWeek: 9 },
  { code: 'FEV', name: 'Février', startWeek: 1 },
  { code: 'MARS', name: 'Mars', startWeek: 5 },
  { code: 'AVR', name: 'Avril', startWeek: 9 },
  { code: 'MAI', name: 'Mai', startWeek: 1 },
  { code: 'JUIN', name: 'Juin', startWeek: 5 },
  { code: 'JUI', name: 'Juillet', startWeek: 9 },
  { code: 'AOUT', name: 'Août', startWeek: 1 },
  { code: 'SEPT', name: 'Septembre', startWeek: 5 },
  { code: 'OCT', name: 'Octobre', startWeek: 9 },
  { code: 'NOV', name: 'Novembre', startWeek: 1 },
  { code: 'DEC', name: 'Décembre', startWeek: 5 },
];

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Premier lundi du mois (ou le lundi qui suit le 1er)
export function weekStartFor(year, monthCode) {
  const monthIndex = MONTHS_LIST.findIndex((m) => m.code === monthCode);
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (1 - first.getUTCDay() + 7) % 7; // lundi = 1
  return addDays(first.toISOString().slice(0, 10), offset);
}

export function shortDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
