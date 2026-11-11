// socialsync-pro-backend/src/routes/profile.js
import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import { requireOwner } from '../middleware/auth.js';
import { encryptSecret } from '../utils/crypto.js';

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const MAX_CALENDAR_CHARS = 50000;
const TEXT_EXT = ['.csv', '.txt', '.md'];
const SHEET_EXT = ['.xlsx', '.xls'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ---------- Utilitaires ----------

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const avatarPrefix = (userId) =>
  `${SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/`;

function isOwnAvatarUrl(url, userId) {
  return url.startsWith(avatarPrefix(userId)) && !url.includes('..') && url.length <= 500;
}

async function verifyClaudeKey(apiKey) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401 || r.status === 403) {
      return { ok: false, reason: 'Clé refusée par Anthropic. Vérifiez-la dans votre console.' };
    }
    if (!r.ok) return { ok: false, reason: `Vérification impossible (code ${r.status}).` };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Vérification impossible : Anthropic est injoignable.' };
  }
}

const cleanText = (s) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();

function extractCalendarText(file) {
  const name = String(file.originalname || '').toLowerCase();
  const i = name.lastIndexOf('.');
  const ext = i >= 0 ? name.slice(i) : '';

  if (TEXT_EXT.includes(ext)) {
    return cleanText(file.buffer.toString('utf8'));
  }
  if (SHEET_EXT.includes(ext)) {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const text = wb.SheetNames
      .map((sheet) => `### Feuille : ${sheet}\n${XLSX.utils.sheet_to_csv(wb.Sheets[sheet])}`)
      .join('\n\n');
    return cleanText(text);
  }
  const err = new Error(
    'Format non pris en charge. Envoyez un fichier .xlsx, .csv, .txt ou .md (exportez votre Word ou PDF en texte).'
  );
  err.status = 400;
  throw err;
}

const withUpload = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux (5 Mo maximum).'
        : 'Envoi du fichier impossible.';
      return res.status(400).json({ success: false, error: msg });
    }
    next();
  });

async function saveReferenceCalendar(req, content, sourceName) {
  const now = new Date().toISOString();
  const { error } = await req.db
    .from('owner_settings')
    .upsert(
      {
        owner_id: req.user.id,
        reference_calendar: { content, source_name: sourceName, updated_at: now },
        updated_at: now,
      },
      { onConflict: 'owner_id' }
    );
  if (error) throw new Error(error.message);
}

// ---------- Profil ----------

router.get('/', async (req, res) => {
  try {
    const { data: profile, error } = await req.db
      .from('team_member')
      .select('id, name, email, bio, avatar, timezone')
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
      settings = {
        has_claude_key: Boolean(data?.claude_key_encrypted),
        has_reference_calendar: Boolean(data?.reference_calendar?.content),
        reference_calendar_name: data?.reference_calendar?.source_name ?? null,
        reference_calendar_updated_at: data?.reference_calendar?.updated_at ?? null,
        updated_at: data?.updated_at ?? null,
      };
    }

    res.json({
      success: true,
      profile: profile ?? {
        id: req.user.id,
        email: req.user.email,
        name: '',
        bio: '',
        avatar: '',
        timezone: 'Europe/Paris',
      },
      space: { ownerId: req.ownerId, role: req.userRole },
      settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/', async (req, res) => {
  const b = req.body || {};
  const update = {};

  if (typeof b.name === 'string') update.name = b.name.trim().slice(0, 120);
  if (typeof b.bio === 'string') update.bio = b.bio.trim().slice(0, 1000);

  if (typeof b.avatar === 'string') {
    const url = b.avatar.split('?')[0];
    if (b.avatar !== '' && !isOwnAvatarUrl(url, req.user.id)) {
      return res.status(400).json({ success: false, error: 'Avatar invalide : importez une image depuis votre profil.' });
    }
    update.avatar = b.avatar.slice(0, 500);
  }

  if (typeof b.timezone === 'string') {
    if (!isValidTimezone(b.timezone)) {
      return res.status(400).json({ success: false, error: 'Fuseau horaire invalide.' });
    }
    update.timezone = b.timezone;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ success: false, error: 'Aucune donnée à enregistrer.' });
  }

  try {
    const { data, error } = await req.db
      .from('team_member')
      .update(update)
      .eq('id', req.user.id)
      .select('id, name, email, bio, avatar, timezone')
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, profile: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ success: false, error: 'Mots de passe manquants.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ success: false, error: "Le nouveau mot de passe doit être différent de l'actuel." });
  }

  try {
    const check = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: req.user.email, password: currentPassword }),
    });
    if (!check.ok) {
      return res.status(400).json({ success: false, error: 'Mot de passe actuel incorrect.' });
    }

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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/claude-key', requireOwner, async (req, res) => {
  const apiKey = String(req.body?.apiKey || '').trim();
  if (!apiKey.startsWith('sk-ant-') || apiKey.length < 20 || apiKey.length > 300) {
    return res.status(400).json({ success: false, error: 'Format de clé Claude invalide.' });
  }
  const check = await verifyClaudeKey(apiKey);
  if (!check.ok) return res.status(400).json({ success: false, error: check.reason });

  try {
    const encrypted = encryptSecret(apiKey);
    const { error } = await req.db
      .from('owner_settings')
      .upsert(
        { owner_id: req.user.id, claude_key_encrypted: encrypted, updated_at: new Date().toISOString() },
        { onConflict: 'owner_id' }
      );
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Clé Claude vérifiée et enregistrée.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/claude-key', requireOwner, async (req, res) => {
  const { error } = await req.db
    .from('owner_settings')
    .update({ claude_key_encrypted: null, updated_at: new Date().toISOString() })
    .eq('owner_id', req.user.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

router.put('/reference-calendar', requireOwner, async (req, res) => {
  const content = cleanText(String(req.body?.content || ''));
  if (!content) return res.status(400).json({ success: false, error: 'Contenu vide.' });
  if (content.length > MAX_CALENDAR_CHARS) {
    return res.status(400).json({ success: false, error: `Calendrier trop volumineux (${MAX_CALENDAR_CHARS} caractères maximum).` });
  }
  try {
    await saveReferenceCalendar(req, content, 'Saisie manuelle');
    res.json({ success: true, message: 'Calendrier de référence enregistré.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reference-calendar/upload', requireOwner, withUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Aucun fichier reçu.' });
  try {
    const content = extractCalendarText(req.file);
    if (!content) return res.status(400).json({ success: false, error: 'Le fichier ne contient pas de texte exploitable.' });
    if (content.length > MAX_CALENDAR_CHARS) {
      return res.status(400).json({
        success: false,
        error: `Calendrier trop volumineux après lecture (${content.length} caractères, ${MAX_CALENDAR_CHARS} maximum). Réduisez le fichier.`,
      });
    }
    await saveReferenceCalendar(req, content, req.file.originalname.slice(0, 200));
    res.json({ success: true, message: 'Calendrier de référence importé.', characters: content.length });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

router.delete('/reference-calendar', requireOwner, async (req, res) => {
  const { error } = await req.db
    .from('owner_settings')
    .update({ reference_calendar: null, updated_at: new Date().toISOString() })
    .eq('owner_id', req.user.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

export default router;
