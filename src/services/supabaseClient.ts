import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mqefmsrrtfhasqakzwuq.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_z-HkuOTB-ndnP2gEIsVB4A_vkXXVnD2';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials are missing. Please check your configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
