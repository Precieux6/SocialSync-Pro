import express from 'express';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();
const router = express.Router();

// Initialisation de Supabase pour la récupération des clés et du calendrier
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Clé maîtresse pour déchiffrer les clés API stockées (à définir dans ton .env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // 32 chars min

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

// Fonction centrale pour résoudre la clé Claude à utiliser (Hiérarchie BYOK)
async function resolveApiKeyAndContext(userId) {
  if (!userId) {
    return { apiKey: process.env.ANTHROPIC_API_KEY, editorialSummary: null };
  }

  try {
    // 1. Récupérer le profil utilisateur et son équipe associée
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, teams(*)')
      .eq('id', userId)
      .single();

    if (profile) {
      // Clé personnelle ?
      if (profile.personal_api_key_encrypted) {
        const decryptedKey = decrypt(profile.personal_api_key_encrypted);
        if (decryptedKey) return { apiKey: decryptedKey, editorialSummary: profile.editorial_summary };
      }

      // Clé partagée de l'équipe ?
      if (profile.teams && profile.teams.shared_api_key_encrypted) {
        const decryptedTeamKey = decrypt(profile.teams.shared_api_key_encrypted);
        if (decryptedTeamKey) {
          // Récupérer le résumé éditorial de l'équipe si disponible
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

  // Fallback sur la clé globale du serveur (.env)
  return { apiKey: process.env.ANTHROPIC_API_KEY, editorialSummary: null };
}

// Consignes éditoriales globales pour Frédéric Barbey
const SYSTEM_PROMPT = `
Vous êtes l'assistant éditorial officiel de Frédéric Barbey pour SocialSync Pro.
Respectez scrupuleusement ces règles :
- TON : Inspirant, spirituel, bienveillant, ancré et pédagogique.
- STRUCTURE : Titre accrocheur avec émoticônes ✨, paragraphes aérés, invitation à échanger en commentaire et mention de l'Académie du Spirituel ou de la chaîne YouTube.
- STYLE DE PROMPT IMAGE : Inclure des teintes indigo profond, bleu nuit, violet doux et or antique #D6AC66, ambiance peinture éthérée avec géométrie sacrée fine. Signature : FRÉDÉRIC BARBEY.
`;

// POST /api/ai/generate-caption
router.post('/generate-caption', async (req, res) => {
  const { title, theme, platform, userId } = req.body;
  const targetPlatform = platform ? platform.toUpperCase() : 'INSTAGRAM';

  // Résolution dynamique de la clé et du contexte éditorial
  const { apiKey, editorialSummary } = await resolveApiKeyAndContext(userId);

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: "Aucune clé API Claude disponible. Veuillez renseigner votre clé personnelle dans votre profil ou demander au propriétaire de l'équipe d'en configurer une."
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Intégration du calendrier éditorial de référence si l'utilisateur en a téléversé un
    let dynamicSystemPrompt = SYSTEM_PROMPT;
    if (editorialSummary) {
      dynamicSystemPrompt += `\n\nCONTEXTE ET STYLE DU CALENDRIER DE RÉFÉRENCE DE L'UTILISATEUR :\n${editorialSummary}`;
    }

    const userPrompt = `Rédige une légende captivante pour la plateforme ${targetPlatform}.\nSujet/Titre : "${title || theme}"\nThème de la semaine : "${theme || title}"`;

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

  // Fallback de secours
  res.json({
    success: true,
    platform: targetPlatform,
    caption: `✨ ${title || theme} ✨\n\nRetrouvez cet enseignement guidé par Frédéric Barbey. Chaque expérience laisse une empreinte sur notre intuition.\n\n👇 Laissez votre impression en commentaire !`
  });
});

// POST /api/ai/generate-prompt
router.post('/generate-prompt', (req, res) => {
  const { theme, platform } = req.body;

  res.json({
    success: true,
    prompt: `Crée un visuel symbolique haut de gamme pour le thème : "${theme || 'Sérénité'}". Format ${platform === 'youtube' ? '16:9' : '1:1'}, peinture éthérée, tons indigo, bleu nuit, violet doux et accents d'or antique #D6AC66. Signature : FRÉDÉRIC BARBEY.`
  });
});

export default router;