import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env.js';

const supabaseUrl = getEnv('SUPABASE_URL');
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Lazily instantiated Supabase client that works in the Edge runtime.
 * Uses the service role key to unlock PostGIS RPCs while disabling session persistence.
 */
let cachedClient;

export function getSupabaseServiceRoleClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return cachedClient;
}

export function assertSupabaseClient() {
  const client = getSupabaseServiceRoleClient();
  if (!client) {
    throw new Error('Supabase service role credentials are not configured');
  }
  return client;
}
