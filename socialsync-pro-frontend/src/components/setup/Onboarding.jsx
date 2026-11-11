// socialsync-pro-frontend/src/components/setup/Onboarding.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SocialAccountsForm, ClaudeKeyForm, ReferenceCalendarForm } from './SetupForms';

const STEPS = [
  {
    key: 'socialAccounts',
    required: true,
    title: '1. Connecter vos comptes réseaux',
    text: 'Renseignez les identifiants d\'au moins un compte (Instagram, Facebook, YouTube ou TikTok). Obligatoire.',
  },
  {
    key: 'referenceCalendar',
    required: true,
    title: '2. Calendrier éditorial de référence',
    text: "Importez votre calendrier actuel. L'IA s'en imprègne avant de prendre le relais. Obligatoire.",
  },
  {
    key: 'claudeKey',
    required: false,
    title: '3. Clé API Claude',
    text: 'Active la génération de légendes et de contenus. Facultatif : vous pourrez l\'ajouter plus tard dans « Mon profil ».',
  },
];

const firstOpen = (status) => {
  const i = STEPS.findIndex((s) => s.required && !status[s.key]);
  return i === -1 ? 0 : i;
};

export default function Onboarding({ onComplete, onLogout, notify }) {
  const [status, setStatus] = useState({ socialAccounts: false, claudeKey: false, referenceCalendar: false });
  
  // Utilisation exclusive du localStorage pour verrouiller l'étape active sans écrasement distant intempestif
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem('onboarding_current_step');
    return saved !== null ? parseInt(saved, 10) : 0;
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Sauvegarde instantanée de l'étape active
  useEffect(() => {
    localStorage.setItem('onboarding_current_step', step);
  }, [step]);

  // Chargement initial unique au montage du composant (ne se relance plus jamais en arrière-plan)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.setup.status()
      .then((r) => {
        if (!isMounted) return;
        setStatus(r.status);
        // Si aucune étape n'est mémorisée, on positionne sur la première non validée
        if (localStorage.getItem('onboarding_current_step') === null) {
          setStep(firstOpen(r.status));
        }
      })
      .catch((e) => {
        if (isMounted) setLoadError(e.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []); // Tableau de dépendances vide pour bloquer tout rechargement cyclique

  const onSaved = async () => {
    try {
      const r = await api.setup.status();
      setStatus(r.status);

      if (r.complete) {
        // Nettoyage complet des caches d'onboarding une fois terminé
        localStorage.removeItem('onboarding_current_step');
        localStorage.removeItem('social_accounts_draft');
        localStorage.removeItem('claude_key_draft');
        notify('Configuration terminée. Bienvenue dans SocialSync Pro !');
        onComplete();
      } else {
        // Passage automatique à l'étape obligatoire suivante
        const nextStep = firstOpen(r.status);
        setStep(nextStep);
      }
    } catch (e) {
      notify(e.message);
    }
  };

  const skip = () => {
    const next = STEPS.findIndex((s, i) => i > step && s.required && !status[s.key]);
    setStep(next === -1 ? step + 1 : next);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs font-bold uppercase tracking-widest text-stone-500">
        Chargement de votre espace...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E2D5C3] rounded-3xl p-8 shadow-sm max-w-md w-full text-center space-y-4">
          <p className="text-sm text-stone-800">{loadError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow"
            >
              Réessayer
            </button>
            <button
              onClick={onLogout}
              className="px-5 py-2.5 rounded-xl bg-[#F4EFE6] text-stone-700 text-xs font-bold"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = STEPS[step] || STEPS[0];
  const requiredTotal = STEPS.filter((s) => s.required).length;
  const requiredDone = STEPS.filter((s) => s.required && status[s.key]).length;

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-10 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2D5C3] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <img src="/logo-social-sync-pro.png" alt="SocialSync Pro" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="font-serif font-bold text-xl text-stone-900">Bienvenue sur SocialSync Pro</h1>
              <p className="text-xs text-stone-500">
                Étapes obligatoires terminées : {requiredDone} / {requiredTotal}. Prenez le temps de renseigner vos informations en toute tranquillité.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={`text-left rounded-2xl border p-3 text-xs font-bold transition-all ${
                  i === step ? 'border-gold-500 bg-[#F4EFE6]' : 'border-[#E2D5C3] bg-[#FAF7F2] hover:border-gold-500'
                }`}
              >
                <span className="block">{s.title}</span>
                <span className={`text-[10px] ${status[s.key] ? 'text-emerald-700' : s.required ? 'text-amber-700' : 'text-stone-500'}`}>
                  {status[s.key] ? '✓ Terminé' : s.required ? 'À faire (obligatoire)' : 'Facultatif'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E2D5C3] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
          <div>
            <h2 className="font-serif font-bold text-lg text-stone-900">{current.title}</h2>
            <p className="text-xs text-stone-600 mt-1">{current.text}</p>
          </div>

          {current.key === 'socialAccounts' && <SocialAccountsForm onSaved={onSaved} notify={notify} />}
          {current.key === 'claudeKey' && <ClaudeKeyForm configured={status.claudeKey} onSaved={onSaved} notify={notify} />}
          {current.key === 'referenceCalendar' && (
            <ReferenceCalendarForm configured={status.referenceCalendar} onSaved={onSaved} notify={notify} />
          )}

          {!current.required && (
            <div className="flex justify-end pt-2 border-t border-[#E2D5C3]">
              <button onClick={skip} className="text-xs font-bold text-stone-600 hover:text-stone-900 px-4 py-2">
                Plus tard
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <button onClick={onLogout} className="text-xs font-bold text-stone-600 hover:text-stone-900">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
