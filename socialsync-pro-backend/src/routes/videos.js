// socialsync-pro-backend/src/routes/videos.js
import express from 'express';

const router = express.Router();

// GET /api/videos/to-film : vidéos à tourner de l'espace actif
router.get('/to-film', async (req, res) => {
  const { data, error } = await req.db
    .from('videos_to_film')
    .select('*')
    .eq('owner_id', req.ownerId)
    .order('release_date', { ascending: true });

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, count: data.length, videos: data });
});

export default router;
