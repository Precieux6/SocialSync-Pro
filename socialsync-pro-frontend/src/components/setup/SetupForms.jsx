// socialsync-pro-frontend/src/components/setup/SetupForms.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const input =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500';
const MAX_CALENDAR = 50000;

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
      notify('Clé Claude enregistrée.');
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
        La clé est chiffrée et n'est jamais affichée.
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
          {busy ? 'Enregistrement...' : 'Enregistrer la clé'}
        </button>
      </div>
    </div>
  );
}

export function ReferenceCalendarForm({ configured, onSaved, notify }) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text.slice(0, MAX_CALENDAR));
    notify(`Fichier "${file.name}" chargé. Vérifiez le contenu puis enregistrez.`);
  };

  const save = async () => {
    if (!content.trim()) {
      notify('Le calendrier est vide.');
      return;
    }
    setBusy(true);
    try {
      await api.profile.saveReferenceCalendar(content);
      setContent('');
      notify('Calendrier de référence enregistré.');
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
        Statut : {configured ? <strong className="text-emerald-700">calendrier enregistré</strong> : <strong>aucun calendrier</strong>}.
        L'IA s'appuie dessus pour reprendre votre ton et votre ligne éditoriale.
      </p>
      <p className="text-[11px] text-stone-500">
        Formats acceptés : .csv, .txt, .md. Pour un fichier Excel, Word ou PDF, exportez-le d'abord en CSV ou en texte,
        ou collez son contenu ci-dessous.
      </p>
      <input type="file" accept=".csv,.txt,.md" onChange={onFile} className="text-xs" />
      <textarea
        rows={10}
        className={input}
        value={content}
        maxLength={MAX_CALENDAR}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Collez ici votre calendrier éditorial de référence..."
      />
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-stone-500">{content.length} / {MAX_CALENDAR}</span>
        <button
          onClick={save}
          disabled={busy || !content.trim()}
          className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow disabled:opacity-50"
        >
          {busy ? 'Enregistrement...' : 'Enregistrer le calendrier'}
        </button>
      </div>
    </div>
  );
}
