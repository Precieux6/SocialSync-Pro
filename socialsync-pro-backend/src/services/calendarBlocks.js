// socialsync-pro-backend/src/services/calendarBlocks.js
import { loadTemplate } from './weeklyTemplate.js';

const DAY_MS = 864e5;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);

export const isValidIsoDate = (iso) =>
  DATE_RE.test(String(iso)) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`));

export const addDays = (iso, n) => isoOfMs(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS);

// Lundi = 0 ... dimanche = 6
export const dayIndexOf = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

export const isMonday = (iso) => isValidIsoDate(iso) && dayIndexOf(iso) === 0;
export const mondayOf = (iso) => addDays(iso, -dayIndexOf(iso));
export const sundayOf = (iso) => addDays(mondayOf(iso), 6);

// Numéro de semaine ISO (1 à 53), déterminé par le jeudi de la semaine
export function isoWeekNumber(iso) {
  const thursday = addDays(mondayOf(iso), 3);
  const year = Number(thursday.slice(0, 4));
  const firstThursday = addDays(mondayOf(`${year}-01-04`), 3);
  return 1 + Math.round(
    (Date.parse(`${thursday}T00:00:00Z`) - Date.parse(`${firstThursday}T00:00:00Z`)) / (7 * DAY_MS)
  );
}

// Plage couverte par un mois : du lundi de la semaine du 1er au dimanche de la semaine du dernier jour
export function monthRange(year, monthIndex) {
  return {
    from: mondayOf(isoOfMs(Date.UTC(year, monthIndex, 1))),
    to: sundayOf(isoOfMs(Date.UTC(year, monthIndex + 1, 0))),
  };
}

// Crée les publications manquantes de [from, to] d'après le modèle de l'espace.
// Ne crée jamais de doublon, format par format et jour par jour.
export async function ensureRange(db, ownerId, from, to) {
  const { data: existing, error: eErr } = await db
    .from('editorial_posts')
    .select('post_date, format')
    .eq('owner_id', ownerId)
    .eq('is_adhoc', false)
    .gte('post_date', from)
    .lte('post_date', to);
  if (eErr) throw new Error(eErr.message);

  const have = new Map();
  for (const p of existing || []) {
    const key = `${p.post_date}|${p.format}`;
    have.set(key, (have.get(key) || 0) + 1);
  }

  const template = await loadTemplate(db, ownerId);
  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
  const rows = [];

  for (let i = 0; i < span; i++) {
    const postDate = addDays(from, i);
    const d = dayIndexOf(postDate);
    const weekNum = isoWeekNumber(postDate);
    const seen = new Map();

    for (const slot of template.days[d]) {
      const key = `${postDate}|${slot.format}`;
      const occurrence = (seen.get(key) || 0) + 1;
      seen.set(key, occurrence);
      if (occurrence <= (have.get(key) || 0)) continue;

      rows.push({
        owner_id: ownerId,
        post_date: postDate,
        week_num: weekNum,
        day_index: d,
        format: slot.format,
        platform: 'instagram',
        publish_time: slot.publish_time,
        brief: slot.brief || '',
        status: 'brouillon',
        is_adhoc: false,
      });
    }
  }

  if (rows.length === 0) return 0;
  const { error } = await db.from('editorial_posts').insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
