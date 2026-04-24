import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
export const revalidate = 60;

const GENRES = [
    'jukyo', 'jigyo', 'parking', 'yard',
    'house', 'mansion', 'tochi', 'sonota',
];

// Replaces the `admin_stats` RPC which started hitting Supabase's 8s
// statement timeout once the properties table crossed ~18k rows. We fan
// out a handful of indexed count(*) queries in parallel instead — each
// comes back in <100ms.
export async function GET() {
    try {
        const supabase = getSupabase('service');

        const [totalRes, latestRes, ...genreRes] = await Promise.all([
            supabase.from('properties').select('*', { count: 'exact', head: true }),
            supabase.from('properties').select('first_seen_date').order('first_seen_date', { ascending: false }).limit(1),
            ...GENRES.map((g) =>
                supabase
                    .from('properties')
                    .select('*', { count: 'exact', head: true })
                    .eq('genre_name_ja', g),
            ),
        ]);

        if (totalRes.error) throw totalRes.error;

        const categories: Record<string, number> = {};
        genreRes.forEach((res, i) => {
            if (res.error) throw res.error;
            categories[GENRES[i]] = res.count ?? 0;
        });

        const lastUpdated = latestRes.data?.[0]?.first_seen_date ?? null;
        const total = totalRes.count ?? 0;

        return NextResponse.json(
            {
                total,
                // We don't track a soft-delete flag, so every row in the
                // table is considered active for the dashboard's purposes.
                active: total,
                categories,
                lastUpdated,
            },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
        );
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
