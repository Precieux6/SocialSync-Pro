// socialsync-pro-frontend/src/services/api.js
import { supabase } from '../supabaseClient';

const API_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api`;
const STORAGE_KEY = 'socialsync.activeSpaceId';

let activeSpaceId = localStorage.getItem(STORAGE_KEY);

export const getActiveSpaceId = () => activeSpaceId;

export const setActiveSpaceId = (id) => {
  activeSpaceId = id || null;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
};

async function authHeaders({ space = true } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const ownerId = space ? activeSpaceId : null;
  if (ownerId && ownerId !== session?.user?.id) headers['X-Owner-Id'] = ownerId;
  return { headers, session };
}

async function request(path, { method = 'GET', body, space = true } = {}) {
  const { headers } = await authHeaders({ space });
  if (body !== undefined) headers['Content-Type'] = 'application/json';

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

async function upload(path, file) {
  const { headers } = await authHeaders();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: form });
  const json = await res.json().catch(() => ({ success: false, error: 'Réponse invalide du serveur.' }));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Erreur ${res.status}`);
  }
  return json;
}

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
    deleteClaudeKey: () => request('/profile/claude-key', { method: 'DELETE' }),
    saveReferenceCalendar: (content) =>
      request('/profile/reference-calendar', { method: 'PUT', body: { content } }),
    uploadReferenceCalendar: (file) => upload('/profile/reference-calendar/upload', file),
    deleteReferenceCalendar: () => request('/profile/reference-calendar', { method: 'DELETE' }),
  },

  account: {
    status: () => request('/account/status', { space: false }),
    deactivate: (confirm) => request('/account/deactivate', { method: 'POST', body: { confirm }, space: false }),
    reactivate: () => request('/account/reactivate', { method: 'POST', space: false }),
    deleteNow: (confirm) => request('/account', { method: 'DELETE', body: { confirm }, space: false }),
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
    schedule: (id, local_datetime) =>
      request(`/calendar/posts/${id}/schedule`, { method: 'POST', body: { local_datetime } }),
    publishNow: (id) => request(`/calendar/posts/${id}/publish-now`, { method: 'POST' }),
    cancelSchedule: (id) => request(`/calendar/posts/${id}/cancel`, { method: 'POST' }),
    deletePost: (id) => request(`/calendar/posts/${id}`, { method: 'DELETE' }),
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
