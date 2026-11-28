// socialsync-pro-backend/src/services/calendarBlocks.js
// Semaines du lundi au dimanche. Dates au format AAAA-MM-JJ.
import { loadTemplate } from './weeklyTemplate.js';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 864e5;

export const isValidIsoDate = (s) => {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// 0 = lundi ... 6 = dimanche
export const dayIndexOf = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

export const startOfWeek = (iso) => addDays(iso, -dayIndexOf(iso));
export const endOfWeek = (iso) => addDays(startOfWeek(iso), 6);
export const mondayOf = startOfWeek;

export const isWeekStart = (iso) => isValidIsoDate(iso) && dayIndexOf(iso) === 0;
export const isWeekEnd = (iso) => isValidIsoDate(iso) && dayIndexOf(iso) === 6;

// Date du jour à Paris
export const parisToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

// Numéro de semaine ISO (1 à 53)
export function isoWeekNumber(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // jeudi de la semaine
  const thursday = d.getTime();
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((thursday - firstThu.getTime()) / (7 * DAY_MS));
}

// Alias conservé pour contentPlanner
export const weekNumOf = isoWeekNumber;

// Premier et dernier jour d'un mois (monthIndex : 0 = janvier)
export function monthRange(year, monthIndex) {
  const from = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { from, to: last.toISOString().slice(0, 10) };
}

// Crée les publications manquantes sur la plage [from, to] (bornes incluses), d'après le modèle.
// Ne crée jamais de doublon : comparaison format par format et jour par jour.
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
  const rows = [];

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const d = dayIndexOf(date);
    const seen = new Map();
    for (const slot of template.days[d]) {
      const key = `${date}|${slot.format}`;
      const occurrence = (seen.get(key) || 0) + 1;
      seen.set(key, occurrence);
      if (occurrence <= (have.get(key) || 0)) continue;

      rows.push({
        owner_id: ownerId,
        post_date: date,
        week_num: isoWeekNumber(date),
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

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('editorial_posts').insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  return rows.length;
}
