// socialsync-pro-backend/src/routes/reminders.js
import express from 'express';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.js';
import { sendVideoReminders } from '../services/reminders.js';

const router = express.Router();

// Comparaison en temps constant, comme pour les routes internes
function isAuthorized(req) {
  const expected = process.env.CRON_SECRET || '';
  if (expected.length < 32) return false;
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const received = String(req.headers['x-cron-secret'] || bearer);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET /api/reminders : appelé toutes les heures par cron-job.org
router.get('/', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ success: false, error: 'Non autorisé.' });

  try {
    const admin = getSupabaseAdmin();
    // Date du jour à Paris (et non en UTC) pour éviter un décalage autour de minuit
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

    const { data: owners, error } = await admin.from('owner_settings').select('owner_id');
    if (error) return res.status(500).json({ success: false, error: error.message });

    const report = [];
    for (const o of owners || []) {
      try {
        const r = await sendVideoReminders({ admin, ownerId: o.owner_id, today });
        if (r.sent) report.push({ owner: o.owner_id, reminders: r.sent });
      } catch (err) {
        report.push({ owner: o.owner_id, error: err.message });
      }
    }
    res.json({ success: true, today, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
