import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { parseIntParam, jsonError, logAndSerializeError } from '@/lib/api-utils';

// Aggregates change daily at most. The R23-perf audit found this RPC tripping
// Vercel's default 10s function timeout on cold start. Raise the budget,
// drop force-dynamic so the framework can serve from the data cache, and
// keep the upstream CDN cache aggressive (5min fresh + 1h stale).
export const maxDuration = 30;
export const revalidate = 300;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseIntParam(searchParams.get('days'), 7, 1, 365);

        // Service role needed: RLS on properties hides rows from anon, so the
        // RPC (non-SECURITY DEFINER) returned nothing / errored for anon.
        const supabase = getSupabase('service');
        const { data, error } = await supabase.rpc('get_diff_summary', { days_back: days });
        if (error) throw error;

        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
        });
    } catch (error) {
        return jsonError(logAndSerializeError('analytics/diff', error));
    }
}
