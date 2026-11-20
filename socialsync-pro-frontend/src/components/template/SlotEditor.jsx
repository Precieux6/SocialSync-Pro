// socialsync-pro-frontend/src/components/template/SlotEditor.jsx
import React from 'react';
import { FIELD_META, FORMAT_FIELDS } from '../../constants/formats';

const input =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500 disabled:opacity-60';

export default function SlotEditor({ slot, index, canEdit, isFirst, isLast, onChange, onRemove, onMove }) {
  const fields = FORMAT_FIELDS[slot.format] || ['brief', 'note'];

  return (
    <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-stone-500">Créneau {index + 1}</span>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-700 text-white">
            {slot.format}
          </span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => onMove(-1)}
              className="px-2 py-1 text-xs font-bold text-stone-600 hover:bg-[#E8DFC9] rounded disabled:opacity-30"
              title="Monter"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={() => onMove(1)}
              className="px-2 py-1 text-xs font-bold text-stone-600 hover:bg-[#E8DFC9] rounded disabled:opacity-30"
              title="Descendre"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded"
            >
              Retirer
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
          Heure de publication
        </label>
        <input
          type="time"
          value={slot.publish_time}
          disabled={!canEdit}
          onChange={(e) => onChange({ publish_time: e.target.value })}
          className={`${input} w-40`}
        />
      </div>

      {fields.map((key) => {
        const meta = FIELD_META[key];
        const value = key === 'slides' ? (slot.slides || []).join('\n') : slot[key] || '';
        return (
          <div key={key}>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              {meta.label}
            </label>
            <textarea
              rows={meta.rows}
              value={value}
              disabled={!canEdit}
              maxLength={meta.max}
              placeholder={meta.placeholder}
              onChange={(e) =>
                onChange({ [key]: key === 'slides' ? e.target.value.split('\n') : e.target.value })
              }
              className={`${input} ${meta.mono ? 'font-mono' : ''}`}
            />
          </div>
        );
      })}
    </div>
  );
}
