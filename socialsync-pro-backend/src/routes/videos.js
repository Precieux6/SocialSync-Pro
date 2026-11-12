// socialsync-pro-backend/src/routes/videos.js
import express from 'express';

const router = express.Router();

// GET /api/videos/to-film : vidéos à tourner de l'espace actif
router.get('/to-film', async (req, res) => {
  try {
    // Tentative de récupération depuis la table/vue principale
    const { data, error } = await req.db
      .from('videos_to_film')
      .select('*')
      .eq('owner_id', req.ownerId)
      .order('post_date', { ascending: true });

    if (error) {
      // Repli de sécurité si la table n'existe pas encore sous ce nom exact
      const { data: fallbackData, error: fError } = await req.db
        .from('editorial_posts')
        .select('*')
        .eq('owner_id', req.ownerId)
        .in('format', ['Vidéo courte', 'Séance YouTube', 'Live'])
        .order('post_date', { ascending: true });

      if (fError) {
        return res.status(500).json({ success: false, error: fError.message });
      }
      const videos = fallbackData || [];
      return res.json({ success: true, count: videos.length, videos });
    }

    const videos = data || [];
    res.json({ success: true, count: videos.length, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
