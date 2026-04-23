import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { jsonError, logAndSerializeError } from '@/lib/api-utils';

export const revalidate = 300;

export async function GET() {
    try {
        const supabase = getSupabase('anon');
        const { data, error } = await supabase.rpc('analytics_areas');
        if (error) throw error;
        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
    } catch (error) {
        return jsonError(logAndSerializeError('analytics/areas', error));
    }
}
