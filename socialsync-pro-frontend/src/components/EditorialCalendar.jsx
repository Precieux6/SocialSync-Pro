// src/components/EditorialCalendar.jsx
import React, { useState, useEffect } from 'react';

export default function EditorialCalendar() {
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const token = localStorage.getItem('supabase_token') || '';
        const response = await fetch('/api/calendar/current', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Erreur lors de la récupération du calendrier.');
        }

        // Si le propriétaire n'a pas encore configuré de calendrier, result.data sera null
        setCalendarData(result.data);
      } catch (err) {
        console.error("Erreur chargement calendrier :", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCalendar();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12 text-gray-500">
        Chargement du calendrier de l'équipe...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 my-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
        <p className="font-semibold">Une erreur est survenue</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // ÉTAT VIDE : Aucun calendrier configuré par le propriétaire pour l'instant
  if (!calendarData || Object.keys(calendarData).length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-amber-50 border border-amber-200 rounded-2xl text-center shadow-sm">
        <div className="w-12 h-12 mx-auto mb-4 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-xl">
          📅
        </div>
        <h3 className="text-xl font-bold text-amber-900 mb-2">Espace de travail vide</h3>
        <p className="text-amber-700 text-sm leading-relaxed max-w-md mx-auto">
          Le propriétaire de l'équipe n'a pas encore configuré ou initialisé de calendrier éditorial. 
          Cet espace est prêt et attend la configuration initiale pour que vous puissiez y collaborer.
        </p>
      </div>
    );
  }

  // AFFICHAGE DU CALENDRIER ACTIF (si les données existent)
  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Calendrier Éditorial</h2>
        <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
          Actif
        </span>
      </div>

      {/* Rendu des semaines / planning selon ta structure de données */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Exemple d'affichage dynamique basé sur calendarData */}
        {Object.entries(calendarData.semaines || {}).map(([semaineKey, semaineVal], index) => (
          <div key={semaineKey || index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="font-semibold text-gray-700 mb-2">Semaine {index + 1}</h4>
            <p className="text-xs text-gray-500">{semaineVal.theme || "Aucun thème défini"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
