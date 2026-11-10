// socialsync-pro-frontend/src/services/api.js
import { supabase } from '../supabaseClient';

// VITE_API_URL = racine du backend, sans /api
const API_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api`;
const STORAGE_KEY = 'socialsync.activeSpaceId';

let activeSpaceId = localStorage.getItem(STORAGE_KEY);

export const getActiveSpaceId = () => activeSpaceId;

export const setActiveSpaceId = (id) => {
  activeSpaceId = id || null;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
};

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

// Envoie un fichier dans le stockage Supabase et renvoie son URL publique
export async function uploadFile(bucket, path, file) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export const api = {
  setup: {
    status: () => request('/setup/status'),
    getSocialAccounts: () => request('/setup/social-accounts'),
    saveSocialAccounts: (accounts) =>
      request('/setup/social-accounts', { method: 'PUT', body: accounts }),
  },

  profile: {
    get: () => request('/profile'),
    update: (data) => request('/profile', { method: 'PUT', body: data }),
    changePassword: (currentPassword, newPassword) =>
      request('/profile/password', { method: 'PUT', body: { currentPassword, newPassword } }),
    saveClaudeKey: (apiKey) => request('/profile/claude-key', { method: 'PUT', body: { apiKey } }),
    saveReferenceCalendar: (content) =>
      request('/profile/reference-calendar', { method: 'PUT', body: { content } }),
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
    updateTheme: (week, title) =>
      request(`/calendar/themes/${week}`, { method: 'PUT', body: { title } }),
    posts: (start, startWeek) =>
      request(`/calendar/posts?start=${start}&startWeek=${startWeek}`),
    createPost: (data) => request('/calendar/posts', { method: 'POST', body: data }),
    updatePost: (id, data) => request(`/calendar/posts/${id}`, { method: 'PUT', body: data }),
    schedule: (id, scheduled_at) =>
      request(`/calendar/posts/${id}/schedule`, { method: 'POST', body: { scheduled_at } }),
    publishNow: (id) => request(`/calendar/posts/${id}/publish-now`, { method: 'POST' }),
    cancelSchedule: (id) => request(`/calendar/posts/${id}/cancel`, { method: 'POST' }),
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
