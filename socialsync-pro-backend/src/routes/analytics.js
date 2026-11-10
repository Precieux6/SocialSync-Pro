// socialsync-pro-backend/src/routes/analytics.js
import express from 'express';

const router = express.Router();

// GET /api/analytics : statistiques de l'espace actif (comptes du propriétaire)
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('social_stats')
    .select('platform, period_start, metrics, synced_at')
    .eq('owner_id', req.ownerId)
    .order('period_start', { ascending: false })
    .limit(90);

  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({
    success: true,
    ownerId: req.ownerId,
    hasData: data.length > 0,
    lastSync: data[0]?.synced_at ?? null,
    stats: data,
  });
});

export default router;
