import express from 'express';
import { INITIAL_TEAM } from '../data/mockData.js';
import { resend } from '../config/resend.js';

const router = express.Router();
let team = [...INITIAL_TEAM];

// Middleware de vérification des rôles (RBAC)
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // Dans un contexte de production, le rôle est extrait du token JWT ou de la session utilisateur
    const userRole = req.headers['x-user-role'] || 'Propriétaire'; 
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé : vous ne disposez pas des permissions nécessaires pour cette action.' 
      });
    }
    next();
  };
};

// GET /api/team
router.get('/', (req, res) => {
  res.json({ success: true, count: team.length, team });
});

// POST /api/team/invite (Réservé aux Propriétaires et Community Managers)
router.post('/invite', requireRole(['Propriétaire', 'Community Manager']), async (req, res) => {
  const { email, role } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Adresse e-mail invalide.' });
  }

  const validRoles = ['Propriétaire', 'Community Manager', 'Éditeur', 'Relecteur / Client'];
  const assignedRole = validRoles.includes(role) ? role : 'Éditeur';

  const newMember = {
    id: Date.now(),
    name: email.split('@')[0],
    email,
    role: assignedRole,
    status: 'Actif',
    avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`
  };

  team.push(newMember);

  // Envoi de l'e-mail d'invitation via Resend si la clé est renseignée
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'votre_cle_resend') {
    try {
      await resend.emails.send({
        from: 'SocialSync Pro <onboarding@resend.dev>',
        to: email,
        subject: 'Invitation à rejoindre l\'équipe SocialSync Pro',
        html: `<p>Bonjour,</p><p>Vous avez été invité à rejoindre le studio d'édition SocialSync Pro en tant que <strong>${assignedRole}</strong>.</p>`
      });
    } catch (error) {
      console.error('Erreur lors de l’envoi de l’e-mail via Resend:', error);
    }
  }

  res.status(201).json({
    success: true,
    message: `Invitation envoyée à ${email} en tant que ${assignedRole} via Resend.`,
    member: newMember
  });
});

// DELETE /api/team/:id (Réservé aux Propriétaires)
router.delete('/:id', requireRole(['Propriétaire']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const member = team.find(m => m.id === id);

  if (!member) {
    return res.status(404).json({ success: false, message: 'Membre non trouvé.' });
  }

  if (member.role === 'Propriétaire') {
    return res.status(403).json({ success: false, message: 'Impossible de supprimer le propriétaire.' });
  }

  team = team.filter(m => m.id !== id);
  res.json({ success: true, message: `Membre ${member.name} retiré de l'équipe.` });
});

export default router;