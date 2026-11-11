// socialsync-pro-backend/src/routes/internal.js
import express from 'express';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.js';

const router = express.Router();

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 3;

// Comparaison en temps constant pour éviter les attaques par timing
function secretMatches(received) {
  const expected = process.env.CRON_SECRET || '';
  if (!expected || expected.length < 32 || !received) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Envoi réel vers le réseau : à compléter réseau par réseau (étape suivante)
async function publishToNetwork(post) {
  throw new Error(
    `Publication vers ${post.platform} non encore branchée (post ${post.id}).`
  );
}

// POST /api/internal/publish-due
router.post('/publish-due', async (req, res) => {
  if (!secretMatches(req.headers['x-cron-secret'])) {
    return res.status(401).json({ success: false, error: 'Non autorisé.' });
  }

  try {
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // 1. Sélection des posts dus
    const { data: due, error: dErr } = await admin
      .from('editorial_posts')
      .select('id, owner_id, platform, caption, tags, first_comment, image_prompt, publish_attempts')
      .eq('status', 'programme')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (dErr) throw new Error(dErr.message);

    const results = { claimed: 0, published: 0, failed: 0, skipped: 0 };

    for (const post of due || []) {
      // 2. Prise de verrou atomique : ne réussit que si le statut est encore « programme »
      const { data: claimed, error: cErr } = await admin
        .from('editorial_posts')
        .update({
          status: 'en_cours',
          publish_attempts: (post.publish_attempts || 0) + 1,
          updated_at: nowIso,
        })
        .eq('id', post.id)
        .eq('status', 'programme')
        .select('id')
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (!claimed) {
        results.skipped += 1; // déjà pris par une autre exécution
        continue;
      }
      results.claimed += 1;

      // 3. Publication réseau
      try {
        await publishToNetwork(post);
        await admin
          .from('editorial_posts')
          .update({ status: 'publie', last_error: null, updated_at: new Date().toISOString() })
          .eq('id', post.id);
        results.published += 1;
      } catch (err) {
        // Après MAX_ATTEMPTS échecs, le post passe en échec définitif ; sinon il repasse programmé
        const attempts = (post.publish_attempts || 0) + 1;
        const nextStatus = attempts >= MAX_ATTEMPTS ? 'echec' : 'programme';
        await admin
          .from('editorial_posts')
          .update({
            status: nextStatus,
            last_error: String(err.message).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);
        results.failed += 1;
      }
    }

    res.json({ success: true, at: nowIso, ...results });
  } catch (err) {
    console.error('publish-due :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
