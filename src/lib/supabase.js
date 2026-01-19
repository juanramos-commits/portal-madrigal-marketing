import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ootncgtcvwnrskqtamak.supabase.co'
const supabaseAnonKey = 'sb_publishable_j9r0B9mpw2UG86TZwZ0Adg_jEg3oyKk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export { supabaseUrl, supabaseAnonKey }
