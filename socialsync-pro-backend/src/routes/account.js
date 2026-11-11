// socialsync-pro-backend/src/routes/account.js
import express from 'express';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.js';

const router = express.Router();

const GRACE_DAYS = 30;

// Membres actifs rattachés à mon espace (propriétaire)
async function activeMembersOf(ownerId) {
  const { data, error } = await getSupabaseAdmin()
    .from('memberships')
    .select('user_id')
    .eq('owner_id', ownerId)
    .eq('status', 'active')
    .neq('user_id', ownerId);
  if (error) throw new Error(error.message);
  return data || [];
}

// GET /api/account/status : état de la désactivation éventuelle
router.get('/status', async (req, res) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('team_member')
      .select('deactivated_at, deletion_scheduled_for')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({
      success: true,
      deactivatedAt: data?.deactivated_at ?? null,
      deletionScheduledFor: data?.deletion_scheduled_for ?? null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/account/deactivate : désactive le compte, suppression programmée dans 30 jours
// Corps : { confirm: "SUPPRIMER" } ou l'e-mail exact du compte
router.post('/deactivate', async (req, res) => {
  const confirm = String(req.body?.confirm || '').trim();
  const email = String(req.user.email || '').toLowerCase();
  if (confirm !== 'SUPPRIMER' && confirm.toLowerCase() !== email) {
    return res.status(400).json({ success: false, error: 'Confirmation incorrecte.' });
  }

  try {
    // Propriétaire avec membres actifs : bloqué
    if (req.userRole === 'Propriétaire' && req.ownerId === req.user.id) {
      const members = await activeMembersOf(req.user.id);
      if (members.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Retirez ou transférez d'abord les ${members.length} membre(s) de votre équipe.`,
        });
      }
    }

    const now = new Date();
    const scheduled = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await getSupabaseAdmin()
      .from('team_member')
      .update({
        deactivated_at: now.toISOString(),
        deletion_scheduled_for: scheduled.toISOString(),
      })
      .eq('id', req.user.id);
    if (error) return res.status(500).json({ success: false, error: error.message });

    // Retire l'accès immédiat aux espaces partagés
    await getSupabaseAdmin()
      .from('memberships')
      .update({ status: 'suspended' })
      .eq('user_id', req.user.id);

    res.json({ success: true, deletionScheduledFor: scheduled.toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/account/reactivate : annule la désactivation pendant le délai
router.post('/reactivate', async (req, res) => {
  try {
    const { error } = await getSupabaseAdmin()
      .from('team_member')
      .update({ deactivated_at: null, deletion_scheduled_for: null })
      .eq('id', req.user.id);
    if (error) return res.status(500).json({ success: false, error: error.message });

    await getSupabaseAdmin()
      .from('memberships')
      .update({ status: 'active' })
      .eq('user_id', req.user.id)
      .eq('status', 'suspended');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/account : suppression définitive immédiate (confirmation forte)
router.delete('/', async (req, res) => {
  const confirm = String(req.body?.confirm || '').trim();
  const email = String(req.user.email || '').toLowerCase();
  if (confirm !== 'SUPPRIMER' && confirm.toLowerCase() !== email) {
    return res.status(400).json({ success: false, error: 'Confirmation incorrecte.' });
  }

  try {
    if (req.userRole === 'Propriétaire' && req.ownerId === req.user.id) {
      const members = await activeMembersOf(req.user.id);
      if (members.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Retirez ou transférez d'abord les ${members.length} membre(s) de votre équipe.`,
        });
      }
    }
    await purgeUserData(req.user.id);
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(req.user.id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Efface les données propres à l'utilisateur (ordre : dépendances d'abord)
export async function purgeUserData(userId) {
  const tables = [
    ['editorial_posts', 'owner_id'],
    ['weeks_themes', 'owner_id'],
    ['media_library', 'owner_id'],
    ['comments', 'owner_id'],
    ['social_stats', 'owner_id'],
    ['videos_to_film', 'owner_id'],
    ['invitations', 'owner_id'],
    ['owner_settings', 'owner_id'],
    ['memberships', 'user_id'],
    ['memberships', 'owner_id'],
    ['team_member', 'id'],
  ];
  const admin = getSupabaseAdmin();
  for (const [table, col] of tables) {
    const { error } = await admin.from(table).delete().eq(col, userId);
    if (error) throw new Error(`Purge ${table} : ${error.message}`);
  }
}

export default router;
