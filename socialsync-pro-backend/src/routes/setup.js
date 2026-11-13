// socialsync-pro-backend/src/routes/setup.js
import express from 'express';
import { requireOwner } from '../middleware/auth.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const router = express.Router();
const MAX_LEN = 500;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

// Premier champ = identifiant (non secret), second = secret
const PLATFORM_FIELDS = {
  instagram: ['accountId', 'accessToken'],
  facebook: ['pageId', 'pageToken'],
  youtube: ['channelId', 'refreshToken'],
  tiktok: ['clientKey', 'userToken'],
};

const serverError = (res, where, err) => {
  console.error(`${where} :`, err);
  return res.status(500).json({ success: false, error: 'Erreur serveur. Réessayez plus tard.' });
};

async function readSettings(req) {
  const { data, error } = await req.db
    .from('owner_settings')
    .select('claude_key_encrypted, reference_calendar, social_accounts_encrypted')
    .eq('owner_id', req.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || {};
}

// ok = false si la valeur existe mais ne peut pas être déchiffrée (clé modifiée, donnée corrompue)
function readSocial(encrypted) {
  if (!encrypted) return { ok: true, data: {} };
  const raw = decryptSecret(encrypted);
  if (!raw) return { ok: false, data: {} };
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, data: {} };
  }
}

const platformConfigured = (cfg, fields) => fields.every((f) => Boolean(cfg?.[f]));

// GET /api/setup/status
// Étapes obligatoires : comptes réseaux (1) et calendrier de référence (3).
// La clé Claude (2) est facultative : elle est signalée mais ne bloque pas.
router.get('/status', requireOwner, async (req, res) => {
  try {
    const s = await readSettings(req);
    const { data: social } = readSocial(s.social_accounts_encrypted);
    const status = {
      socialAccounts: Object.entries(PLATFORM_FIELDS).some(([p, f]) => platformConfigured(social[p], f)),
      claudeKey: Boolean(s.claude_key_encrypted),
      referenceCalendar: Boolean(s.reference_calendar?.content),
    };
    const complete = status.socialAccounts && status.referenceCalendar;
    res.json({ success: true, status, required: ['socialAccounts', 'referenceCalendar'], complete });
  } catch (err) {
    serverError(res, 'setup/status', err);
  }
});

// GET /api/setup/social-accounts : valeurs non secrètes + indication « secret enregistré »
router.get('/social-accounts', requireOwner, async (req, res) => {
  try {
    const s = await readSettings(req);
    const { data: social } = readSocial(s.social_accounts_encrypted);
    const platforms = {};
    for (const [p, fields] of Object.entries(PLATFORM_FIELDS)) {
      const cfg = social[p] || {};
      platforms[p] = {
        configured: platformConfigured(cfg, fields),
        ids: { [fields[0]]: cfg[fields[0]] || '' },
        secretsSaved: { [fields[1]]: Boolean(cfg[fields[1]]) },
      };
    }
    res.json({ success: true, platforms });
  } catch (err) {
    serverError(res, 'setup/social-accounts', err);
  }
});

// PUT /api/setup/social-accounts : fusionne avec l'existant (un champ vide conserve la valeur actuelle)
router.put('/social-accounts', requireOwner, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: 'Données invalides.' });
  }

  try {
    const s = await readSettings(req);
    const current = readSocial(s.social_accounts_encrypted);

    // Refus d'écraser des identifiants qu'on ne peut pas relire
    if (!current.ok) {
      return res.status(409).json({
        success: false,
        error: "Impossible de lire les comptes réseaux déjà enregistrés. Enregistrement annulé pour ne rien perdre : contactez l'administrateur.",
      });
    }

    const next = JSON.parse(JSON.stringify(current.data));

    for (const [p, fields] of Object.entries(PLATFORM_FIELDS)) {
      const incoming = body[p];
      if (!incoming || typeof incoming !== 'object') continue;
      for (const f of fields) {
        const v = incoming[f];
        if (v === undefined || v === null || v === '') continue;
        if (typeof v !== 'string' || v.length > MAX_LEN || CONTROL_CHARS_RE.test(v)) {
          return res.status(400).json({ success: false, error: `Valeur invalide pour ${p}.${f}.` });
        }
        next[p] = { ...(next[p] || {}), [f]: v.trim() };
      }
    }

    const { error } = await req.db
      .from('owner_settings')
      .upsert(
        {
          owner_id: req.user.id,
          social_accounts_encrypted: encryptSecret(JSON.stringify(next)),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id' }
      );
    if (error) return serverError(res, 'setup/save', error);

    res.json({ success: true, message: 'Comptes réseaux enregistrés.' });
  } catch (err) {
    serverError(res, 'setup/social-accounts PUT', err);
  }
});

export default router;
