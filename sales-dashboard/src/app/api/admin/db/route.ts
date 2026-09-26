import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, NO_STORE } from '@/lib/admin-auth';
import { ALL_CATEGORIES } from '@/lib/categories';
import { cached, errorMessage, loadMarketOverview, rpc } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

interface DbOverview {
    today_jst: string;
    database_bytes: number;
    tables: { name: string; rows: number; total_bytes: number; table_bytes: number; index_bytes: number }[];
    inventory: { category: string; active: number; sold: number }[];
    snapshots: {
        first_date: string | null;
        last_date: string | null;
        rows: number;
        days: number;
        last_scraped_at: string | null;
        missing_days: string[];
        partial_days: { date: string; categories: number }[];
    };
    properties_last_updated_at: string | null;
}

interface ImageRate {
    from: string;
    to: string;
    by_category: { category: string; sold: number; with_images: number }[];
}

/**
 * DB詳細: うちなーらいふDB（米国・共有）の表・在庫・スナップショット・画像保存率
 * ＋ PROPERTY AI（東京）の公開集計 ＋ 両者の掲載中件数のカテゴリ別突き合わせ
 */
export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    // 3つは別々の呼び出しにする（DB側の8秒制限がそれぞれに掛かる）
    const [overviewRes, imageRes, market] = await Promise.all([
        cached('db-overview', 60 * 1000, () => rpc<DbOverview>('uchina_admin_db_overview'))
            .then((v) => ({ ok: true as const, v }))
            .catch((e) => ({ ok: false as const, e: errorMessage(e) })),
        cached('image-rate-30', 5 * 60 * 1000, () => rpc<ImageRate>('uchina_admin_image_rate', { p_days: 30 }))
            .then((v) => ({ ok: true as const, v }))
            .catch((e) => ({ ok: false as const, e: errorMessage(e) })),
        loadMarketOverview(),
    ]);

    const overview = overviewRes.ok ? overviewRes.v : null;

    // 掲載中件数の突き合わせ（うちなーらいふ properties.is_active と PROPERTY AI の active）
    let comparison: {
        category: string;
        uchina: number | null;
        propertyAi: number | null;
        diff: number | null;
        match: boolean | null;
    }[] | null = null;
    if (overview && market.data?.byCategory) {
        const inv = new Map(overview.inventory.map((r) => [r.category, r.active]));
        const cats = [
            ...ALL_CATEGORIES,
            ...Object.keys(market.data.byCategory).filter((c) => !(ALL_CATEGORIES as readonly string[]).includes(c)),
        ];
        comparison = cats.map((category) => {
            const u = inv.get(category) ?? null;
            const p = market.data?.byCategory?.[category]?.active ?? null;
            const diff = u !== null && p !== null ? p - u : null;
            return { category, uchina: u, propertyAi: p, diff, match: diff === null ? null : diff === 0 };
        });
    }

    return NextResponse.json(
        {
            uchina: overview,
            uchinaError: overviewRes.ok ? null : overviewRes.e,
            imageRate: imageRes.ok ? imageRes.v : null,
            imageRateError: imageRes.ok ? null : imageRes.e,
            propertyAi: market.data,
            propertyAiError: market.error,
            comparison,
        },
        { headers: NO_STORE },
    );
}
