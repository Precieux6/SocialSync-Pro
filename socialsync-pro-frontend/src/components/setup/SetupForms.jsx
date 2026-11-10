// socialsync-pro-frontend/src/components/setup/SetupForms.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const input =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500';

const PLATFORMS = [
  {
    id: 'instagram', label: 'Instagram Graph API',
    fields: [
      { key: 'accountId', label: 'Instagram Business Account ID' },
      { key: 'accessToken', label: 'Access Token longue durée', secret: true },
    ],
  },
  {
    id: 'facebook', label: 'Facebook Pages API',
    fields: [
      { key: 'pageId', label: 'ID de la Page Facebook' },
      { key: 'pageToken', label: 'Page Access Token', secret: true },
    ],
  },
  {
    id: 'youtube', label: 'YouTube Data API v3',
    fields: [
      { key: 'channelId', label: 'ID de la chaîne YouTube' },
      { key: 'refreshToken', label: 'OAuth2 Refresh Token', secret: true },
    ],
  },
  {
    id: 'tiktok', label: 'TikTok Content Posting API',
    fields: [
      { key: 'clientKey', label: 'Client Key' },
      { key: 'userToken', label: 'User Access Token', secret: true },
    ],
  },
];

export function SocialAccountsForm({ onSaved, notify }) {
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const r = await api.setup.getSocialAccounts();
    setCurrent(r.platforms);
  };

  useEffect(() => {
    reload().catch((e) => notify(e.message));
  }, [notify]);

  const setField = (pid, key, value) =>
    setDraft((d) => ({ ...d, [pid]: { ...(d[pid] || {}), [key]: value } }));

  const save = async () => {
    const payload = {};
    for (const [pid, fields] of Object.entries(draft)) {
      const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v && v.trim()));
      if (Object.keys(clean).length) payload[pid] = clean;
    }
    if (Object.keys(payload).length === 0) {
      notify('Aucune modification à enregistrer.');
      return;
    }
    setBusy(true);
    try {
      await api.setup.saveSocialAccounts(payload);
      setDraft({});
      await reload();
      notify('Comptes réseaux enregistrés.');
      if (onSaved) onSaved();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!current) return <p className="text-xs text-stone-500">Chargement...</p>;

  return (
    <div className="space-y-5">
      {PLATFORMS.map((p) => (
        <div key={p.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-stone-900 text-sm">{p.label}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
              current[p.id]?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {current[p.id]?.configured ? 'Configuré' : 'Non configuré'}
            </span>
          </div>
          {p.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] text-stone-500 mb-1">{f.label}</label>
              <input
                type={f.secret ? 'password' : 'text'}
                className={input}
                value={
                  f.secret
                    ? draft[p.id]?.[f.key] ?? ''
                    : draft[p.id]?.[f.key] ?? current[p.id]?.ids?.[f.key] ?? ''
                }
                placeholder={
                  f.secret && current[p.id]?.secretsSaved?.[f.key]
                    ? '•••• enregistré (laisser vide pour conserver)'
                    : ''
                }
                onChange={(e) => setField(p.id, f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy}
          className="px-6 py-3 rounded-2xl bg-stone-900 text-amber-200 text-xs font-bold shadow disabled:opacity-50"
        >
          {busy ? 'Enregistrement...' : 'Enregistrer les comptes réseaux'}
        </button>
      </div>
    </div>
  );
}

export function ClaudeKeyForm({ configured, onSaved, notify }) {
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const k = apiKey.trim();
    if (!k.startsWith('sk-ant-')) {
      notify('Format de clé invalide (elle commence par sk-ant-).');
      return;
    }
    setBusy(true);
    try {
      await api.profile.saveClaudeKey(k);
      setApiKey('');
      notify('Clé Claude vérifiée et enregistrée.');
      if (onSaved) onSaved();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-600">
        Statut : {configured ? <strong className="text-emerald-700">clé enregistrée</strong> : <strong>aucune clé</strong>}.
        La clé est vérifiée auprès d'Anthropic, chiffrée, et n'est jamais affichée.
      </p>
      <input
        type="password"
        className={input}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-ant-api03-..."
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy || !apiKey.trim()}
          className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow disabled:opacity-50"
        >
          {busy ? 'Vérification...' : 'Enregistrer la clé'}
        </button>
      </div>
    </div>
  );
}

// Import uniquement par fichier : le serveur extrait le texte (.xlsx, .xls, .csv, .txt, .md)
export function ReferenceCalendarForm({ configured, sourceName, onSaved, notify }) {
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de réimporter le même fichier ensuite
    if (!file) return;

    setBusy(true);
    try {
      const r = await api.profile.uploadReferenceCalendar(file);
      notify(`Calendrier « ${file.name} » importé (${r.characters} caractères).`);
      if (onSaved) onSaved();
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-600">
        Statut : {configured ? <strong className="text-emerald-700">calendrier enregistré</strong> : <strong>aucun calendrier</strong>}
        {configured && sourceName && <span className="text-stone-500"> ({sourceName})</span>}.
        L'IA s'appuie dessus pour reprendre votre ton et votre ligne éditoriale.
      </p>
      <p className="text-[11px] text-stone-500">
        Formats acceptés : .xlsx, .xls, .csv, .txt, .md (5 Mo maximum). Pour un Word ou un PDF,
        exportez d'abord le document en texte.
      </p>
      <label className={`inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        <i className="fa-solid fa-file-arrow-up text-gold-400"></i>
        <span>{busy ? 'Import en cours...' : configured ? 'Remplacer le calendrier' : 'Importer le calendrier'}</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt,.md"
          onChange={onFile}
          disabled={busy}
          className="hidden"
        />
      </label>
    </div>
  );
}
