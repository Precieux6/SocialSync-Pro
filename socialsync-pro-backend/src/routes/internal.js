// socialsync-pro-backend/src/routes/internal.js
import express from 'express';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.js';
import { decryptSecret } from '../utils/crypto.js';
import { publishInstagram } from '../services/publishers/instagram.js';
import { runContentAutomation, parisToday } from '../services/contentPlanner.js';
import { sendVideoReminders } from '../services/reminders.js';

const router = express.Router();

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;
const CONTENT_BUDGET_MS = 50_000;
const SCRIPTS_BUDGET_MS = 50_000;   // route dédiée aux scripts longs (maxDuration à prévoir)
const STUCK_AFTER_MS = 15 * 60_000;

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
// Les appels manuels peuvent utiliser l'en-tête X-Cron-Secret.
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

// Enregistre le succès ; réessaie car le post est déjà sur le réseau
async function markPublished(admin, id, externalId, warning) {
  for (let i = 0; i < 3; i += 1) {
    const { error } = await admin
      .from('editorial_posts')
      .update({
        status: 'publie',
        external_id: externalId ?? null,
        last_error: warning ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (!error) return true;
    console.error(`publish-due : statut « publié » non enregistré (essai ${i + 1}) :`, id, error.message);
  }
  return false;
}

// Posts restés « en_cours » après un arrêt brutal. On ne les republie jamais
// automatiquement : ils passent en échec pour vérification manuelle.
async function recoverStuckPosts(admin, nowIso) {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { error } = await admin
    .from('editorial_posts')
    .update({
      status: 'echec',
      last_error: 'Publication interrompue : vérifiez sur le réseau avant de reprogrammer.',
      updated_at: nowIso,
    })
    .eq('status', 'en_cours')
    .lt('updated_at', cutoff);
  if (error) console.error('publish-due : récupération des posts bloqués :', error.message);
}

// GET|POST /api/internal/publish-due
async function publishDue(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ success: false, error: 'Non autorisé.' });

  try {
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    await recoverStuckPosts(admin, nowIso);

    const { data: due, error: dErr } = await admin
      .from('editorial_posts')
      .select('id, owner_id, platform, format, caption, tags, first_comment, media_urls, video_url, publish_attempts')
      .eq('status', 'programme')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (dErr) throw new Error(dErr.message);

    const credsByOwner = new Map();
    const results = { claimed: 0, published: 0, failed: 0, skipped: 0, unconfirmed: 0 };

    for (const post of due || []) {
      // Verrou atomique : une seule exécution peut passer le post à « en_cours »
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
      if (cErr) {
        // Une erreur sur un post n'arrête pas le lot
        console.error('publish-due : verrou impossible', post.id, cErr.message);
        results.failed += 1;
        continue;
      }
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

        const saved = await markPublished(admin, post.id, externalId, warning);
        if (!saved) results.unconfirmed += 1;
        results.published += 1;
      } catch (err) {
        const attempts = (post.publish_attempts || 0) + 1;
        // Si la publication a peut-être abouti côté réseau, on ne relance jamais automatiquement
        const nextStatus = err.ambiguous || attempts >= MAX_ATTEMPTS ? 'echec' : 'programme';
        const detail = err.creationId
          ? `${String(err.message).slice(0, 400)} [conteneur ${err.creationId}]`
          : String(err.message).slice(0, 500);
        const { error: fErr } = await admin
          .from('editorial_posts')
          .update({ status: nextStatus, last_error: detail, updated_at: new Date().toISOString() })
          .eq('id', post.id);
        if (fErr) console.error('publish-due : échec non enregistré', post.id, fErr.message);
        results.failed += 1;
      }
    }

    res.json({ success: true, at: nowIso, ...results });
  } catch (err) {
    console.error('publish-due :', err);
    res.status(500).json({ success: false, error: 'Erreur interne du job.' });
  }
}

