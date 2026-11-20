// socialsync-pro-backend/src/services/reminders.js
import { resend } from '../config/resend.js';
import { addDays } from './calendarBlocks.js';

const FROM_ADDRESS = process.env.RESEND_FROM || 'SocialSync Pro <onboarding@resend.dev>';
const APP_URL = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
const VIDEO_FORMATS = ['Vidéo courte', 'Séance YouTube', 'Live'];
const DAYS_BEFORE = 3;   // rappels à J-3, J-2, J-1 et le jour J
const LEAD_HOURS = 3;    // le jour J, rappel à partir de 3 h avant l'heure de publication

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

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

// "18:00:00" ou "18:00" -> minutes
const toMinutes = (t) => {
  const [h, m] = String(t || '18:00').split(':').map(Number);
  return h * 60 + m;
};

// Envoie au propriétaire un e-mail listant les vidéos à tourner.
// Un seul e-mail par jour ; le rappel s'arrête dès qu'une vidéo est déposée (video_url renseigné).
export async function sendVideoReminders({ admin, ownerId, today }) {
  if (!APP_URL) return { skipped: 'APP_URL absente' };

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
    // Le jour J, on attend la fenêtre de LEAD_HOURS avant l'heure de publication
    if (n === 0) return nowMin >= toMinutes(p.publish_time) - LEAD_HOURS * 60;
    return true;
  });
  if (!due.length) return { sent: 0 };

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'votre_cle_resend') {
    return { skipped: 'Resend non configuré' };
  }

  const { data: owner } = await admin
    .from('team_member')
    .select('email, name')
    .eq('id', ownerId)
    .maybeSingle();
  if (!owner?.email) return { skipped: 'e-mail du propriétaire introuvable' };

  const items = due.map((p) => {
    const n = daysBetween(p.post_date, today);
    const brief = String(p.brief || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const hour = String(p.publish_time || '18:00').slice(0, 5);
    return `<li><strong>${esc(p.format)}</strong> : ${esc(dateFr(p.post_date))} à ${esc(hour)} (${esc(whenLabel(n))})${brief ? `<br>${esc(brief)}` : ''}</li>`;
  }).join('');

  const html = `<p>Bonjour ${esc(owner.name || '')},</p>
    <p>Ces vidéos sont à tourner :</p>
    <ul>${items}</ul>
    <p>Déposez la vidéo dans « À tourner » ou dans le calendrier éditorial : ce rappel s'arrêtera pour cette publication.</p>
    <p><a href="${esc(APP_URL)}">Ouvrir SocialSync Pro</a></p>`;

  const { error: sErr } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: owner.email,
    subject: `${due.length} vidéo(s) à tourner`,
    html,
  });
  if (sErr) throw new Error(`Resend a refusé l'envoi : ${sErr.message}`);

  for (const p of due) {
    await admin
      .from('editorial_posts')
      .update({ reminders_sent: (p.reminders_sent || 0) + 1, last_reminder_on: today })
      .eq('id', p.id)
      .eq('owner_id', ownerId);
  }
  return { sent: due.length };
}
