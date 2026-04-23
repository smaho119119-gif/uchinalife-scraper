import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
export const revalidate = 60;

export async function GET() {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('admin_stats');
        if (error) throw error;
        return NextResponse.json(
            {
                total: data?.total || 0,
                active: data?.active || 0,
                categories: data?.categories || {},
                lastUpdated: data?.lastUpdated || null,
            },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
        );
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
