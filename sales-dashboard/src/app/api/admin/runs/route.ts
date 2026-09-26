import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, NO_STORE } from '@/lib/admin-auth';
import {
    cached,
    errorMessage,
    GITHUB_WORKFLOW_URL,
    jstToday,
    loadActiveGithubRuns,
    loadRuns,
    rpc,
} from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

interface DailyResult {
    from: string;
    to: string;
    snapshots: { date: string; category: string; url_count: number | null; scraped_at: string | null }[];
    new: { date: string; count: number }[];
    sold: { date: string; count: number }[];
}

/**
 * 取得履歴: 記録された実行（新しい順・カテゴリ行つき）＋ GitHub で実行中/待機中の実行
 * ＋ 推移グラフ用の日別データ（スナップショット全期間・新着/売れたの日別合計）
 */
export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const [runsRes, activeRes, dailyRes] = await Promise.allSettled([
        loadRuns({ limit: 100 }),
        loadActiveGithubRuns(),
        // 1日1回しか変わらないので5分持つ
        cached(`daily-400-${jstToday()}`, 5 * 60 * 1000, () =>
            rpc<DailyResult>('uchina_admin_daily', { p_days: 400 }),
        ),
    ]);

    return NextResponse.json(
        {
            todayJst: jstToday(),
            workflowUrl: GITHUB_WORKFLOW_URL,
            runs: runsRes.status === 'fulfilled' ? runsRes.value : [],
            runsError: runsRes.status === 'rejected' ? errorMessage(runsRes.reason) : null,
            active: activeRes.status === 'fulfilled' ? activeRes.value : { runs: [], error: errorMessage(activeRes.reason), fetchedAt: new Date().toISOString() },
            daily: dailyRes.status === 'fulfilled' ? dailyRes.value : null,
            dailyError: dailyRes.status === 'rejected' ? errorMessage(dailyRes.reason) : null,
        },
        { headers: NO_STORE },
    );
}
