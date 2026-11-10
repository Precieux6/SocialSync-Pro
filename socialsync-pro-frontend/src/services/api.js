import { supabase } from '../supabaseClient';

// VITE_API_URL = racine du backend, sans /api ni slash final
const API_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api`;

const STORAGE_KEY = 'socialsync.activeSpaceId';

let activeSpaceId = localStorage.getItem(STORAGE_KEY);

export const getActiveSpaceId = () => activeSpaceId;

export const setActiveSpaceId = (id) => {
  activeSpaceId = id || null;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
};

// Envoie le token et, si l'espace actif n'est pas le mien, l'en-tête X-Owner-Id.
// { space: false } : n'envoie jamais d'espace (utile pour l'acceptation d'invitations).
async function request(path, { method = 'GET', body, space = true } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };

  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const ownerId = space ? activeSpaceId : null;
  if (ownerId && ownerId !== session?.user?.id) headers['X-Owner-Id'] = ownerId;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({ success: false, error: 'Réponse invalide du serveur.' }));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || json.message || `Erreur ${res.status}`);
  }
  return json;
}

export const api = {
  profile: {
    get: () => request('/profile'),
    update: (data) => request('/profile', { method: 'PUT', body: data }),
    changePassword: (currentPassword, newPassword) =>
      request('/profile/password', { method: 'PUT', body: { currentPassword, newPassword } }),
    saveClaudeKey: (apiKey) => request('/profile/claude-key', { method: 'PUT', body: { apiKey } }),
    deleteClaudeKey: () => request('/profile/claude-key', { method: 'DELETE' }),
    saveReferenceCalendar: (content) =>
      request('/profile/reference-calendar', { method: 'PUT', body: { content } }),
    deleteReferenceCalendar: () => request('/profile/reference-calendar', { method: 'DELETE' }),
  },

  team: {
    members: () => request('/team/members'),
    invitations: () => request('/team/invitations'),
    invite: (email, role) => request('/team/invite', { method: 'POST', body: { email, role } }),
    resendInvitation: (id) => request(`/team/invitations/${id}/resend`, { method: 'POST' }),
    deleteInvitation: (id) => request(`/team/invitations/${id}`, { method: 'DELETE' }),
    setMemberRole: (userId, role) =>
      request(`/team/members/${userId}/role`, { method: 'POST', body: { role } }),
    removeMember: (userId) => request(`/team/members/${userId}`, { method: 'DELETE' }),
    acceptInvitations: () => request('/team/accept', { method: 'POST', space: false }),
  },

  calendar: {
    themes: () => request('/calendar/themes'),
    updateTheme: (week, title) => request(`/calendar/themes/${week}`, { method: 'PUT', body: { title } }),
  },

  videos: {
    toFilm: () => request('/videos/to-film'),
  },

  media: {
    list: () => request('/media'),
    register: (file) => request('/media/upload', { method: 'POST', body: file }),
  },

  comments: {
    list: () => request('/comments'),
  },

  analytics: {
    get: () => request('/analytics'),
  },

  ai: {
    caption: (title, theme, platform) =>
      request('/ai/generate-caption', { method: 'POST', body: { title, theme, platform } }),
    prompt: (theme, platform) =>
      request('/ai/generate-prompt', { method: 'POST', body: { theme, platform } }),
  },
};
