import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { RENTAL_CATEGORIES, SALE_CATEGORIES, ALL_CATEGORIES } from '@/lib/categories';
export const revalidate = 60;

const CATEGORY_TYPE_MAP: Record<string, string> = {
    jukyo: '賃貸', jigyo: '賃貸', parking: '賃貸', yard: '賃貸',
    house: '売買', mansion: '売買', tochi: '売買', sonota: '売買',
};

// Replaces the `dashboard_stats` RPC which tripped Supabase's 8s statement
// timeout once properties crossed ~18k rows. A handful of indexed
// count(*) queries in parallel comes back in <1s. Uses the service role
// to bypass RLS on the properties table (the old RPC was SECURITY DEFINER).
export async function GET() {
    try {
        const supabase = getSupabase('service');
        const today = new Date().toISOString().split('T')[0];

        const base = () =>
            supabase
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

        const [totalRes, rentalRes, saleRes, newTodayRes, ...catRes] = await Promise.all([
            base(),
            base().in('category', RENTAL_CATEGORIES as unknown as string[]),
            base().in('category', SALE_CATEGORIES as unknown as string[]),
            base().gte('first_seen_date', today),
            ...ALL_CATEGORIES.map((c) => base().eq('category', c)),
        ]);

        for (const r of [totalRes, rentalRes, saleRes, newTodayRes, ...catRes]) {
            if (r.error) throw r.error;
        }

        const categories: Record<string, number> = {};
        ALL_CATEGORIES.forEach((c, i) => {
            categories[c] = catRes[i].count ?? 0;
        });

        const byCategory = Object.entries(categories).map(([cat, count]) => ({
            category_name_ja: CATEGORY_TYPE_MAP[cat] || '不明',
            genre_name_ja: cat,
            count,
        }));

        return NextResponse.json(
            {
                total: totalRes.count ?? 0,
                newToday: newTodayRes.count ?? 0,
                soldToday: 0,
                byType: {
                    '賃貸': rentalRes.count ?? 0,
                    '売買': saleRes.count ?? 0,
                },
                byCategory,
                categories,
            },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
        );
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
