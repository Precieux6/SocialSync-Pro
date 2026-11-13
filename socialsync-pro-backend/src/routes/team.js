// socialsync-pro-backend/src/routes/team.js
import express from 'express';
import dotenv from 'dotenv';
import { resend } from '../config/resend.js';
import { requireOwner } from '../middleware/auth.js';

dotenv.config();
const router = express.Router();

const ROLES = ['Community Manager', 'Éditeur', 'Relecteur / Client'];
const APP_URL = process.env.APP_URL || 'https://social-sync-pro.vercel.app';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 120;

// Expéditeur : doit appartenir à un domaine vérifié dans Resend.
// onboarding@resend.dev ne fonctionne que pour l'adresse du compte Resend.
const FROM_ADDRESS = process.env.RESEND_FROM || 'SocialSync Pro <onboarding@resend.dev>';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
const cleanLine = (value, max = MAX_NAME) =>
  String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

const emailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY) && process.env.RESEND_API_KEY !== 'votre_cle_resend';

const ownerDisplayName = (user) =>
  cleanLine(user.user_metadata?.full_name || user.email || 'Un propriétaire');

const invalidId = (res) =>
  res.status(400).json({ success: false, error: 'Identifiant invalide.' });

const serverError = (res, where, err) => {
  console.error(`${where} :`, err);
  return res.status(500).json({ success: false, error: 'Erreur serveur. Réessayez plus tard.' });
};

async function sendInvitationEmail(invitation, ownerName) {
  if (!emailConfigured()) {
    return { sent: false, reason: 'Envoi e-mail non configuré : RESEND_API_KEY absente sur le serveur.' };
  }

  if (FROM_ADDRESS === 'SocialSync Pro <onboarding@resend.dev>') {
    console.warn('RESEND_FROM absent : seul le propriétaire du compte Resend recevra les e-mails.');
  }

  const name = escapeHtml(ownerName);
  const role = escapeHtml(invitation.role);
  const url = escapeHtml(APP_URL);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: invitation.email,
      subject: `${cleanLine(ownerName)} vous invite à rejoindre son studio SocialSync Pro`,
      html: `<p>Bonjour,</p>
             <p>${name} vous invite en tant que <strong>${role}</strong>.</p>
             <p>Créez votre compte ou connectez-vous avec cette adresse e-mail sur
             <a href="${url}">${url}</a> : l'invitation sera acceptée automatiquement.</p>`,
    });

    // Le SDK Resend ne lève pas d'exception en cas de refus : il faut contrôler error
    if (error) {
      console.error('Resend (refus) :', error);
      return { sent: false, reason: `Resend a refusé l'envoi : ${error.message}` };
    }

    return { sent: true, id: data?.id ?? null };
  } catch (err) {
    console.error('Resend (exception) :', err);
    return { sent: false, reason: "L'e-mail n'a pas pu être envoyé. Vous pouvez réessayer." };
  }
}

// Liste des membres actifs de mon espace
router.get('/members', requireOwner, async (req, res) => {
  const { data: links, error: e1 } = await req.db
    .from('memberships')
    .select('user_id, role, created_at')
    .eq('owner_id', req.ownerId)
    .eq('status', 'active');
  if (e1) return serverError(res, 'members/links', e1);

  const ids = (links ?? []).map((l) => l.user_id);
  const { data: profiles, error: e2 } = ids.length
    ? await req.db.from('team_member').select('id, name, email, avatar').in('id', ids)
    : { data: [], error: null };
  if (e2) return serverError(res, 'members/profiles', e2);

  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  res.json({
    success: true,
    members: (links ?? []).map((l) => ({
      ...byId[l.user_id],
      user_id: l.user_id,
      role: l.role,
      since: l.created_at,
    })),
  });
});

// Invitations en attente et acceptées
router.get('/invitations', requireOwner, async (req, res) => {
  const { data, error } = await req.db
    .from('invitations')
    .select('id, email, role, created_at, accepted_at')
    .eq('owner_id', req.ownerId)
    .order('created_at', { ascending: false });
  if (error) return serverError(res, 'invitations', error);
  res.json({ success: true, invitations: data });
});

