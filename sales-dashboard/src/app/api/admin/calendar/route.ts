import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, NO_STORE } from '@/lib/admin-auth';
import { cached, errorMessage, jstToday, loadRuns, rpc } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

interface DailyResult {
    from: string;
    to: string;
    snapshots: { date: string; category: string; url_count: number | null; scraped_at: string | null }[];
    new: { date: string; count: number }[];
    sold: { date: string; count: number }[];
}

interface DayDetailResult {
    date: string;
    snapshots: { category: string; url_count: number | null; scraped_at: string | null }[];
    new: Record<string, number>;
    sold: Record<string, { count: number; with_images: number }>;
}

/**
 * カレンダー（日付はすべて日本時間）
 *   ?month=YYYY-MM   … その月の各日: 実行（uchina_scrape_runs）・掲載件数（daily_link_snapshots）・新着・売れた
 *   ?date=YYYY-MM-DD … その日の実行（カテゴリ行つき）とカテゴリ別の内訳
 */
export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const sp = req.nextUrl.searchParams;
    const date = sp.get('date');
    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
            return NextResponse.json({ error: '日付は YYYY-MM-DD で指定してください' }, { status: 400, headers: NO_STORE });
        }
        return dayDetail(date);
    }

    const month = sp.get('month') ?? jstToday().slice(0, 7);
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[1]) < 2020 || Number(m[1]) > 2099) {
        return NextResponse.json({ error: '月は YYYY-MM で指定してください' }, { status: 400, headers: NO_STORE });
    }
    return monthView(Number(m[1]), Number(m[2]));
}

async function monthView(year: number, month: number) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, '0');
    const from = `${year}-${mm}-01`;
    const to = `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`;
    const today = jstToday();

    const [dailyRes, runsRes] = await Promise.allSettled([
        cached(`daily-${to}-${today}`, 5 * 60 * 1000, () =>
            rpc<DailyResult>('uchina_admin_daily', { p_days: daysInMonth, p_end: to }),
        ),
        loadRuns({ from, to, limit: 200 }),
    ]);
    const daily = dailyRes.status === 'fulfilled' ? dailyRes.value : null;
    const runs = runsRes.status === 'fulfilled' ? runsRes.value : [];

    const newBy = new Map((daily?.new ?? []).map((r) => [r.date, r.count]));
    const soldBy = new Map((daily?.sold ?? []).map((r) => [r.date, r.count]));
    const snapBy = new Map<string, { total: number; categories: number; lastScrapedAt: string | null }>();
    for (const s of daily?.snapshots ?? []) {
        const cur = snapBy.get(s.date) ?? { total: 0, categories: 0, lastScrapedAt: null };
        cur.total += s.url_count ?? 0;
        cur.categories += 1;
        if (s.scraped_at && (!cur.lastScrapedAt || s.scraped_at > cur.lastScrapedAt)) cur.lastScrapedAt = s.scraped_at;
        snapBy.set(s.date, cur);
    }

    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const d = `${year}-${mm}-${String(i + 1).padStart(2, '0')}`;
        const dayRuns = runs
            .filter((r) => r.snapshot_date === d)
            .map((r) => ({
                run_id: r.run_id,
                run_number: r.run_number,
                event: r.event,
                mode: r.mode,
                conclusion: r.conclusion,
                run_url: r.run_url,
            }));
        const snap = snapBy.get(d);
        return {
            date: d,
            isFuture: d > today,
            runs: dayRuns,
            listings: snap?.total ?? null,
            snapshotCategories: snap?.categories ?? 0,
            lastScrapedAt: snap?.lastScrapedAt ?? null,
            newCount: newBy.get(d) ?? 0,
            soldCount: soldBy.get(d) ?? 0,
        };
    });

    return NextResponse.json(
        {
            year,
            month,
            todayJst: today,
            days,
            dailyError: dailyRes.status === 'rejected' ? errorMessage(dailyRes.reason) : null,
            runsError: runsRes.status === 'rejected' ? errorMessage(runsRes.reason) : null,
        },
        { headers: NO_STORE },
    );
}

async function dayDetail(date: string) {
    const [detailRes, runsRes] = await Promise.allSettled([
        cached(`day-${date}-${jstToday()}`, 5 * 60 * 1000, () =>
            rpc<DayDetailResult>('uchina_admin_day_detail', { p_date: date }),
        ),
        loadRuns({ from: date, to: date, limit: 50 }),
    ]);
    return NextResponse.json(
        {
            date,
            detail: detailRes.status === 'fulfilled' ? detailRes.value : null,
            detailError: detailRes.status === 'rejected' ? errorMessage(detailRes.reason) : null,
            runs: runsRes.status === 'fulfilled' ? runsRes.value : [],
            runsError: runsRes.status === 'rejected' ? errorMessage(runsRes.reason) : null,
        },
        { headers: NO_STORE },
    );
}
