const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// 1. Récupérer les thèmes depuis le Backend (Supabase)
export const fetchThemes = async () => {
  const res = await fetch(`${API_URL}/calendar/themes`);
  return await res.json();
};

// 2. Mettre à jour un thème
export const updateTheme = async (weekNum, title) => {
  const res = await fetch(`${API_URL}/calendar/themes/${weekNum}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  return await res.json();
};

// 3. Demander une génération de légende au serveur backend sécurisé (Claude)
export const generateCaptionWithClaude = async (title, theme, platform, userId) => {
  try {
    const res = await fetch(`${API_URL}/ai/generate-caption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_URL}/team/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role })
  });
  return await res.json();
};
