// socialsync-pro-backend/src/utils/supabaseAdmin.js
// Client « service_role » : réservé au backend, ne jamais l'exposer au navigateur.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);