// Nouvelle invitation (ou mise à jour de l'invitation en attente pour la même adresse)
router.post('/invite', requireOwner, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
  const role = req.body?.role;

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Adresse e-mail invalide.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Rôle invalide.' });
  }
  if (email === String(req.user.email || '').toLowerCase()) {
    return res.status(400).json({ success: false, error: 'Vous ne pouvez pas vous inviter vous-même.' });
  }

  const { data: pending, error: pErr } = await req.db
    .from('invitations')
    .select('id')
    .eq('owner_id', req.ownerId)
    .eq('email', email)
    .is('accepted_at', null)
    .maybeSingle();
  if (pErr) return serverError(res, 'invite/pending', pErr);

  let invitation;
  if (pending) {
    const { data, error } = await req.db
      .from('invitations')
      .update({ role })
      .eq('id', pending.id)
      .eq('owner_id', req.ownerId)
      .select()
      .single();
    if (error) return serverError(res, 'invite/update', error);
    invitation = data;
  } else {
    const { data, error } = await req.db
      .from('invitations')
      .insert([{ owner_id: req.ownerId, email, role }])
      .select()
      .single();
    if (error) return serverError(res, 'invite/insert', error);
    invitation = data;
  }

  const mail = await sendInvitationEmail(invitation, ownerDisplayName(req.user));
  res.status(pending ? 200 : 201).json({ success: true, invitation, email: mail });
});

// Renvoyer une invitation existante (même ligne)
router.post('/invitations/:id/resend', requireOwner, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return invalidId(res);

  const { data, error } = await req.db
    .from('invitations')
    .select('*')
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId)
    .is('accepted_at', null)
    .maybeSingle();
  if (error) return serverError(res, 'invitations/resend', error);
  if (!data) {
    return res.status(404).json({ success: false, error: 'Invitation introuvable ou déjà acceptée.' });
  }

  const mail = await sendInvitationEmail(data, ownerDisplayName(req.user));
  res.json({ success: true, email: mail });
});

// Supprimer une invitation non acceptée
router.delete('/invitations/:id', requireOwner, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return invalidId(res);

  const { error } = await req.db
    .from('invitations')
    .delete()
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId)
    .is('accepted_at', null);
  if (error) return serverError(res, 'invitations/delete', error);
  res.json({ success: true });
});

// Changer le rôle d'un membre
router.post('/members/:userId/role', requireOwner, async (req, res) => {
  const { userId } = req.params;
  if (!UUID_RE.test(userId)) return invalidId(res);
  if (userId === req.ownerId) {
    return res.status(400).json({ success: false, error: 'Vous ne pouvez pas modifier votre propre rôle.' });
  }
  if (!ROLES.includes(req.body?.role)) {
    return res.status(400).json({ success: false, error: 'Rôle invalide.' });
  }

  const { error } = await req.db.rpc('owner_set_member_role', {
    p_user: userId,
    p_role: req.body.role,
  });
  // Message métier renvoyé par la fonction SQL (volontairement affiché)
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true });
});

// Retirer un membre (statut « removed », le compte est conservé)
router.delete('/members/:userId', requireOwner, async (req, res) => {
  const { userId } = req.params;
  if (!UUID_RE.test(userId)) return invalidId(res);
  if (userId === req.ownerId) {
    return res.status(400).json({ success: false, error: 'Vous ne pouvez pas vous retirer de votre propre espace.' });
  }

  const { error } = await req.db.rpc('owner_remove_member', { p_user: userId });
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true });
});

// Acceptation des invitations par le membre connecté.
// Ne passe pas par requireOwner : tout utilisateur authentifié peut accepter.
// Doit être appelée SANS en-tête X-Owner-Id (l'espace par défaut est le sien).
router.post('/accept', async (req, res) => {
  const { data, error } = await req.db.rpc('accept_my_invitation');
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, accepted: data });
});

export default router;
