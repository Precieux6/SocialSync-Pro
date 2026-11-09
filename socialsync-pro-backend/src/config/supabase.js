import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://votre-projet.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'votre_cle_supabase';

export const supabase = createClient(supabaseUrl, supabaseKey);
