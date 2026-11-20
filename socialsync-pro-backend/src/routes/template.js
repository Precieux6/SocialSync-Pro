// socialsync-pro-backend/src/routes/template.js
import express from 'express';
import { requireRole } from '../middleware/auth.js';
import { decryptSecret } from '../utils/crypto.js';
import { FORMATS } from '../config/formats.js';
import {
  DAY_LABELS,
  loadTemplate,
  normalizeSlots,
  saveTemplateDays,
  syncFutureFromTemplate,
} from '../services/weeklyTemplate.js';
import { runContentAutomation } from '../services/contentPlanner.js';

const router = express.Router();
const WRITE = requireRole('Propriétaire', 'Éditeur', 'Community Manager');
const MANUAL_BUDGET_MS = 240_000;

const todayIso = () => new Date().toISOString().slice(0, 10);

// Clé Claude et calendrier de référence de l'espace actif, via les fonctions SQL
async function loadAiConfig(req) {
  const { data: encrypted, error: kErr } = await req.db.rpc('get_space_ai_key', { p_owner: req.ownerId });
  if (kErr) return { error: 'Accès à la configuration IA refusé.' };

  const apiKey = decryptSecret(encrypted);
  if (!apiKey) return { error: 'Aucune clé Claude valide pour cet espace.' };

  const { data: ref, error: rErr } = await req.db.rpc('get_space_reference_calendar', { p_owner: req.ownerId });
  if (rErr) return { error: 'Lecture du calendrier de référence refusée.' };

  const reference = ref?.content ? String(ref.content).slice(0, 100000) : null;
  if (!reference) return { error: 'Importez le calendrier de référence pour lancer la rédaction.' };

  return { apiKey, reference };
}

function serialize(template) {
  return {
    isDefault: template.isDefault,
    formats: FORMATS,
    days: template.days.map((slots, i) => ({
      day_index: i,
      label: DAY_LABELS[i],
      slots,
    })),
  };
}

// GET /api/template : modèle hebdomadaire de l'espace actif
router.get('/', async (req, res) => {
  try {
    const template = await loadTemplate(req.db, req.ownerId);
    res.json({ success: true, ...serialize(template) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/template : enregistre les créneaux pour un ou plusieurs jours,
// synchronise les publications futures non rédigées, puis relance la rédaction.
// Corps : { days: [0, 2, 3], slots: [ { format, publish_time, brief, ... } ] }
router.put('/', WRITE, async (req, res) => {
  const rawDays = req.body?.days;
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    return res.status(400).json({ success: false, error: 'Choisissez au moins un jour.' });
  }

  const days = [...new Set(rawDays.map(Number))].sort((a, b) => a - b);
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return res.status(400).json({ success: false, error: 'Jour invalide.' });
  }

  let slots;
  try {
    slots = normalizeSlots(req.body?.slots);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  try {
    await saveTemplateDays(req.db, req.ownerId, days, slots);
    const sync = await syncFutureFromTemplate(req.db, req.ownerId, days, todayIso());

    let generation;
    const cfg = await loadAiConfig(req);
    if (cfg.error) {
      generation = { skipped: cfg.error };
    } else {
      try {
        generation = await runContentAutomation({
          db: req.db,
          ownerId: req.ownerId,
          apiKey: cfg.apiKey,
          reference: cfg.reference,
          budgetMs: MANUAL_BUDGET_MS,
        });
      } catch (err) {
        generation = { error: err.message };
      }
    }

    const template = await loadTemplate(req.db, req.ownerId);
    res.json({ success: true, days, sync, generation, ...serialize(template) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