// GET|POST /api/internal/content-job : rédaction automatique (légendes, prompts, formats courts)
async function contentJob(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ success: false, error: 'Non autorisé.' });

  try {
    const admin = getSupabaseAdmin();
    const t0 = Date.now();
    const today = parisToday();

    const { data: spaces, error } = await admin
      .from('owner_settings')
      .select('owner_id, claude_key_encrypted, reference_calendar')
      .not('claude_key_encrypted', 'is', null)
      .eq('auto_generate', true)
      .range(0, 4999);
    if (error) throw new Error(error.message);

    const summary = { spaces: 0, generated: 0, skipped: 0, errors: 0, budgetReached: false };

    for (const s of spaces || []) {
      if (Date.now() - t0 > CONTENT_BUDGET_MS) {
        summary.budgetReached = true;
        break;
      }
      summary.spaces += 1;

      const reference = s.reference_calendar?.content
        ? String(s.reference_calendar.content).slice(0, 100000)
        : null;
      if (!reference) {
        summary.skipped += 1;
        continue;
      }

      try {
        const apiKey = decryptSecret(s.claude_key_encrypted);
        if (!apiKey) throw new Error('clé illisible');
        await runContentAutomation({
          db: admin,
          ownerId: s.owner_id,
          apiKey,
          reference,
          today,
          budgetMs: CONTENT_BUDGET_MS - (Date.now() - t0),
          skipScripts: true,
        });
        summary.generated += 1;
      } catch (err) {
        console.error('content-job : espace', s.owner_id, ':', err.message);
        summary.errors += 1;
      }
    }

    res.json({ success: true, today, ...summary });
  } catch (err) {
    console.error('content-job :', err);
    res.status(500).json({ success: false, error: 'Erreur interne du job.' });
  }
}

// GET|POST /api/internal/scripts-job : scripts longs, partie par partie (durée maximale plus élevée)
async function scriptsJob(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ success: false, error: 'Non autorisé.' });

  try {
    const admin = getSupabaseAdmin();
    const t0 = Date.now();
    const today = parisToday();

    const { data: spaces, error } = await admin
      .from('owner_settings')
      .select('owner_id, claude_key_encrypted, reference_calendar')
      .not('claude_key_encrypted', 'is', null)
      .eq('auto_generate', true)
      .range(0, 4999);
    if (error) throw new Error(error.message);

    const summary = { spaces: 0, generated: 0, skipped: 0, errors: 0, budgetReached: false };

    for (const s of spaces || []) {
      if (Date.now() - t0 > SCRIPTS_BUDGET_MS) {
        summary.budgetReached = true;
        break;
      }
      summary.spaces += 1;

      const reference = s.reference_calendar?.content
        ? String(s.reference_calendar.content).slice(0, 100000)
        : null;
      if (!reference) {
        summary.skipped += 1;
        continue;
      }

      try {
        const apiKey = decryptSecret(s.claude_key_encrypted);
        if (!apiKey) throw new Error('clé illisible');
        await runContentAutomation({
          db: admin,
          ownerId: s.owner_id,
          apiKey,
          reference,
          today,
          budgetMs: SCRIPTS_BUDGET_MS - (Date.now() - t0),
          scriptsOnly: true,
        });
        summary.generated += 1;
      } catch (err) {
        console.error('scripts-job : espace', s.owner_id, ':', err.message);
        summary.errors += 1;
      }
    }

    res.json({ success: true, today, ...summary });
  } catch (err) {
    console.error('scripts-job :', err);
    res.status(500).json({ success: false, error: 'Erreur interne du job.' });
  }
}

// GET|POST /api/internal/reminders : rappels de tournage, un espace à la fois
async function remindersJob(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ success: false, error: 'Non autorisé.' });

  try {
    const admin = getSupabaseAdmin();
    const today = parisToday();

    const { data: owners, error } = await admin
      .from('owner_settings')
      .select('owner_id')
      .range(0, 4999);
    if (error) throw new Error(error.message);

    const summary = { spaces: 0, sent: 0, errors: 0 };

    for (const o of owners || []) {
      summary.spaces += 1;
      try {
        const r = await sendVideoReminders({ admin, ownerId: o.owner_id, today });
        summary.sent += r.sent || 0;
      } catch (err) {
        // Un espace en erreur n'empêche pas les autres ; le détail reste dans les journaux
        console.error('reminders : espace', o.owner_id, ':', err.message);
        summary.errors += 1;
      }
    }

    res.json({ success: true, today, ...summary });
  } catch (err) {
    console.error('reminders :', err);
    res.status(500).json({ success: false, error: 'Erreur interne du job.' });
  }
}

router.get('/publish-due', publishDue);
router.post('/publish-due', publishDue);
router.get('/content-job', contentJob);
router.post('/content-job', contentJob);
router.get('/scripts-job', scriptsJob);
router.post('/scripts-job', scriptsJob);
router.get('/reminders', remindersJob);
router.post('/reminders', remindersJob);

export default router;
