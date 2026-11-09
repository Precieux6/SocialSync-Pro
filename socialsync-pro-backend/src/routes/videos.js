import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

router.get('/to-film', async (req, res) => {
  try {
    const clientId = req.clientId;

    const { data, error } = await supabase
      .from('videos_to_film')
      .select('*')
      .eq('client_id', clientId);

    if (error) throw error;

    // Si le compte est nouveau et n'a pas de vidéos enregistrées, on renvoie un tableau vide
    res.json({ success: true, count: data ? data.length : 0, videos: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
