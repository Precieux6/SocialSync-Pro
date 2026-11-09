import express from 'express';

const router = express.Router();

// Route pour récupérer les statistiques hebdomadaires et globales
router.get('/', (req, res) => {
  try {
    res.json({
      success: true,
      totalReach: "284 300 Vues",
      weeklyStats: [
        { day: "Lundi", instagram: "12.4k", facebook: "8.2k", youtube: "4.1k", tiktok: "15.8k" },
        { day: "Mardi", instagram: "18.9k", facebook: "6.5k", youtube: "3.2k", tiktok: "9.4k" },
        { day: "Mercredi", instagram: "34.2k", facebook: "14.1k", youtube: "22.5k", tiktok: "45.0k" },
        { day: "Jeudi", instagram: "15.1k", facebook: "9.8k", youtube: "5.0k", tiktok: "18.3k" },
        { day: "Vendredi", instagram: "11.6k", facebook: "7.4k", youtube: "4.8k", tiktok: "12.1k" },
        { day: "Samedi", instagram: "21.3k", facebook: "11.2k", youtube: "8.9k", tiktok: "24.6k" },
        { day: "Dimanche", instagram: "41.0k", facebook: "18.5k", youtube: "29.1k", tiktok: "52.4k" }
      ],
      aiRecommendations: [
        { title: "Augmenter le rythme vidéo", desc: "Les vidéos du Mercredi et Dimanche génèrent +240% d'engagement." },
        { title: "Optimiser TikTok", desc: "Audience TikTok active entre 20h00 et 21h30." },
        { title: "Impact Story J+1", desc: "Le repartage en Story à 16h15 offre +35% de clics." }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;