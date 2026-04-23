import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client. Validates env at first call and caches one instance per process.
 * Use this in Route Handlers, RSCs, and server actions — never in client components.
 */
export function getSupabase(): SupabaseClient {
    if (cachedClient) return cachedClient;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url) {
        throw new Error('SUPABASE_URL is not configured');
    }
    if (!key) {
        throw new Error('Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is configured');
    }

    cachedClient = createClient(url, key, {
        auth: { persistSession: false },
    });
    return cachedClient;
}
