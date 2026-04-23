import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { getCityCoordinates, getRegionFull } from '@/lib/area';

export const dynamic = 'force-dynamic';

export const revalidate = 300;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category') || '';
        const type = searchParams.get('type') || 'all';

        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('area_stats', {
            p_category: category,
            p_type: type,
        });
        if (error) throw error;

        const cities = ((data?.cities as any[]) || [])
            .map((c) => {
                const coordinates = getCityCoordinates(c.name);
                const region = getRegionFull(c.name);
                return {
                    ...c,
                    coordinates: coordinates || [0, 0],
                    region: region || 'その他',
                };
            })
            .filter((c) => c.coordinates[0] !== 0 && c.coordinates[1] !== 0);

        return NextResponse.json(
            {
                success: true,
                cities,
                totalProperties: data?.totalProperties || 0,
            },
            { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
        );
    } catch (error: any) {
        console.error('Error in area-stats:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
