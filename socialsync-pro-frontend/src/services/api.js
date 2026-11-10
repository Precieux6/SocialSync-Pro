import { supabase } from '../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Utilitaire pour récupérer les en-têtes avec le token d'authentification Supabase
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// 1. Récupérer les thèmes depuis le Backend (Supabase)
export const fetchThemes = async (userId) => {
  try {
    const headers = await getAuthHeaders();
    const url = userId ? `${API_URL}/calendar/themes?userId=${userId}` : `${API_URL}/calendar/themes`;
    const res = await fetch(url, { headers });
    return await res.json();
  } catch (err) {
    console.error("Erreur fetchThemes:", err);
    return { success: false, themes: [] };
  }
};

// 2. Mettre à jour un thème
export const updateTheme = async (weekNum, title) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/calendar/themes/${weekNum}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title })
    });
    return await res.json();
  } catch (err) {
    console.error("Erreur updateTheme:", err);
    return { success: false, error: err.message };
  }
};

// 3. Demander une génération de légende au serveur backend sécurisé (Claude)
export const generateCaptionWithClaude = async (title, theme, platform, userId) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/ai/generate-caption`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, theme, platform, userId })
    });
    return await res.json();
  } catch (err) {
    console.error("Erreur de communication avec le backend :", err);
    return { success: false, error: err.message };
  }
};

// 4. Inviter un membre d'équipe (Resend)
export const inviteTeamMember = async (email, role) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, role })
    });
    return await res.json();
  } catch (err) {
    console.error("Erreur inviteTeamMember:", err);
    return { success: false, error: err.message };
  }
};
