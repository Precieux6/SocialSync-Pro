import { createClient } from '@supabase/supabase-js';

// Clé publique (anon) : sûre côté navigateur, la protection repose sur RLS
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
