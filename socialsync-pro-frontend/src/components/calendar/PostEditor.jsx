// socialsync-pro-frontend/src/components/calendar/PostEditor.jsx
import React, { useState } from 'react';
import { api, uploadFile } from '../../services/api';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
];

const SUGGESTED_TAGS = ['@followers', '@everyone'];
const MAX_TAGS = 30;
const ACCEPTED_IMAGE_TYPES = 'image/png, image/jpeg, image/jpg, image/webp';

const toForm = (post) => ({
  brief: post.brief || '',
  caption: post.caption || '',
  image_prompt: post.image_prompt || '',
  thumbnail_prompt: post.thumbnail_prompt || '',
  script: post.script || '',
  slides: post.slides || [''],
  media_urls: post.media_urls || [],
  video_url: post.video_url || '',
  tags: post.tags || [],
  first_comment: post.first_comment || '',
});

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
  const [uploadingMedia, setUploadingMedia] = useState(false);

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

  // Gestion des slides
  const addSlide = () => set('slides', [...form.slides, '']);
  const updateSlide = (index, value) => {
    const newSlides = [...form.slides];
    newSlides[index] = value;
    set('slides', newSlides);
  };
  const removeSlide = (index) => {
    set('slides', form.slides.filter((_, i) => i !== index));
  };

  // Upload d'images multiples (jusqu'à 10)
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    if (form.media_urls.length + files.length > 10) {
      notify('Vous pouvez téléverser un maximum de 10 fichiers images.');
      return;
    }

    setUploadingMedia(true);
    try {
      const uploadPromises = files.map(async (file, idx) => {
        const path = `posts/${post.id}/media_${Date.now()}_${idx}`;
        return await uploadFile('media', path, file);
      });
      const urls = await Promise.all(uploadPromises);
      set('media_urls', [...form.media_urls, ...urls]);
      notify('Images ajoutées avec succès.');
    } catch (err) {
      notify(err.message || 'Erreur lors du téléversement des images.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (index) => {
    set('media_urls', form.media_urls.filter((_, i) => i !== index));
  };

  // Liaison vidéo depuis l'espace "À tourner" ou upload direct
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const path = `posts/${post.id}/video_${Date.now()}`;
      const url = await uploadFile('videos', path, file);
      set('video_url', url);
      notify('Vidéo synchronisée depuis l\'espace "À tourner".');
    } catch (err) {
      notify(err.message || 'Erreur lors du téléversement de la vidéo.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const downloadScript = (format) => {
    const content = `TITRE DU POST : ${post.format} (${post.post_date})\nTHÈME : ${themeTitle}\n\nSCRIPT :\n${form.script || 'Aucun script rédigé.'}`;
    const blob = new Blob([content], { type: format === 'pdf' ? 'application/pdf' : 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-post-${post.id}.${format}`;
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
      notify('Légende générée.');
    });

  const onCopyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copié.`);
    } catch {
      notify('Copie impossible.');
    }
  };

  const onGeneratePrompt = () =>
    withBusy(async () => {
      const r = await api.ai.prompt(themeTitle, platform);
      if (isVideo) {
        set('thumbnail_prompt', r.prompt || '');
      } else {
        set('image_prompt', r.prompt || '');
      }
    });

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
        <button onClick={onClose} type="button" className="text-xs font-bold text-stone-600 hover:text-stone-900 px-4 py-2 bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl">
          Fermer ✕
        </button>
      </div>

      {/* Onglets horizontaux des réseaux sociaux */}
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

      {/* SECTION TÉLÉVERSEMENT MÉDIAS / FICHIERS */}
      {!isVideo ? (
        <section className="space-y-3 p-4 bg-[#F4EFE6]/70 rounded-2xl border border-[#E2D5C3]">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-800 block">Médias associés (Images)</label>
              <span className="text-[10px] text-stone-500">Formats acceptés : PNG, JPEG, JPG, WEBP (Max 10 fichiers)</span>
            </div>
            {!readOnly && form.media_urls.length < 10 && (
              <label className="px-3 py-1.5 bg-stone-900 text-amber-200 text-xs font-bold rounded-xl cursor-pointer shadow hover:bg-stone-800">
                📁 Ajouter des images
                <input type="file" multiple accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>
          {form.media_urls.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
              {form.media_urls.map((url, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-[#E2D5C3] bg-white h-20">
                  <img src={url} alt={`Media ${idx + 1}`} className="w-full h-full object-cover" />
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-80 hover:opacity-100"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3 p-4 bg-[#F4EFE6]/70 rounded-2xl border border-[#E2D5C3]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-800 block">
                Vidéo associée (Espace « À tourner »)
              </label>
              <span className="text-[10px] text-stone-500">
                {post.format === 'Vidéo courte' ? 'Format vertical 9:16 recommandé' : 'Format horizontal 16:9 recommandé'}
              </span>
            </div>
            {!readOnly && (
              <label className="px-3 py-1.5 bg-stone-900 text-amber-200 text-xs font-bold rounded-xl cursor-pointer shadow hover:bg-stone-800">
                🎬 Sélectionner depuis « À tourner » / Upload
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
            )}
          </div>
          {form.video_url ? (
            <div className="p-3 bg-white rounded-xl border border-[#E2D5C3] flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-800 truncate max-w-xs">📹 {form.video_url.split('/').pop()}</span>
              <a href={form.video_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-gold-700 hover:underline">
                Prévisualiser
              </a>
            </div>
          ) : (
            <p className="text-xs text-stone-400 italic">Aucune vidéo liée pour le moment. Ajoutez-la depuis l'espace de tournage.</p>
          )}
        </section>
      )}

      {/* SECTION SLIDES POUR CARROUSEL */}
      {isCarrousel && (
        <section className="space-y-3 p-4 bg-[#F4EFE6]/70 rounded-2xl border border-[#E2D5C3]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800">Slides du Carrousel</label>
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

      {/* SECTION SCRIPT POUR VIDÉOS */}
      {isVideo && (
        <section className="space-y-3 p-4 bg-[#F4EFE6]/70 rounded-2xl border border-[#E2D5C3]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-800">Script de la vidéo (À lire)</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => downloadScript('pdf')} className="px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-xl shadow hover:bg-red-800">
                📥 PDF
              </button>
              <button type="button" onClick={() => downloadScript('docx')} className="px-3 py-1.5 bg-blue-700 text-white text-xs font-bold rounded-xl shadow hover:bg-blue-800">
                📥 Word
              </button>
            </div>
          </div>
          <textarea
            rows={4}
            value={form.script}
            disabled={readOnly}
            onChange={(e) => set('script', e.target.value)}
            placeholder="Rédigez ou générez le script complet..."
            className={inputClass}
          />
        </section>
      )}

      {/* Légende avec bouton Copier à côté de Générer avec Claude */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Légende à publier</label>
          <div className="flex gap-2">
            <button
              onClick={onGenerateCaption}
              disabled={busy || readOnly}
              type="button"
              className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow disabled:opacity-50"
            >
              Générer avec Claude 🤖
            </button>
            <button
              onClick={() => onCopyText(form.caption, 'Légende')}
              disabled={!form.caption}
              type="button"
              className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#E8DFC9] disabled:opacity-50"
            >
              Copier
            </button>
          </div>
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

      {/* Prompt Image / Miniature */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
            {isVideo ? 'Prompt Miniature' : 'Prompt Image'}
          </label>
          <div className="flex gap-2">
            <button onClick={onGeneratePrompt} disabled={busy || readOnly} type="button" className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#E8DFC9]">
              Suggérer 💡
            </button>
            <button onClick={() => onCopyText(isVideo ? form.thumbnail_prompt : form.image_prompt, 'Prompt')} disabled={!(isVideo ? form.thumbnail_prompt : form.image_prompt)} type="button" className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#E8DFC9]">
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
              {!readOnly && <button onClick={() => removeTag(tag)} type="button" className="text-amber-700 hover:text-red-600">×</button>}
            </span>
          ))}
        </div>
        {!readOnly && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TAGS.map((t) => (
                <button key={t} onClick={() => addTag(t)} type="button" className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F4EFE6] border border-[#E2D5C3] text-stone-700 hover:bg-[#E8DFC9]">
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
              className={inputClass}
            />
          </div>
        )}
      </section>

      {/* Premier commentaire */}
      <section className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Premier commentaire sous le post</label>
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

      {/* Actions de programmation */}
      {!readOnly && (
        <section className="border-t border-[#E2D5C3] pt-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              Date de programmation ({ownerTimezone || 'Europe/Paris'})
            </label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2.5 text-xs font-bold text-stone-800 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
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
                Annuler programmation
              </button>
            ) : (
              <>
                <button onClick={onPublishNow} disabled={busy} type="button" className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow hover:bg-emerald-800">
                  Publier maintenant
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
