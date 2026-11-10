// socialsync-pro-backend/src/routes/ai.js
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { decryptSecret } from '../utils/crypto.js';

const router = express.Router();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

const SYSTEM_PROMPT = `
Vous êtes l'assistant éditorial officiel pour SocialSync Pro.
Respectez scrupuleusement ces règles :
- TON : Inspirant, professionnel, bienveillant et pédagogique.
- STRUCTURE : Titre accrocheur avec émoticônes ✨, paragraphes aérés, invitation à échanger en commentaire.
`;

// Charge la clé et le calendrier de référence de l'espace actif.
// Passe par les fonctions SQL : un membre ne lit jamais owner_settings directement.
async function loadSpaceAiConfig(req) {
  const { data: encrypted, error: kErr } = await req.db.rpc('get_space_ai_key', { p_owner: req.ownerId });
  if (kErr) throw new Error('Accès à la configuration IA refusé.');

  const apiKey = decryptSecret(encrypted);
  if (!apiKey) {
    return { error: 'Aucune clé Claude valide pour cet espace. Le propriétaire doit la renseigner dans Mon profil.' };
  }

  const { data: ref, error: rErr } = await req.db.rpc('get_space_reference_calendar', { p_owner: req.ownerId });
  if (rErr) throw new Error('Lecture du calendrier de référence refusée.');

  const reference = ref?.content ? String(ref.content).slice(0, 20000) : null;
  return { apiKey, reference };
}

// POST /api/ai/generate-caption
router.post('/generate-caption', async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 300);
  const theme = String(req.body?.theme || '').trim().slice(0, 300);
  const platform = String(req.body?.platform || 'instagram').toUpperCase();

  if (!title && !theme) {
    return res.status(400).json({ success: false, error: 'Titre ou thème requis.' });
  }

  try {
    const cfg = await loadSpaceAiConfig(req);
    if (cfg.error) return res.status(400).json({ success: false, error: cfg.error });

    let system = SYSTEM_PROMPT;
    if (cfg.reference) {
      system += `\n\nCONTEXTE ET STYLE DU CALENDRIER DE RÉFÉRENCE :\n${cfg.reference}`;
    }

    const anthropic = new Anthropic({ apiKey: cfg.apiKey });
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system,
      messages: [{
        role: 'user',
        content: `Rédige une légende captivante pour la plateforme ${platform}.\nSujet/Titre : "${title || theme}"\nThème : "${theme || title}"`,
      }],
    });

    const caption = response.content.find((b) => b.type === 'text')?.text;
    if (!caption) {
      return res.status(502).json({ success: false, error: 'Réponse vide de Claude.' });
    }

    res.json({ success: true, platform, caption });
  } catch (err) {
    console.error('generate-caption :', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération de la légende.' });
  }
});

// POST /api/ai/generate-prompt : suggestion de visuel (sans appel à Claude)
router.post('/generate-prompt', (req, res) => {
  const theme = String(req.body?.theme || 'Sérénité').slice(0, 300);
  const platform = req.body?.platform === 'youtube' ? '16:9' : '1:1';
  res.json({
    success: true,
    prompt: `Crée un visuel symbolique haut de gamme pour le thème : "${theme}". Format ${platform}.`,
  });
});

export default router;
