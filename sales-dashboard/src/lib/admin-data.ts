import { getSupabase } from '@/lib/supabase-server';

/**
 * 管理画面（/admin）のサーバー側の読み取り。
 * DB は service_role で読む（uchina_* の表は RLS 有効・ポリシー無しなので service_role 以外は読めない）。
 * 集計は DB 側の関数 uchina_admin_*（supabase/migrations/20260926_uchina_admin_read.sql）に任せる。
 */

export const GITHUB_REPO = 'smaho119119-gif/uchinalife-scraper';
export const GITHUB_WORKFLOW = 'scrape-parallel.yml';
export const GITHUB_WORKFLOW_URL = `https://github.com/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}`;

const PROPERTY_AI_OVERVIEW_URL =
    'https://rtrorhmmsjvbmlulcxra.supabase.co/functions/v1/property-ai-api?forceFunctionRegion=ap-northeast-1&action=market-overview';

/** 日本時間の今日（YYYY-MM-DD） */
export function jstToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

// ── 関数インスタンス内の短いキャッシュ（成功した結果だけ持つ） ──
const memo = new Map<string, { at: number; value: unknown }>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = memo.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
    const value = await load();
    memo.set(key, { at: Date.now(), value });
    return value;
}

export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await getSupabase('service').rpc(name, args);
    if (error) throw new Error(`${name}: ${error.message}`);
    return data as T;
}

export function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === 'string') return m;
    }
    return String(err);
}

// ── 実行記録（uchina_scrape_runs / uchina_scrape_run_categories） ──

export interface RunRow {
    run_id: number;
    run_number: number | null;
    run_attempt: number | null;
    event: string | null;
    mode: string | null;
    sold_mode: string | null;
    head_sha: string | null;
    run_url: string | null;
    snapshot_date: string | null;
    created_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    total_minutes: number | null;
    conclusion: string | null;
    jobs_ok: number | null;
    jobs_total: number | null;
    status_text: string | null;
    problems: string[] | null;
    expected_total: number | null;
    collected_total: number | null;
    new_total: number | null;
    sold_total: number | null;
    reactivated_total: number | null;
    mail_sent: boolean | null;
    mail_detail: string | null;
    source: string | null;
    recorded_at: string | null;
}

export type RunCategoryRow = Record<string, unknown> & { run_id: number; category: string };

export interface RunWithCategories extends RunRow {
    categories: RunCategoryRow[];
}

const RUN_COLUMNS =
    'run_id,run_number,run_attempt,event,mode,sold_mode,head_sha,run_url,snapshot_date,created_at,started_at,finished_at,total_minutes,conclusion,jobs_ok,jobs_total,status_text,problems,expected_total,collected_total,new_total,sold_total,reactivated_total,mail_sent,mail_detail,source,recorded_at';

/** 実行を新しい順に（カテゴリ行つき）。期間を渡すとその日付（日本時間）の範囲だけ */
export async function loadRuns(opts: { from?: string; to?: string; limit?: number } = {}): Promise<RunWithCategories[]> {
    const sb = getSupabase('service');
    let q = sb
        .from('uchina_scrape_runs')
        .select(RUN_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(opts.limit ?? 100);
    if (opts.from) q = q.gte('snapshot_date', opts.from);
    if (opts.to) q = q.lte('snapshot_date', opts.to);
    const { data: runs, error } = await q;
    if (error) throw new Error(`uchina_scrape_runs: ${error.message}`);
    const list = (runs ?? []) as unknown as RunRow[];
    if (list.length === 0) return [];

    const { data: cats, error: catErr } = await sb
        .from('uchina_scrape_run_categories')
        .select('*')
        .in('run_id', list.map((r) => r.run_id))
        .range(0, 999);
    if (catErr) throw new Error(`uchina_scrape_run_categories: ${catErr.message}`);
    const byRun = new Map<number, RunCategoryRow[]>();
    for (const c of (cats ?? []) as RunCategoryRow[]) {
        const arr = byRun.get(c.run_id) ?? [];
        arr.push(c);
        byRun.set(c.run_id, arr);
    }
    return list.map((r) => ({ ...r, categories: byRun.get(r.run_id) ?? [] }));
}

// ── GitHub（公開リポジトリ・未認証。1時間60回の制限があるので数分キャッシュ） ──

export interface ActiveRun {
    id: number;
    run_number: number;
    event: string;
    status: string;
    created_at: string;
    run_started_at: string | null;
    html_url: string;
}

export interface ActiveRunsResult {
    runs: ActiveRun[];
    error: string | null;
    fetchedAt: string;
}

export async function loadActiveGithubRuns(): Promise<ActiveRunsResult> {
    try {
        return await cached('gh-active-runs', 3 * 60 * 1000, async () => {
            const res = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/runs?per_page=10`,
                {
                    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'home-sales-admin' },
                    cache: 'no-store',
                    signal: AbortSignal.timeout(8000),
                },
            );
            if (!res.ok) throw new Error(`GitHub API ${res.status}`);
            const body = (await res.json()) as { workflow_runs?: (ActiveRun & { status: string })[] };
            const runs = (body.workflow_runs ?? [])
                .filter((r) => r.status !== 'completed')
                .map((r) => ({
                    id: r.id,
                    run_number: r.run_number,
                    event: r.event,
                    status: r.status,
                    created_at: r.created_at,
                    run_started_at: r.run_started_at,
                    html_url: r.html_url,
                }));
            return { runs, error: null, fetchedAt: new Date().toISOString() };
        });
    } catch (err) {
        return { runs: [], error: errorMessage(err), fetchedAt: new Date().toISOString() };
    }
}

// ── PROPERTY AI（東京）の公開集計 ──

export interface MarketOverview {
    asOf?: string;
    lastSyncedAt?: string | null;
    byCategory?: Record<string, { active?: number; ended?: number; outliers?: number }>;
    prices?: { day: string; rows: number; withFavorite: number }[];
    themes?: Record<string, number>;
    favorites?: { filled?: number; positive?: number; max?: number };
    media?: { imageCountFilled?: number; withVideo?: number };
    uniqueProperties?: number;
}

export async function loadMarketOverview(): Promise<{ data: MarketOverview | null; error: string | null }> {
    try {
        const data = await cached('property-ai-overview', 5 * 60 * 1000, async () => {
            const res = await fetch(PROPERTY_AI_OVERVIEW_URL, {
                cache: 'no-store',
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) throw new Error(`PROPERTY AI ${res.status}`);
            const body = (await res.json()) as MarketOverview;
            if (!body || typeof body !== 'object' || !body.byCategory) {
                throw new Error('PROPERTY AI の応答の形が想定と違います');
            }
            return body;
        });
        return { data, error: null };
    } catch (err) {
        return { data: null, error: errorMessage(err) };
    }
}
