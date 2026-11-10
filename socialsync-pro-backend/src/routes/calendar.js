// socialsync-pro-backend/src/routes/calendar.js
import express from 'express';

const router = express.Router();

const DEFAULT_THEMES = [
  { week: 1, title: 'Thème Semaine 1' },
  { week: 2, title: 'Thème Semaine 2' },
  { week: 3, title: 'Thème Semaine 3' },
  { week: 4, title: 'Thème Semaine 4' },
];

// GET /api/calendar/themes : thèmes de l'espace actif
router.get('/themes', async (req, res) => {
  const { data, error } = await req.db
    .from('weeks_themes')
    .select('*')
    .eq('owner_id', req.ownerId)
    .order('week', { ascending: true });

  if (error) return res.status(500).json({ success: false, error: error.message });

  // Valeurs par défaut uniquement si l'espace n'a encore rien, jamais en cas d'erreur
  if (!data || data.length === 0) {
    return res.json({ success: true, themes: DEFAULT_THEMES, isDefault: true });
  }
  res.json({ success: true, themes: data, isDefault: false });
});

// PUT /api/calendar/themes/:weekNum : modifie le thème d'une semaine (tous les membres)
router.put('/themes/:weekNum', async (req, res) => {
  const weekNum = parseInt(req.params.weekNum, 10);
  const title = String(req.body?.title || '').trim().slice(0, 200);

  if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 13) {
    return res.status(400).json({ success: false, error: 'Numéro de semaine invalide.' });
  }
  if (!title) {
    return res.status(400).json({ success: false, error: 'Titre vide.' });
  }

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

  // La semaine n'existe pas encore pour cet espace : création
  const { data: created, error: cErr } = await req.db
    .from('weeks_themes')
    .insert([{ week: weekNum, title, owner_id: req.ownerId, user_id: req.ownerId }])
    .select()
    .single();
  if (cErr) return res.status(500).json({ success: false, error: cErr.message });

  res.status(201).json({ success: true, updatedWeek: created });
});

export default router;
