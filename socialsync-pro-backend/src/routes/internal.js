// socialsync-pro-backend/src/routes/internal.js
import express from 'express';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.js';
import { decryptSecret } from '../utils/crypto.js';
import { publishInstagram } from '../services/publishers/instagram.js';
import { runContentAutomation } from '../services/contentPlanner.js';
import { sendVideoReminders } from '../services/reminders.js';

const router = express.Router();

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;
const CONTENT_BUDGET_MS = 200_000;

const PUBLISHERS = {
  instagram: publishInstagram,
};

// Comparaison en temps constant pour éviter les attaques par timing
function secretMatches(received) {
  const expected = process.env.CRON_SECRET || '';
  if (!expected || expected.length < 32 || !received) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ».
// Les appels manuels ou externes peuvent utiliser l'en-tête X-Cron-Secret.
function isAuthorized(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return secretMatches(req.headers['x-cron-secret']) || secretMatches(bearer);
}

// Identifiants réseau d'un espace, déchiffrés uniquement côté serveur
async function loadCredentials(admin, ownerId) {
  const { data, error } = await admin
    .from('owner_settings')
    .select('social_accounts_encrypted')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const raw = decryptSecret(data?.social_accounts_encrypted);
  if (!raw) throw new Error('Comptes réseaux absents ou illisibles pour cet espace.');
  return JSON.parse(raw);
}

async function publishToNetwork(post, creds) {
  const publisher = PUBLISHERS[post.platform];
  if (!publisher) throw new Error(`Publication vers ${post.platform} non encore branchée.`);
  const platformCreds = creds[post.platform];
  if (!platformCreds) throw new Error(`Compte ${post.platform} non configuré pour cet espace.`);
  return publisher(post, platformCreds);
}

// Publication des posts programmés dont l'heure est atteinte
async function publishDue(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ success: false, error: 'Non autorisé.' });

  try {
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: due, error: dErr } = await admin
      .from('editorial_posts')
      .select('id, owner_id, platform, format, caption, tags, first_comment, media_urls, video_url, publish_attempts')
      .eq('status', 'programme')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (dErr) throw new Error(dErr.message);

    const credsByOwner = new Map();
    const results = { claimed: 0, published: 0, failed: 0, skipped: 0 };

    for (const post of due || []) {
      // Verrou atomique : seule une exécution peut passer le statut à « en_cours »
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
        results.skipped += 1;
        continue;
      }
      results.claimed += 1;

      try {
        if (!credsByOwner.has(post.owner_id)) {
          credsByOwner.set(post.owner_id, await loadCredentials(admin, post.owner_id));
        }
        const { externalId, warning } = await publishToNetwork(post, credsByOwner.get(post.owner_id));

        const { error: uErr } = await admin
          .from('editorial_posts')
          .update({
            status: 'publie',
            external_id: externalId,
            last_error: warning,
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);
        // Le post est déjà sur le réseau : on journalise sans relancer la publication
        if (uErr) console.error('publish-due : statut non enregistré pour un post publié', post.id, uErr.message);
        results.published += 1;
      } catch (err) {
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
}

// Rédaction automatique, puis rappels de tournage pour tous les espaces
async function contentJob(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ success: false, error: 'Non autorisé.' });

  try {
    const admin = getSupabaseAdmin();
    const t0 = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    const { data: spaces, error } = await admin
      .from('owner_settings')
      .select('owner_id, claude_key_encrypted, reference_calendar')
      .not('claude_key_encrypted', 'is', null)
      .eq('auto_generate', true);
    if (error) return res.status(500).json({ success: false, error: error.message });

    const report = [];
    for (const s of spaces || []) {
      if (Date.now() - t0 > CONTENT_BUDGET_MS) {
        report.push({ skipped: 'durée maximale atteinte, reprise à la prochaine exécution' });
        break;
      }

      const reference = s.reference_calendar?.content
        ? String(s.reference_calendar.content).slice(0, 100000)
        : null;
      if (!reference) {
        report.push({ owner: s.owner_id, skipped: 'calendrier de référence absent' });
        continue;
      }

      try {
        const apiKey = decryptSecret(s.claude_key_encrypted);
        if (!apiKey) throw new Error('clé illisible');
        const result = await runContentAutomation({ db: admin, ownerId: s.owner_id, apiKey, reference });
        report.push({ owner: s.owner_id, ...result });
      } catch (err) {
        report.push({ owner: s.owner_id, error: err.message });
      }
    }

    // Rappels de tournage : indépendants de la clé Claude
    const { data: owners, error: oErr } = await admin.from('owner_settings').select('owner_id');
    if (!oErr) {
      for (const o of owners || []) {
        try {
          const r = await sendVideoReminders({ admin, ownerId: o.owner_id, today });
          if (r.sent) report.push({ owner: o.owner_id, reminders: r.sent });
        } catch (err) {
          report.push({ owner: o.owner_id, reminderError: err.message });
        }
      }
    }

    res.json({ success: true, report });
  } catch (err) {
    console.error('content-job :', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

router.get('/publish-due', publishDue);
router.post('/publish-due', publishDue);
router.get('/content-job', contentJob);

export default router;
