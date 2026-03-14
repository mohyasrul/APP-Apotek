import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[MediSir] Konfigurasi Supabase tidak lengkap. ' +
    'Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah diset di file .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
