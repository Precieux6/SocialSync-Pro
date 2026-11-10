// socialsync-pro-backend/src/routes/profile.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// GET /api/profile - Récupérer le profil propre à l'utilisateur connecté
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const userEmail = req.user?.email;

    let query = supabase.from('team_member').select('*');
    if (userId) {
      query = query.eq('id', userId);
    } else if (userEmail) {
      query = query.eq('email', userEmail);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    res.json({ success: true, profile: data || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/profile/update - Mettre à jour son propre profil
router.put('/update', async (req, res) => {
  const { apiKey, editorialSummary, fullName, roleTitle, bio } = req.body;
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: "ID utilisateur manquant." });
  }

  try {
    const updateData = {};
    
    if (fullName) updateData.name = fullName;
    if (roleTitle) updateData.role = roleTitle;
    if (bio) updateData.bio = bio;
    
    if (apiKey && apiKey.trim() !== '') {
      updateData.personal_api_key_encrypted = encrypt(apiKey.trim());
    }

    if (editorialSummary) {
      updateData.editorial_summary = editorialSummary;
    }

    const { data, error } = await supabase
      .from('team_member')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) throw error;

    res.json({ success: true, message: "Profil et paramètres mis à jour avec succès.", data });
  } catch (err) {
    console.error("Erreur lors de la mise à jour du profil :", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
