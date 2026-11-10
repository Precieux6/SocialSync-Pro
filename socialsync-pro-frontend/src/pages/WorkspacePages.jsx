// socialsync-pro-frontend/src/pages/WorkspacePages.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { api, uploadFile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CommentsManager from '../components/Comments/CommentsManager';

const Empty = ({ children }) => (
  <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-12 text-center text-stone-500 text-xs font-medium">
    {children}
  </div>
);

export function ToFilmPage({ notify }) {
  const [videos, setVideos] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.videos.toFilm().then((r) => setVideos(r.videos)).catch((e) => { notify(e.message); setVideos([]); });
  }, [notify]);

  if (!videos) return <p className="text-xs text-stone-500">Chargement...</p>;

  return (
    <div className="space-y-8">
      <div className="bg-[#FAF7F2] border-2 border-[#E2D5C3] rounded-3xl p-6 shadow-sm space-y-2">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 flex items-center gap-3">
          <i className="fa-solid fa-clapperboard text-gold-600"></i>
          <span>Vidéos à tourner ({videos.length})</span>
        </h2>
      </div>

      {videos.length === 0 ? (
        <Empty>Aucune vidéo en attente de tournage.</Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((v) => (
            <div key={v.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-6 space-y-3 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {v.format && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-700 text-white">{v.format}</span>}
                  {v.duration && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F4EFE6] text-stone-700 border border-[#E2D5C3]">{v.duration}</span>}
                  {v.status && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{v.status}</span>}
                </div>
                <p className="text-sm font-serif font-bold text-stone-900 leading-snug">{v.title}</p>
                {v.release_date && <p className="text-xs text-stone-500">Sortie : {v.release_date}</p>}
              </div>
              <div className="pt-3 border-t border-[#E2D5C3] text-right">
                <button onClick={() => setActive(v)} className="font-bold text-gold-700 hover:text-stone-900 text-xs">Consulter le script &gt;</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#D6AC66] w-full max-w-2xl rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-stone-900">{active.title}</h3>
              <button onClick={() => setActive(null)} className="text-stone-400 hover:text-stone-900 text-xl px-2">×</button>
            </div>
            <div className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-4 text-xs whitespace-pre-line max-h-96 overflow-y-auto leading-relaxed">
              {active.script || 'Aucun script enregistré pour cette vidéo.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaPage({ notify }) {
  const { activeSpace } = useAuth();
  const [items, setItems] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const r = await api.media.list();
    setItems(r.media);
  }, []);

  useEffect(() => {
    load().catch((e) => { notify(e.message); setItems([]); });
  }, [load, notify]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
    if (!type) {
      notify('Formats acceptés : image ou vidéo.');
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const url = await uploadFile('media', `${activeSpace.ownerId}/${Date.now()}-${safe}`, file);
      await api.media.register({
        name: file.name,
        type,
        url,
        size: `${(file.size / 1048576).toFixed(2)} MB`,
      });
      notify('Média ajouté à la médiathèque.');
      await load();
    } catch (err) {
      notify(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (!items) return <p className="text-xs text-stone-500">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900">Médiathèque</h2>
          <p className="text-xs text-stone-500 mt-1">Visuels et vidéos prêts à être utilisés dans vos publications.</p>
        </div>
        <label className={`bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold px-5 py-3 rounded-2xl cursor-pointer shadow flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <i className="fa-solid fa-cloud-arrow-up text-gold-400"></i>
          <span>{uploading ? 'Envoi...' : 'Téléverser un fichier'}</span>
          <input type="file" accept="image/*,video/*" onChange={onUpload} className="hidden" />
        </label>
      </div>

      {items.length === 0 ? (
        <Empty>Aucun média dans la médiathèque pour l'instant.</Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((m) => (
            <div key={m.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="w-full h-40 bg-stone-900 rounded-2xl overflow-hidden flex items-center justify-center relative">
                {m.type === 'image' ? (
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <i className="fa-solid fa-video text-3xl text-amber-200"></i>
                )}
                {m.size && (
                  <span className="absolute top-3 right-3 bg-stone-900/80 text-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold">{m.size}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-xs text-stone-900 truncate max-w-[180px]">{m.name}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(m.url).then(() => notify('Lien copié.'))}
                  className="text-gold-700 hover:text-stone-900 text-xs font-bold"
                  title="Copier le lien"
                >
                  <i className="fa-regular fa-copy"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentsPage({ notify }) {
  const [comments, setComments] = useState(null);

  useEffect(() => {
    api.comments.list()
      .then((r) => setComments(r.comments))
      .catch((e) => { notify(e.message); setComments([]); });
  }, [notify]);

  if (!comments) return <p className="text-xs text-stone-500">Chargement...</p>;
  return <CommentsManager comments={comments} triggerNotification={notify} />;
}

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.analytics.get().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Empty>Impossible de charger les statistiques : {error}</Empty>;
  if (!data) return <p className="text-xs text-stone-500">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
        <h2 className="text-2xl font-serif font-bold text-stone-900">Mes statistiques</h2>
        <p className="text-xs text-stone-500 mt-1">
          {data.lastSync ? `Dernière synchronisation : ${new Date(data.lastSync).toLocaleString('fr-FR')}` : 'Synchronisation non effectuée'}
        </p>
      </div>

      {!data.hasData ? (
        <Empty>
          Aucune statistique pour le moment. Les données apparaîtront ici après la première synchronisation de vos comptes réseaux.
        </Empty>
      ) : (
        <div className="bg-[#FAF7F2] rounded-3xl border border-[#E2D5C3] overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4EFE6] text-stone-600 border-b border-[#E2D5C3]">
                <th className="p-3.5 font-bold">Plateforme</th>
                <th className="p-3.5 font-bold">Période</th>
                <th className="p-3.5 font-bold">Indicateurs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2D5C3] text-stone-700">
              {data.stats.map((s, idx) => (
                <tr key={`${s.platform}-${s.period_start}-${idx}`}>
                  <td className="p-3.5 font-bold text-stone-900 capitalize">{s.platform}</td>
                  <td className="p-3.5">{s.period_start}</td>
                  <td className="p-3.5">
                    {Object.entries(s.metrics || {}).map(([k, v]) => `${k} : ${v}`).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
