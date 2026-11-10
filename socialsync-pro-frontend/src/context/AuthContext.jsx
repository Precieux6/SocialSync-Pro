import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [userRole, setUserRole] = useState('Propriétaire');
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    async function resolveUserRoleAndClient(user) {
      try {
        // Interroger la table team_member pour récupérer le rôle et le team_id associé
        const { data: memberData } = await supabase
          .from('team_member')
          .select('role, team_id, id')
          .eq('email', user.email)
          .maybeSingle();

        if (memberData) {
          setUserRole(memberData.role || 'Propriétaire');
          // Si le membre appartient à une équipe, son clientId devient le team_id (propriétaire)
          // Sinon, c'est son propre ID utilisateur
          setClientId(memberData.team_id || memberData.id);
        } else {
          setUserRole('Propriétaire');
          setClientId(user.id);
        }
      } catch (err) {
        console.error("Erreur résolution rôle/équipe:", err);
        setUserRole('Propriétaire');
        setClientId(user.id);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        resolveUserRoleAndClient(session.user);
      }
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        resolveUserRoleAndClient(session.user);
      } else {
        setUserRole('Propriétaire');
        setClientId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Déconnexion locale forcée.");
    } finally {
      setSession(null);
      setUserRole('Propriétaire');
      setClientId(null);
      localStorage.removeItem('supabase.auth.token');
    }
  };

  return (
    <AuthContext.Provider value={{ session, loadingSession, userRole, clientId, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
