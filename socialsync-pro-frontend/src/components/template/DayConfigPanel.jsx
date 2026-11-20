// socialsync-pro-frontend/src/components/template/DayConfigPanel.jsx
import React, { useState } from 'react';
import { api } from '../../services/api';
import { DAY_LABELS, FORMATS, MAX_SLOTS } from '../../constants/formats';
import SlotEditor from './SlotEditor';

let uid = 0;
const newKey = () => ++uid;

const toEditable = (slot) => ({ ...slot, _k: newKey(), slides: slot.slides || [] });

const blankSlot = (format) =>
  toEditable({
    format,
    publish_time: '18:00',
    brief: '',
    caption_example: '',
    image_prompt: '',
    thumbnail_prompt: '',
    script_example: '',
    slides: [],
    note: '',
  });

function summaryOf(r, dayCount) {
  const parts = [`Modèle mis à jour pour ${dayCount} jour(s).`];
  if (r.sync) {
    parts.push(`Prochaines publications : ${r.sync.added} ajoutée(s), ${r.sync.removed} retirée(s).`);
  }
  if (r.generation?.skipped) {
    parts.push(`Rédaction non lancée : ${r.generation.skipped}`);
  } else if (r.generation?.error) {
    parts.push(`Erreur de rédaction : ${r.generation.error}`);
  } else if (r.generation?.generated) {
    parts.push(`${r.generation.generated} publication(s) rédigée(s).`);
  }
  return parts.join(' ');
}

const btnPrimary =
  'px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow hover:bg-stone-800 disabled:opacity-50';

export default function DayConfigPanel({ dayIndex, template, canEdit, notify, onClose, onSaved }) {
  const [slots, setSlots] = useState(() => template.days[dayIndex].map(toEditable));
  const [targets, setTargets] = useState([dayIndex]);
  const [busy, setBusy] = useState(false);

  const patch = (key, changes) =>
    setSlots((list) => list.map((s) => (s._k === key ? { ...s, ...changes } : s)));

  const remove = (key) => setSlots((list) => list.filter((s) => s._k !== key));

  const move = (index, dir) =>
    setSlots((list) => {
      const j = index + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const add = (format) =>
    setSlots((list) => (list.length >= MAX_SLOTS ? list : [...list, blankSlot(format)]));

  const toggleTarget = (d) =>
    setTargets((t) => (t.includes(d) ? t.filter((x) => x !== d) : [...t, d].sort((a, b) => a - b)));

  const save = async () => {
    if (!targets.length) {
      notify('Choisissez au moins un jour.');
      return;
    }
    setBusy(true);
    try {
      const payload = slots.map(({ _k, ...rest }) => rest);
      const r = await api.template.save(targets, payload);
      onSaved(r);
      notify(summaryOf(r, targets.length));
      onClose();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FAF7F2] border-2 border-[#D6AC66] w-full max-w-2xl rounded-3xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
          <div>
            <span className="text-[10px] font-bold text-gold-700 uppercase tracking-widest block">
              Modèle hebdomadaire
            </span>
            <h3 className="font-serif font-bold text-stone-900 text-lg">{DAY_LABELS[dayIndex]}</h3>
          </div>
          <button onClick={onClose} type="button" className="text-stone-400 hover:text-stone-900 text-xl px-2">
            ×
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
            Appliquer à
          </label>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, d) => (
              <button
                key={d}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleTarget(d)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-50 ${
                  targets.includes(d)
                    ? 'bg-stone-900 text-amber-200 border-stone-900'
                    : 'bg-[#F4EFE6] text-stone-700 border-[#E2D5C3]'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setTargets(DAY_LABELS.map((_, d) => d))}
              className="px-3 py-2 rounded-xl text-xs font-bold border bg-[#F4EFE6] text-gold-700 border-gold-500 disabled:opacity-50"
            >
              Toute la semaine
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
            Publications du jour ({slots.length} / {MAX_SLOTS})
          </label>
          {slots.length === 0 && (
            <p className="text-xs italic text-stone-400">Aucune publication ce jour-là.</p>
          )}
          {slots.map((s, i) => (
            <SlotEditor
              key={s._k}
              slot={s}
              index={i}
              canEdit={canEdit}
              isFirst={i === 0}
              isLast={i === slots.length - 1}
              onChange={(changes) => patch(s._k, changes)}
              onRemove={() => remove(s._k)}
              onMove={(dir) => move(i, dir)}
            />
          ))}
        </div>

        {canEdit && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
              Ajouter une publication
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={slots.length >= MAX_SLOTS}
                  onClick={() => add(f)}
                  className="px-3 py-2.5 rounded-xl bg-[#F4EFE6] hover:bg-white border border-[#E2D5C3] hover:border-gold-500 text-xs font-bold text-stone-800 disabled:opacity-50"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-[#E2D5C3] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold"
          >
            Fermer
          </button>
          <button type="button" onClick={save} disabled={busy || !canEdit} className={btnPrimary}>
            {busy ? 'Enregistrement...' : 'Enregistrer et rédiger'}
          </button>
        </div>
      </div>
    </div>
  );
}
