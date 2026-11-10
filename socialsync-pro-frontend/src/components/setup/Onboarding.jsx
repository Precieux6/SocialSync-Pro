// socialsync-pro-frontend/src/components/setup/Onboarding.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SocialAccountsForm, ClaudeKeyForm, ReferenceCalendarForm } from './SetupForms';

const STEP_KEYS = ['socialAccounts', 'claudeKey', 'referenceCalendar'];

const STEPS = [
  {
    title: '1. Connecter vos comptes réseaux',
    text: 'Renseignez les identifiants de vos comptes Instagram, Facebook, YouTube et TikTok. Un seul réseau suffit pour démarrer.',
  },
  {
    title: '2. Ajouter votre clé API Claude',
    text: "Cette clé alimente la génération des légendes et des contenus. Elle est chiffrée et réservée au propriétaire.",
  },
  {
    title: '3. Calendrier éditorial de référence',
    text: "Importez votre calendrier actuel. L'IA s'en imprègne avant de prendre le relais pour les prochaines générations.",
  },
];

const firstOpen = (status) => {
  const i = STEP_KEYS.findIndex((k) => !status[k]);
  return i === -1 ? 0 : i;
};

export default function Onboarding({ onComplete, onLogout, notify }) {
  const [status, setStatus] = useState({ socialAccounts: false, claudeKey: false, referenceCalendar: false });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await api.setup.status();
    setStatus(r.status);
    return r;
  }, []);

  useEffect(() => {
    load()
      .then((r) => setStep(firstOpen(r.status)))
      .catch((e) => notify(e.message))
      .finally(() => setLoading(false));
  }, [load, notify]);

  const onSaved = async () => {
    const r = await load();
    if (r.complete) {
      notify('Configuration terminée. Bienvenue dans SocialSync Pro !');
      onComplete();
    } else {
      setStep(firstOpen(r.status));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs font-bold uppercase tracking-widest text-stone-500">
        Chargement...
      </div>
    );
  }

  const current = STEPS[step];
  const doneCount = STEP_KEYS.filter((k) => status[k]).length;

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-10 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2D5C3] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <img src="/logo-social-sync-pro.png" alt="SocialSync Pro" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="font-serif font-bold text-xl text-stone-900">Bienvenue sur SocialSync Pro</h1>
              <p className="text-xs text-stone-500">
                Terminez la configuration de votre studio ({doneCount} / {STEP_KEYS.length} étapes) pour accéder à l'interface.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setStep(i)}
                className={`text-left rounded-2xl border p-3 text-xs font-bold transition-all ${
                  i === step ? 'border-gold-500 bg-[#F4EFE6]' : 'border-[#E2D5C3] bg-[#FAF7F2] hover:border-gold-500'
                }`}
              >
                <span className="block">{s.title}</span>
                <span className={`text-[10px] ${status[STEP_KEYS[i]] ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {status[STEP_KEYS[i]] ? '✓ Terminé' : 'À faire'}
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

          {step === 0 && <SocialAccountsForm onSaved={onSaved} notify={notify} />}
          {step === 1 && <ClaudeKeyForm configured={status.claudeKey} onSaved={onSaved} notify={notify} />}
          {step === 2 && <ReferenceCalendarForm configured={status.referenceCalendar} onSaved={onSaved} notify={notify} />}
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
