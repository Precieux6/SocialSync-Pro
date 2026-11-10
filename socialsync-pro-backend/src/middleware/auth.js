// socialsync-pro-backend/src/middleware/auth.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

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

    req.user = user;
    req.userId = user.id;

    // Par défaut, l'utilisateur est son propre client (Propriétaire)
    let clientId = user.id;
    let userRole = 'Propriétaire';

    // Vérification dans la table "team_member"
    const { data: memberRecord } = await supabase
      .from('team_member')
      .select('team_id, role, email')
      .eq('email', user.email)
      .maybeSingle();

    if (memberRecord) {
      userRole = memberRecord.role || 'Éditeur';
      if (memberRecord.team_id) {
        clientId = memberRecord.team_id;
      }
    }

    req.clientId = clientId;
    req.userRole = userRole;

    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: `Erreur d'authentification : ${err.message}` });
  }
};
