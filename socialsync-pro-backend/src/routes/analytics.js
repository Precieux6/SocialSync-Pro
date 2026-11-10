// socialsync-pro-backend/src/routes/analytics.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

router.get('/', async (req, res) => {
  try {
    // req.clientId contient l'ID du propriétaire de l'équipe (ou l'utilisateur lui-même s'il est owner)
    const clientId = req.clientId;

    let weeklyStats = [
      { day: "Lundi", instagram: "0", facebook: "0", youtube: "0", tiktok: "0" },
      { day: "Mardi", instagram: "0", facebook: "0", youtube: "0", tiktok: "0" },
      { day: "Mercredi", instagram: "0", facebook: "0", youtube: "0", tiktok: "0" },
      { day: "Jeudi", instagram: "0", facebook: "0", youtube: "0", tiktok: "0" },
      { day: "Vendredi", instagram: "0", facebook: "0", youtube: "0", tiktok: "0" },
      { day: "Samedi", instagram: "0", facebook: "0", youtube: "0", tiktok: "0" },
      { day: "Dimanche", instagram: "0", facebook: "0", youtube: "0", tiktok: "0" }
    ];

    if (clientId) {
      const { data, error } = await supabase
        .from('analytics')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (data && !error) {
        weeklyStats = data.weekly_stats || weeklyStats;
      }
    }

    res.json({
      success: true,
      totalReach: clientId ? "Données chargées pour l'espace actif" : "0 Vues",
      weeklyStats,
      aiRecommendations: [
        { title: "Optimisation de contenu", desc: "Analysez les performances de vos créneaux de publication." }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
