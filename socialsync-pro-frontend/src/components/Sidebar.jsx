// socialsync-pro-frontend/src/components/Sidebar.jsx
import React from 'react';

const MAIN_ITEMS = [
  { id: 'calendar', label: 'Calendrier éditorial', icon: 'fa-regular fa-calendar-days' },
  { id: 'to_film', label: 'À tourner', icon: 'fa-solid fa-clapperboard' },
  { id: 'comments', label: 'Mes commentaires', icon: 'fa-regular fa-comments' },
  { id: 'media', label: 'Médiathèque', icon: 'fa-solid fa-photo-film' },
  { id: 'analytics', label: 'Mes statistiques', icon: 'fa-solid fa-chart-line' },
  { id: 'profile', label: 'Mon profil & paramètres', icon: 'fa-regular fa-user' },
];

const ADMIN_ITEMS = [
  { id: 'team', label: 'Équipes & accès', icon: 'fa-solid fa-users' },
  { id: 'apis', label: 'APIs réseaux', icon: 'fa-solid fa-key' },
];

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
        active ? 'bg-stone-900 text-amber-200 shadow-sm' : 'text-stone-700 hover:bg-[#E8DFC9]/60'
      }`}
    >
      <i className={`${item.icon} text-sm w-4 text-center`}></i>
      <span>{item.label}</span>
    </button>
  );
}

function UserAvatar({ src, name }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-10 h-10 rounded-xl object-cover border border-gold-500 shrink-0"
      />
    );
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-xl bg-amber-200 text-stone-900 font-serif font-bold flex items-center justify-center shrink-0">
      {initial}
    </div>
  );
}

export default function Sidebar({
  tab,
  onNavigate,
  isOwner,
  userName,
  userAvatar,
  roleLabel,
  spaceName,
  spaces = [],
  activeSpace,
  onSwitchSpace,
  onLogout,
  open,
  onClose,
}) {
  const go = (id) => {
    onNavigate(id);
    if (onClose) onClose();
  };

  const displayName = (userName || '').trim() || 'Utilisateur';
  const showSpaceSelector = spaces.length > 1 && typeof onSwitchSpace === 'function';

  return (
    <>
      {open && <div className="fixed inset-0 bg-stone-900/50 z-40 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#F4EFE6] border-r border-[#E2D5C3] p-6 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-8">
          {/* Logo officiel */}
          <button onClick={() => go('calendar')} className="flex items-center gap-3 text-left w-full">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-900 flex items-center justify-center border border-gold-400 shadow shrink-0">
              <img
                src="/logo-social-sync-pro.png"
                alt="SocialSync Pro Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.innerHTML = '<span class="text-amber-200 font-serif font-bold text-xs">SSP</span>';
                  }
                }}
              />
            </div>
            <div>
              <h1 className="font-serif font-bold text-stone-900 text-sm tracking-wide">SOCIALSYNC PRO</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-gold-700">Studio éditorial</span>
            </div>
          </button>

          {/* Encadré : utilisateur connecté, son rôle, et l'espace consulté si ce n'est pas le sien */}
          <div className="p-3.5 rounded-2xl bg-stone-900 text-amber-200 flex items-center gap-3 shadow-lg">
            <UserAvatar src={userAvatar} name={displayName} />
            <div className="min-w-0">
              <h4 className="font-serif font-bold text-xs truncate">{displayName}</h4>
              {roleLabel && (
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75 mt-0.5">
                  {roleLabel}
                </span>
              )}
              {spaceName && (
                <span className="text-[10px] block opacity-75 truncate mt-1">
                  Espace : {spaceName}
                </span>
              )}
            </div>
          </div>

          {/* Sélecteur d'espace : visible seulement si l'utilisateur a accès à plusieurs espaces */}
          {showSpaceSelector && (
            <div className="space-y-1.5">
              <label
                htmlFor="space-selector"
                className="block text-[10px] font-bold uppercase tracking-wider text-stone-600"
              >
                Espace de travail
              </label>
              <select
                id="space-selector"
                value={activeSpace?.ownerId ?? ''}
                onChange={(e) => onSwitchSpace(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E2D5C3] rounded-xl p-2.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-gold-500"
              >
                {spaces.map((s) => (
                  <option key={s.ownerId} value={s.ownerId}>
                    {s.isOwn ? 'Mon espace' : s.ownerName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav className="space-y-1.5">
            {MAIN_ITEMS.map((item) => (
              <NavItem key={item.id} item={item} active={tab === item.id} onClick={() => go(item.id)} />
            ))}

            {isOwner && (
              <div className="pt-4 mt-4 border-t border-[#E2D5C3] space-y-1.5">
                {ADMIN_ITEMS.map((item) => (
                  <NavItem key={item.id} item={item} active={tab === item.id} onClick={() => go(item.id)} />
                ))}
              </div>
            )}
          </nav>
        </div>

        <div className="pt-6 border-t border-[#E2D5C3]">
          <button
            onClick={onLogout}
            className="w-full bg-[#FAF7F2] hover:bg-[#E8DFC9] border border-[#E2D5C3] text-stone-800 text-xs font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <i className="fa-solid fa-right-from-bracket text-stone-600"></i>
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
}
