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

// 1. Récupérer les thèmes
router.get('/themes', async (req, res) => {
  try {
    const clientId = req.clientId;
    
    const { data, error } = await supabase
      .from('weeks_themes')
      .select('*')
      .eq('client_id', clientId);

    // Si une erreur survient ou s'il n'y a pas encore de thèmes pour ce nouveau compte
    if (error || !data || data.length === 0) {
      return res.json({
        success: true,
        themes: [
          { week: 1, title: "Thème Semaine 1" },
          { week: 2, title: "Thème Semaine 2" },
          { week: 3, title: "Thème Semaine 3" },
          { week: 4, title: "Thème Semaine 4" }
        ]
      });
    }

    // Et si des données existent en base :
    res.json({ success: true, themes: data });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Mettre à jour un thème
router.put('/themes/:weekNum', async (req, res) => {
  try {
    const weekNum = parseInt(req.params.weekNum, 10);
    const { title } = req.body;
    const clientId = req.clientId;

    const { data, error } = await supabase
      .from('weeks_themes')
      .update({ title })
      .eq('week', weekNum)
      .eq('client_id', clientId)
      .select();

    if (error) throw error;

    res.json({ success: true, message: `Thème de la Semaine ${weekNum} mis à jour.`, updatedWeek: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Importer le fichier Excel rattaché au client actif
router.post('/import-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Aucun fichier fourni." });
    }

    const clientId = req.clientId;
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (const row of sheetData) {
      await supabase.from('editorial_posts').upsert({
        client_id: clientId, // Rattachement strict au client supervisé
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
      message: `Calendrier importé avec succès (${sheetData.length} publications synchronisées pour ce client) !` 
    });
  } catch (error) {
    console.error("Erreur lors de l'import Excel :", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
