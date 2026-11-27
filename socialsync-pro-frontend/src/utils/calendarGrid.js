// socialsync-pro-frontend/src/utils/calendarGrid.js
export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const DAY_MS = 864e5;
const isoOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);

export const todayIso = () => isoOfMs(Date.now());

export function addDays(iso, n) {
  return isoOfMs(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS);
}

const dayIndex = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

export const mondayOf = (iso) => addDays(iso, -dayIndex(iso));
export const sundayOf = (iso) => addDays(mondayOf(iso), 6);

export function isoWeekNumber(iso) {
  const thursday = addDays(mondayOf(iso), 3);
  const year = Number(thursday.slice(0, 4));
  const firstThursday = addDays(mondayOf(`${year}-01-04`), 3);
  return 1 + Math.round((Date.parse(`${thursday}T00:00:00Z`) - Date.parse(`${firstThursday}T00:00:00Z`)) / (7 * DAY_MS));
}

// Semaines complètes couvrant un mois (monthIndex : 0 = janvier)
export function buildMonthWeeks(year, monthIndex) {
  const first = isoOfMs(Date.UTC(year, monthIndex, 1));
  const last = isoOfMs(Date.UTC(year, monthIndex + 1, 0));
  const from = mondayOf(first);
  const to = sundayOf(last);
  const count = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

  const weeks = [];
  for (let w = 0; w < count / 7; w++) {
    const weekStart = addDays(from, w * 7);
    weeks.push({
      weekStart,
      weekNum: isoWeekNumber(weekStart),
      days: DAY_LABELS.map((label, d) => {
        const date = addDays(weekStart, d);
        return {
          date,
          label,
          day: Number(date.slice(8, 10)),
          inMonth: Number(date.slice(5, 7)) === monthIndex + 1,
        };
      }),
    });
  }
  return { from, to, weeks };
}

export const dayMonth = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
