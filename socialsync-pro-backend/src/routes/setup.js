// socialsync-pro-backend/src/routes/setup.js
import express from 'express';
import { requireOwner } from '../middleware/auth.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const router = express.Router();
const MAX_LEN = 500;

// Premier champ = identifiant (non secret), second = secret
const PLATFORM_FIELDS = {
  instagram: ['accountId', 'accessToken'],
  facebook: ['pageId', 'pageToken'],
  youtube: ['channelId', 'refreshToken'],
  tiktok: ['clientKey', 'userToken'],
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

function readSocial(encrypted) {
  const raw = decryptSecret(encrypted);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const platformConfigured = (cfg, fields) => fields.every((f) => Boolean(cfg?.[f]));

// GET /api/setup/status
// Étapes obligatoires : comptes réseaux (1) et calendrier de référence (3).
// La clé Claude (2) est facultative : elle est signalée mais ne bloque pas.
router.get('/status', requireOwner, async (req, res) => {
  try {
    const s = await readSettings(req);
    const social = readSocial(s.social_accounts_encrypted);
    const status = {
      socialAccounts: Object.entries(PLATFORM_FIELDS).some(([p, f]) => platformConfigured(social[p], f)),
      claudeKey: Boolean(s.claude_key_encrypted),
      referenceCalendar: Boolean(s.reference_calendar?.content),
    };
    const complete = status.socialAccounts && status.referenceCalendar;
    res.json({ success: true, status, required: ['socialAccounts', 'referenceCalendar'], complete });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/setup/social-accounts : valeurs non secrètes + indication « secret enregistré »
router.get('/social-accounts', requireOwner, async (req, res) => {
  try {
    const s = await readSettings(req);
    const social = readSocial(s.social_accounts_encrypted);
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/setup/social-accounts : fusionne avec l'existant (un champ vide conserve la valeur actuelle)
router.put('/social-accounts', requireOwner, async (req, res) => {
  try {
    const s = await readSettings(req);
    const current = readSocial(s.social_accounts_encrypted);
    const next = JSON.parse(JSON.stringify(current));

    for (const [p, fields] of Object.entries(PLATFORM_FIELDS)) {
      const incoming = req.body?.[p];
      if (!incoming || typeof incoming !== 'object') continue;
      for (const f of fields) {
        const v = incoming[f];
        if (v === undefined || v === null || v === '') continue;
        if (typeof v !== 'string' || v.length > MAX_LEN) {
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
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.json({ success: true, message: 'Comptes réseaux enregistrés.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
