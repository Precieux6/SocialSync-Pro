// socialsync-pro-frontend/src/utils/calendarGrid.js
// Grille mensuelle façon Meta Business Suite : semaines du dimanche au samedi.
// La semaine 1 est celle qui contient le 1er du mois. Le dimanche d'ouverture sert de clé (week_start).

export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const DAY_MS = 864e5;
const isoOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const msOf = (iso) => Date.parse(`${iso}T00:00:00Z`);

export const todayIso = () => isoOfMs(Date.now());

export const addDays = (iso, n) => isoOfMs(msOf(iso) + n * DAY_MS);

const weekdayOf = (iso) => new Date(msOf(iso)).getUTCDay(); // dimanche = 0

export const startOfWeek = (iso) => addDays(iso, -weekdayOf(iso));
export const endOfWeek = (iso) => addDays(startOfWeek(iso), 6);

// Semaines affichées pour un mois (monthIndex : 0 = janvier)
export function buildMonthWeeks(year, monthIndex) {
  const first = isoOfMs(Date.UTC(year, monthIndex, 1));
  const last = isoOfMs(Date.UTC(year, monthIndex + 1, 0));
  const from = startOfWeek(first);
  const to = endOfWeek(last);
  const rows = Math.round((msOf(to) - msOf(from)) / DAY_MS) / 7 + 1;
  const month = monthIndex + 1;

  const weeks = Array.from({ length: rows }, (_, w) => {
    const weekStart = addDays(from, w * 7);
    return {
      weekStart,
      weekNum: w + 1,
      days: DAY_LABELS.map((label, d) => {
        const date = addDays(weekStart, d);
        return {
          date,
          label,
          day: Number(date.slice(8, 10)),
          inMonth: Number(date.slice(5, 7)) === month,
        };
      }),
    };
  });

  return { from, to, weeks };
}

export const dayMonth = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
