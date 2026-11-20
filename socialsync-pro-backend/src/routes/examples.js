// socialsync-pro-backend/src/routes/examples.js
import express from 'express';
import { requireOwner } from '../middleware/auth.js';

const router = express.Router();

const FORMATS = ['Photo', 'Carrousel', 'Vidéo courte', 'Séance YouTube', 'Story', 'Question', 'Live'];
const KINDS = ['legende', 'prompt_image', 'prompt_miniature', 'script_court', 'script_long', 'slides', 'question'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (v, max) => String(v ?? '').trim().slice(0, max);

// GET /api/examples : tous les exemples de l'espace, du plus récent au plus ancien
router.get('/', requireOwner, async (req, res) => {
  const { data, error } = await req.db
    .from('content_examples')
    .select('*')
    .eq('owner_id', req.ownerId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, examples: data || [] });
});

// POST /api/examples : ajoute un exemple
router.post('/', requireOwner, async (req, res) => {
  const b = req.body || {};
  const format = String(b.format || '');
  const kind = String(b.kind || '');

  if (!FORMATS.includes(format)) return res.status(400).json({ success: false, error: 'Format invalide.' });
  if (!KINDS.includes(kind)) return res.status(400).json({ success: false, error: "Type d'exemple invalide." });

  // Jour de la semaine : 0 = lundi ... 6 = dimanche, ou null (tous les jours)
  let dayIndex = null;
  if (kind === 'prompt_image' && b.day_index !== undefined && b.day_index !== null && b.day_index !== '') {
    const d = Number(b.day_index);
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      return res.status(400).json({ success: false, error: 'Jour invalide.' });
    }
    dayIndex = d;
  }

  const slides = Array.isArray(b.slides)
    ? b.slides.map((s) => clip(s, 300)).filter(Boolean).slice(0, 8)
    : [];

  const row = {
    owner_id: req.ownerId,
    format,
    kind,
    day_index: dayIndex,
    title: clip(b.title, 200),
    caption: clip(b.caption, 2200),
    image_prompt: clip(b.image_prompt, 4000),
    script: clip(b.script, 40000),
    slides,
    note: clip(b.note, 500),
  };

  const hasContent = row.caption || row.image_prompt || row.script || slides.length;
  if (!hasContent) {
    return res.status(400).json({ success: false, error: 'Le contenu de cet exemple est vide.' });
  }

  const { data, error } = await req.db.from('content_examples').insert([row]).select().single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.status(201).json({ success: true, example: data });
});

// DELETE /api/examples/:id
router.delete('/:id', requireOwner, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const { error } = await req.db
    .from('content_examples')
    .delete()
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

export default router;
