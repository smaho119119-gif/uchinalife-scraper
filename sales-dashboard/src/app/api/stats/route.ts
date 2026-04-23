import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
export const revalidate = 60;

const CATEGORY_TYPE_MAP: Record<string, string> = {
    jukyo: '賃貸', jigyo: '賃貸', parking: '賃貸', yard: '賃貸',
    house: '売買', mansion: '売買', tochi: '売買', sonota: '売買',
};

export async function GET() {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('dashboard_stats');
        if (error) throw error;

        const categories: Record<string, number> = data?.categories || {};
        const byCategory = Object.entries(categories).map(([cat, count]) => ({
            category_name_ja: CATEGORY_TYPE_MAP[cat] || '不明',
            genre_name_ja: cat,
            count: count as number,
        }));

        return NextResponse.json(
            {
                total: data?.total || 0,
                newToday: data?.newToday || 0,
                soldToday: data?.soldToday || 0,
                byType: {
                    '賃貸': data?.rentalCount || 0,
                    '売買': data?.saleCount || 0,
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
