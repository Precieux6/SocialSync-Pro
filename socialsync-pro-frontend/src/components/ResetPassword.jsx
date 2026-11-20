// socialsync-pro-frontend/src/components/ResetPassword.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const inputClass =
  'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-amber-600';

export default function ResetPassword({ notify, onDone }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    if (pw !== confirm) return setError('Les deux mots de passe ne correspondent pas.');

    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      setError(`${err.message}. Le lien est peut-être expiré : refaites une demande depuis la page de connexion.`);
      return;
    }

    // Reconnexion explicite avec le nouveau mot de passe
    await supabase.auth.signOut();
    notify('Mot de passe mis à jour. Connectez-vous avec le nouveau mot de passe.');
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-stone-900 font-sans p-4">
      <div className="bg-white p-8 rounded-3xl border border-[#E2D5C3] shadow-xl w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <img src="/logo-social-sync-pro.png" alt="SocialSync Pro" className="mx-auto h-20 w-20 object-contain" />
          <h2 className="text-2xl font-serif font-bold">Nouveau mot de passe</h2>
          <p className="text-xs text-stone-500 uppercase tracking-widest">Choisissez un mot de passe</p>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Masquer' : 'Afficher'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-900 text-base px-1"
              >
                {show ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Confirmer</label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-amber-200 font-bold text-xs rounded-2xl shadow-md uppercase tracking-wider disabled:opacity-50"
          >
            {busy ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
