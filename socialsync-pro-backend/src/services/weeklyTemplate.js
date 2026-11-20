// socialsync-pro-backend/src/services/weeklyTemplate.js
import { DEFAULT_TEMPLATE, FORMATS } from '../config/formats.js';

export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MAX_SLOTS_PER_DAY = 10;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const REFERENCE_KEYS = ['brief', 'image_prompt', 'thumbnail_prompt', 'caption_example', 'script_example', 'note'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const blankSlot = (format) => ({
  format,
  publish_time: '18:00',
  brief: '',
  image_prompt: '',
  thumbnail_prompt: '',
  caption_example: '',
  script_example: '',
  slides: [],
  note: '',
});

// Ligne de base de données -> créneau
const fromRow = (row) => ({
  format: row.format,
  publish_time: String(row.publish_time || '18:00').slice(0, 5),
  brief: row.brief || '',
  image_prompt: row.image_prompt || '',
  thumbnail_prompt: row.thumbnail_prompt || '',
  caption_example: row.caption_example || '',
  script_example: row.script_example || '',
  slides: Array.isArray(row.slides) ? row.slides : [],
  note: row.note || '',
});

// Valide et nettoie les créneaux envoyés par l'interface.
// Lève une erreur lisible au premier problème.
export function normalizeSlots(input) {
  if (!Array.isArray(input)) throw new Error('Créneaux : liste attendue.');
  if (input.length > MAX_SLOTS_PER_DAY) {
    throw new Error(`${MAX_SLOTS_PER_DAY} créneaux maximum par jour.`);
  }

  return input.map((raw) => {
    const format = String(raw?.format || '');
    if (!FORMATS.includes(format)) throw new Error(`Format invalide : ${format || '(vide)'}.`);

    const time = String(raw?.publish_time || '18:00').slice(0, 5);
    if (!TIME_RE.test(time)) throw new Error(`Heure invalide : ${time}.`);

    const slides = Array.isArray(raw?.slides)
      ? raw.slides.map((s) => str(s, 300)).filter(Boolean).slice(0, 8)
      : [];

    return {
      format,
      publish_time: time,
      brief: str(raw?.brief, 2000),
      image_prompt: str(raw?.image_prompt, 4000),
      thumbnail_prompt: str(raw?.thumbnail_prompt, 4000),
      caption_example: str(raw?.caption_example, 2200),
      script_example: str(raw?.script_example, 40000),
      slides,
      note: str(raw?.note, 500),
    };
  });
}

// Modèle effectif de l'espace : base si initialisé, sinon modèle par défaut (lecture seule)
export async function loadTemplate(db, ownerId) {
  const [stateRes, slotsRes] = await Promise.all([
    db.from('weekly_template_state').select('owner_id').eq('owner_id', ownerId).maybeSingle(),
    db.from('weekly_template_slots').select('*').eq('owner_id', ownerId)
      .order('day_index', { ascending: true })
      .order('position', { ascending: true }),
  ]);
  if (stateRes.error) throw new Error(stateRes.error.message);
  if (slotsRes.error) throw new Error(slotsRes.error.message);

  if (!stateRes.data) {
    return {
      isDefault: true,
      days: DEFAULT_TEMPLATE.map((formats) => formats.map(blankSlot)),
    };
  }

  const days = Array.from({ length: 7 }, () => []);
  for (const row of slotsRes.data || []) days[row.day_index].push(fromRow(row));
  return { isDefault: false, days };
}

async function replaceDay(db, ownerId, day, slots) {
  const { error } = await db.rpc('replace_template_day', {
    p_owner: ownerId,
    p_day: day,
    p_slots: slots,
  });
  if (error) throw new Error(error.message);
}

// Enregistre les mêmes créneaux sur un ou plusieurs jours.
// Premier enregistrement : le modèle par défaut est d'abord écrit en base.
export async function saveTemplateDays(db, ownerId, days, slots) {
  const current = await loadTemplate(db, ownerId);
  if (current.isDefault) {
    for (let d = 0; d < 7; d++) await replaceDay(db, ownerId, d, current.days[d]);
  }
  for (const d of days) await replaceDay(db, ownerId, d, slots);
}

// Références d'un créneau, transmises à Claude
export function referencesOf(slot) {
  if (!slot) return null;
  const out = {};
  for (const key of REFERENCE_KEYS) if (slot[key]) out[key] = slot[key];
  if (slot.slides?.length) out.slides = slot.slides;
  return Object.keys(out).length ? out : null;
}

// Références du n-ième créneau d'un format donné un jour donné
export function referencesFor(template, dayIndex, format, occurrence = 0) {
  const matches = (template.days[dayIndex] || []).filter((s) => s.format === format);
  return referencesOf(matches[occurrence] || matches[0] || null);
}

// Une publication est modifiable par le modèle tant qu'aucun contenu n'a été rédigé ni validé
const isRewritable = (r) =>
  r.status === 'brouillon'
  && !r.ai_generated_at
  && !r.reviewed_at
  && !String(r.caption || '').trim();

// Compare les publications d'une date au modèle du jour et renvoie les changements
function planDay(ownerId, list, wanted, date, day) {
  const removeIds = [];
  const timeUpdates = [];
  const inserts = [];
  const formats = new Set([...list.map((r) => r.format), ...wanted.map((s) => s.format)]);

  for (const format of formats) {
    const want = wanted.filter((s) => s.format === format);
    const existing = list.filter((r) => r.format === format);
    const frozen = existing.filter((r) => !isRewritable(r));
    const open = existing.filter(isRewritable);
    const slotsLeft = Math.max(0, want.length - frozen.length);

    open.forEach((row, i) => {
      if (i < slotsLeft) {
        const slot = want[frozen.length + i];
        if (slot && String(row.publish_time || '').slice(0, 5) !== slot.publish_time) {
          timeUpdates.push({ id: row.id, publish_time: slot.publish_time });
        }
      } else {
        removeIds.push(row.id);
      }
    });

    const covered = frozen.length + Math.min(open.length, slotsLeft);
    for (let i = covered; i < want.length; i++) {
      inserts.push({
        owner_id: ownerId,
        post_date: date,
        week_num: list[0].week_num,
        day_index: day,
        format,
        platform: 'instagram',
        publish_time: want[i].publish_time,
        brief: want[i].brief || '',
        status: 'brouillon',
        is_adhoc: false,
      });
    }
  }
  return { removeIds, timeUpdates, inserts };
}

// Applique le modèle courant aux publications futures non rédigées des jours modifiés.
// Les publications rédigées, validées ou modifiées ne sont jamais touchées.
export async function syncFutureFromTemplate(db, ownerId, days, todayIso) {
  const template = await loadTemplate(db, ownerId);
  const report = { added: 0, removed: 0, updated: 0 };

  for (const day of days) {
    const { data: rows, error } = await db
      .from('editorial_posts')
      .select('id, post_date, format, week_num, publish_time, status, caption, ai_generated_at, reviewed_at')
      .eq('owner_id', ownerId)
      .eq('day_index', day)
      .eq('is_adhoc', false)
      .gt('post_date', todayIso)
      .order('post_date', { ascending: true });
    if (error) throw new Error(error.message);

    const byDate = new Map();
    for (const row of rows || []) {
      if (!byDate.has(row.post_date)) byDate.set(row.post_date, []);
      byDate.get(row.post_date).push(row);
    }

    for (const [date, list] of byDate) {
      const { removeIds, timeUpdates, inserts } = planDay(ownerId, list, template.days[day], date, day);

      if (removeIds.length) {
        const { error: dErr } = await db
          .from('editorial_posts')
          .delete()
          .in('id', removeIds)
          .eq('owner_id', ownerId);
        if (dErr) throw new Error(dErr.message);
        report.removed += removeIds.length;
      }

      for (const u of timeUpdates) {
        const { error: uErr } = await db
          .from('editorial_posts')
          .update({ publish_time: u.publish_time })
          .eq('id', u.id)
          .eq('owner_id', ownerId);
        if (uErr) throw new Error(uErr.message);
        report.updated += 1;
      }

      if (inserts.length) {
        const { error: iErr } = await db.from('editorial_posts').insert(inserts);
        if (iErr) throw new Error(iErr.message);
        report.added += inserts.length;
      }
    }
  }
  return report;
}
