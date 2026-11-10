// socialsync-pro-backend/src/routes/comments.js
import express from 'express';

const router = express.Router();

// GET /api/comments : commentaires de l'espace actif
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('comments')
    .select('*')
    .eq('owner_id', req.ownerId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, count: data.length, comments: data });
});

// POST /api/comments/:id/reply : publication de la réponse sur le réseau
// Non branché : les API Meta / YouTube / TikTok ne sont pas encore intégrées.
router.post('/:id/reply', (req, res) => {
  res.status(501).json({
    success: false,
    error: "Publication de la réponse sur le réseau social non encore branchée.",
  });
});

export default router;
