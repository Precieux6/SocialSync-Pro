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

function OwnerAvatar({ src, name }) {
  if (src) {
    return <img src={src} alt={name} className="w-10 h-10 rounded-xl object-cover border border-gold-500 shrink-0" />;
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-200 font-serif font-bold flex items-center justify-center shrink-0">
      {initial}
    </div>
  );
}

export default function Sidebar({
  tab,
  onNavigate,
  isOwner,
  isOwnSpace,
  ownerName,
  ownerAvatar,
  ownerBio,
  roleLabel,
  onLogout,
  open,
  onClose,
}) {
  const go = (id) => {
    onNavigate(id);
    if (onClose) onClose();
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-stone-900/50 z-40 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#F4EFE6] border-r border-[#E2D5C3] p-6 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-8">
          <button onClick={() => go('calendar')} className="flex items-center gap-3 text-left w-full">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-900 flex items-center justify-center border border-gold-400 shadow shrink-0">
              <img 
                src="/logo.png" 
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

          {/* Encadré Espace avec le libellé correct et le nom de l'utilisateur sur la deuxième ligne */}
          <div className="p-3.5 rounded-2xl bg-stone-900 text-amber-200 flex items-center gap-3 shadow-lg">
            <OwnerAvatar src={ownerAvatar} name={ownerName} />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                {isOwnSpace ? 'Mon espace' : 'Espace partagé'}
              </span>
              <h4 className="font-serif font-bold text-xs truncate">{ownerName || '—'}</h4>
              {ownerBio && <span className="text-[10px] opacity-80 truncate block">{ownerBio}</span>}
            </div>
          </div>

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

        <div className="pt-6 border-t border-[#E2D5C3] space-y-3">
          {roleLabel && (
            <p className="text-[10px] text-stone-500 text-center">Votre rôle : {roleLabel}</p>
          )}
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
