import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

router.get('/', async (req, res) => {
  try {
    const clientId = req.clientId;

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('client_id', clientId);

    if (error) throw error;

    res.json({ success: true, count: data ? data.length : 0, comments: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reply', async (req, res) => {
  try {
    // Logique d'enregistrement ou de réponse liée au client
    res.json({ success: true, message: 'Réponse envoyée avec succès.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
