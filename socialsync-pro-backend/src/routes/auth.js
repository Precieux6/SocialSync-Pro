// socialsync-pro-backend/src/routes/auth.js
import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { resend } from '../config/resend.js';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.js';

dotenv.config();
const router = express.Router();

const APP_URL = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
const FROM_ADDRESS = process.env.RESEND_FROM || 'SocialSync Pro <onboarding@resend.dev>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// Réponse identique qu'un compte existe ou non : pas de révélation des adresses enregistrées
const GENERIC_REPLY = {
  success: true,
  message: "Si un compte existe pour cette adresse, un e-mail avec un lien de réinitialisation vient d'être envoyé.",
};

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Trop de demandes. Réessayez dans une heure.' },
});

// POST /api/auth/forgot-password : route publique, sans jeton
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);

  if (!APP_URL) {
    console.error('forgot-password : APP_URL absente');
    return res.json(GENERIC_REPLY);
  }
  if (!EMAIL_RE.test(email)) return res.json(GENERIC_REPLY);

  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: APP_URL },
    });
    const link = data?.properties?.action_link;
    if (error || !link) {
      // Compte inexistant ou erreur : on répond de la même façon
      if (error) console.warn('forgot-password : lien non généré :', error.message);
      return res.json(GENERIC_REPLY);
    }

    const { error: sErr } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Réinitialiser votre mot de passe SocialSync Pro',
      html: `<p>Bonjour,</p>
             <p>Vous avez demandé à réinitialiser votre mot de passe SocialSync Pro.</p>
             <p><a href="${esc(link)}">Choisir un nouveau mot de passe</a></p>
             <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe ne changera pas.</p>`,
    });
    if (sErr) console.error('Resend (réinitialisation) :', sErr);
  } catch (err) {
    console.error('forgot-password :', err);
  }
  res.json(GENERIC_REPLY);
});

export default router;
