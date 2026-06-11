import { createClient } from '@supabase/supabase-js'

// ===== NASTAVENÍ SUPABASE =====
const SUPABASE_URL = 'https://bnkkimycxuqjzgdwgxll.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_lF6DhR0Dn-NJSGxlhyL1lA_bgGsVmS9'
// ==============================

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
