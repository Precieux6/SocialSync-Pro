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
const PROFILE_COLUMNS = 'id, name, email, bio, avatar, timezone';
const AVATAR_PATH = '/storage/v1/object/public/avatars/';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ---------- Utilitaires ----------

const serverError = (res, where, err) => {
  console.error(`${where} :`, err);
  return res.status(500).json({ success: false, error: 'Erreur serveur. Réessayez plus tard.' });
};

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Vérifie que l'URL pointe vers le dossier avatar de l'utilisateur connecté, et seulement celui-ci
function isOwnAvatarUrl(url, userId) {
  if (typeof url !== 'string' || url.length > 500) return false;
  if (!SUPABASE_URL || !UUID_RE.test(userId)) return false;

  let parsed;
  let base;
  try {
    parsed = new URL(url);
    base = new URL(SUPABASE_URL);
  } catch {
    return false;
  }

  return parsed.origin === base.origin
    && parsed.pathname.startsWith(`${AVATAR_PATH}${userId}/`)
    && !parsed.pathname.includes('..');
}

// Nom d'affichage par défaut : métadonnées Supabase, sinon partie locale de l'e-mail
function defaultName(user) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email || '').split('@')[0] ||
    ''
  ).replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
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
  const err = new Error('Format non pris en charge. Envoyez un fichier .xlsx, .csv, .txt ou .md.');
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
    let { data: profile, error } = await req.db
      .from('team_member')
      .select(PROFILE_COLUMNS)
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) return serverError(res, 'profile/get', error);

    // Création de la fiche si elle n'existe pas encore (l'e-mail est obligatoire).
    // ignoreDuplicates : une lecture concurrente n'écrase jamais une fiche existante.
    if (!profile) {
      const { error: createErr } = await req.db
        .from('team_member')
        .upsert(
          [{
            id: req.user.id,
            email: req.user.email,
            name: defaultName(req.user),
            bio: '',
            avatar: '',
            timezone: 'Europe/Paris',
          }],
          { onConflict: 'id', ignoreDuplicates: true }
        );
      if (createErr) return serverError(res, 'profile/create', createErr);

      const { data: created, error: readErr } = await req.db
        .from('team_member')
        .select(PROFILE_COLUMNS)
        .eq('id', req.user.id)
        .maybeSingle();
      if (readErr) return serverError(res, 'profile/reread', readErr);
      profile = created;
    }

    let settings = null;
    if (req.userRole === 'Propriétaire') {
      const { data, error: sErr } = await req.db
        .from('owner_settings')
        .select('claude_key_encrypted, reference_calendar, updated_at')
        .eq('owner_id', req.user.id)
        .maybeSingle();
      if (sErr) return serverError(res, 'profile/settings', sErr);
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
    serverError(res, 'profile/get (global)', err);
  }
});

router.put('/', async (req, res) => {
  const b = req.body || {};

  // L'e-mail et l'identifiant viennent toujours de la session : la colonne email est NOT NULL
  const update = {
    id: req.user.id,
    email: req.user.email,
  };

  if (typeof b.name === 'string') {
    update.name = b.name.replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  }
  if (typeof b.bio === 'string') update.bio = b.bio.trim().slice(0, 1000);

  if (typeof b.avatar === 'string') {
    if (b.avatar !== '' && !isOwnAvatarUrl(b.avatar.split('?')[0], req.user.id)) {
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

  // Nom par défaut à la création si rien n'est fourni
  if (update.name === undefined) update.name = defaultName(req.user);

  try {
    const { data, error } = await req.db
      .from('team_member')
      .upsert(update, { onConflict: 'id' })
      .select(PROFILE_COLUMNS)
      .single();

    if (error) return serverError(res, 'profile/update', error);
    res.json({ success: true, profile: data });
  } catch (err) {
    serverError(res, 'profile/update (global)', err);
  }
});

router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ success: false, error: 'Mots de passe manquants.' });
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit faire entre 8 et 72 caractères.' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ success: false, error: "Le nouveau mot de passe doit être différent de l'actuel." });
  }

  const token = String(req.headers.authorization || '').slice(7).trim();

  try {
    // Vérification du mot de passe actuel
    const check = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: req.user.email, password: currentPassword }),
      signal: AbortSignal.timeout(8000),
    });
    if (!check.ok) {
      return res.status(400).json({ success: false, error: 'Mot de passe actuel incorrect.' });
    }

    const upd = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
      signal: AbortSignal.timeout(8000),
    });
    if (!upd.ok) {
      return res.status(400).json({ success: false, error: 'Mise à jour du mot de passe impossible.' });
    }
    res.json({ success: true, message: 'Mot de passe mis à jour.' });
  } catch (err) {
    serverError(res, 'profile/password', err);
  }
});

// ---------- Intelligence artificielle ----------

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
    if (error) return serverError(res, 'profile/claude-key', error);
    res.json({ success: true, message: 'Clé Claude vérifiée et enregistrée.' });
  } catch (err) {
    serverError(res, 'profile/claude-key (global)', err);
  }
});

router.delete('/claude-key', requireOwner, async (req, res) => {
  const { error } = await req.db
    .from('owner_settings')
    .update({ claude_key_encrypted: null, updated_at: new Date().toISOString() })
    .eq('owner_id', req.user.id);
  if (error) return serverError(res, 'profile/claude-key delete', error);
  res.json({ success: true });
});

// ---------- Calendrier de référence ----------

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
    serverError(res, 'profile/reference-calendar', err);
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
    await saveReferenceCalendar(req, content, req.file.originalname.replace(/[\r\n]+/g, ' ').slice(0, 200));
    res.json({ success: true, message: 'Calendrier de référence importé.', characters: content.length });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    serverError(res, 'profile/reference-calendar upload', err);
  }
});

router.delete('/reference-calendar', requireOwner, async (req, res) => {
  const { error } = await req.db
    .from('owner_settings')
    .update({ reference_calendar: null, updated_at: new Date().toISOString() })
    .eq('owner_id', req.user.id);
  if (error) return serverError(res, 'profile/reference-calendar delete', error);
  res.json({ success: true });
});

export default router;
