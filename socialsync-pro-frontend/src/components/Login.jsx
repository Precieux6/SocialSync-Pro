import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false); // Bascule Connexion / Inscription
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Community Manager'); // Rôle par défaut
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isSignUp) {
      // Inscription
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: role }
        }
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        // Insertion explicite du rôle et profil dans la table team_member
        if (data?.user) {
          const { error: insertError } = await supabase.from('team_member').insert([
            {
              id: data.user.id,
              name: fullName,
              email: email,
              role: role,
              status: 'Actif'
            }
          ]);
          if (insertError) {
            console.warn("Avertissement insert team_member:", insertError.message);
          }
        }

        setSuccessMsg("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
        setIsSignUp(false);
      }
    } else {
      // Connexion
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        onLoginSuccess(data.user);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-stone-900 font-sans p-4">
      <div className="bg-white p-8 rounded-3xl border border-[#E2D5C3] shadow-xl w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-serif font-bold">SocialSync Pro</h2>
          <p className="text-xs text-stone-500 uppercase tracking-widest">
            {isSignUp ? 'Créer un nouveau compte' : 'Espace Sécurisé — Frédéric Barbey'}
          </p>
        </div>
        
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Nom complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-amber-600"
                  placeholder="Frédéric Barbey"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Rôle au sein de l'équipe</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 font-bold focus:outline-none focus:border-amber-600"
                >
                  <option value="Propriétaire">Propriétaire</option>
                  <option value="Community Manager">Community Manager</option>
                  <option value="Éditeur">Éditeur</option>
                  <option value="Relecteur / Client">Relecteur / Client</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-amber-600"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-amber-600"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-amber-200 font-bold text-xs rounded-2xl transition-all shadow-md uppercase tracking-wider cursor-pointer"
          >
            {loading ? 'Traitement...' : (isSignUp ? "S'inscrire" : 'Se connecter')}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#E2D5C3]">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(null); setSuccessMsg(null); }}
            className="text-xs text-stone-600 hover:text-gold-700 font-semibold transition-colors"
          >
            {isSignUp ? "Vous avez déjà un compte ? Se connecter" : "Pas encore de compte ? Créer un compte"}
          </button>
        </div>
      </div>
    </div>
  );
}
