import express from 'express';
import { resend } from '../config/resend.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'] || 'Propriétaire'; 
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé : permissions insuffisantes.' 
      });
    }
    next();
  };
};

// GET /api/team - Récupérer l'équipe liée au compte / client actif
router.get('/', async (req, res) => {
  try {
    const clientId = req.clientId;
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('client_id', clientId);

    if (error) throw error;

    res.json({ success: true, count: data ? data.length : 0, team: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/team/invite
router.post('/invite', requireRole(['Propriétaire', 'Community Manager']), async (req, res) => {
  try {
    const { email, role } = req.body;
    const clientId = req.clientId;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Adresse e-mail invalide.' });
    }

    const validRoles = ['Propriétaire', 'Community Manager', 'Éditeur', 'Relecteur / Client'];
    const assignedRole = validRoles.includes(role) ? role : 'Éditeur';

    const newMember = {
      client_id: clientId,
      name: email.split('@')[0],
      email,
      role: assignedRole,
      status: 'Actif',
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`
    };

    const { data, error } = await supabase
      .from('team_members')
      .insert([newMember])
      .select();

    if (error) throw error;

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'votre_cle_resend') {
      await resend.emails.send({
        from: 'SocialSync Pro <onboarding@resend.dev>',
        to: email,
        subject: 'Invitation à rejoindre le studio SocialSync Pro',
        html: `<p>Bonjour,</p><p>Vous avez été invité en tant que <strong>${assignedRole}</strong>.</p>`
      });
    }

    res.status(201).json({
      success: true,
      message: `Invitation envoyée à ${email} en tant que ${assignedRole}.`,
      member: data[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/team/:id
router.delete('/:id', requireRole(['Propriétaire']), async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: `Membre retiré de l'équipe avec succès.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
