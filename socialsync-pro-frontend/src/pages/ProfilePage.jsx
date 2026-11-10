// socialsync-pro-frontend/src/pages/ProfilePage.jsx
import React, { useEffect, useState } from 'react';
import { api, uploadFile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClaudeKeyForm, ReferenceCalendarForm } from '../components/setup/SetupForms';

export const TIMEZONES = [
  'Europe/Paris', 'Africa/Porto-Novo', 'Africa/Abidjan', 'Africa/Casablanca',
  'America/Montreal', 'America/New_York', 'Pacific/Tahiti', 'UTC',
];

const input =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500';

export default function ProfilePage({ notify }) {
  const { user, isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', avatar: '', timezone: 'Europe/Paris' });
  const [settings, setSettings] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  const load = async () => {
    const r = await api.profile.get();
    setForm({
      name: r.profile.name || '',
      bio: r.profile.bio || '',
      avatar: r.profile.avatar || '',
      timezone: r.profile.timezone || 'Europe/Paris',
    });
    setSettings(r.settings);
  };

  useEffect(() => {
    load().catch((e) => notify(e.message)).finally(() => setLoading(false));
  }, [notify]);

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      notify('Choisissez une image.');
      return;
    }
    try {
      const url = await uploadFile('avatars', `${user.id}/avatar`, file);
      setForm((f) => ({ ...f, avatar: `${url}?v=${Date.now()}` }));
      notify('Photo importée. Pensez à enregistrer.');
    } catch (err) {
      notify(err.message);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.profile.update(form);
      notify('Profil enregistré.');
    } catch (e) {
      notify(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 8) return notify('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    if (pw.next !== pw.confirm) return notify('Les deux mots de passe ne correspondent pas.');
    try {
      await api.profile.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      notify('Mot de passe modifié.');
    } catch (e) {
      notify(e.message);
    }
  };

  if (loading) return <p className="text-xs text-stone-500">Chargement...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
        <h2 className="text-2xl font-serif font-bold text-stone-900">Mon profil & paramètres</h2>
        <p className="text-xs text-stone-500 mt-1">Vos informations personnelles, votre photo, votre fuseau horaire et votre sécurité.</p>
      </div>

      <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-4 border-b border-[#E2D5C3] pb-6">
          <div className="relative">
            {form.avatar ? (
              <img src={form.avatar} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover border-2 border-gold-500" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-stone-900 text-amber-200 flex items-center justify-center font-serif font-bold text-xl">
                {(form.name || user.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 bg-stone-900 text-amber-200 p-1.5 rounded-full cursor-pointer shadow text-[10px]">
              <i className="fa-solid fa-camera"></i>
              <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
            </label>
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-900">{form.name || user.email}</h3>
            <span className="text-xs text-stone-500">{user.email}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Prénom & Nom</label>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Fuseau horaire</label>
            <select className={`${input} font-bold`} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Bio</label>
          <textarea rows={3} className={`${input} leading-relaxed`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>

        <div className="flex justify-end">
          <button onClick={saveProfile} disabled={saving} className="px-6 py-3 bg-stone-900 text-amber-200 text-xs font-bold rounded-2xl shadow disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
          </button>
        </div>

        <div className="pt-6 border-t border-[#E2D5C3] space-y-4">
          <h4 className="font-serif font-bold text-sm text-stone-900">Sécurité</h4>
          <input type="password" className={input} placeholder="Mot de passe actuel" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="password" className={input} placeholder="Nouveau mot de passe" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <input type="password" className={input} placeholder="Confirmer le nouveau mot de passe" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button onClick={changePassword} disabled={!pw.current || !pw.next} className="px-5 py-2.5 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold disabled:opacity-50">
              Changer le mot de passe
            </button>
          </div>
        </div>

        {isOwner && (
          <div className="pt-6 border-t border-[#E2D5C3] space-y-6">
            <div className="space-y-3">
              <h4 className="font-serif font-bold text-sm text-stone-900">Intelligence artificielle (Claude)</h4>
              <ClaudeKeyForm configured={Boolean(settings?.has_claude_key)} onSaved={() => load().catch(() => {})} notify={notify} />
            </div>
            <div className="space-y-3">
              <h4 className="font-serif font-bold text-sm text-stone-900">Calendrier éditorial de référence</h4>
              <ReferenceCalendarForm configured={Boolean(settings?.has_reference_calendar)} onSaved={() => load().catch(() => {})} notify={notify} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
