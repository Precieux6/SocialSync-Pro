// socialsync-pro-backend/src/middleware/auth.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Accès non autorisé : Token manquant.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Vérification du token auprès de Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Token invalide ou expiré.' });
    }

    // Injecter l'utilisateur brut dans la requête
    req.user = user;
    req.userId = user.id;

    // Déterminer le "clientId" (Propriétaire des données)
    // Par défaut, le propriétaire des données est l'utilisateur lui-même.
    let ownerId = user.id;
    let userRole = 'owner';

    // Vérifier si l'utilisateur appartient à une équipe en tant que membre (CM, éditeur, etc.)
    const { data: membership } = await supabase
      .from('team_members')
      .select('owner_id, role')
      .eq('member_email', user.email)
      .single();

    if (membership) {
      ownerId = membership.owner_id; // Il accède aux données du propriétaire de l'équipe
      userRole = membership.role;     // 'community_manager', 'editor', etc.
    }

    req.clientId = ownerId;
    req.userRole = userRole;

    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: `Erreur d'authentification : ${err.message}` });
  }
};
