// socialsync-pro-frontend/src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { api, getActiveSpaceId, setActiveSpaceId } from '../services/api';

const AuthContext = createContext(null);

const OWNER_ROLE = 'Propriétaire';
const RELOAD_EVENTS = ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [invitationError, setInvitationError] = useState(null);

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
    // 1. Acceptation des invitations en attente
    try {
      await api.team.acceptInvitations();
      setInvitationError(null);
    } catch (err) {
      console.warn('Acceptation des invitations :', err.message);
      setInvitationError(err.message);
    }

    try {
      // 2. Rattachements actifs de l'utilisateur
      const { data: links, error: linksErr } = await supabase
        .from('memberships')
        .select('owner_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active');
      if (linksErr) throw linksErr;

      // Un rattachement à son propre espace est ignoré : l'espace propre est toujours ajouté ci-dessous
      const sharedLinks = (links || []).filter((l) => l.owner_id !== user.id);

      // 3. Noms des propriétaires des espaces partagés
      const ownerIds = sharedLinks.map((l) => l.owner_id);
      const { data: owners } = ownerIds.length
        ? await supabase.from('team_member').select('id, name').in('id', ownerIds)
        : { data: [] };
      const names = Object.fromEntries((owners || []).map((o) => [o.id, o.name]));

      const ownSpace = {
        ownerId: user.id,
        ownerName: 'Mon espace',
        role: OWNER_ROLE,
        isOwn: true,
      };

      const sharedSpaces = sharedLinks.map((l) => ({
        ownerId: l.owner_id,
        ownerName: names[l.owner_id] || 'Espace partagé',
        role: l.role,
        isOwn: false,
      }));

      const list = [ownSpace, ...sharedSpaces];

      // 4. Choix de l'espace actif
      //    - Un espace partagé enregistré est respecté.
      //    - Un invité sans espace enregistré entre dans le premier espace partagé.
      //    - Sans espace partagé, l'espace propre est utilisé.
      const savedId = getActiveSpaceId();
      const chosen =
        sharedSpaces.length > 0
          ? sharedSpaces.find((s) => s.ownerId === savedId) ?? sharedSpaces[0]
          : ownSpace;

      setSpaces(list);
      setActiveSpace(chosen);
      setActiveSpaceId(chosen.ownerId);

      await Promise.all([loadOwnerProfile(chosen.ownerId), loadMyProfile(user.id)]);
    } catch (err) {
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
        setInvitationError(null);
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
    localStorage.removeItem('onboarding_current_step');
    localStorage.removeItem('social_accounts_draft');
    localStorage.removeItem('claude_key_draft');

    await supabase.auth.signOut().catch(() => {});
    setActiveSpaceId(null);
  };

  const isOwner = activeSpace?.role === OWNER_ROLE;
  const isOwnSpace = Boolean(session && activeSpace?.isOwn);
  const ownerName = ownerProfile?.name || ownerProfile?.email || activeSpace?.ownerName || '';

  // Identité de la personne connectée (affichée dans la barre latérale)
  const user = session?.user ?? null;
  const myName =
    myProfile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    '';
  const myAvatar = myProfile?.avatar || user?.user_metadata?.avatar_url || '';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loadingSession,
        spaces,
        activeSpace,
        userRole: activeSpace?.role ?? null,
        isOwner,
        isOwnSpace,
        invitationError,
        ownerProfile,
        ownerName,
        ownerAvatar: ownerProfile?.avatar || '',
        ownerBio: ownerProfile?.bio || '',
        myProfile,
        myName,
        myAvatar,
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
