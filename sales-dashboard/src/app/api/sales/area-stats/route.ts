import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { getCityCoordinates, getRegionFull } from '@/lib/area';
import { isValidCategory } from '@/lib/categories';
import { jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export const revalidate = 300;

const ALLOWED_TYPES = ['rent', 'sale', 'all'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const rawCategory = searchParams.get('category') || '';
        const rawType = searchParams.get('type') || 'all';

        const category = rawCategory && isValidCategory(rawCategory) ? rawCategory : '';
        const type: AllowedType = (ALLOWED_TYPES as readonly string[]).includes(rawType)
            ? (rawType as AllowedType)
            : 'all';

        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('area_stats', {
            p_category: category,
            p_type: type,
        });
        if (error) throw error;

        const cities = ((data?.cities as Array<Record<string, unknown>>) || [])
            .map((c) => {
                const name = String(c.name ?? '');
                const coordinates = getCityCoordinates(name);
                const region = getRegionFull(name);
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
    } catch (error) {
        return jsonError(logAndSerializeError('sales/area-stats', error));
    }
}
