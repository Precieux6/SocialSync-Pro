import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Route pour lister les médias de la bibliothèque du client actif
router.get('/', async (req, res) => {
  try {
    const clientId = req.clientId;

    const { data, error } = await supabase
      .from('media_library')
      .select('*')
      .eq('client_id', clientId);

    if (error) throw error;

    res.json({
      success: true,
      media: data || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route d'upload de média rattachée au client actif
router.post('/upload', async (req, res) => {
  try {
    const clientId = req.clientId;
    const fileData = { ...req.body, client_id: clientId };

    const { data, error } = await supabase
      .from('media_library')
      .insert([fileData])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: "Média téléversé avec succès sur le cloud Supabase.",
      file: data[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
