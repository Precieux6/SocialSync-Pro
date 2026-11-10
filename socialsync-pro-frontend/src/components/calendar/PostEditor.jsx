// socialsync-pro-frontend/src/components/Calendar/PostEditor.jsx
import React, { useState } from 'react';
import { api } from '../../services/api';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
];

const SUGGESTED_TAGS = ['@followers', '@everyone'];
const MAX_TAGS = 30;

const toForm = (post) => ({
  brief: post.brief || '',
  caption: post.caption || '',
  image_prompt: post.image_prompt || '',
  tags: post.tags || [],
  first_comment: post.first_comment || '',
});

// Date/heure locale par défaut pour le champ datetime-local : maintenant + 1 h
const defaultLocalDateTime = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function PostEditor({ post, themeTitle, onUpdated, onClose, notify }) {
  const [form, setForm] = useState(toForm(post));
  const [platform, setPlatform] = useState(post.platform || 'instagram');
  const [tagInput, setTagInput] = useState('');
  const [scheduleAt, setScheduleAt] = useState(defaultLocalDateTime());
  const [busy, setBusy] = useState(false);

  const readOnly = post.status === 'publie';

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const addTag = (raw) => {
    const tag = String(raw).trim();
    if (!tag || form.tags.includes(tag) || form.tags.length >= MAX_TAGS) return;
    set('tags', [...form.tags, tag]);
  };

  const removeTag = (tag) => set('tags', form.tags.filter((t) => t !== tag));

  // Enregistre le contenu et renvoie la publication mise à jour
  const save = async () => {
    const r = await api.calendar.updatePost(post.id, form);
    onUpdated(r.post);
    return r.post;
  };

  const withBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onSave = () =>
    withBusy(async () => {
      await save();
      notify('Publication enregistrée.');
    });

  const onGenerateCaption = () =>
    withBusy(async () => {
      const r = await api.ai.caption(form.brief.trim() || post.format, themeTitle, platform);
      set('caption', r.caption || '');
      notify('Légende générée. Pensez à l\'enregistrer.');
    });

  const onGeneratePrompt = () =>
    withBusy(async () => {
      const r = await api.ai.prompt(themeTitle, platform);
      set('image_prompt', r.prompt || '');
    });

  const onCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(form.image_prompt);
      notify('Prompt copié.');
    } catch {
      notify('Copie impossible dans ce navigateur.');
    }
  };

  const onSchedule = () =>
    withBusy(async () => {
      await save();
      const r = await api.calendar.schedule(post.id, new Date(scheduleAt).toISOString());
      onUpdated(r.post);
      notify('Publication programmée.');
    });

  const onPublishNow = () => {
    if (!window.confirm('Publier maintenant ? La publication sera envoyée dès que le worker de publication sera actif.')) return;
    withBusy(async () => {
      await save();
      const r = await api.calendar.publishNow(post.id);
      onUpdated(r.post);
      notify(r.message || 'Publication enregistrée.');
    });
  };

  const onCancelSchedule = () =>
    withBusy(async () => {
      const r = await api.calendar.cancelSchedule(post.id);
      onUpdated(r.post);
      notify('Programmation annulée.');
    });

  const inputClass =
    'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500 leading-relaxed disabled:opacity-60';

  return (
    <div className="bg-[#FAF7F2] border-2 border-gold-400 rounded-3xl p-6 space-y-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#E2D5C3] pb-4">
        <div>
          <span className="text-xs font-bold text-gold-700 uppercase tracking-widest">Publication</span>
          <h3 className="font-serif font-bold text-xl text-stone-900">
            {post.format} · {post.post_date}
          </h3>
          <p className="text-xs text-stone-500">Thème : {themeTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={platform}
            disabled={readOnly}
            onChange={(e) => setPlatform(e.target.value)}
            className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2.5 text-xs font-bold text-stone-800 focus:outline-none disabled:opacity-60"
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button onClick={onClose} className="text-xs font-bold text-stone-600 hover:text-stone-900 px-3 py-2">
            Fermer
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Brief</label>
        <textarea
          rows={3}
          value={form.brief}
          disabled={readOnly}
          maxLength={5000}
          onChange={(e) => set('brief', e.target.value)}
          placeholder="Intention du post, angle, points clés à aborder."
          className={inputClass}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Légende à publier</label>
          <button
            onClick={onGenerateCaption}
            disabled={busy || readOnly}
            className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow disabled:opacity-50"
          >
            Générer avec Claude
          </button>
        </div>
        <textarea
          rows={6}
          value={form.caption}
          disabled={readOnly}
          maxLength={2200}
          onChange={(e) => set('caption', e.target.value)}
          className={inputClass}
        />
        <span className="text-[10px] text-stone-500">{form.caption.length} / 2200 caractères</span>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Prompt image</label>
          <div className="flex gap-2">
            <button
              onClick={onGeneratePrompt}
              disabled={busy || readOnly}
              className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#E8DFC9] disabled:opacity-50"
            >
              Suggérer
            </button>
            <button
              onClick={onCopyPrompt}
              disabled={!form.image_prompt}
              className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#E8DFC9] disabled:opacity-50"
            >
              Copier
            </button>
          </div>
        </div>
        <textarea
          rows={3}
          value={form.image_prompt}
          disabled={readOnly}
          maxLength={1000}
          onChange={(e) => set('image_prompt', e.target.value)}
          className={`${inputClass} font-mono`}
        />
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
          Tags ({form.tags.length} / {MAX_TAGS})
        </label>
        <div className="flex flex-wrap gap-2">
          {form.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              {tag}
              {!readOnly && (
                <button onClick={() => removeTag(tag)} className="text-amber-700 hover:text-red-600" aria-label={`Retirer ${tag}`}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => addTag(t)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F4EFE6] border border-[#E2D5C3] text-stone-700 hover:bg-[#E8DFC9]"
                >
                  + {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(tagInput);
                  setTagInput('');
                }
              }}
              placeholder="Ajouter un tag puis Entrée (lettres, chiffres, _ . -)"
              className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2.5 text-xs text-stone-900 focus:outline-none focus:border-gold-500"
            />
          </>
        )}
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
          Commentaire publié sous le post (au moment de la publication)
        </label>
        <textarea
          rows={2}
          value={form.first_comment}
          disabled={readOnly}
          maxLength={2200}
          onChange={(e) => set('first_comment', e.target.value)}
          placeholder="Ex. : Dites-moi en commentaire si ce sujet résonne avec vous ✨"
          className={inputClass}
        />
        <span className="text-[10px] text-stone-500">
          Sur TikTok, ce commentaire devra être publié à la main : l'API ne le permet pas.
        </span>
      </section>

      {!readOnly && (
        <section className="border-t border-[#E2D5C3] pt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Date de programmation</label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2.5 text-xs font-bold text-stone-800 focus:outline-none"
            />
            {post.status === 'programme' && post.scheduled_at && (
              <p className="text-[11px] text-amber-800">
                Programmé le {new Date(post.scheduled_at).toLocaleString('fr-FR')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={onSave}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold hover:bg-[#E8DFC9] disabled:opacity-50"
            >
              Enregistrer
            </button>
            {post.status === 'programme' ? (
              <button
                onClick={onCancelSchedule}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 disabled:opacity-50"
              >
                Annuler la programmation
              </button>
            ) : (
              <>
                <button
                  onClick={onPublishNow}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow disabled:opacity-50"
                >
                  Publier maintenant
                </button>
                <button
                  onClick={onSchedule}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow disabled:opacity-50"
                >
                  Programmer
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
