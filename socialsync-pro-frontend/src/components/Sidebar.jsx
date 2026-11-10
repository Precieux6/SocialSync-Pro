import React from 'react';
import { Calendar, Users, Settings, BarChart2, FolderArchive, Bell, LogOut } from 'lucide-react';

export function Sidebar({ activeTab, setActiveTab, userRole, onLogout, setSelectedDay }) {
  const handleLogoClick = () => {
    setActiveTab('calendar');
    if (setSelectedDay) setSelectedDay(null);
  };

  return (
    <aside className="w-64 bg-white border-r border-[#E2D5C3] flex flex-col h-screen">
      {/* Logo cliquable redirigeant vers le calendrier */}
      <div 
        onClick={handleLogoClick}
        className="p-6 border-b border-[#E2D5C3] flex items-center space-x-3 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <img 
          src="/SOCIAL SYNC PRO LOGO.png" 
          alt="Social Sync Pro" 
          className="h-8 w-auto object-contain"
        />
        <div>
          <h1 className="font-bold text-gray-900 text-sm leading-tight">Social Sync Pro</h1>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Espace de travail</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <button
          onClick={() => { setActiveTab('calendar'); if (setSelectedDay) setSelectedDay(null); }}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'calendar' ? 'bg-[#1C2C35] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendrier éditorial</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'media' ? 'bg-[#1C2C35] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>Médiathèque</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'analytics' ? 'bg-[#1C2C35] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Statistiques</span>
        </button>

        {/* Réservé au Propriétaire */}
        {userRole === 'Propriétaire' && (
          <>
            <button
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'team' ? 'bg-[#1C2C35] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Mon équipe & accès</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'notifications' ? 'bg-[#1C2C35] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications & Rappels</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'settings' ? 'bg-[#1C2C35] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>APIs Réseaux & IA</span>
            </button>
          </>
        )}
      </nav>

      {/* Footer / Déconnexion */}
      <div className="p-4 border-t border-[#E2D5C3]">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
