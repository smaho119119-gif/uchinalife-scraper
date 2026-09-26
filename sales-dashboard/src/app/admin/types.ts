/**
 * 管理画面（/admin）で使う型。API（/api/admin/*）の応答の形と合わせる。
 */

export interface Stats {
    total: number;
    active: number;
    categories: Record<string, number>;
    /** properties.updated_at の最新（実際の時刻） */
    lastUpdated: string | null;
    lastSnapshotDate: string | null;
    lastScrapedAt: string | null;
}

export interface RunCategory {
    run_id: number;
    category: string;
    job_conclusion?: string | null;
    job_started_at?: string | null;
    job_finished_at?: string | null;
    job_minutes?: number | null;
    expected?: number | null;
    collected?: number | null;
    complete?: boolean | null;
    method?: string | null;
    seconds?: number | null;
    retries?: number | null;
    chunks?: number | null;
    requests?: number | null;
    api_problems?: string[] | null;
    new_count?: number | null;
    sold_count?: number | null;
    sold_candidates?: number | null;
    sold_confirmed?: number | null;
    sold_still_listed?: number | null;
    sold_held?: number | null;
    sold_controls_ok?: boolean | null;
    reactivated?: number | null;
    scrape_errors?: number | null;
    sync_rows?: number | null;
    sync_written?: number | null;
    sync_outliers?: number | null;
    sync_ended?: number | null;
    sync_finalized?: boolean | null;
    sync_error?: string | null;
    elapsed_seconds?: number | null;
}

export interface Run {
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
    categories: RunCategory[];
}

export interface ActiveRun {
    id: number;
    run_number: number;
    event: string;
    status: string;
    created_at: string;
    run_started_at: string | null;
    html_url: string;
}

export interface DailySeries {
    from: string;
    to: string;
    snapshots: { date: string; category: string; url_count: number | null; scraped_at: string | null }[];
    new: { date: string; count: number }[];
    sold: { date: string; count: number }[];
}

export interface RunsResponse {
    todayJst: string;
    workflowUrl: string;
    runs: Run[];
    runsError: string | null;
    active: { runs: ActiveRun[]; error: string | null; fetchedAt: string };
    daily: DailySeries | null;
    dailyError: string | null;
}

export interface CalendarDay {
    date: string;
    isFuture: boolean;
    runs: { run_id: number; run_number: number | null; event: string | null; mode: string | null; conclusion: string | null; run_url: string | null }[];
    listings: number | null;
    snapshotCategories: number;
    lastScrapedAt: string | null;
    newCount: number;
    soldCount: number;
}

export interface CalendarResponse {
    year: number;
    month: number;
    todayJst: string;
    days: CalendarDay[];
    dailyError: string | null;
    runsError: string | null;
}

export interface DayDetailResponse {
    date: string;
    detail: {
        date: string;
        snapshots: { category: string; url_count: number | null; scraped_at: string | null }[];
        new: Record<string, number>;
        sold: Record<string, { count: number; with_images: number }>;
    } | null;
    detailError: string | null;
    runs: Run[];
    runsError: string | null;
}

export interface DbResponse {
    uchina: {
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
    } | null;
    uchinaError: string | null;
    imageRate: { from: string; to: string; by_category: { category: string; sold: number; with_images: number }[] } | null;
    imageRateError: string | null;
    propertyAi: {
        asOf?: string;
        lastSyncedAt?: string | null;
        byCategory?: Record<string, { active?: number; ended?: number; outliers?: number }>;
        prices?: { day: string; rows: number; withFavorite: number }[];
        themes?: Record<string, number>;
        favorites?: { filled?: number; positive?: number; max?: number };
        media?: { imageCountFilled?: number; withVideo?: number };
        uniqueProperties?: number;
    } | null;
    propertyAiError: string | null;
    comparison: { category: string; uchina: number | null; propertyAi: number | null; diff: number | null; match: boolean | null }[] | null;
}

export interface GeneratedImageItem {
    id: number;
    property_url: string;
    image_url: string;
    filename: string;
    mode: string;
    style: string;
    size: string;
    aspect_ratio: string;
    created_at: string;
    file_exists: boolean;
}
