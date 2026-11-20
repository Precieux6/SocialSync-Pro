// socialsync-pro-frontend/src/components/template/WeeklyTemplate.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import DayConfigPanel from './DayConfigPanel';

export default function WeeklyTemplate({ notify, canEdit }) {
  const [template, setTemplate] = useState(null);
  const [openDay, setOpenDay] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setTemplate(await api.template.get());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between gap-3">
        <span>Impossible de charger le modèle : {error}</span>
        <button onClick={load} className="px-3 py-1.5 rounded-lg bg-white border border-red-200 font-bold">
          Réessayer
        </button>
      </div>
    );
  }

  if (!template) return <p className="text-xs text-stone-500">Chargement du modèle...</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-600">
        Définissez les publications de chaque jour. Chaque modification s'applique aux prochaines publications
        non encore rédigées ; les publications déjà rédigées ou validées ne changent pas.
        {!canEdit && ' Vous consultez ce modèle en lecture seule.'}
      </p>

      {template.isDefault && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
          Modèle par défaut affiché. Il sera enregistré dès votre première modification.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {template.days.map((day) => (
          <button
            key={day.day_index}
            type="button"
            onClick={() => setOpenDay(day.day_index)}
            className="text-left bg-[#FAF7F2] border border-[#E2D5C3] hover:border-gold-500 rounded-2xl p-4 space-y-3 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-sm text-stone-900">{day.label}</span>
              <span className="text-[10px] font-bold text-stone-500">{day.slots.length} créneau(x)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {day.slots.length === 0 && (
                <span className="text-[11px] italic text-stone-400">Aucune publication</span>
              )}
              {day.slots.map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4EFE6] border border-[#E2D5C3] text-stone-700"
                >
                  {s.publish_time} · {s.format}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {openDay !== null && (
        <DayConfigPanel
          dayIndex={openDay}
          template={template}
          canEdit={canEdit}
          notify={notify}
          onClose={() => setOpenDay(null)}
          onSaved={(r) => setTemplate(r)}
        />
      )}
    </div>
  );
}
