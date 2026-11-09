import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { INITIAL_WEEKS_THEMES } from '../data/mockData.js';

dotenv.config();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

let weeksThemes = [...INITIAL_WEEKS_THEMES];

// 1. Récupérer les thèmes
router.get('/themes', (req, res) => {
  res.json({ success: true, themes: weeksThemes });
});

// 2. Mettre à jour un thème
router.put('/themes/:weekNum', (req, res) => {
  const weekNum = parseInt(req.params.weekNum, 10);
  const { title } = req.body;
  const index = weeksThemes.findIndex(w => w.week === weekNum);
  if (index !== -1) {
    weeksThemes[index].title = title;
    res.json({ success: true, message: `Thème de la Semaine ${weekNum} mis à jour.`, updatedWeek: weeksThemes[index] });
  } else {
    res.status(404).json({ success: false, message: 'Semaine non trouvée.' });
  }
});

// 3. Importer le fichier Excel et synchroniser avec Supabase
router.post('/import-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Aucun fichier fourni." });
    }

    // Lecture du fichier Excel en mémoire
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Feuille "Calendrier"
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Importation de ${sheetData.length} lignes depuis le fichier Excel...`);

    // Insertion ou mise à jour dans la table Supabase 'editorial_posts'
    for (const row of sheetData) {
      await supabase.from('editorial_posts').upsert({
        week_num: row['Semaine'],
        date: row['Date'],
        day_name: row['Jour'],
        theme: row['Thème de la semaine'],
        content_type: row['Type de contenu'],
        angle: row['Angle / sujet du jour'],
        prompt_gemini: row['Prompt Gemini — cliquer sur la cellule puis copier'],
        script: row['Script vidéo à lire'],
        caption: row['Légende à publier'],
        cta: row['CTA'],
        cta_link: row['Lien du CTA'],
        status: row['Statut'] || 'À faire'
      });
    }

    res.json({ 
      success: true, 
      message: `Calendrier importé avec succès (${sheetData.length} publications synchronisées dans Supabase) !` 
    });
  } catch (error) {
    console.error("Erreur lors de l'import Excel :", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;