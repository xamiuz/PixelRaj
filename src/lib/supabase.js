import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Keamanan: Validasi ketersediaan kredensial sebelum inisialisasi
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL atau Anon Key tidak ditemukan. Aplikasi akan berjalan dalam mode offline/tanpa backend.");
}

export const supabase = createClient(
  supabaseUrl || 'https://xyz1234.supabase.co',
  supabaseAnonKey || 'public-anon-key'
)

