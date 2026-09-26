import { NextResponse, type NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { requireAdmin, NO_STORE } from '@/lib/admin-auth';

// 管理データなので共有キャッシュに載せない（ログイン確認のため毎回実行する）
export const dynamic = 'force-dynamic';

const GENRES = [
    'jukyo', 'jigyo', 'parking', 'yard',
    'house', 'mansion', 'tochi', 'sonota',
];

// Replaces the `admin_stats` RPC which started hitting Supabase's 8s
// statement timeout once the properties table crossed ~18k rows. We fan
// out a handful of indexed count(*) queries in parallel instead — each
// comes back in <100ms.
export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    try {
        const supabase = getSupabase('service');

        const [totalRes, activeRes, latestRes, snapRes, ...genreRes] = await Promise.all([
            supabase.from('properties').select('*', { count: 'exact', head: true }),
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('is_active', true),
            // 最終更新は実際の時刻（updated_at）を使う。日付だけの first_seen_date を時刻として出すと
            // 「9:00:00」のような実在しない時刻になっていた
            supabase.from('properties').select('updated_at').order('updated_at', { ascending: false }).limit(1),
            // urls 列（巨大）は読まない
            supabase.from('daily_link_snapshots').select('snapshot_date, scraped_at').order('scraped_at', { ascending: false }).limit(1),
            ...GENRES.map((g) =>
                supabase
                    .from('properties')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_active', true)
                    .eq('category', g),
            ),
        ]);

        if (totalRes.error) throw totalRes.error;
        if (activeRes.error) throw activeRes.error;

        const categories: Record<string, number> = {};
        genreRes.forEach((res, i) => {
            if (res.error) throw res.error;
            categories[GENRES[i]] = res.count ?? 0;
        });

        return NextResponse.json(
            {
                total: totalRes.count ?? 0,
                active: activeRes.count ?? 0,
                categories,
                lastUpdated: latestRes.data?.[0]?.updated_at ?? null,
                lastSnapshotDate: snapRes.data?.[0]?.snapshot_date ?? null,
                lastScrapedAt: snapRes.data?.[0]?.scraped_at ?? null,
            },
            { headers: NO_STORE },
        );
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500, headers: NO_STORE });
    }
}
