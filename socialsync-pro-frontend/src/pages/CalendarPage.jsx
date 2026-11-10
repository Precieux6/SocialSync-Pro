// socialsync-pro-frontend/src/pages/CalendarPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PostEditor from '../components/calendar/PostEditor';
import { MONTHS_LIST, DAY_LABELS, addDays, weekStartFor, shortDate } from '../utils/calendarGrid';

const FORMATS = ['Photo', 'Carrousel', 'Vidéo courte', 'Séance YouTube', 'Story', 'Question', 'Live'];

const STATUS_STYLE = {
  brouillon: 'bg-stone-100 text-stone-700 border-stone-200',
  programme: 'bg-amber-100 text-amber-800 border-amber-200',
  publie: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  echec: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABEL = {
  brouillon: 'Brouillon',
  programme: 'Programmé',
  publie: 'Publié',
  echec: 'Échec',
};

function AddPostModal({ date, weekNum, onClose, onCreated, notify }) {
  const [busy, setBusy] = useState(false);

  const create = async (format) => {
    setBusy(true);
    try {
      const r = await api.calendar.createPost({ post_date: date, week_num: weekNum, format });
      onCreated(r.post);
    } catch (e) {
      notify(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] border-2 border-[#D6AC66] w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
          <div>
            <span className="text-[10px] font-bold text-gold-700 uppercase tracking-widest block">Hors calendrier</span>
            <h3 className="font-serif font-bold text-stone-900 text-lg">{shortDate(date)}</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900 text-xl px-2">×</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              disabled={busy}
              onClick={() => create(f)}
              className="px-3 py-3 rounded-xl bg-[#F4EFE6] hover:bg-white border border-[#E2D5C3] hover:border-gold-500 text-xs font-bold text-stone-800 disabled:opacity-50"
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage({ notify }) {
  const { isOwner } = useAuth();
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [monthCode, setMonthCode] = useState('NOV');
  const month = MONTHS_LIST.find((m) => m.code === monthCode);
  const start = useMemo(() => weekStartFor(year, monthCode), [year, monthCode]);

  const [themes, setThemes] = useState({});
  const [isDefault, setIsDefault] = useState(false);
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [posts, setPosts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingWeek, setEditingWeek] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null); // { date, weekNum }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.calendar.posts(start, month.startWeek);
      setPosts(r.posts || []);
      setThemes(r.themes || {});
      setIsDefault(Boolean(r.isDefault));
      setTimezone(r.timezone || 'Europe/Paris');
    } catch (e) {
      notify(e.message);
    } finally {
      setLoading(false);
    }
  }, [start, month.startWeek, notify]);

  useEffect(() => {
    setSelectedId(null);
    load();
  }, [load]);

  const weeks = useMemo(() => {
    return [0, 1, 2, 3].map((i) => {
      const weekNum = ((month.startWeek - 1 + i) % 13) + 1;
      const weekStart = addDays(start, i * 7);
      return {
        weekNum,
        title: themes[weekNum] || `Thème Semaine ${weekNum}`,
        days: DAY_LABELS.map((label, d) => {
          const date = addDays(weekStart, d);
          return { date, label, posts: posts.filter((p) => p.post_date === date) };
        }),
      };
    });
  }, [posts, themes, start, month.startWeek]);

  const selected = posts.find((p) => p.id === selectedId) || null;
  const selectedTheme = selected ? themes[selected.week_num] || `Thème Semaine ${selected.week_num}` : '';

  const onPostUpdated = (updated) => {
    setPosts((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  };

  const onPostDeleted = (id) => {
    setPosts((list) => list.filter((p) => p.id !== id));
    setSelectedId(null);
  };

  const onPostCreated = async (post) => {
    setAdding(null);
    await load();
    setSelectedId(post.id);
    notify('Publication ajoutée.');
  };

  const saveTheme = async (weekNum) => {
    const title = draftTitle.trim();
    if (!title) return;
    try {
      await api.calendar.updateTheme(weekNum, title);
      setEditingWeek(null);
      notify(`Thème de la semaine ${weekNum} enregistré.`);
      await load();
    } catch (e) {
      notify(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900">Calendrier éditorial</h2>
          <p className="text-xs text-stone-500 mt-1">
            Cliquez sur une publication pour rédiger son brief, sa légende et son visuel. Le « + » ajoute une publication hors calendrier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={monthCode}
            onChange={(e) => setMonthCode(e.target.value)}
            className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-gold-500"
          >
            {MONTHS_LIST.map((m) => (
              <option key={m.code} value={m.code}>{m.name}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            min={2024}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-2.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-gold-500"
          />
        </div>
      </div>

      {isDefault && isOwner && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
          Thèmes par défaut : modifiez-les pour cet espace.
        </div>
      )}

      {loading && <p className="text-xs text-stone-500">Chargement du calendrier...</p>}

      {weeks.map((week) => (
        <div key={week.weekNum} className="bg-[#FAF7F2] border-2 border-[#D6AC66]/60 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2D5C3] pb-4">
            <div className="flex-1">
              <span className="text-xs font-bold text-gold-700 uppercase tracking-wider">Semaine {week.weekNum}</span>
              {editingWeek === week.weekNum ? (
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    maxLength={200}
                    className="flex-1 bg-[#F4EFE6] border border-[#D6AC66] rounded-xl p-2.5 text-sm font-semibold text-stone-900 focus:outline-none"
                  />
                  <button onClick={() => saveTheme(week.weekNum)} className="px-4 py-2 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold">
                    Enregistrer
                  </button>
                  <button onClick={() => setEditingWeek(null)} className="px-4 py-2 rounded-xl bg-[#F4EFE6] text-stone-700 text-xs font-bold">
                    Annuler
                  </button>
                </div>
              ) : (
                <h3 className="font-serif font-bold text-lg text-stone-900 uppercase tracking-wide mt-1">{week.title}</h3>
              )}
            </div>
            {isOwner && editingWeek !== week.weekNum && (
              <button
                onClick={() => { setEditingWeek(week.weekNum); setDraftTitle(week.title); }}
                className="bg-[#FAF7F2] hover:bg-gold-500 hover:text-white text-stone-800 text-xs font-bold px-3 py-1.5 rounded-full border border-gold-600 transition-all"
              >
                Modifier le thème
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {week.days.map((day) => (
              <div key={day.date} className="rounded-2xl border border-[#E2D5C3] bg-[#F4EFE6]/50 p-3 min-h-[160px] space-y-2">
                <div className="border-b border-[#E2D5C3] pb-2 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-serif font-bold text-xs uppercase tracking-wider text-stone-800 block">{day.label}</span>
                    <span className="text-[10px] text-stone-500">{shortDate(day.date)}</span>
                  </div>
                  <button
                    onClick={() => setAdding({ date: day.date, weekNum: week.weekNum })}
                    title="Ajouter une publication hors calendrier"
                    className="w-6 h-6 rounded-full bg-[#FAF7F2] border border-[#D6AC66] text-stone-800 font-bold text-sm flex items-center justify-center hover:bg-stone-900 hover:text-amber-200 transition-colors shrink-0"
                  >
                    +
                  </button>
                </div>

                {day.posts.length === 0 && <p className="text-[11px] text-stone-400 italic">Aucune publication</p>}

                {day.posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => setSelectedId(post.id)}
                    className={`w-full text-left rounded-xl border p-2 transition-all ${
                      selectedId === post.id ? 'border-gold-500 bg-white shadow' : 'border-[#E2D5C3] bg-[#FAF7F2] hover:border-gold-500'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-stone-800 block">
                      {post.format}{post.is_adhoc ? ' · hors plan' : ''}
                    </span>
                    <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      STATUS_STYLE[post.status] || STATUS_STYLE.brouillon
                    }`}>
                      {STATUS_LABEL[post.status] || post.status}
                    </span>
                    {post.scheduled_at && post.status === 'programme' && (
                      <span className="block text-[9px] text-stone-500 mt-1">
                        {new Date(post.scheduled_at).toLocaleString('fr-FR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: timezone,
                        })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <PostEditor
          key={selected.id}
          post={selected}
          themeTitle={selectedTheme}
          ownerTimezone={timezone}
          onUpdated={onPostUpdated}
          onDeleted={onPostDeleted}
          onClose={() => setSelectedId(null)}
          notify={notify}
        />
      )}

      {adding && (
        <AddPostModal
          date={adding.date}
          weekNum={adding.weekNum}
          onClose={() => setAdding(null)}
          onCreated={onPostCreated}
          notify={notify}
        />
      )}
    </div>
  );
}
