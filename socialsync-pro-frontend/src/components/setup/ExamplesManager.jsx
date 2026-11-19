// socialsync-pro-frontend/src/components/setup/ExamplesManager.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const FORMATS = ['Photo', 'Carrousel', 'Vidéo courte', 'Séance YouTube', 'Story', 'Question', 'Live'];

// Types d'exemples, avec le champ attendu pour chacun
const KINDS = [
  { id: 'legende', label: 'Légende', field: 'caption', placeholder: 'Légende complète, avec emojis et sauts de ligne.' },
  { id: 'prompt', label: 'Prompt image / miniature', field: 'image_prompt', placeholder: 'IMAGE : ...\nTEXTE À INTÉGRER : ...\nTYPOGRAPHIE : ...\nSTYLE : ...' },
  { id: 'script', label: 'Script (vidéo courte ou longue)', field: 'script', placeholder: 'Texte complet à lire. Pour une séance longue, indiquez les parties et les indications entre crochets.' },
  { id: 'slides', label: 'Diapositives de carrousel', field: 'slides', placeholder: 'Une diapositive par ligne.' },
  { id: 'question', label: 'Question interactive', field: 'caption', placeholder: 'La question posée, telle qu\'elle apparaît (Story ou Question).' },
  { id: 'exemple', label: 'Exemple complet (libre)', field: 'caption', placeholder: 'Un post complet, tel que vous le publieriez.' },
];

const input =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500';

const EMPTY = { format: 'Photo', kind: 'legende', title: '', caption: '', image_prompt: '', script: '', slides: '', note: '' };

export default function ExamplesManager({ notify }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const kind = KINDS.find((k) => k.id === form.kind) || KINDS[0];

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

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const value = (form[kind.field] || '').trim();
    if (!value) return notify('Renseignez le contenu de cet exemple.');

    const payload = {
      format: form.format,
      kind: form.kind,
      title: form.title,
      note: form.note,
      caption: '',
      image_prompt: '',
      script: '',
      slides: [],
    };
    if (kind.field === 'slides') {
      payload.slides = value.split('\n').map((s) => s.trim()).filter(Boolean);
    } else {
      payload[kind.field] = value;
    }

    setBusy(true);
    try {
      await api.examples.create(payload);
      notify('Exemple enregistré.');
      setForm({ ...EMPTY, format: form.format, kind: form.kind });
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

  const labelOf = (k) => KINDS.find((x) => x.id === k)?.label || k;

  return (
    <div className="space-y-6">
      <p className="text-xs text-stone-600">
        Ajoutez des contenus que vous avez validés. Claude s'en inspire pour le ton, la structure et la longueur de vos prochaines publications.
        Les exemples les plus récents de chaque format sont utilisés.
      </p>

      <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Format</label>
            <select className={input} value={form.format} onChange={(e) => set('format', e.target.value)}>
              {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Type d'exemple</label>
            <select className={input} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Titre (facultatif)</label>
            <input className={input} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Script long : la séance du vendredi" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Contenu</label>
          <textarea
            rows={kind.field === 'script' ? 10 : 5}
            className={input}
            value={form[kind.field]}
            onChange={(e) => set(kind.field, e.target.value)}
            placeholder={kind.placeholder}
          />
          <p className="text-[10px] text-stone-500 mt-1">
            {(form[kind.field] || '').length} caractères
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">Note pour Claude (facultatif)</label>
          <input className={input} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Ex. Ton plus doux, phrases courtes, pas de point d'exclamation." />
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
        {!list && <p className="text-xs text-stone-500">Chargement...</p>}
        {list && list.length === 0 && <p className="text-xs text-stone-400 italic">Aucun exemple pour le moment.</p>}
        {list && list.map((e) => (
          <div key={e.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-700 text-white">{e.format}</span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F4EFE6] border border-[#E2D5C3] text-stone-700">{labelOf(e.kind)}</span>
                {e.title && <span className="text-xs font-bold text-stone-900">{e.title}</span>}
              </div>
              <button onClick={() => remove(e.id)} type="button" className="text-red-600 text-xs font-bold hover:bg-red-50 rounded px-2 py-1">Supprimer</button>
            </div>
            <p className="text-[11px] text-stone-600 whitespace-pre-line line-clamp-4">
              {e.caption || e.script || e.image_prompt || (Array.isArray(e.slides) ? e.slides.join(' / ') : '')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
