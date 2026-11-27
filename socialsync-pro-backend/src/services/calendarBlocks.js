// socialsync-pro-backend/src/services/calendarBlocks.js
import { loadTemplate } from './weeklyTemplate.js';

const DAY_MS = 864e5;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const msOf = (iso) => Date.parse(`${iso}T00:00:00Z`);

export const isValidIsoDate = (iso) =>
  DATE_RE.test(String(iso)) && !Number.isNaN(msOf(iso));

export const addDays = (iso, n) => isoOfMs(msOf(iso) + n * DAY_MS);

// Jour calendaire : dimanche = 0 ... samedi = 6
export const weekdayOf = (iso) => new Date(msOf(iso)).getUTCDay();

// Index du modèle hebdomadaire : lundi = 0 ... dimanche = 6 (inchangé, stocké en base)
export const dayIndexOf = (iso) => (weekdayOf(iso) + 6) % 7;

// Semaine affichée : du dimanche au samedi. Le dimanche d'ouverture sert de clé (week_start).
export const startOfWeek = (iso) => addDays(iso, -weekdayOf(iso));
export const endOfWeek = (iso) => addDays(startOfWeek(iso), 6);
export const isWeekStart = (iso) => isValidIsoDate(iso) && weekdayOf(iso) === 0;
export const isWeekEnd = (iso) => isValidIsoDate(iso) && weekdayOf(iso) === 6;

// Numéro ISO (1 à 53), conservé en base à titre informatif
export function isoWeekNumber(iso) {
  const ms = msOf(iso);
  const mondayIndex = (new Date(ms).getUTCDay() + 6) % 7;
  const thursday = ms - mondayIndex * DAY_MS + 3 * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();

  const jan4 = msOf(`${year}-01-04`);
  const jan4Index = (new Date(jan4).getUTCDay() + 6) % 7;
  const firstThursday = jan4 - jan4Index * DAY_MS + 3 * DAY_MS;

  return 1 + Math.round((thursday - firstThursday) / (7 * DAY_MS));
}

// Plage couverte par un mois affiché : de la semaine du 1er à la semaine du dernier jour
export function monthRange(year, monthIndex) {
  const first = isoOfMs(Date.UTC(year, monthIndex, 1));
  const last = isoOfMs(Date.UTC(year, monthIndex + 1, 0));
  return { from: startOfWeek(first), to: endOfWeek(last) };
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
  const span = Math.round((msOf(to) - msOf(from)) / DAY_MS) + 1;
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
