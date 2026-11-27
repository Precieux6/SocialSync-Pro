// socialsync-pro-frontend/src/pages/CalendarPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PostEditor from '../components/calendar/PostEditor';
import {
  MONTH_NAMES, addDays, buildMonthWeeks, buildWeek, dayMonth, shortDate, startOfWeek, todayIso,
} from '../utils/calendarGrid';
import { FORMATS } from '../constants/formats';

const READ_ONLY_ROLE = 'Relecteur / Client';
const NO_THEME = 'Thème à définir';
const MAX_STEPS = 40;

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

const badgeOf = (post) => {
  if (post.ai_generated_at && !post.reviewed_at && post.status === 'brouillon') {
    return { label: 'À valider', style: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  return {
    label: STATUS_LABEL[post.status] || post.status,
    style: STATUS_STYLE[post.status] || STATUS_STYLE.brouillon,
  };
};

// Premier jour du mois de la date donnée, décalé de delta mois
const shiftMonthAnchor = (iso, delta) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1)).toISOString().slice(0, 10);
};

function AddPostModal({ date, onClose, onCreated, notify }) {
  const [busy, setBusy] = useState(false);

  const create = async (format) => {
    setBusy(true);
    try {
      const r = await api.calendar.createPost({ post_date: date, format });
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
  const { isOwner, userRole } = useAuth();
  const [mode, setMode] = useState('month'); // 'month' | 'week'
  const [anchor, setAnchor] = useState(() => todayIso());
  const today = todayIso();

  const view = useMemo(() => {
    if (mode === 'week') return buildWeek(anchor);
    const [y, m] = anchor.split('-').map(Number);
    return buildMonthWeeks(y, m - 1);
  }, [mode, anchor]);
  const { from, to, weeks } = view;

  const [posts, setPosts] = useState([]);
  const [themes, setThemes] = useState({});
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editingWeek, setEditingWeek] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [busyWeek, setBusyWeek] = useState(null);
  const [adding, setAdding] = useState(null);

  const canGenerate = Boolean(userRole) && userRole !== READ_ONLY_ROLE;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await api.calendar.posts(from, to);
      setPosts(r.posts || []);
      setThemes(r.themes || {});
      setTimezone(r.timezone || 'Europe/Paris');
    } catch (e) {
      setLoadError(e.message);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    setSelectedId(null);
    load();
  }, [load]);

  const postsByDate = useMemo(() => {
    const map = {};
    for (const p of posts) (map[p.post_date] ||= []).push(p);
    return map;
  }, [posts]);

  const selected = posts.find((p) => p.id === selectedId) || null;
  const selectedTheme = selected ? themes[startOfWeek(selected.post_date)] || NO_THEME : '';

  const goPrev = () => setAnchor((a) => (mode === 'week' ? addDays(a, -7) : shiftMonthAnchor(a, -1)));
  const goNext = () => setAnchor((a) => (mode === 'week' ? addDays(a, 7) : shiftMonthAnchor(a, 1)));
  const goToday = () => setAnchor(todayIso());

  const titleLabel = mode === 'week'
    ? `Du ${dayMonth(from)} au ${dayMonth(to)} ${to.slice(0, 4)}`
    : `${MONTH_NAMES[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}`;

  // Rédige une semaine étape par étape. Chaque appel rédige une publication ou une partie de script.
  const generateWeek = async (weekStart) => {
    setBusyWeek(weekStart);
    let produced = 0;
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const r = await api.ai.generateWeek(weekStart);
        if (r.done) break;
        if (!r.generated) {
          throw new Error("Rédaction interrompue : une publication n'a pas pu être rédigée. Le cycle automatique reprendra.");
        }
        produced += r.generated;
      }
      notify(produced
        ? `${produced} élément(s) rédigé(s) pour la semaine du ${shortDate(weekStart)}.`
        : 'Rien à rédiger : cette semaine est déjà prête.');
    } catch (e) {
      notify(e.message);
    } finally {
      setBusyWeek(null);
      await load();
    }
  };

  const saveTheme = async (weekStart) => {
    const title = draftTitle.trim();
    if (!title) return;
    try {
      await api.calendar.updateTheme(weekStart, title);
      setEditingWeek(null);
      notify(`Thème de la semaine du ${shortDate(weekStart)} enregistré. Rédaction lancée.`);
      await load();
      generateWeek(weekStart);
    } catch (e) {
      notify(e.message);
    }
  };

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
    if (post?.id) setSelectedId(post.id);
    notify('Publication ajoutée.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900">Calendrier éditorial</h2>
          <p className="text-xs text-stone-500 mt-1">
            Cliquez sur une publication pour la rédiger. Le « + » ajoute une publication hors plan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] p-1">
            {[['week', 'Semaine'], ['month', 'Mois']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mode === id ? 'bg-white text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={goPrev} className="px-3 py-2 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 font-bold">‹</button>
          <button onClick={goToday} className="px-3 py-2 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-xs font-bold text-stone-800">
            Aujourd'hui
          </button>
          <button onClick={goNext} className="px-3 py-2 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 font-bold">›</button>
          <div className="min-w-[200px] text-center font-serif font-bold text-stone-900 text-sm">
            {titleLabel}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>Impossible de charger le calendrier : {loadError}</span>
          <button onClick={load} className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 font-bold shrink-0">
            Réessayer
          </button>
        </div>
      )}

      {loading && <p className="text-xs text-stone-500">Chargement du calendrier...</p>}

      <div className="bg-[#FAF7F2] border-2 border-[#D6AC66]/60 rounded-3xl p-4 overflow-x-auto">
        <div className="min-w-[860px] space-y-4">
          {weeks.map((week) => {
            const title = themes[week.weekStart];
            const busy = busyWeek === week.weekStart;
            return (
              <div key={week.weekStart} className="space-y-2 border-b border-[#E2D5C3] pb-4 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {editingWeek === week.weekStart ? (
                    <div className="flex flex-1 flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        maxLength={200}
                        className="flex-1 bg-[#F4EFE6] border border-[#D6AC66] rounded-xl p-2.5 text-sm font-semibold text-stone-900 focus:outline-none"
                      />
                      <button onClick={() => saveTheme(week.weekStart)} className="px-4 py-2 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold">
                        Enregistrer
                      </button>
                      <button onClick={() => setEditingWeek(null)} className="px-4 py-2 rounded-xl bg-[#F4EFE6] text-stone-700 text-xs font-bold">
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-gold-700 uppercase tracking-wider">
                        {week.weekNum ? `S${week.weekNum} · ` : ''}du {dayMonth(week.days[0].date)} au {dayMonth(week.days[6].date)}
                      </span>
                      <h3 className={`font-serif font-bold text-base uppercase tracking-wide truncate ${title ? 'text-stone-900' : 'text-stone-400 italic normal-case'}`}>
                        {title || NO_THEME}
                      </h3>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {busy && <span className="text-[11px] font-bold text-gold-700">Rédaction en cours...</span>}
                    {isOwner && editingWeek !== week.weekStart && (
                      <button
                        onClick={() => { setEditingWeek(week.weekStart); setDraftTitle(title || ''); }}
                        className="bg-[#FAF7F2] hover:bg-gold-500 hover:text-white text-stone-800 text-xs font-bold px-3 py-1.5 rounded-full border border-gold-600 transition-all"
                      >
                        Modifier le thème
                      </button>
                    )}
                    {canGenerate && (
                      <button
                        onClick={() => generateWeek(week.weekStart)}
                        disabled={busyWeek !== null}
                        title="Relance la rédaction des publications vides de cette semaine"
                        className="bg-stone-900 text-amber-200 hover:bg-stone-800 text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-50"
                      >
                        {busy ? 'En cours...' : 'Rédiger 🤖'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {week.days.map((day) => (
                    <div
                      key={day.date}
                      className={`rounded-xl border border-[#E2D5C3] p-1.5 min-h-[120px] space-y-1 ${
                        day.inMonth ? 'bg-white' : 'bg-[#F4EFE6]/50 opacity-60'
                      } ${day.date === today ? 'ring-2 ring-gold-500' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="leading-tight">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-stone-500">{day.label}</span>
                          <span className="text-xs font-bold text-stone-800">{day.day}</span>
                        </div>
                        <button
                          onClick={() => setAdding({ date: day.date })}
                          title="Ajouter une publication hors plan"
                          className="w-5 h-5 rounded-full bg-[#FAF7F2] border border-[#D6AC66] text-stone-800 font-bold text-xs flex items-center justify-center hover:bg-stone-900 hover:text-amber-200"
                        >
                          +
                        </button>
                      </div>

                      {(postsByDate[day.date] || []).map((post) => {
                        const badge = badgeOf(post);
                        return (
                          <button
                            key={post.id}
                            onClick={() => setSelectedId(post.id)}
                            className={`w-full text-left rounded-lg border p-1.5 transition-all ${
                              selectedId === post.id ? 'border-gold-500 bg-white shadow' : 'border-[#E2D5C3] bg-[#FAF7F2] hover:border-gold-500'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-stone-800 block leading-tight">
                              {post.format}{post.is_adhoc ? ' · hors plan' : ''}
                            </span>
                            <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badge.style}`}>
                              {badge.label}
                            </span>
                            {post.scheduled_at && post.status === 'programme' && (
                              <span className="block text-[9px] text-stone-500 mt-0.5">
                                {new Date(post.scheduled_at).toLocaleString('fr-FR', {
                                  dateStyle: 'short', timeStyle: 'short', timeZone: timezone,
                                })}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
          </div>
        </div>
      )}

      {adding && (
        <AddPostModal
          date={adding.date}
          onClose={() => setAdding(null)}
          onCreated={onPostCreated}
          notify={notify}
        />
      )}
    </div>
  );
}
