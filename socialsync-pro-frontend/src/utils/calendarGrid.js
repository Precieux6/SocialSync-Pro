// socialsync-pro-frontend/src/utils/calendarGrid.js
// Semaines du dimanche au samedi, façon Meta Business Suite.
// Le dimanche d'ouverture d'une semaine sert de clé (week_start) côté serveur.

export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const DAY_MS = 864e5;
const isoOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const msOf = (iso) => Date.parse(`${iso}T00:00:00Z`);

// Date du jour à Paris (et non en UTC), pour éviter un décalage autour de minuit
export const todayIso = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

export const addDays = (iso, n) => isoOfMs(msOf(iso) + n * DAY_MS);

const weekdayOf = (iso) => new Date(msOf(iso)).getUTCDay(); // dimanche = 0

export const startOfWeek = (iso) => addDays(iso, -weekdayOf(iso));
export const endOfWeek = (iso) => addDays(startOfWeek(iso), 6);

// Une semaine de 7 jours.
// monthIndex null : tous les jours sont considérés comme appartenant au mois affiché (vue Semaine).
function makeWeek(weekStart, weekNum, monthIndex) {
  return {
    weekStart,
    weekNum,
    days: DAY_LABELS.map((label, d) => {
      const date = addDays(weekStart, d);
      return {
        date,
        label,
        day: Number(date.slice(8, 10)),
        inMonth: monthIndex === null || Number(date.slice(5, 7)) === monthIndex + 1,
      };
    }),
  };
}

// Vue Mois : toutes les semaines qui touchent le mois (monthIndex : 0 = janvier)
export function buildMonthWeeks(year, monthIndex) {
  const first = isoOfMs(Date.UTC(year, monthIndex, 1));
  const last = isoOfMs(Date.UTC(year, monthIndex + 1, 0));
  const from = startOfWeek(first);
  const to = endOfWeek(last);
  const count = (Math.round((msOf(to) - msOf(from)) / DAY_MS) + 1) / 7;

  const weeks = Array.from({ length: count }, (_, w) =>
    makeWeek(addDays(from, w * 7), w + 1, monthIndex)
  );
  return { from, to, weeks };
}

// Vue Semaine : uniquement la semaine qui contient la date d'ancrage
export function buildWeek(anchor) {
  const from = startOfWeek(anchor);
  return { from, to: endOfWeek(anchor), weeks: [makeWeek(from, null, null)] };
}

export const dayMonth = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
