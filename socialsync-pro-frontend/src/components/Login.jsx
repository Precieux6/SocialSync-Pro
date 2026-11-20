// socialsync-pro-frontend/src/components/Login.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { api } from '../services/api';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const switchMode = (next) => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'forgot') {
        await api.auth.forgotPassword(email.trim());
        setSuccessMsg("Si un compte existe pour cette adresse, un e-mail avec un lien de réinitialisation vient d'être envoyé.");
      } else if (mode === 'signup') {
        // Le profil est créé par le trigger SQL ; aucun rôle n'est choisi ici (rôles par invitation uniquement)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
          setMode('login');
          setPassword('');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErrorMsg(error.message);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: 'Espace sécurisé',
    signup: 'Créer un nouveau compte',
    forgot: 'Réinitialiser le mot de passe',
  };

  const buttonLabel = loading
    ? 'Traitement...'
    : mode === 'signup'
      ? "S'inscrire"
      : mode === 'forgot'
        ? 'Envoyer le lien'
        : 'Se connecter';

  const inputClass =
    'w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-amber-600';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-stone-900 font-sans p-4">
      <div className="bg-white p-8 rounded-3xl border border-[#E2D5C3] shadow-xl w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <img
            src="/logo-social-sync-pro.png"
            alt="SocialSync Pro"
            className="mx-auto h-24 w-24 object-contain"
          />
          <h2 className="text-2xl font-serif font-bold">SocialSync Pro</h2>
          <p className="text-xs text-stone-500 uppercase tracking-widest">{titles[mode]}</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl">{successMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
                placeholder="Prénom Nom"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="votre@email.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className={`${inputClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-900 text-base px-1"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {mode === 'login' && (
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] font-semibold text-stone-500 hover:text-gold-700 underline underline-offset-2"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-amber-200 font-bold text-xs rounded-2xl transition-all shadow-md uppercase tracking-wider disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#E2D5C3] space-y-2">
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-xs text-stone-600 hover:text-gold-700 font-semibold transition-colors"
            >
              Pas encore de compte ? Créer un compte
            </button>
          )}
          {mode !== 'login' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs text-stone-600 hover:text-gold-700 font-semibold transition-colors"
            >
              Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
