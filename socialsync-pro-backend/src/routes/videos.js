// socialsync-pro-backend/src/routes/videos.js
import express from 'express';

const router = express.Router();

const VIDEO_FORMATS = ['Vidéo courte', 'Séance YouTube', 'Live'];

// État de rédaction lisible par l'interface
const stateOf = (p) => {
  if (!p.ai_generated_at) return 'attente';
  if (!p.reviewed_at) return 'a_valider';
  return 'valide';
};

// Titre : le brief, sinon la première ligne de la légende, sinon le format
const titleOf = (p) => {
  const brief = String(p.brief || '').trim();
  if (brief) return brief;
  const firstLine = String(p.caption || '').split('\n')[0].trim();
  return firstLine || p.format;
};

// GET /api/videos/to-film : vidéos à tourner de l'espace actif, lues directement dans editorial_posts
router.get('/to-film', async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('editorial_posts')
      .select('id, post_date, format, platform, brief, caption, script, status, ai_generated_at, reviewed_at')
      .eq('owner_id', req.ownerId)
      .eq('is_adhoc', false)
      .in('format', VIDEO_FORMATS)
      .neq('status', 'publie')
      .order('post_date', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });

    const videos = (data || []).map((p) => ({
      id: p.id,
      format: p.format,
      status: p.status,
      title: titleOf(p),
      release_date: p.post_date,
      script: p.script || '',
      content_state: stateOf(p),
    }));

    res.json({ success: true, count: videos.length, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
