// socialsync-pro-frontend/src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { api, getActiveSpaceId, setActiveSpaceId } from '../services/api';

const AuthContext = createContext(null);

// Événements qui doivent réellement recalculer les espaces
const RELOAD_EVENTS = ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  // Garde l'ID utilisateur courant pour éviter les rechargements inutiles
  const currentUserId = useRef(null);

  const loadOwnerProfile = useCallback(async (ownerId) => {
    try {
      const { data } = await supabase
        .from('team_member')
        .select('id, name, email, avatar, bio')
        .eq('id', ownerId)
        .maybeSingle();
      setOwnerProfile(data ?? null);
    } catch (err) {
      console.error('Profil propriétaire :', err);
    }
  }, []);

  const loadMyProfile = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('team_member')
        .select('id, name, email, avatar, bio, timezone')
        .eq('id', userId)
        .maybeSingle();
      setMyProfile(data ?? null);
    } catch (err) {
      console.error('Mon profil :', err);
    }
  }, []);

  const loadSpaces = useCallback(async (user) => {
    // Invitations : lancées en arrière-plan, jamais bloquantes
    api.team.acceptInvitations().catch((err) => {
      console.warn('Acceptation des invitations ignorée :', err.message);
    });

    try {
      // Lecture par RLS : seulement mes propres rattachements
      const { data: links } = await supabase
        .from('memberships')
        .select('owner_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active');

      const ownerIds = (links || []).map((l) => l.owner_id);
      const { data: owners } = ownerIds.length
        ? await supabase.from('team_member').select('id, name').in('id', ownerIds)
        : { data: [] };
      const names = Object.fromEntries((owners || []).map((o) => [o.id, o.name]));

      const list = [
        { ownerId: user.id, ownerName: 'Mon espace', role: 'Propriétaire' },
        ...(links || []).map((l) => ({
          ownerId: l.owner_id,
          ownerName: names[l.owner_id] || 'Espace partagé',
          role: l.role,
        })),
      ];

      const saved = getActiveSpaceId();
      const chosen = list.find((s) => s.ownerId === saved) || list[0];

      setSpaces(list);
      setActiveSpace(chosen);
      setActiveSpaceId(chosen.ownerId);

      await Promise.all([loadOwnerProfile(chosen.ownerId), loadMyProfile(user.id)]);
    } catch (err) {
      // Une erreur de lecture ne doit pas bloquer l'application
      console.error('Chargement des espaces :', err);
    }
  }, [loadOwnerProfile, loadMyProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session: current } }) => {
        if (!mounted) return;
        setSession(current);
        if (current?.user) {
          currentUserId.current = current.user.id;
          await loadSpaces(current.user);
        }
      })
      .catch((err) => console.error('Session :', err))
      .finally(() => {
        if (mounted) setLoadingSession(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!RELOAD_EVENTS.includes(event)) {
        if (s) setSession(s);
        return;
      }

      setSession(s);

      if (s?.user) {
        if (event === 'SIGNED_IN' && currentUserId.current === s.user.id) return;
        currentUserId.current = s.user.id;
        await loadSpaces(s.user);
      } else {
        currentUserId.current = null;
        setSpaces([]);
        setActiveSpace(null);
        setOwnerProfile(null);
        setMyProfile(null);
        setActiveSpaceId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadSpaces]);

  const switchSpace = async (ownerId) => {
    const next = spaces.find((s) => s.ownerId === ownerId);
    if (!next) return;
    setActiveSpace(next);
    setActiveSpaceId(next.ownerId);
    await loadOwnerProfile(next.ownerId);
  };

  const refreshProfiles = useCallback(async () => {
    if (!session?.user) return;
    await Promise.all([
      activeSpace ? loadOwnerProfile(activeSpace.ownerId) : Promise.resolve(),
      loadMyProfile(session.user.id),
    ]);
  }, [session, activeSpace, loadOwnerProfile, loadMyProfile]);

  const handleLogout = async () => {
    // Nettoyage des brouillons du localStorage lors de la déconnexion
    localStorage.removeItem('onboarding_current_step');
    localStorage.removeItem('social_accounts_draft');
    localStorage.removeItem('claude_key_draft');

    await supabase.auth.signOut().catch(() => {});
    setActiveSpaceId(null);
  };

  const isOwner = activeSpace?.role === 'Propriétaire';
  const isOwnSpace = Boolean(session && activeSpace && activeSpace.ownerId === session.user.id);
  const ownerName = ownerProfile?.name || ownerProfile?.email || activeSpace?.ownerName || '';

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loadingSession,
        spaces,
        activeSpace,
        userRole: activeSpace?.role ?? null,
        isOwner,
        isOwnSpace,
        ownerProfile,
        ownerName,
        ownerAvatar: ownerProfile?.avatar || '',
        ownerBio: ownerProfile?.bio || '',
        myProfile,
        refreshProfiles,
        switchSpace,
        handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
