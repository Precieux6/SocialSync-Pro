import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { api, getActiveSpaceId, setActiveSpaceId } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);

  const loadSpaces = useCallback(async (user) => {
    // Accepte les invitations en attente pour cet e-mail (sans espace : c'est mon propre espace)
    await api.team.acceptInvitations().catch(() => {});

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
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadSpaces(session.user);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        await loadSpaces(s.user);
      } else {
        setSpaces([]);
        setActiveSpace(null);
        setActiveSpaceId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadSpaces]);

  const switchSpace = (ownerId) => {
    const next = spaces.find((s) => s.ownerId === ownerId);
    if (!next) return;
    setActiveSpace(next);
    setActiveSpaceId(next.ownerId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => {});
    setActiveSpaceId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loadingSession,
        spaces,
        activeSpace,
        userRole: activeSpace?.role ?? null,
        isOwner: activeSpace?.role === 'Propriétaire',
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
