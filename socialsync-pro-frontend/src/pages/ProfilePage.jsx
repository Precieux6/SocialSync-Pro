// socialsync-pro-frontend/src/pages/ProfilePage.jsx
import React, { useEffect, useState } from 'react';
import { api, uploadFile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { ClaudeKeyForm, ReferenceCalendarForm } from '../components/setup/SetupForms';

export const TIMEZONES = [
  'Europe/Paris', 'Africa/Porto-Novo', 'Africa/Abidjan', 'Africa/Casablanca',
  'America/Montreal', 'America/New_York', 'Pacific/Tahiti', 'UTC',
];

const input =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500';

export default function ProfilePage({ notify }) {
  const { user, isOwner, myProfile, refreshProfiles, handleLogout } = useAuth();

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', bio: '', avatar: '', timezone: 'Europe/Paris' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  const [accountState, setAccountState] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);

  useEffect(() => {
    if (!myProfile) return;
    setForm({
      name: myProfile.name || '',
      bio: myProfile.bio || '',
      avatar: myProfile.avatar || '',
      timezone: myProfile.timezone || 'Europe/Paris',
    });
  }, [myProfile]);

  const loadSettings = async () => {
    if (!isOwner) return;
    try {
      const r = await api.profile.get();
      setSettings(r.settings);
    } catch (e) {
      notify(e.message);
    }
  };

  const loadAccountState = async () => {
    try {
      const r = await api.account.status();
      setAccountState(r);
    } catch (e) {
      notify(e.message);
    }
  };

  useEffect(() => {
    loadSettings();
    loadAccountState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      notify('Choisissez une image.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const url = await uploadFile('avatars', `${user.id}/avatar`, file);
      setForm((f) => ({ ...f, avatar: `${url}?v=${Date.now()}` }));
      notify('Photo importée. Pensez à enregistrer.');
    } catch (err) {
      notify(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.profile.update(form);
      await refreshProfiles();
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

  const deactivate = async () => {
    setDangerBusy(true);
    try {
      const r = await api.account.deactivate(confirmText.trim());
      notify('Compte désactivé. Suppression définitive prévue dans 30 jours.');
      setConfirmText('');
      setAccountState({ success: true, deactivatedAt: new Date().toISOString(), deletionScheduledFor: r.deletionScheduledFor });
    } catch (e) {
      notify(e.message);
    } finally {
      setDangerBusy(false);
    }
  };

  const reactivate = async () => {
    setDangerBusy(true);
    try {
      await api.account.reactivate();
      notify('Compte réactivé.');
      await loadAccountState();
    } catch (e) {
      notify(e.message);
    } finally {
      setDangerBusy(false);
    }
  };

  const deleteNow = async () => {
    if (!window.confirm('Supprimer définitivement votre compte et toutes vos données ? Action irréversible.')) return;
    setDangerBusy(true);
    try {
      await api.account.deleteNow(confirmText.trim());
      await supabase.auth.signOut().catch(() => {});
      handleLogout();
    } catch (e) {
      notify(e.message);
      setDangerBusy(false);
    }
  };

  if (!myProfile) return <p className="text-xs text-stone-500">Chargement du profil...</p>;

  const displayName = form.name || myProfile.email || user?.email || 'Utilisateur';
  const initial = displayName.trim().charAt(0).toUpperCase();
  const isDeactivated = Boolean(accountState?.deactivatedAt);
  const confirmOk = confirmText.trim().toUpperCase() === 'SUPPRIMER'
    || confirmText.trim().toLowerCase() === (myProfile.email || user?.email || '').toLowerCase();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
        <h2 className="text-2xl font-serif font-bold text-stone-900">Mon profil & paramètres</h2>
        <p className="text-xs text-stone-500 mt-1">
          Vos informations personnelles, votre photo, votre fuseau horaire et votre sécurité.
        </p>
      </div>

      <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-4 border-b border-[#E2D5C3] pb-6">
          <div className="relative">
            {form.avatar ? (
              <img src={form.avatar} alt={displayName} className="w-16 h-16 rounded-2xl object-cover border-2 border-gold-500" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-stone-900 text-amber-200 flex items-center justify-center font-serif font-bold text-xl">
                {initial}
              </div>
            )}
            <label
              className={`absolute -bottom-1 -right-1 bg-stone-900 text-amber-200 p-1.5 rounded-full cursor-pointer shadow text-[10px] ${
                uploadingAvatar ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <i className="fa-solid fa-camera"></i>
              <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
            </label>
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-900">{displayName}</h3>
            <span className="text-xs text-stone-500">{myProfile.email || user?.email}</span>
            <span className="ml-2 text-[10px] font-bold text-gold-800">{isOwner ? 'Propriétaire' : 'Membre'}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Prénom & Nom</label>
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Votre nom complet" />
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
            <button onClick={saveProfile} disabled={saving || uploadingAvatar} className="px-6 py-3 bg-stone-900 text-amber-200 text-xs font-bold rounded-2xl shadow disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
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
              <ClaudeKeyForm configured={Boolean(settings?.has_claude_key)} onSaved={loadSettings} notify={notify} />
            </div>
            <div className="space-y-3">
              <h4 className="font-serif font-bold text-sm text-stone-900">Calendrier éditorial de référence</h4>
              <ReferenceCalendarForm
                configured={Boolean(settings?.has_reference_calendar)}
                sourceName={settings?.reference_calendar_name}
                onSaved={loadSettings}
                notify={notify}
              />
            </div>
          </div>
        )}

        <div className="pt-6 border-t-2 border-red-200 space-y-4">
          <h4 className="font-serif font-bold text-sm text-red-700">Zone de danger</h4>

          {isDeactivated ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-amber-900">
                Compte désactivé. Suppression définitive prévue le{' '}
                <strong>{new Date(accountState.deletionScheduledFor).toLocaleDateString('fr-FR')}</strong>.
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={reactivate} disabled={dangerBusy} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold disabled:opacity-50">
                  Réactiver mon compte
                </button>
                <button onClick={deleteNow} disabled={dangerBusy} className="px-5 py-2.5 rounded-xl bg-red-700 text-white text-xs font-bold disabled:opacity-50">
                  Supprimer définitivement maintenant
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-red-800">
                La désactivation retire immédiatement votre accès. Votre compte est supprimé définitivement dans 30 jours, sauf réactivation.
              </p>
              {isOwner && (
                <p className="text-[11px] text-red-700">
                  Propriétaire : retirez ou transférez d'abord les membres de votre équipe.
                </p>
              )}
              <input
                className={input}
                placeholder={`Tapez SUPPRIMER ou ${myProfile.email || user?.email || ''}`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <div className="flex justify-end">
                <button onClick={deactivate} disabled={!confirmOk || dangerBusy} className="px-5 py-2.5 rounded-xl bg-red-700 text-white text-xs font-bold disabled:opacity-50">
                  Désactiver mon compte
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
