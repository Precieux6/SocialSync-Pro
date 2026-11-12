// socialsync-pro-frontend/src/components/calendar/PostEditor.jsx
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
  thumbnail_prompt: post.thumbnail_prompt || '',
  script: post.script || '',
  slides: post.slides || [''],
  tags: post.tags || [],
  first_comment: post.first_comment || '',
});

// Valeur « AAAA-MM-JJTHH:mm » d'un instant dans le fuseau donné
const toLocalInputValue = (date, tz) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const v = (type) => parts.find((p) => p.type === type).value;
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
};

export default function PostEditor({
  post,
  themeTitle,
  ownerTimezone,
  onUpdated,
  onDeleted,
  onClose,
  notify,
}) {
  const [form, setForm] = useState(toForm(post));
  const [platform, setPlatform] = useState(post.platform || 'instagram');
  const [tagInput, setTagInput] = useState('');
  const [scheduleAt, setScheduleAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000), ownerTimezone || 'Europe/Paris')
  );
  const [busy, setBusy] = useState(false);

  const readOnly = post.status === 'publie';
  const canDelete = post.is_adhoc && !readOnly;
  const isVideo = ['Vidéo courte', 'Séance YouTube', 'Live'].includes(post.format);
  const isCarrousel = post.format === 'Carrousel';

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const addTag = (raw) => {
    const tag = String(raw).trim();
    if (!tag || form.tags.includes(tag) || form.tags.length >= MAX_TAGS) return;
    set('tags', [...form.tags, tag]);
  };

  const removeTag = (tag) => set('tags', form.tags.filter((t) => t !== tag));

  // Gestion des slides pour le carrousel
  const addSlide = () => set('slides', [...form.slides, '']);
  const updateSlide = (index, value) => {
    const newSlides = [...form.slides];
    newSlides[index] = value;
    set('slides', newSlides);
  };
  const removeSlide = (index) => {
    set('slides', form.slides.filter((_, i) => i !== index));
  };

  // Téléchargement du script au format texte brut simulant Word/PDF
  const downloadScript = (format) => {
    const content = `TITRE DU POST : ${post.format} (${post.post_date})\nTHÈME : ${themeTitle}\n\nSCRIPT :\n${form.script || 'Aucun script rédigé.'}`;
    const blob = new Blob([content], { type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-post-${post.id}.${format === 'pdf' ? 'pdf' : 'docx'}`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Script téléchargé au format ${format.toUpperCase()}`);
  };

  const save = async () => {
    const r = await api.calendar.updatePost(post.id, { ...form, platform });
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
      notify("Légende générée.");
    });

  const onGeneratePrompt = () =>
    withBusy(async () => {
      const r = await api.ai.prompt(themeTitle, platform);
      if (isVideo) {
        set('thumbnail_prompt', r.prompt || '');
      } else {
        set('image_prompt', r.prompt || '');
      }
    });

  const onCopyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copié.`);
    } catch {
      notify('Copie impossible.');
    }
  };

  const onSchedule = () =>
    withBusy(async () => {
      await save();
      const r = await api.calendar.schedule(post.id, scheduleAt);
      onUpdated(r.post);
      notify('Publication programmée.');
    });

  const onPublishNow = () => {
    if (!window.confirm('Publier maintenant ?')) return;
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

  const onDelete = () => {
    if (!window.confirm('Supprimer cette publication ?')) return;
    withBusy(async () => {
      await api.calendar.deletePost(post.id);
      notify('Publication supprimée.');
      onDeleted(post.id);
    });
  };

  const inputClass =
    'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500 leading-relaxed disabled:opacity-60';

  return (
    <div className="bg-[#FAF7F2] border-2 border-gold-400 rounded-3xl p-6 space-y-6 shadow-2xl">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#E2D5C3] pb-4">
        <div>
          <span className="text-xs font-bold text-gold-700 uppercase tracking-widest">
            Configuration · {post.format}{post.is_adhoc ? ' (hors plan)' : ''}
          </span>
          <h3 className="font-serif font-bold text-xl text-stone-900 mt-1">
            {post.format} · {post.post_date}
          </h3>
          <p className="text-xs text-stone-500">Thème : {themeTitle}</p>
        </div>
        <button onClick={onClose} className="text-xs font-bold text-stone-600 hover:text-stone-900 px-4 py-2 bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl">
          Fermer ✕
        </button>
      </div>

      {/* Alignement horizontal des 4 réseaux sociaux (Onglets) */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Réseau social cible</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                platform === p.id
                  ? 'bg-stone-900 text-amber-200 border-stone-900 shadow'
                  : 'bg-[#F4EFE6] text-stone-700 border-[#E2D5C3] hover:bg-[#E8DFC9]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brief */}
      <section className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Brief éditorial</label>
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

      {/* SECTION CARROUSEL : Slides */}
      {isCarrousel && (
        <section className="space-y-3 p-4 bg-[#F4EFE6]/70 rounded-2xl border border-[#E2D5C3]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800">Gestion des Slides du Carrousel</label>
            {!readOnly && (
              <button onClick={addSlide} type="button" className="px-3 py-1 bg-stone-900 text-amber-200 text-xs font-bold rounded-lg">
                + Ajouter un slide
              </button>
            )}
          </div>
          {form.slides.map((slideText, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs font-bold text-stone-500 w-16">Slide {idx + 1}</span>
              <input
                type="text"
                value={slideText}
                disabled={readOnly}
                onChange={(e) => updateSlide(idx, e.target.value)}
                placeholder={`Contenu du slide ${idx + 1}...`}
                className={inputClass}
              />
              {!readOnly && form.slides.length > 1 && (
                <button onClick={() => removeSlide(idx)} type="button" className="text-red-600 font-bold px-2 hover:bg-red-50 rounded">
                  ✕
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* SECTION VIDÉOS : Script & Téléchargement Word / PDF */}
      {isVideo && (
        <section className="space-y-3 p-4 bg-[#F4EFE6]/70 rounded-2xl border border-[#E2D5C3]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800">Script de la vidéo (À lire)</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadScript('pdf')}
                className="px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-xl shadow hover:bg-red-800"
              >
                📥 Télécharger PDF
              </button>
              <button
                type="button"
                onClick={() => downloadScript('docx')}
                className="px-3 py-1.5 bg-blue-700 text-white text-xs font-bold rounded-xl shadow hover:bg-blue-800"
              >
                📥 Télécharger Word
              </button>
            </div>
          </div>
          <textarea
            rows={5}
            value={form.script}
            disabled={readOnly}
            onChange={(e) => set('script', e.target.value)}
            placeholder="Rédigez ou générez le script complet de la vidéo ici..."
            className={inputClass}
          />
        </section>
      )}

      {/* Légende */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Légende à publier</label>
          <button
            onClick={onGenerateCaption}
            disabled={busy || readOnly}
            type="button"
            className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow disabled:opacity-50"
          >
            Générer avec Claude 🤖
          </button>
        </div>
        <textarea
          rows={5}
          value={form.caption}
          disabled={readOnly}
          maxLength={2200}
          onChange={(e) => set('caption', e.target.value)}
          className={inputClass}
        />
        <span className="text-[10px] text-stone-500">{form.caption.length} / 2200 caractères</span>
      </section>

      {/* Prompt Image ou Miniature */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
            {isVideo ? 'Prompt Miniature' : 'Prompt Image'}
          </label>
          <div className="flex gap-2">
            <button
              onClick={onGeneratePrompt}
              disabled={busy || readOnly}
              type="button"
              className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#E8DFC9] disabled:opacity-50"
            >
              Suggérer 💡
            </button>
            <button
              onClick={() => onCopyText(isVideo ? form.thumbnail_prompt : form.image_prompt, isVideo ? 'Prompt miniature' : 'Prompt image')}
              disabled={!(isVideo ? form.thumbnail_prompt : form.image_prompt)}
              type="button"
              className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#E8DFC9] disabled:opacity-50"
            >
              Copier
            </button>
          </div>
        </div>
        <textarea
          rows={3}
          value={isVideo ? form.thumbnail_prompt : form.image_prompt}
          disabled={readOnly}
          maxLength={1000}
          onChange={(e) => set(isVideo ? 'thumbnail_prompt' : 'image_prompt', e.target.value)}
          placeholder={isVideo ? "Description détaillée pour la miniature..." : "Description visuelle pour l'image..."}
          className={`${inputClass} font-mono`}
        />
      </section>

      {/* Tags */}
      <section className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
          Tags ({form.tags.length} / {MAX_TAGS})
        </label>
        <div className="flex flex-wrap gap-2">
          {form.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              {tag}
              {!readOnly && (
                <button onClick={() => removeTag(tag)} type="button" className="text-amber-700 hover:text-red-600">×</button>
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
                  type="button"
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
              placeholder="Ajouter un tag puis Entrée..."
              className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2.5 text-xs text-stone-900 focus:outline-none focus:border-gold-500"
            />
          </>
        )}
      </section>

      {/* Premier commentaire */}
      <section className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
          Premier commentaire sous le post
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
      </section>

      {/* SECTION DU BAS PARFAITEMENT ALIGNÉE SUR UNE SEULE LIGNE */}
      {!readOnly && (
        <section className="border-t border-[#E2D5C3] pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-600">
              Programmation ({ownerTimezone || 'Europe/Paris'})
            </label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2 text-xs font-bold text-stone-800 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canDelete && (
              <button onClick={onDelete} disabled={busy} type="button" className="px-4 py-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                Supprimer
              </button>
            )}
            <button onClick={onSave} disabled={busy} type="button" className="px-4 py-2.5 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold hover:bg-[#E8DFC9]">
              Enregistrer
            </button>
            {post.status === 'programme' ? (
              <button onClick={onCancelSchedule} disabled={busy} type="button" className="px-4 py-2.5 rounded-xl bg-red-100 text-red-700 text-xs font-bold">
                Annuler
              </button>
            ) : (
              <>
                <button onClick={onPublishNow} disabled={busy} type="button" className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow hover:bg-emerald-800">
                  Publier
                </button>
                <button onClick={onSchedule} disabled={busy} type="button" className="px-4 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow hover:bg-stone-800">
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
