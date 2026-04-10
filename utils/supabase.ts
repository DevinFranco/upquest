/**
 * UpQuest – Supabase client (frontend)
 * Uses the anon/public key — RLS enforced on all tables.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:           AsyncStorage,
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: false,
  },
});

// DEV MODE: bypass auth
const DEV_SESSION = { access_token: 'dev', refresh_token: 'dev', expires_in: 99999, token_type: 'bearer', user: { id: 'dev-user-001', email: 'dev@upquest.app', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } } as any;
supabase.auth.getSession = async () => ({ data: { session: DEV_SESSION }, error: null });
supabase.auth.onAuthStateChange = (cb: any) => { setTimeout(() => cb('SIGNED_IN', DEV_SESSION), 100); return { data: { subscription: { unsubscribe: () => {} } } } as any; };
