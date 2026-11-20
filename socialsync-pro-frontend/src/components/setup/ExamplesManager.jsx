// socialsync-pro-frontend/src/components/setup/ExamplesManager.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const FORMATS = ['Photo', 'Carrousel', 'Vidéo courte', 'Séance YouTube', 'Story', 'Question', 'Live'];
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Types d'exemples : champ enregistré, formats autorisés, aide affichée
const KINDS = [
  { id: 'legende', label: 'Légende', field: 'caption', formats: null, rows: 6,
    help: 'Légende complète, avec emojis et sauts de ligne.' },
  { id: 'prompt_image', label: 'Prompt image (par jour)', field: 'image_prompt', formats: null, rows: 10, needsDay: true,
    help: 'Structure conseillée : IMAGE / TEXTE À INTÉGRER / TYPOGRAPHIE / STYLE.' },
  { id: 'prompt_miniature', label: 'Prompt miniature', field: 'image_prompt', formats: ['Vidéo courte', 'Séance YouTube', 'Live'], rows: 8,
    help: 'Prompt de la vignette de la vidéo.' },
  { id: 'script_court', label: 'Script vidéo courte (1 à 3 min)', field: 'script', formats: ['Vidéo courte'], rows: 10,
    help: 'Texte complet à lire à voix haute.' },
  { id: 'script_long', label: 'Script long format (30 min et plus)', field: 'script', formats: ['Séance YouTube', 'Live'], rows: 14,
    help: 'Un extrait structuré suffit : ouverture, une partie, conclusion. Les indications de mise en scène vont entre crochets.' },
  { id: 'slides', label: 'Diapositives de carrousel', field: 'slides', formats: ['Carrousel'], rows: 8,
    help: 'Une diapositive par ligne.' },
  { id: 'question', label: 'Question interactive', field: 'caption', formats: ['Question', 'Story'], rows: 4,
    help: 'La question telle qu\'elle apparaît dans la Story ou le post.' },
];

const input =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500';

const EMPTY = { kind: 'legende', format: 'Photo', day: '', title: '', content: '', note: '' };

// Contenu d'un exemple, complet, sans troncature
const contentOf = (e) => {
  if (Array.isArray(e.slides) && e.slides.length) {
    return e.slides.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  return e.caption || e.script || e.image_prompt || '';
};

const dayOf = (e) => {
  if (e.day_index != null) return DAYS[e.day_index];
  return e.kind === 'prompt_image' ? 'Tous les jours' : null;
};

export default function ExamplesManager({ notify }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const kind = KINDS.find((k) => k.id === form.kind) || KINDS[0];
  const formatOptions = kind.formats || FORMATS;
  const kindLabel = (id) => KINDS.find((k) => k.id === id)?.label || id;

  const load = async () => {
    try {
      const r = await api.examples.list();
      setList(r.examples || []);
    } catch (e) {
      notify(e.message);
      setList([]);
    }
  };

  useEffect(() => { load(); }, []);

  const setKind = (id) => {
    const k = KINDS.find((x) => x.id === id) || KINDS[0];
    setForm((f) => ({
      ...f,
      kind: id,
      format: (!k.formats || k.formats.includes(f.format)) ? f.format : k.formats[0],
    }));
  };

  const save = async () => {
    const content = form.content.trim();
    if (!content) return notify('Renseignez le contenu de cet exemple.');

    const payload = {
      format: form.format,
      kind: form.kind,
      title: form.title.trim(),
      note: form.note.trim(),
      day_index: kind.needsDay && form.day !== '' ? Number(form.day) : null,
    };
    if (kind.field === 'slides') {
      payload.slides = content.split('\n').map((s) => s.trim()).filter(Boolean);
    } else {
      payload[kind.field] = content;
    }

    setBusy(true);
    try {
      await api.examples.create(payload);
      notify('Exemple enregistré.');
      setForm((f) => ({ ...f, title: '', content: '', note: '' }));
      await load();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Supprimer cet exemple ?')) return;
    try {
      await api.examples.remove(id);
      await load();
    } catch (e) {
      notify(e.message);
    }
  };

  const counts = KINDS.map((k) => ({ label: k.label, n: (list || []).filter((e) => e.kind === k.id).length }));

  return (
    <div className="space-y-6">
      <p className="text-xs text-stone-600">
        Ajoutez autant d'exemples validés que vous voulez. Claude s'inspire des plus récents de chaque type pour le ton,
        la structure et la longueur. Un prompt image s'applique au jour choisi.
      </p>

      <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Type d'exemple</label>
            <select className={input} value={form.kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Format</label>
            <select className={input} value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}>
              {formatOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {kind.needsDay ? (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Jour</label>
              <select className={input} value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}>
                <option value="">Tous les jours</option>
                {DAYS.map((d, i) => <option key={d} value={String(i)}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Titre (facultatif)</label>
              <input className={input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex. Légende du mardi, ton doux" />
            </div>
          )}
        </div>

        {kind.needsDay && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Titre (facultatif)</label>
            <input className={input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex. Visuel du samedi, carte de guidance" />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Contenu</label>
          <textarea
            rows={kind.rows}
            className={input}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder={kind.help}
          />
          <p className="text-[10px] text-stone-500 mt-1">{form.content.length} caractères</p>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Note pour Claude (facultatif)</label>
          <input className={input} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Ex. Ton plus doux, phrases courtes." />
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={busy}
            type="button"
            className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow hover:bg-stone-800 disabled:opacity-50"
          >
            {busy ? 'Enregistrement...' : 'Ajouter cet exemple'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-serif font-bold text-sm text-stone-900">Exemples enregistrés ({list?.length ?? 0})</h4>

        {list && list.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {counts.filter((c) => c.n > 0).map((c) => (
              <span key={c.label} className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F4EFE6] border border-[#E2D5C3] text-stone-700">
                {c.label} : {c.n}
              </span>
            ))}
          </div>
        )}

        {!list && <p className="text-xs text-stone-500">Chargement...</p>}
        {list && list.length === 0 && <p className="text-xs text-stone-400 italic">Aucun exemple pour le moment.</p>}

        {list && list.map((e) => (
          <div key={e.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-700 text-white">{e.format}</span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F4EFE6] border border-[#E2D5C3] text-stone-700">{kindLabel(e.kind)}</span>
                {dayOf(e) && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800">{dayOf(e)}</span>
                )}
                {e.title && <span className="text-xs font-bold text-stone-900">{e.title}</span>}
              </div>
              <button onClick={() => remove(e.id)} type="button" className="text-red-600 text-xs font-bold hover:bg-red-50 rounded px-2 py-1 shrink-0">
                Supprimer
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs text-stone-700 leading-relaxed max-h-80 overflow-y-auto bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3">
              {contentOf(e)}
            </pre>
            {e.note && <p className="text-[11px] text-stone-500">Note : {e.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
