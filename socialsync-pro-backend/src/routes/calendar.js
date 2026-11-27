// socialsync-pro-backend/src/routes/calendar.js
import express from 'express';
import { requireOwner, requireRole } from '../middleware/auth.js';
import {
  addDays,
  dayIndexOf,
  ensureRange,
  isWeekEnd,
  isWeekStart,
  isoWeekNumber,
  isValidIsoDate,
} from '../services/calendarBlocks.js';
import { FORMATS } from '../config/formats.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG_RE = /^[@#]?[\p{L}\p{N}_.\-]{1,50}$/u;
const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DEFAULT_TZ = 'Europe/Paris';
const HTTPS_RE = /^https:\/\//;
const MAX_RANGE_DAYS = 42;
const MIN_RANGE_DAYS = 7;

// Rôles autorisés à saisir ou modifier un thème de semaine (lecture seule exclue)
const THEME_EDITORS = requireRole('Propriétaire', 'Éditeur', 'Community Manager');

// Champs dont la modification remet un contenu généré en attente de relecture
const CONTENT_KEYS = [
  'brief', 'caption', 'image_prompt', 'thumbnail_prompt', 'first_comment',
  'tags', 'script', 'slides', 'media_urls', 'video_url',
];

// Plage demandée par l'interface : du dimanche au samedi, de 7 à 42 jours
function parseRange(req) {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return { error: 'Dates invalides (YYYY-MM-DD).' };
  if (!isWeekStart(from)) return { error: 'La période doit commencer un dimanche.' };
  if (!isWeekEnd(to)) return { error: 'La période doit se terminer un samedi.' };

  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;
  if (span < MIN_RANGE_DAYS || span > MAX_RANGE_DAYS) {
    return { error: `Période hors limite (${MIN_RANGE_DAYS} à ${MAX_RANGE_DAYS} jours).` };
  }
  return { from, to };
}

export function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const v = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function zonedToUtc(localStr, tz) {
  const m = LOCAL_DT_RE.exec(String(localStr || ''));
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);

  const check = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== mo || check.getUTCDate() !== d) {
    return null;
  }

  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - tzOffsetMs(guess, tz);
  utc = guess - tzOffsetMs(utc, tz);
  return new Date(utc);
}

