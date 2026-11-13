// socialsync-pro-frontend/src/components/setup/Onboarding.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import {
  SocialAccountsForm,
  ClaudeKeyForm,
  ReferenceCalendarForm,
  clearSecretDrafts,
} from './SetupForms';

const STEP_KEY = 'onboarding_current_step';

const STEPS = [
  {
    key: 'socialAccounts',
    required: true,
    title: '1. Connecter vos comptes réseaux',
    text: "Renseignez les identifiants d'au moins un compte (Instagram, Facebook, YouTube ou TikTok). Obligatoire.",
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
    text: "Active la génération de légendes et de contenus. Facultatif : vous pourrez l'ajouter plus tard dans « Mon profil ».",
  },
];

const firstOpen = (status) => {
  const i = STEPS.findIndex((s) => s.required && !status[s.key]);
  return i === -1 ? 0 : i;
};

const BTN_PRIMARY = 'px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow hover:bg-stone-800';
const BTN_SECONDARY = 'px-5 py-2.5 rounded-xl bg-[#F4EFE6] border border-[#E2D5C3] text-stone-700 text-xs font-bold hover:bg-[#E8DFC9]';

export default function Onboarding({ onComplete, onLogout, notify }) {
  const [status, setStatus] = useState({ socialAccounts: false, claudeKey: false, referenceCalendar: false });

  // Mémorisé avant tout effet : sans cela, l'écriture de l'étape empêcherait la première étape automatique
  const [hadSavedStep] = useState(() => localStorage.getItem(STEP_KEY) !== null);

  const [step, setStep] = useState(() => {
    const saved = parseInt(localStorage.getItem(STEP_KEY) ?? '', 10);
    return Number.isInteger(saved) && saved >= 0 && saved < STEPS.length ? saved : 0;
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  // Chargement de l'état : au montage et via « Réessayer » (sans recharger la page)
  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await api.setup.status();
      setStatus(r.status);
      if (!hadSavedStep) setStep(firstOpen(r.status));
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [hadSavedStep]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Après un enregistrement : mise à jour de l'état seulement.
  // Pas de changement d'étape automatique et pas de démontage du formulaire.
  const refresh = useCallback(async () => {
    try {
      const r = await api.setup.status();
      setStatus(r.status);
    } catch (e) {
      notify(e.message);
    }
  }, [notify]);

  const finish = () => {
    localStorage.removeItem(STEP_KEY);
    clearSecretDrafts();
    notify('Configuration terminée. Bienvenue dans SocialSync Pro !');
    onComplete();
  };

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

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
            <button onClick={loadStatus} className={BTN_PRIMARY}>
              Réessayer
            </button>
            <button onClick={onLogout} className={BTN_SECONDARY}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = STEPS[step] || STEPS[0];
  const isLast = step === STEPS.length - 1;
  const currentDone = Boolean(status[current.key]);
  const requiredTotal = STEPS.filter((s) => s.required).length;
  const requiredDone = STEPS.filter((s) => s.required && status[s.key]).length;
  const complete = requiredDone === requiredTotal;

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

          {current.key === 'socialAccounts' && <SocialAccountsForm onSaved={refresh} notify={notify} />}
          {current.key === 'claudeKey' && <ClaudeKeyForm configured={status.claudeKey} onSaved={refresh} notify={notify} />}
          {current.key === 'referenceCalendar' && (
            <ReferenceCalendarForm configured={status.referenceCalendar} onSaved={refresh} notify={notify} />
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[#E2D5C3]">
            {!current.required && !currentDone && (
              <button onClick={goNext} className={BTN_SECONDARY}>
                Plus tard
              </button>
            )}
            {currentDone && !isLast && (
              <button onClick={goNext} className={BTN_SECONDARY}>
                Étape suivante
              </button>
            )}
            {complete && (
              <button onClick={finish} className={BTN_PRIMARY}>
                Accéder à SocialSync Pro
              </button>
            )}
          </div>
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
