import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase clients.
 *
 * - `getSupabase('anon')` — read-only public surface. Use this for any API
 *   that anonymous users can hit (`/api/sales/featured`, `/api/stats`, ...).
 *   It enforces RLS, so a misconfigured policy fails closed.
 *
 * - `getSupabase('service')` — full-access bypass. Use this only for admin
 *   APIs, AI write paths, and other server-only mutations. Never expose
 *   responses from this client without filtering.
 *
 * - `getSupabase()` (no arg) keeps backwards compat: prefers service-role if
 *   present, otherwise anon. New code should be explicit.
 *
 * Each role has its own cached client per process to avoid recreating the
 * underlying http agent on every request.
 */

export type SupabaseRole = 'anon' | 'service' | 'auto';

const cache: Partial<Record<SupabaseRole, SupabaseClient>> = {};

function buildClient(role: 'anon' | 'service'): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    if (!url) {
        throw new Error('SUPABASE_URL is not configured');
    }

    const key =
        role === 'service'
            ? process.env.SUPABASE_SERVICE_ROLE_KEY
            : process.env.SUPABASE_ANON_KEY;

    if (!key) {
        throw new Error(
            role === 'service'
                ? 'SUPABASE_SERVICE_ROLE_KEY is not configured'
                : 'SUPABASE_ANON_KEY is not configured',
        );
    }

    return createClient(url, key, {
        auth: { persistSession: false },
    });
}

export function getSupabase(role: SupabaseRole = 'auto'): SupabaseClient {
    if (role === 'auto') {
        // Backwards-compatible behavior: use service role if available, else anon.
        const preferred: 'anon' | 'service' = process.env.SUPABASE_SERVICE_ROLE_KEY
            ? 'service'
            : 'anon';
        return getSupabase(preferred);
    }
    const cached = cache[role];
    if (cached) return cached;
    const client = buildClient(role);
    cache[role] = client;
    return client;
}
