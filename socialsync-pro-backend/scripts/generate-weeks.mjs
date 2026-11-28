// socialsync-pro-backend/scripts/generate-weeks.mjs
// Rédaction des semaines mises en file, exécutée par GitHub Actions (sans limite de 60 s).
import { createClient } from '@supabase/supabase-js';
import { decryptSecret } from '../src/utils/crypto.js';
import { runWeekStep } from '../src/services/contentPlanner.js';

const STEP_BUDGET_MS = 5 * 60_000;    // une étape peut durer jusqu'à 5 min
const JOB_BUDGET_MS = 50 * 60_000;    // arrêt propre avant la limite de 55 min du job
const MAX_REF_CHARS = 100_000;        // contexte inchangé
const startedAt = Date.now();
const timeLeft = () => JOB_BUDGET_MS - (Date.now() - startedAt);

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.');

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// Clé Claude (déchiffrée) et calendrier de référence du propriétaire
async function loadConfig(ownerId) {
  const { data, error } = await db
    .from('owner_settings')
    .select('claude_key_encrypted, reference_calendar')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(`lecture des réglages : ${error.message}`);

  const apiKey = decryptSecret(data?.claude_key_encrypted);
  if (!apiKey) throw new Error('clé Claude absente ou illisible (ENCRYPTION_KEY différent ?)');

  const reference = data?.reference_calendar?.content
    ? String(data.reference_calendar.content).slice(0, MAX_REF_CHARS)
    : null;
  if (!reference) throw new Error('calendrier de référence absent');

  return { apiKey, reference };
}

async function main() {
  const { data: rows, error } = await db
    .from('weeks_themes')
    .select('owner_id, week_start, gen_requested_at, gen_done_at')
    .not('gen_requested_at', 'is', null)
    .order('gen_requested_at', { ascending: true });
  if (error) throw new Error(`lecture de la file : ${error.message}`);

  const pending = (rows || []).filter(
    (r) => !r.gen_done_at || new Date(r.gen_done_at) < new Date(r.gen_requested_at)
  );
  console.log(`Semaines en file : ${pending.length}`);

  const summary = { pending: pending.length, steps: 0, weeksDone: 0, errors: 0 };
  const configs = new Map();

  for (const job of pending) {
    if (timeLeft() < STEP_BUDGET_MS) {
      console.log('Temps du job épuisé : reprise à la prochaine exécution.');
      break;
    }

    try {
      if (!configs.has(job.owner_id)) configs.set(job.owner_id, await loadConfig(job.owner_id));
      const cfg = configs.get(job.owner_id);

      let done = false;
      while (!done) {
        if (timeLeft() < STEP_BUDGET_MS) break;

        const r = await runWeekStep({
          db,
          ownerId: job.owner_id,
          apiKey: cfg.apiKey,
          reference: cfg.reference,
          weekStart: job.week_start,
          budgetMs: STEP_BUDGET_MS,
        });
        summary.steps += 1;
        console.log(`${job.week_start} : ${r.kind ?? 'terminé'} · ${r.generated ?? 0} élément(s)`);
        if (r.done) done = true;
      }

      if (done) {
        const { error: dErr } = await db
          .from('weeks_themes')
          .update({ gen_done_at: new Date().toISOString() })
          .eq('owner_id', job.owner_id)
          .eq('week_start', job.week_start);
        if (dErr) throw new Error(`marquage terminé : ${dErr.message}`);
        summary.weeksDone += 1;
        console.log(`${job.week_start} : semaine terminée`);
      }
    } catch (err) {
      summary.errors += 1;
      console.error(`${job.week_start} : ${err.message}`);
    }
  }

  console.log(JSON.stringify(summary));
  if (summary.errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
