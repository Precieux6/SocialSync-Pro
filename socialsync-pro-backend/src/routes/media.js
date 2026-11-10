// socialsync-pro-backend/src/routes/media.js
import express from 'express';

const router = express.Router();
const ALLOWED_TYPES = ['image', 'video'];

// GET /api/media : médiathèque de l'espace actif
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('media_library')
    .select('*')
    .eq('owner_id', req.ownerId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, media: data });
});

// POST /api/media/upload : enregistrement d'un média déjà envoyé sur le stockage
// Le fichier lui-même ne transite pas par l'API (voir note ci-dessous).
router.post('/upload', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 255);
  const type = String(req.body?.type || '');
  const url = String(req.body?.url || '');
  const size = String(req.body?.size || '').slice(0, 30);

  if (!name) return res.status(400).json({ success: false, error: 'Nom de fichier requis.' });
  if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ success: false, error: 'Type de média invalide.' });
  if (!/^https:\/\//.test(url)) return res.status(400).json({ success: false, error: 'URL https requise.' });

  const { data, error } = await req.db
    .from('media_library')
    .insert([{ owner_id: req.ownerId, user_id: req.user.id, name, type, url, size }])
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.status(201).json({ success: true, file: data });
});

export default router;
