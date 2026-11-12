// socialsync-pro-frontend/src/App.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Onboarding from './components/setup/Onboarding';
import CalendarPage from './pages/CalendarPage';
import ProfilePage from './pages/ProfilePage';
import { ToFilmPage, MediaPage, CommentsPage, AnalyticsPage } from './pages/WorkspacePages';
import { TeamPage, ApisPage } from './pages/AdminPages';
import { api } from './services/api';

const OWNER_TABS = ['team', 'apis'];

const Loader = ({ text = 'Chargement de SocialSync Pro...' }) => (
  <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs font-bold uppercase tracking-widest text-stone-500">
    {text}
  </div>
);

export default function App() {
  const {
    session,
    loadingSession,
    isOwner,
    isOwnSpace,
    activeSpace,
    userRole,
    ownerName,
    myName,
    myAvatar,
    invitationError,
    handleLogout,
  } = useAuth();

  const [tab, setTab] = useState('calendar');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [setup, setSetup] = useState({ loading: true, complete: false, error: null });

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Signale un échec d'acceptation d'invitation
  useEffect(() => {
    if (invitationError) {
      notify(`Invitation non acceptée : ${invitationError}`);
    }
  }, [invitationError, notify]);

  // Espace propre du propriétaire connecté
  const ownSpace = Boolean(session && isOwner && isOwnSpace && activeSpace?.ownerId === session.user.id);

  const refreshSetup = useCallback(async () => {
    // Un membre invité n'a pas de configuration à faire
    if (!isOwner || !activeSpace || activeSpace.ownerId !== session?.user?.id) {
      setSetup({ loading: false, complete: true, error: null });
      return;
    }
    setSetup((s) => ({ ...s, loading: true }));
    try {
      const r = await api.setup.status();
      setSetup({ loading: false, complete: r.complete, error: null });
    } catch (e) {
      setSetup({ loading: false, complete: false, error: e.message });
    }
  }, [isOwner, activeSpace, session?.user?.id]);

  useEffect(() => {
    if (!session || !activeSpace) return;
    refreshSetup();
  }, [session?.user?.id, activeSpace?.ownerId, ownSpace]);

  if (loadingSession) return <Loader />;
  if (!session) return <Login />;
  if (!activeSpace || setup.loading) return <Loader text="Préparation de votre espace..." />;

  if (setup.error && ownSpace) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E2D5C3] rounded-3xl p-8 max-w-md text-center space-y-4">
          <p className="text-sm text-stone-800">Impossible de charger votre espace : {setup.error}</p>
          <button onClick={refreshSetup} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // L'onboarding ne concerne que le propriétaire sur son propre espace, tant que sa configuration est incomplète
  if (ownSpace && !setup.complete) {
    return <Onboarding onComplete={refreshSetup} onLogout={handleLogout} notify={notify} />;
  }

  const currentTab = !isOwner && OWNER_TABS.includes(tab) ? 'calendar' : tab;

  const renderPage = () => {
    switch (currentTab) {
      case 'calendar': return <CalendarPage notify={notify} />;
      case 'to_film': return <ToFilmPage notify={notify} />;
      case 'comments': return <CommentsPage notify={notify} />;
      case 'media': return <MediaPage notify={notify} />;
      case 'analytics': return <AnalyticsPage />;
      case 'profile': return <ProfilePage notify={notify} />;
      case 'team': return <TeamPage notify={notify} />;
      case 'apis': return <ApisPage notify={notify} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-800 font-sans antialiased flex flex-col md:flex-row">
      {toast && (
        <div className="fixed top-5 right-5 z-[60] bg-stone-900 text-amber-200 text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-gold-500">
          {toast}
        </div>
      )}

      {/* Barre d'en-tête mobile */}
      <div className="md:hidden bg-[#F4EFE6] border-b border-[#E2D5C3] p-4 flex items-center justify-between">
        <button onClick={() => setTab('calendar')} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-stone-900 flex items-center justify-center border border-gold-400 shrink-0">
            <img
              src="/logo-social-sync-pro.png"
              alt="Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.innerHTML = '<span class="text-amber-200 font-serif font-bold text-[10px]">SSP</span>';
                }
              }}
            />
          </div>
          <span className="font-serif font-bold text-stone-900 text-sm">SocialSync Pro</span>
        </button>
        <button onClick={() => setMenuOpen(true)} className="p-2 text-stone-700">
          <i className="fa-solid fa-bars text-xl"></i>
        </button>
      </div>

      <Sidebar
        tab={currentTab}
        onNavigate={setTab}
        isOwner={isOwner}
        userName={myName}
        userAvatar={myAvatar}
        roleLabel={userRole}
        spaceName={isOwnSpace ? null : ownerName}
        onLogout={handleLogout}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8 space-y-6">
        {renderPage()}
      </main>
    </div>
  );
}
