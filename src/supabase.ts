import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase env');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}
