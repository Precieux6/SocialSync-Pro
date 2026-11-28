// socialsync-pro-backend/src/services/reminders.js
import { resend } from '../config/resend.js';
import { VIDEO_FORMATS } from '../config/formats.js';

const FROM_ADDRESS = process.env.RESEND_FROM || 'SocialSync Pro <onboarding@resend.dev>';
const APP_URL = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
const DAYS_BEFORE = 3;                 // rappels à J-3, J-2, J-1 et le jour J
const LEAD_HOURS = 3;                  // le jour J, rappel à partir de 3 h avant la publication
const DEFAULT_PUBLISH_TIME = '18:00';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (later, earlier) =>
  Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 864e5);

const whenLabel = (n) => (n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`);

const dateFr = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

// Minutes écoulées depuis minuit, à Paris
const parisMinutes = () => {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const v = (t) => Number(parts.find((p) => p.type === t).value);
  return v('hour') * 60 + v('minute');
};

// "18:00:00" ou "18:00" -> minutes depuis minuit
const toMinutes = (t) => {
  const [h, m] = String(t || DEFAULT_PUBLISH_TIME).slice(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
};

const emailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY) && process.env.RESEND_API_KEY !== 'votre_cle_resend';

// Envoie au seul propriétaire de l'espace un e-mail listant les vidéos à tourner.
// Un e-mail par espace et par jour. Le rappel d'une publication s'arrête dès que sa vidéo est déposée.
export async function sendVideoReminders({ admin, ownerId, today }) {
  if (!APP_URL) return { skipped: 'APP_URL absente' };
  if (!emailConfigured()) return { skipped: 'Resend non configuré' };

  // 1. Publications de CET espace uniquement (le client admin ignore le RLS : filtrer explicitement)
  const { data: posts, error } = await admin
    .from('editorial_posts')
    .select('id, post_date, format, brief, publish_time, reminders_sent, last_reminder_on')
    .eq('owner_id', ownerId)
    .in('format', VIDEO_FORMATS)
    .neq('status', 'publie')
    .is('video_url', null)
    .gte('post_date', today)
    .lte('post_date', addDays(today, DAYS_BEFORE))
    .order('post_date', { ascending: true });
  if (error) throw new Error(error.message);

  const nowMin = parisMinutes();
  const due = (posts || []).filter((p) => {
    if (p.last_reminder_on === today) return false;
    const n = daysBetween(p.post_date, today);
    if (n === 0) return nowMin >= toMinutes(p.publish_time) - LEAD_HOURS * 60;
    return true;
  });
  if (!due.length) return { sent: 0 };

  // 2. Destinataire : le propriétaire de cet espace, et lui seul
  const { data: owner, error: oErr } = await admin
    .from('team_member')
    .select('email, name')
    .eq('id', ownerId)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!owner?.email) return { skipped: 'e-mail du propriétaire introuvable' };

  // 3. Verrou : on marque d'abord les publications. Une exécution concurrente
  //    ne peut plus les réclamer, donc aucun doublon d'envoi.
  const { data: locked, error: lErr } = await admin
    .from('editorial_posts')
    .update({ last_reminder_on: today })
    .in('id', due.map((p) => p.id))
    .eq('owner_id', ownerId)
    .or(`last_reminder_on.is.null,last_reminder_on.neq.${today}`)
    .select('id');
  if (lErr) throw new Error(lErr.message);

  const lockedIds = new Set((locked || []).map((r) => r.id));
  const toSend = due.filter((p) => lockedIds.has(p.id));
  if (!toSend.length) return { sent: 0 };

  const items = toSend.map((p) => {
    const n = daysBetween(p.post_date, today);
    const brief = String(p.brief || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const hour = String(p.publish_time || DEFAULT_PUBLISH_TIME).slice(0, 5);
    return `<li><strong>${esc(p.format)}</strong> : ${esc(dateFr(p.post_date))} à ${esc(hour)} (${esc(whenLabel(n))})${brief ? `<br>${esc(brief)}` : ''}</li>`;
  }).join('');

  const html = `<p>Bonjour ${esc(owner.name || '')},</p>
    <p>Ces vidéos sont à tourner :</p>
    <ul>${items}</ul>
    <p>Déposez la vidéo dans « À tourner » ou dans le calendrier éditorial : ce rappel s'arrêtera pour cette publication.</p>
    <p><a href="${esc(APP_URL)}">Ouvrir SocialSync Pro</a></p>`;

  // 4. Envoi. En cas d'échec, on libère le verrou pour qu'un prochain passage réessaie.
  try {
    const { error: sErr } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: owner.email,
      subject: `${toSend.length} vidéo(s) à tourner`,
      html,
    });
    if (sErr) throw new Error(`Resend a refusé l'envoi : ${sErr.message}`);
  } catch (err) {
    for (const p of toSend) {
      const { error: rbErr } = await admin
        .from('editorial_posts')
        .update({ last_reminder_on: p.last_reminder_on ?? null })
        .eq('id', p.id)
        .eq('owner_id', ownerId);
      if (rbErr) console.error('reminders : verrou non libéré', p.id, rbErr.message);
    }
    throw err;
  }

  // 5. Compteur d'envois (le verrou est déjà posé, un échec ici n'entraîne pas de doublon)
  for (const p of toSend) {
    const { error: cErr } = await admin
      .from('editorial_posts')
      .update({ reminders_sent: (p.reminders_sent || 0) + 1 })
      .eq('id', p.id)
      .eq('owner_id', ownerId);
    if (cErr) console.error('reminders : compteur non mis à jour', p.id, cErr.message);
  }

  return { sent: toSend.length };
}
