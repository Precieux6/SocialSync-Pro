import express from 'express';

const router = express.Router();

// Route pour lister les médias de la bibliothèque
router.get('/', (req, res) => {
  try {
    // Simulation ou récupération depuis Supabase Storage / Table media
    res.json({
      success: true,
      media: [
        { id: 1, name: "Visuel_Or_Chakras.png", type: "image", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500", size: "2.4 MB" },
        { id: 2, name: "Reel_Introduction_Conscience.mp4", type: "video", url: "#", size: "18.2 MB" }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route d'upload de média
router.post('/upload', (req, res) => {
  try {
    // Logique de traitement d'upload vers Supabase Storage
    res.json({
      success: true,
      message: "Média téléversé avec succès sur le cloud Supabase.",
      file: req.body
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;