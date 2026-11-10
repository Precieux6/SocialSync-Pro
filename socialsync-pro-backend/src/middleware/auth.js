// socialsync-pro-backend/src/middleware/auth.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 1. Vérifie le token de l'utilisateur.
// 2. Détermine l'espace actif (en-tête X-Owner-Id, sinon son propre espace).
// 3. Récupère son rôle dans cet espace via my_role_in (RLS s'applique).
// Toutes les routes utilisent ensuite req.db, client lié au JWT de l'utilisateur.
export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token manquant.' });
    }
    const token = header.slice(7).trim();

    // Client lié au JWT : auth.uid() et RLS fonctionnent dans toutes les requêtes
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Token invalide ou expiré.' });
    }

    const spaceId = req.headers['x-owner-id'] || user.id;
    if (!UUID_RE.test(spaceId)) {
      return res.status(400).json({ success: false, error: 'Espace invalide.' });
    }

    const { data: role, error: roleErr } = await db.rpc('my_role_in', { p_owner: spaceId });
    if (roleErr) {
      return res.status(500).json({ success: false, error: 'Vérification de l\'espace impossible.' });
    }
    if (!role) {
      return res.status(403).json({ success: false, error: 'Accès à cet espace refusé.' });
    }

    req.user = user;
    req.db = db;
    req.ownerId = spaceId;
    req.userRole = role;
    next();
  } catch (err) {
    console.error('requireAuth:', err);
    res.status(500).json({ success: false, error: 'Erreur d\'authentification.' });
  }
};

// Usage : router.post('/x', requireRole('Propriétaire'), handler)
export const requireRole = (...allowed) => (req, res, next) => {
  if (!allowed.includes(req.userRole)) {
    return res.status(403).json({ success: false, error: 'Permissions insuffisantes.' });
  }
  next();
};

export const requireOwner = requireRole('Propriétaire');
