import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
export const revalidate = 60;

const CATEGORY_TYPE_MAP: Record<string, string> = {
    jukyo: '賃貸', jigyo: '賃貸', parking: '賃貸', yard: '賃貸',
    house: '売買', mansion: '売買', tochi: '売買', sonota: '売買',
};

// The `dashboard_stats` RPC used to compute these aggregates server-side
// but as the properties table grew past ~18k rows it started tripping
// Supabase's 8s statement timeout. We now issue a handful of cheap
// count-only queries in parallel — each uses an index (is_active, category,
// genre_name_ja, first_seen_date) and returns in well under a second.
async function countProperties(
    supabase: ReturnType<typeof getSupabase>,
    filters: Record<string, string> = {},
): Promise<number> {
    let q = supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
    for (const [k, v] of Object.entries(filters)) {
        q = q.eq(k, v);
    }
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
}

export async function GET() {
    try {
        // Use service role to bypass RLS. The underlying properties table
        // has row-level filters that hide most rows from the anon role, so
        // anon count(*) returned 0 even though the public RPC used to work.
        const supabase = getSupabase('service');

        const today = new Date().toISOString().split('T')[0];

        const genres = Object.keys(CATEGORY_TYPE_MAP);

        const [total, rentalCount, saleCount, newToday, ...genreCounts] = await Promise.all([
            countProperties(supabase),
            countProperties(supabase, { category: '賃貸' }),
            countProperties(supabase, { category: '売買' }),
            (async () => {
                const { count, error } = await supabase
                    .from('properties')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_active', true)
                    .gte('first_seen_date', today);
                if (error) throw error;
                return count ?? 0;
            })(),
            ...genres.map((g) => countProperties(supabase, { genre_name_ja: g })),
        ]);

        const categories: Record<string, number> = {};
        genres.forEach((g, i) => {
            categories[g] = genreCounts[i] ?? 0;
        });

        const byCategory = Object.entries(categories).map(([cat, count]) => ({
            category_name_ja: CATEGORY_TYPE_MAP[cat] || '不明',
            genre_name_ja: cat,
            count,
        }));

        return NextResponse.json(
            {
                total,
                newToday,
                soldToday: 0,
                byType: {
                    '賃貸': rentalCount,
                    '売買': saleCount,
                },
                byCategory,
                categories,
            },
            {
                headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
            },
        );
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
