import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://xatrvpgoxywaxjpfydtj.supabase.co';

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_GxnEWSL_npNPsO0DmCHkVg_IhVF1g3l';

export const supabase = createClient(supabaseUrl, supabaseKey);

