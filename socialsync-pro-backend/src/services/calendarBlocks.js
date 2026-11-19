// socialsync-pro-backend/src/services/calendarBlocks.js
const DAY_TEMPLATE = [
  ['Photo'],
  ['Carrousel', 'Story', 'Live'],
  ['Vidéo courte'],
  ['Question'],
  ['Séance YouTube', 'Story'],
  ['Photo'],
  ['Vidéo courte'],
];

// Semaine de départ de chaque mois (janvier à décembre), identique à calendarGrid.js
export const START_WEEK = [9, 1, 5, 9, 1, 5, 9, 1, 5, 9, 1, 5];

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Lundi de la semaine qui contient la date donnée
export const mondayOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

// Premier lundi du mois, et semaine de départ associée
export function blockFor(year, monthIndex) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  first.setUTCDate(first.getUTCDate() + ((1 - first.getUTCDay() + 7) % 7));
  return { start: first.toISOString().slice(0, 10), startWeek: START_WEEK[monthIndex] };
}

// Numéro de semaine (1 à 13) d'un lundi, selon le bloc du mois auquel il appartient.
// Retourne null si le lundi n'appartient à aucun bloc (dernière semaine partielle).
export function weekNumOf(monday) {
  const d = new Date(`${monday}T00:00:00Z`);
  const { start, startWeek } = blockFor(d.getUTCFullYear(), d.getUTCMonth());
  const i = Math.round(
    (Date.parse(`${monday}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (7 * 864e5)
  );
  if (i < 0 || i > 3) return null;
  return ((startWeek - 1 + i) % 13) + 1;
}

export async function ensureBlock(db, ownerId, start, startWeek) {
  const end = addDays(start, 27);
  const { data: existing, error: eErr } = await db
    .from('editorial_posts')
    .select('post_date, format, platform')
    .eq('owner_id', ownerId)
    .eq('is_adhoc', false)
    .gte('post_date', start)
    .lte('post_date', end);
  if (eErr) throw new Error(eErr.message);

  const have = new Set((existing || []).map((p) => `${p.post_date}|${p.format}|${p.platform}`));
  const rows = [];

  for (let i = 0; i < 4; i++) {
    const weekNum = ((startWeek - 1 + i) % 13) + 1;
    for (let d = 0; d < 7; d++) {
      const post_date = addDays(start, i * 7 + d);
      for (const format of DAY_TEMPLATE[d]) {
        if (have.has(`${post_date}|${format}|instagram`)) continue;
        rows.push({
          owner_id: ownerId,
          post_date,
          week_num: weekNum,
          day_index: d,
          format,
          platform: 'instagram',
          status: 'brouillon',
          is_adhoc: false,
        });
      }
    }
  }

  if (rows.length === 0) return 0;
  const { error } = await db.from('editorial_posts').insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
