import express from 'express';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error("Erreur de déchiffrement de la clé API:", e);
    return null;
  }
}

async function resolveApiKeyAndContext(userId, clientId) {
  const targetId = clientId || userId;
  if (!targetId) {
    return { apiKey: process.env.ANTHROPIC_API_KEY, editorialSummary: null };
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, teams(*)')
      .eq('id', targetId)
      .single();

    if (profile) {
      if (profile.personal_api_key_encrypted) {
        const decryptedKey = decrypt(profile.personal_api_key_encrypted);
        if (decryptedKey) return { apiKey: decryptedKey, editorialSummary: profile.editorial_summary };
      }

      if (profile.teams && profile.teams.shared_api_key_encrypted) {
        const decryptedTeamKey = decrypt(profile.teams.shared_api_key_encrypted);
        if (decryptedTeamKey) {
          return { 
            apiKey: decryptedTeamKey, 
            editorialSummary: profile.teams.editorial_summary || profile.editorial_summary 
          };
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors de la résolution de la clé API en base :", err);
  }

  return { apiKey: process.env.ANTHROPIC_API_KEY, editorialSummary: null };
}

const SYSTEM_PROMPT = `
Vous êtes l'assistant éditorial officiel pour SocialSync Pro.
Respectez scrupuleusement ces règles :
- TON : Inspirant, professionnel, bienveillant et pédagogique.
- STRUCTURE : Titre accrocheur avec émoticônes ✨, paragraphes aérés, invitation à échanger en commentaire.
`;

router.post('/generate-caption', async (req, res) => {
  const { title, theme, platform, userId } = req.body;
  const clientId = req.clientId || req.body.clientId;
  const targetPlatform = platform ? platform.toUpperCase() : 'INSTAGRAM';

  const { apiKey, editorialSummary } = await resolveApiKeyAndContext(userId, clientId);

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: "Aucune clé API Claude disponible. Veuillez renseigner votre clé personnelle dans votre profil."
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    let dynamicSystemPrompt = SYSTEM_PROMPT;
    if (editorialSummary) {
      dynamicSystemPrompt += `\n\nCONTEXTE ET STYLE DU CALENDRIER DE RÉFÉRENCE :\n${editorialSummary}`;
    }

    const userPrompt = `Rédige une légende captivante pour la plateforme ${targetPlatform}.\nSujet/Titre : "${title || theme}"\nThème : "${theme || title}"`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: dynamicSystemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const generatedText = response.content[0]?.text;

    if (generatedText) {
      return res.json({ success: true, platform: targetPlatform, caption: generatedText });
    }
  } catch (err) {
    console.error('Erreur lors de l’appel à l’API Claude:', err);
    return res.status(500).json({ success: false, error: "Erreur lors de la génération avec Claude : " + err.message });
  }

  res.json({
    success: true,
    platform: targetPlatform,
    caption: `✨ ${title || theme} ✨\n\nRetrouvez cet enseignement.\n\n👇 Laissez votre impression en commentaire !`
  });
});

router.post('/generate-prompt', (req, res) => {
  const { theme, platform } = req.body;

  res.json({
    success: true,
    prompt: `Crée un visuel symbolique haut de gamme pour le thème : "${theme || 'Sérénité'}". Format ${platform === 'youtube' ? '16:9' : '1:1'}.`
  });
});

export default router;
