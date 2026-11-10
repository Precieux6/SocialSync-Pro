// socialsync-pro-frontend/src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const ALL_ROLES = ['Propriétaire', 'Community Manager', 'Éditeur', 'Relecteur / Client'];
const MEMBER_ROLES = ['Community Manager', 'Éditeur', 'Relecteur / Client'];

const allMenuItems = [
  { id: 'calendar', label: 'Calendrier Éditorial', icon: 'fa-regular fa-calendar-days', roles: ALL_ROLES },
  { id: 'to_film', label: 'À tourner', icon: 'fa-solid fa-clapperboard', roles: ALL_ROLES, badgeKey: 'videosCount' },
  { id: 'comments', label: 'Mes commentaires', icon: 'fa-regular fa-comments', roles: ALL_ROLES, badgeKey: 'commentsCount' },
  { id: 'media', label: 'Médiathèque', icon: 'fa-solid fa-photo-film', roles: ALL_ROLES },
  { id: 'analytics', label: 'Mes Statistiques', icon: 'fa-solid fa-chart-line', roles: ALL_ROLES },
  { id: 'users', label: 'Mon équipe & accès', icon: 'fa-solid fa-users', roles: ['Propriétaire'] },
  { id: 'settings', label: 'APIs Réseaux', icon: 'fa-solid fa-key', roles: ['Propriétaire'] },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  videosCount,
  commentsCount,
  onLogout,
}) {
  const { userRole, spaces, activeSpace, switchSpace } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.profile
      .get()
      .then((res) => {
        if (!cancelled) setProfile(res.profile);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = { videosCount, commentsCount };
  const menuItems = allMenuItems
    .filter((item) => !userRole || item.roles.includes(userRole))
    .map((item) => ({
      ...item,
      badge: item.badgeKey ? counts[item.badgeKey] : undefined,
    }));

  const displayName = profile?.name || 'Chargement…';
  const displayBio = profile?.bio || '';

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-stone-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#F4EFE6] border-r border-[#E2D5C3] p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-200 font-serif font-bold text-lg flex items-center justify-center shadow">
              S
            </div>
            <div>
              <h1 className="font-serif font-bold text-stone-900 text-sm tracking-wide">SOCIALSYNC PRO</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-gold-700">Studio Éditorial</span>
            </div>
          </div>

          <div
            onClick={() => {
              setActiveTab('profile');
              setIsMobileMenuOpen(false);
            }}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
              activeTab === 'profile'
                ? 'bg-stone-900 text-amber-200 border-stone-900 shadow-md'
                : 'bg-[#FAF7F2] border-[#E2D5C3] hover:border-gold-500'
            }`}
          >
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={displayName}
                className="w-10 h-10 rounded-xl object-cover border border-gold-500"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#E8DFC9] border border-gold-500 flex items-center justify-center text-xs font-bold text-stone-700">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                Espace actif ({userRole || '—'})
              </span>
              <h4 className="font-serif font-bold text-xs truncate">{displayName}</h4>
              {displayBio && (
                <span className="text-[10px] opacity-80 truncate block">{displayBio}</span>
              )}
            </div>
          </div>

          {spaces.length > 1 && (
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-600">
                Changer d'espace
              </label>
              <select
                value={activeSpace?.ownerId || ''}
                onChange={(e) => {
                  switchSpace(e.target.value);
                  setActiveTab('calendar');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full bg-[#FAF7F2] border border-[#E2D5C3] rounded-xl p-2.5 text-xs text-stone-800 focus:outline-none focus:border-gold-500"
              >
                {spaces.map((s) => (
                  <option key={s.ownerId} value={s.ownerId}>
                    {s.ownerName} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav className="space-y-1.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === item.id
                    ? 'bg-stone-900 text-amber-200 shadow-sm'
                    : 'text-stone-700 hover:bg-[#E8DFC9]/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i
                    className={`${item.icon} text-sm ${
                      activeTab === item.id ? 'text-gold-400' : 'text-stone-500'
                    }`}
                  ></i>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === item.id ? 'bg-amber-200 text-stone-900' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-[#E2D5C3]">
          <button
            onClick={onLogout}
            className="w-full bg-[#FAF7F2] hover:bg-[#E8DFC9] border border-[#E2D5C3] text-stone-800 text-xs font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <i className="fa-solid fa-right-from-bracket text-stone-600"></i>
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
}
