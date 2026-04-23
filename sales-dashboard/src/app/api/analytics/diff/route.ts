import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { parseIntParam, jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseIntParam(searchParams.get('days'), 7, 1, 365);

        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('get_diff_summary', { days_back: days });
        if (error) throw error;

        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
        });
    } catch (error) {
        return jsonError(logAndSerializeError('analytics/diff', error));
    }
}
