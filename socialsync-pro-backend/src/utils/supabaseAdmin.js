// socialsync-pro-backend/src/utils/supabaseAdmin.js
// Client « service_role » : réservé au backend, ne jamais l'exposer au navigateur.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Création paresseuse : le serveur démarre même si la clé est absente,
// et seule la route concernée renvoie une erreur explicite.
let client = null;

export function getSupabaseAdmin() {
  if (!client) {
    if (!url || !serviceKey) {
      throw new Error('Configuration serveur incomplète : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.');
    }
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
