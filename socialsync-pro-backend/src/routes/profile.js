// socialsync-pro-backend/src/routes/profile.js
import express from 'express';
import dotenv from 'dotenv';
import { requireOwner } from '../middleware/auth.js';
import { encryptSecret } from '../utils/crypto.js';

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const isHttpsUrl = (s) => {
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
};

// GET /api/profile : mon profil + état de la configuration IA (propriétaire seulement)
router.get('/', async (req, res) => {
  const { data: profile, error } = await req.db
    .from('team_member')
    .select('id, name, email, bio, avatar')
    .eq('id', req.user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });

  let settings = null;
  if (req.userRole === 'Propriétaire') {
    const { data, error: sErr } = await req.db
      .from('owner_settings')
      .select('claude_key_encrypted, reference_calendar, updated_at')
      .eq('owner_id', req.user.id)
      .maybeSingle();
    if (sErr) return res.status(500).json({ success: false, error: sErr.message });

    // La clé elle-même n'est jamais renvoyée
    settings = {
      has_claude_key: Boolean(data?.claude_key_encrypted),
      has_reference_calendar: Boolean(data?.reference_calendar),
      updated_at: data?.updated_at ?? null,
    };
  }

  res.json({
    success: true,
    profile: profile ?? { id: req.user.id, email: req.user.email, name: '', bio: '', avatar: '' },
    space: { ownerId: req.ownerId, role: req.userRole },
    settings,
  });
});

// PUT /api/profile : nom, bio, avatar (tous les membres)
router.put('/', async (req, res) => {
  const b = req.body || {};
  const update = {};

  if (typeof b.name === 'string') update.name = b.name.trim().slice(0, 120);
  if (typeof b.bio === 'string') update.bio = b.bio.trim().slice(0, 1000);
  if (typeof b.avatar === 'string') {
    if (b.avatar !== '' && !isHttpsUrl(b.avatar)) {
      return res.status(400).json({ success: false, error: 'Avatar : URL https attendue.' });
    }
    update.avatar = b.avatar.slice(0, 500);
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ success: false, error: 'Aucune donnée à enregistrer.' });
  }

  // Le verrouillage SQL ne laisse modifier que name, bio et avatar
  const { data, error } = await req.db
    .from('team_member')
    .update(update)
    .eq('id', req.user.id)
    .select('id, name, email, bio, avatar')
    .single();
  if (error) return res.status(400).json({ success: false, error: error.message });

  res.json({ success: true, profile: data });
});

// PUT /api/profile/password : changement de mot de passe (tous les membres)
router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ success: false, error: 'Mots de passe manquants.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
  }

  // 1. Vérifie l'ancien mot de passe
  const check = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: req.user.email, password: currentPassword }),
  });
  if (!check.ok) {
    return res.status(400).json({ success: false, error: 'Mot de passe actuel incorrect.' });
  }

  // 2. Met à jour avec le token de l'utilisateur
  const token = req.headers.authorization.slice(7).trim();
  const upd = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!upd.ok) {
    return res.status(400).json({ success: false, error: 'Mise à jour du mot de passe impossible.' });
  }

  res.json({ success: true, message: 'Mot de passe mis à jour.' });
});

// PUT /api/profile/claude-key : enregistre la clé Claude (propriétaire seulement)
router.put('/claude-key', requireOwner, async (req, res) => {
  const apiKey = String(req.body?.apiKey || '').trim();
  if (!apiKey.startsWith('sk-ant-') || apiKey.length < 20) {
    return res.status(400).json({ success: false, error: 'Format de clé Claude invalide.' });
  }

  let encrypted;
  try {
    encrypted = encryptSecret(apiKey);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }

  const { error } = await req.db
    .from('owner_settings')
    .upsert(
      { owner_id: req.user.id, claude_key_encrypted: encrypted, updated_at: new Date().toISOString() },
      { onConflict: 'owner_id' }
    );
  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true, message: 'Clé Claude enregistrée.' });
});

// DELETE /api/profile/claude-key : supprime la clé (propriétaire seulement)
router.delete('/claude-key', requireOwner, async (req, res) => {
  const { error } = await req.db
    .from('owner_settings')
    .update({ claude_key_encrypted: null, updated_at: new Date().toISOString() })
    .eq('owner_id', req.user.id);
  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true });
});

// PUT /api/profile/reference-calendar : calendrier éditorial de référence (propriétaire seulement)
router.put('/reference-calendar', requireOwner, async (req, res) => {
  const content = String(req.body?.content || '');
  if (!content.trim()) {
    return res.status(400).json({ success: false, error: 'Contenu vide.' });
  }
  if (content.length > 50000) {
    return res.status(400).json({ success: false, error: 'Calendrier trop volumineux (50 000 caractères max).' });
  }

  const { error } = await req.db
    .from('owner_settings')
    .upsert(
      {
        owner_id: req.user.id,
        reference_calendar: { content, updated_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' }
    );
  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true, message: 'Calendrier de référence enregistré.' });
});

// DELETE /api/profile/reference-calendar
router.delete('/reference-calendar', requireOwner, async (req, res) => {
  const { error } = await req.db
    .from('owner_settings')
    .update({ reference_calendar: null, updated_at: new Date().toISOString() })
    .eq('owner_id', req.user.id);
  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true });
});

export default router;
