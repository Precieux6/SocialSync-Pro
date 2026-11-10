// socialsync-pro-backend/src/routes/calendar.js
import express from 'express';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG_RE = /^[@#]?[\p{L}\p{N}_.\-]{1,50}$/u;

// Gabarit hebdomadaire : index 0 = lundi
const DAY_TEMPLATE = [
  ['Photo'],
  ['Carrousel', 'Story', 'Live'],
  ['Vidéo courte'],
  ['Question'],
  ['Séance YouTube', 'Story'],
  ['Photo'],
  ['Vidéo courte'],
];

const isoOf = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoOf(d);
};

// Valide ?start=YYYY-MM-DD (un lundi) et ?startWeek=1..13
function parseBlock(req) {
  const start = String(req.query.start || '');
  const startWeek = parseInt(req.query.startWeek ?? '1', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(new Date(`${start}T00:00:00Z`).getTime())) {
    return { error: 'Date de début invalide (YYYY-MM-DD).' };
  }
  if (new Date(`${start}T00:00:00Z`).getUTCDay() !== 1) {
    return { error: 'La période doit commencer un lundi.' };
  }
  if (!Number.isInteger(startWeek) || startWeek < 1 || startWeek > 13) {
    return { error: 'Semaine de départ invalide (1 à 13).' };
  }
  return { start, startWeek };
}

// Thèmes de l'espace, indexés par numéro de semaine
async function loadThemes(req) {
  const { data, error } = await req.db
    .from('weeks_themes')
    .select('week, title')
    .eq('owner_id', req.ownerId);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((t) => [t.week, t.title]));
}

// Crée les publications de la période qui n'existent pas encore
async function ensureBlock(req, start, startWeek) {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const weekNum = ((startWeek - 1 + i) % 13) + 1;
    for (let d = 0; d < 7; d++) {
      for (const format of DAY_TEMPLATE[d]) {
        rows.push({
          owner_id: req.ownerId,
          post_date: addDays(start, i * 7 + d),
          week_num: weekNum,
          day_index: d,
          format,
          platform: 'instagram',
        });
      }
    }
  }
  const { error } = await req.db
    .from('editorial_posts')
    .upsert(rows, { onConflict: 'owner_id,post_date,format,platform', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
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

// ---------- Thèmes ----------

// GET /api/calendar/themes
router.get('/themes', async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('weeks_themes')
      .select('*')
      .eq('owner_id', req.ownerId)
      .order('week', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });

    if (!data || data.length === 0) {
      return res.json({ success: true, themes: [], isDefault: true });
    }
    res.json({ success: true, themes: data, isDefault: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/themes/:weekNum
router.put('/themes/:weekNum', async (req, res) => {
  const weekNum = parseInt(req.params.weekNum, 10);
  const title = String(req.body?.title || '').trim().slice(0, 200);

  if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 13) {
    return res.status(400).json({ success: false, error: 'Numéro de semaine invalide.' });
  }
  if (!title) return res.status(400).json({ success: false, error: 'Titre vide.' });

  try {
    const { data: updated, error: uErr } = await req.db
      .from('weeks_themes')
      .update({ title })
      .eq('week', weekNum)
      .eq('owner_id', req.ownerId)
      .select();
    if (uErr) return res.status(500).json({ success: false, error: uErr.message });

    if (updated && updated.length > 0) {
      return res.json({ success: true, updatedWeek: updated[0] });
    }

    const { data: created, error: cErr } = await req.db
      .from('weeks_themes')
      .insert([{ week: weekNum, title, owner_id: req.ownerId, user_id: req.ownerId }])
      .select()
      .single();
    if (cErr) return res.status(500).json({ success: false, error: cErr.message });
    res.status(201).json({ success: true, updatedWeek: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Publications ----------

// GET /api/calendar/posts?start=YYYY-MM-DD&startWeek=N
router.get('/posts', async (req, res) => {
  const block = parseBlock(req);
  if (block.error) return res.status(400).json({ success: false, error: block.error });

  try {
    await ensureBlock(req, block.start, block.startWeek);
    const end = addDays(block.start, 27);

    const { data, error } = await req.db
      .from('editorial_posts')
      .select('*')
      .eq('owner_id', req.ownerId)
      .gte('post_date', block.start)
      .lte('post_date', end)
      .order('post_date', { ascending: true })
      .order('format', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });

    const themes = await loadThemes(req);
    res.json({
      success: true,
      start: block.start,
      end,
      startWeek: block.startWeek,
      themes,
      posts: data,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/posts/:id : brief, légende, prompt image, tags, commentaire épinglé
router.put('/posts/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  const b = req.body || {};
  const patch = {};

  if (b.brief !== undefined) patch.brief = String(b.brief).slice(0, 5000);
  if (b.caption !== undefined) patch.caption = String(b.caption).slice(0, 2200);
  if (b.image_prompt !== undefined) patch.image_prompt = String(b.image_prompt).slice(0, 1000);
  if (b.first_comment !== undefined) patch.first_comment = String(b.first_comment).slice(0, 2200);

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
  patch.updated_at = new Date().toISOString();

  try {
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

// POST /api/calendar/posts/:id/schedule  { scheduled_at }
router.post('/posts/:id/schedule', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  const when = new Date(req.body?.scheduled_at);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ success: false, error: 'Date de programmation invalide.' });
  if (when.getTime() < Date.now() + 60_000) {
    return res.status(400).json({ success: false, error: 'La date doit être dans le futur (au moins 1 minute).' });
  }

  try {
    const post = await loadPost(req, req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Publication introuvable.' });
    if (post.status === 'publie') return res.status(409).json({ success: false, error: 'Déjà publiée.' });
    if (!post.caption.trim()) {
      return res.status(400).json({ success: false, error: 'Rédigez la légende avant de programmer.' });
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

// POST /api/calendar/posts/:id/publish-now
// Enregistre la publication pour envoi immédiat. L'envoi réel sera fait par le worker.
router.post('/posts/:id/publish-now', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  try {
    const post = await loadPost(req, req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Publication introuvable.' });
    if (post.status === 'publie') return res.status(409).json({ success: false, error: 'Déjà publiée.' });
    if (!post.caption.trim()) {
      return res.status(400).json({ success: false, error: 'Rédigez la légende avant de publier.' });
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
      message: "Publication enregistrée pour envoi immédiat. L'envoi vers le réseau n'est pas encore branché.",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/calendar/posts/:id/cancel : annule une programmation
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