async function spaceTimezone(req) {
  try {
    const { data } = await req.db
      .from('team_member')
      .select('timezone')
      .eq('id', req.ownerId)
      .maybeSingle();
    return data?.timezone && isValidTimezone(data.timezone) ? data.timezone : DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

// Thèmes indexés par dimanche d'ouverture de semaine, limités à la plage affichée
async function loadThemes(req, from, to) {
  const { data, error } = await req.db
    .from('weeks_themes')
    .select('week_start, title')
    .eq('owner_id', req.ownerId)
    .gte('week_start', from)
    .lte('week_start', to);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((t) => [t.week_start, t.title]));
}

async function loadPost(req, id) {
  const { data, error } = await req.db
    .from('editorial_posts')
    .select('*')
    .eq('id', id)
    .eq('owner_id', req.ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Efface les contenus générés et non validés d'une semaine, pour les réécrire avec le nouveau thème.
// Ne touche ni aux publications validées, ni aux publications programmées ou publiées, ni aux publications hors plan.
async function resetUnvalidatedWeek(req, weekStart) {
  const { error } = await req.db
    .from('editorial_posts')
    .update({
      caption: '',
      first_comment: '',
      tags: [],
      image_prompt: '',
      thumbnail_prompt: '',
      slides: [],
      script: '',
      script_parts: [],
      ai_generated_at: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', req.ownerId)
    .eq('is_adhoc', false)
    .eq('status', 'brouillon')
    .gte('post_date', weekStart)
    .lte('post_date', addDays(weekStart, 6))
    .not('ai_generated_at', 'is', null)
    .is('reviewed_at', null);
  if (error) throw new Error(error.message);
}

// Une valeur vide et une valeur absente sont équivalentes : évite une relecture inutile
const emptyish = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const sameContent = (a, b) =>
  JSON.stringify(emptyish(a) ? null : a) === JSON.stringify(emptyish(b) ? null : b);

router.get('/themes', async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('weeks_themes')
      .select('*')
      .eq('owner_id', req.ownerId)
      .not('week_start', 'is', null)
      .order('week_start', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.json({ success: true, themes: data || [], isDefault: !data || data.length === 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Saisie d'un thème. Si le titre change, les contenus non validés de la semaine sont effacés et réécrits.
// La rédaction est mise en file côté serveur : elle se poursuit même si l'onglet est fermé (job week-jobs).
router.put('/themes/:weekStart', THEME_EDITORS, async (req, res) => {
  const weekStart = String(req.params.weekStart || '');
  const title = String(req.body?.title || '').trim().slice(0, 200);

  if (!isWeekStart(weekStart)) {
    return res.status(400).json({ success: false, error: 'Date de semaine invalide (un dimanche au format YYYY-MM-DD).' });
  }
  if (!title) return res.status(400).json({ success: false, error: 'Titre vide.' });

  try {
    const { data: prev, error: pErr } = await req.db
      .from('weeks_themes')
      .select('title')
      .eq('owner_id', req.ownerId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (pErr) return res.status(500).json({ success: false, error: pErr.message });

    const titleChanged = String(prev?.title ?? '').trim() !== title;
    if (titleChanged) await resetUnvalidatedWeek(req, weekStart);

    const now = new Date().toISOString();
    const { data, error } = await req.db
      .from('weeks_themes')
      .upsert([{
        owner_id: req.ownerId,
        user_id: req.user.id,
        week_start: weekStart,
        week: isoWeekNumber(weekStart),
        title,
        ai_generated: false,
        gen_requested_at: now,
        gen_done_at: null,
      }], { onConflict: 'owner_id,week_start' })
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.json({
      success: true,
      updatedWeek: data,
      generation: { pending: true, queued: true, reset: titleChanged, weekStart },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Publications d'une plage (du dimanche au samedi). Les publications manquantes sont créées avant lecture.
router.get('/posts', async (req, res) => {
  const range = parseRange(req);
  if (range.error) return res.status(400).json({ success: false, error: range.error });

  try {
    await ensureRange(req.db, req.ownerId, range.from, range.to);

    const { data, error } = await req.db
      .from('editorial_posts')
      .select('*')
      .eq('owner_id', req.ownerId)
      .gte('post_date', range.from)
      .lte('post_date', range.to)
      .order('post_date', { ascending: true })
      .order('publish_time', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });

    const [themes, timezone] = await Promise.all([
      loadThemes(req, range.from, range.to),
      spaceTimezone(req),
    ]);
    res.json({
      success: true,
      from: range.from,
      to: range.to,
      themes,
      timezone,
      posts: data || [],
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Publication hors plan. Le numéro de semaine ISO est calculé par le serveur.
router.post('/posts', async (req, res) => {
  const postDate = String(req.body?.post_date || '');
  const format = String(req.body?.format || '');

  if (!isValidIsoDate(postDate)) return res.status(400).json({ success: false, error: 'Date invalide.' });
  if (!FORMATS.includes(format)) return res.status(400).json({ success: false, error: 'Format invalide.' });

  try {
    const { data, error } = await req.db
      .from('editorial_posts')
      .insert([{
        owner_id: req.ownerId,
        post_date: postDate,
        week_num: isoWeekNumber(postDate),
        day_index: dayIndexOf(postDate),
        format,
        platform: 'instagram',
        status: 'brouillon',
        is_adhoc: true,
      }])
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.status(201).json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/posts/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  const b = req.body || {};
  const patch = {};

  if (b.brief !== undefined) patch.brief = String(b.brief).slice(0, 5000);
  if (b.caption !== undefined) patch.caption = String(b.caption).slice(0, 2200);
  if (b.image_prompt !== undefined) patch.image_prompt = String(b.image_prompt).slice(0, 2000);
  if (b.thumbnail_prompt !== undefined) patch.thumbnail_prompt = String(b.thumbnail_prompt).slice(0, 2000);
  if (b.first_comment !== undefined) patch.first_comment = String(b.first_comment).slice(0, 2200);
  if (b.script !== undefined) patch.script = String(b.script).slice(0, 40000);

  if (b.slides !== undefined) {
    if (!Array.isArray(b.slides)) {
      return res.status(400).json({ success: false, error: 'Slides : liste attendue.' });
    }
    // Les diapositives vides (champs laissés à blanc dans l'éditeur) ne sont pas conservées
    patch.slides = b.slides.map((s) => String(s).trim().slice(0, 300)).filter(Boolean).slice(0, 8);
  }

  if (b.media_urls !== undefined) {
    if (!Array.isArray(b.media_urls) || b.media_urls.length > 10
      || b.media_urls.some((u) => !HTTPS_RE.test(String(u)))) {
      return res.status(400).json({ success: false, error: 'Médias : 10 images https maximum.' });
    }
    patch.media_urls = b.media_urls.map((u) => String(u).slice(0, 500));
  }

  if (b.video_url !== undefined) {
    const v = String(b.video_url || '').trim();
    if (v && !HTTPS_RE.test(v)) {
      return res.status(400).json({ success: false, error: 'Vidéo : URL https attendue.' });
    }
    patch.video_url = v.slice(0, 500) || null;
  }

  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || b.tags.length > 30) {
      return res.status(400).json({ success: false, error: 'Tags : 30 maximum.' });
    }
    const tags = b.tags.map((t) => String(t).trim()).filter(Boolean);
    if (tags.some((t) => !TAG_RE.test(t))) {
      return res.status(400).json({ success: false, error: 'Tag invalide (lettres, chiffres, _ . - uniquement).' });
    }
    patch.tags = [...new Set(tags)];
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ success: false, error: 'Aucune donnée à enregistrer.' });
  }

  try {
    const current = await loadPost(req, req.params.id);
    if (!current || current.status === 'publie') {
      return res.status(404).json({ success: false, error: 'Publication introuvable ou déjà publiée.' });
    }

    // Toute modification d'un contenu généré doit être relue à nouveau
    if (current.ai_generated_at && CONTENT_KEYS.some((k) => k in patch && !sameContent(patch[k], current[k]))) {
      patch.reviewed_at = null;
    }
    patch.updated_at = new Date().toISOString();

    const { data, error } = await req.db
      .from('editorial_posts')
      .update(patch)
      .eq('id', req.params.id)
      .eq('owner_id', req.ownerId)
      .neq('status', 'publie')
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Publication introuvable ou déjà publiée.' });
    res.json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// La relecture humaine débloque programmation et publication
router.post('/posts/:id/validate', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  try {
    const post = await loadPost(req, req.params.id);
    if (!post || post.status === 'publie') {
      return res.status(404).json({ success: false, error: 'Publication introuvable ou déjà publiée.' });
    }

    const now = new Date().toISOString();
    const { data, error } = await req.db
      .from('editorial_posts')
      .update({ reviewed_at: now, updated_at: now })
      .eq('id', req.params.id)
      .eq('owner_id', req.ownerId)
      .neq('status', 'publie')
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Publication introuvable ou déjà publiée.' });
    res.json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/posts/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  try {
    const post = await loadPost(req, req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Publication introuvable.' });
    if (!post.is_adhoc) {
      return res.status(409).json({ success: false, error: 'Seules les publications hors plan peuvent être supprimées.' });
    }
    if (post.status === 'publie') {
      return res.status(409).json({ success: false, error: 'Une publication déjà publiée ne peut pas être supprimée.' });
    }

    const { error } = await req.db
      .from('editorial_posts')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', req.ownerId);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/posts/:id/schedule', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  try {
    let when = null;
    if (typeof req.body?.local_datetime === 'string') {
      when = zonedToUtc(req.body.local_datetime, await spaceTimezone(req));
    } else if (typeof req.body?.scheduled_at === 'string') {
      when = new Date(req.body.scheduled_at);
    }

    if (!when || Number.isNaN(when.getTime())) {
      return res.status(400).json({ success: false, error: 'Date de programmation invalide.' });
    }
    if (when.getTime() < Date.now() + 60_000) {
      return res.status(400).json({ success: false, error: 'La date doit être dans le futur (au moins 1 minute).' });
    }

    const post = await loadPost(req, req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Publication introuvable.' });
    if (post.status === 'publie') return res.status(409).json({ success: false, error: 'Déjà publiée.' });
    if (!post.caption?.trim()) {
      return res.status(400).json({ success: false, error: 'Rédigez la légende avant de programmer.' });
    }
    if (post.ai_generated_at && !post.reviewed_at) {
      return res.status(409).json({ success: false, error: 'Validez le contenu généré avant de programmer ou publier.' });
    }

    const { data, error } = await req.db
      .from('editorial_posts')
      .update({ status: 'programme', scheduled_at: when.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_id', req.ownerId)
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/posts/:id/publish-now', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  try {
    const post = await loadPost(req, req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Publication introuvable.' });
    if (post.status === 'publie') return res.status(409).json({ success: false, error: 'Déjà publiée.' });
    if (!post.caption?.trim()) {
      return res.status(400).json({ success: false, error: 'Rédigez la légende avant de publier.' });
    }
    if (post.ai_generated_at && !post.reviewed_at) {
      return res.status(409).json({ success: false, error: 'Validez le contenu généré avant de programmer ou publier.' });
    }

    const now = new Date().toISOString();
    const { data, error } = await req.db
      .from('editorial_posts')
      .update({ status: 'programme', scheduled_at: now, updated_at: now })
      .eq('id', req.params.id)
      .eq('owner_id', req.ownerId)
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(202).json({
      success: true,
      post: data,
      message: 'Publication enregistrée pour envoi immédiat.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/posts/:id/cancel', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  try {
    const post = await loadPost(req, req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Publication introuvable.' });
    if (post.status !== 'programme') {
      return res.status(409).json({ success: false, error: "Cette publication n'est pas programmée." });
    }

    const { data, error } = await req.db
      .from('editorial_posts')
      .update({ status: 'brouillon', scheduled_at: null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_id', req.ownerId)
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
