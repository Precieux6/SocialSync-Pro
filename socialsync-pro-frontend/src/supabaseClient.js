import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dxtojxccnegfqhuhuhko.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_16QGLB5qR_kuxk3rm4ogRw_n12e6szQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)