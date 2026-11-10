import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js'; // Ajuste le chemin vers ton middleware

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Route pour récupérer le calendrier de l'équipe (celui du propriétaire via req.clientId)
router.get('/current', requireAuth, async (req, res) => {
  try {
    const targetId = req.clientId; // ID du propriétaire de l'équipe ou de l'utilisateur

    const { data, error } = await supabase
      .from('editorial_calendars')
      .select('*')
      .eq('user_id', targetId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(200).json({ success: true, data: null });
    }

    return res.status(200).json({ success: true, data: data.content });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
