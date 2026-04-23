import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
export const revalidate = 300;

export async function GET() {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('analytics_areas');
        if (error) throw error;
        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
    } catch (error: any) {
        console.error('Error fetching area analytics:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
