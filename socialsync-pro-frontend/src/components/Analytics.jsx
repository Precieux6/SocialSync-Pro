import React from 'react';

export default function Analytics({ analyticsData }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
        <h2 className="text-2xl font-serif font-bold text-stone-900">Mes Statistiques & Analytics</h2>
        <p className="text-xs text-stone-500 mt-1">Aperçu hebdomadaire des vues et performances globales par réseau.</p>
      </div>

      <div className="bg-[#FAF7F2] rounded-3xl border border-[#E2D5C3] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#E2D5C3] flex items-center justify-between text-xs bg-[#F4EFE6]">
          <span className="font-bold text-stone-900">Performances des 7 Jours de la Semaine</span>
          <span className="text-gold-700 font-bold">Portée Hebdo Globale : 284 300 Vues</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] text-stone-600 border-b border-[#E2D5C3]">
                <th className="p-3.5 font-bold">Jour</th>
                <th className="p-3.5 font-bold text-pink-600"><i className="fa-brands fa-instagram mr-1"></i> Instagram</th>
                <th className="p-3.5 font-bold text-blue-600"><i className="fa-brands fa-facebook mr-1"></i> Facebook</th>
                <th className="p-3.5 font-bold text-red-600"><i className="fa-brands fa-youtube mr-1"></i> YouTube</th>
                <th className="p-3.5 font-bold text-teal-600"><i className="fa-brands fa-tiktok mr-1"></i> TikTok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2D5C3] text-stone-700">
              <tr>
                <td className="p-3.5 font-bold text-stone-900">Lundi</td>
                <td className="p-3.5">12.4k vues</td>
                <td className="p-3.5">8.2k vues</td>
                <td className="p-3.5">4.1k vues</td>
                <td className="p-3.5">15.8k vues</td>
              </tr>
              <tr>
                <td className="p-3.5 font-bold text-stone-900">Mardi</td>
                <td className="p-3.5">18.9k vues</td>
                <td className="p-3.5">6.5k vues</td>
                <td className="p-3.5">3.2k vues</td>
                <td className="p-3.5">9.4k vues</td>
              </tr>
              <tr className="bg-[#F4EFE6]/60">
                <td className="p-3.5 font-bold text-gold-700">Mercredi (Reel)</td>
                <td className="p-3.5 font-bold text-gold-700">34.2k vues</td>
                <td className="p-3.5">14.1k vues</td>
                <td className="p-3.5 font-bold text-gold-700">22.5k vues</td>
                <td className="p-3.5 font-bold text-gold-700">45.0k vues</td>
              </tr>
              <tr>
                <td className="p-3.5 font-bold text-stone-900">Jeudi</td>
                <td className="p-3.5">15.1k vues</td>
                <td className="p-3.5">9.8k vues</td>
                <td className="p-3.5">5.0k vues</td>
                <td className="p-3.5">18.3k vues</td>
              </tr>
              <tr>
                <td className="p-3.5 font-bold text-stone-900">Vendredi</td>
                <td className="p-3.5">11.6k vues</td>
                <td className="p-3.5">7.4k vues</td>
                <td className="p-3.5">4.8k vues</td>
                <td className="p-3.5">12.1k vues</td>
              </tr>
              <tr>
                <td className="p-3.5 font-bold text-stone-900">Samedi</td>
                <td className="p-3.5">21.3k vues</td>
                <td className="p-3.5">11.2k vues</td>
                <td className="p-3.5">8.9k vues</td>
                <td className="p-3.5">24.6k vues</td>
              </tr>
              <tr className="bg-[#F4EFE6]/60">
                <td className="p-3.5 font-bold text-gold-700">Dimanche (Récit)</td>
                <td className="p-3.5 font-bold text-gold-700">41.0k vues</td>
                <td className="p-3.5">18.5k vues</td>
                <td className="p-3.5 font-bold text-gold-700">29.1k vues</td>
                <td className="p-3.5 font-bold text-gold-700">52.4k vues</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}