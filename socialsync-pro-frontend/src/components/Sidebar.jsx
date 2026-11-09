import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, videosCount, commentsCount, userRole, onLogout }) {
  // Filtrage des menus selon le rôle (Ex: Masquer les accès équipes/APIs si le rôle n'est pas Propriétaire)
  const allMenuItems = [
    { id: 'calendar', label: 'Calendrier Éditorial', icon: 'fa-regular fa-calendar-days', roles: ['Propriétaire', 'Community Manager', 'Éditeur', 'Relecteur / Client'] },
    { id: 'to_film', label: 'À tourner', icon: 'fa-solid fa-clapperboard', badge: videosCount, roles: ['Propriétaire', 'Community Manager', 'Éditeur'] },
    { id: 'comments', label: 'Mes commentaires', icon: 'fa-regular fa-comments', badge: commentsCount, roles: ['Propriétaire', 'Community Manager'] },
    { id: 'media', label: 'Médiathèque', icon: 'fa-solid fa-photo-film', roles: ['Propriétaire', 'Community Manager', 'Éditeur'] },
    { id: 'analytics', label: 'Mes Statistiques', icon: 'fa-solid fa-chart-line', roles: ['Propriétaire', 'Community Manager'] },
    { id: 'users', label: 'Équipes & Accès', icon: 'fa-solid fa-users', roles: ['Propriétaire'] },
    { id: 'settings', label: 'APIs Réseaux', icon: 'fa-solid fa-key', roles: ['Propriétaire'] }
  ];

  // Filtre les onglets visibles selon le rôle actif (par défaut Propriétaire si non défini)
  const menuItems = allMenuItems.filter(item => !userRole || item.roles.includes(userRole));

  return (
    <>
      {/* Menu Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#F4EFE6] border-r border-[#E2D5C3] p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
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
            onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
              activeTab === 'profile' ? 'bg-stone-900 text-amber-200 border-stone-900 shadow-md' : 'bg-[#FAF7F2] border-[#E2D5C3] hover:border-gold-500'
            }`}
          >
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" 
              alt="Frédéric Barbey" 
              className="w-10 h-10 rounded-xl object-cover border border-gold-500" 
            />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">Espace actif ({userRole || 'Propriétaire'})</span>
              <h4 className="font-serif font-bold text-xs truncate">Frédéric Barbey</h4>
              <span className="text-[10px] opacity-80 truncate block">Créateur & Hypnothérapeute</span>
            </div>
          </div>

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
                  <i className={`${item.icon} text-sm ${activeTab === item.id ? 'text-gold-400' : 'text-stone-500'}`}></i>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === item.id ? 'bg-amber-200 text-stone-900' : 'bg-amber-100 text-amber-800'
                  }`}>
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