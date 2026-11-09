import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Route pour récupérer les statistiques hebdomadaires et globales de manière isolée
router.get('/', async (req, res) => {
  try {
    const clientId = req.clientId;

    // Si une table 'analytics' existe dans Supabase pour lier les stats par client, on les récupère.
    // Sinon, on renvoie des données vides ou par défaut propres au client si aucun historique n'existe encore.
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
      totalReach: clientId ? "0 Vues (Nouveau compte)" : "284 300 Vues",
      weeklyStats,
      aiRecommendations: [
        { title: "Connecter vos comptes", desc: "Liez vos réseaux sociaux pour activer l'analyse prédictive." }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
