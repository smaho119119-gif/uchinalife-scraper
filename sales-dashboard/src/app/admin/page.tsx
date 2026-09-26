"use client";

import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Database, History, Calendar, Server, Image as ImageIcon, BookOpen } from 'lucide-react';
import type { DbResponse, GeneratedImageItem, RunsResponse, Stats } from '@/app/admin/types';
import { StatsOverviewPanel } from '@/components/admin/StatsOverviewPanel';
import { RunsPanel } from '@/components/admin/RunsPanel';
import { CalendarPanel } from '@/components/admin/CalendarPanel';
import { DbPanel } from '@/components/admin/DbPanel';
import { HowItWorksPanel } from '@/components/admin/HowItWorksPanel';
import { GeneratedImagesGallery, type LocalOnlyImage } from '@/components/admin/GeneratedImagesGallery';

const WORKFLOW_URL = 'https://github.com/smaho119119-gif/uchinalife-scraper/actions/workflows/scrape-parallel.yml';

// タブは1色（ティール）。選ばれていないタブは暗い背景の上でも読める明るい文字
const TRIGGER =
    'flex-none rounded-lg border-0 bg-slate-800 px-4 py-2.5 text-[15px] font-semibold text-slate-100 shadow-none hover:scale-100 hover:bg-slate-700 hover:shadow-none data-[state=active]:scale-100 data-[state=active]:border-0 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-none';

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return body as T;
}

export default function AdminPage() {
    const [tab, setTab] = useState('overview');
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [runs, setRuns] = useState<RunsResponse | null>(null);
    const [runsError, setRunsError] = useState<string | null>(null);
    const [db, setDb] = useState<DbResponse | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [dbRequested, setDbRequested] = useState(false);
    const [calendarKey, setCalendarKey] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const [generatedImages, setGeneratedImages] = useState<GeneratedImageItem[]>([]);
    const [localOnlyImages, setLocalOnlyImages] = useState<LocalOnlyImage[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [galleryRequested, setGalleryRequested] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            setStats(await getJson<Stats>('/api/admin/stats'));
            setStatsError(null);
        } catch (e) {
            setStatsError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    const loadRuns = useCallback(async () => {
        try {
            setRuns(await getJson<RunsResponse>('/api/admin/runs'));
            setRunsError(null);
        } catch (e) {
            setRunsError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    const loadDb = useCallback(async () => {
        try {
            setDb(await getJson<DbResponse>('/api/admin/db'));
            setDbError(null);
        } catch (e) {
            setDbError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    const loadGallery = useCallback(async () => {
        setGalleryLoading(true);
        try {
            const data = await getJson<{ images?: GeneratedImageItem[]; local_only?: LocalOnlyImage[] }>('/api/ai/sync-images');
            setGeneratedImages(data.images || []);
            setLocalOnlyImages(data.local_only || []);
        } catch (error) {
            console.warn('生成画像を取得できませんでした:', error);
        } finally {
            setGalleryLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
        loadRuns();
    }, [loadStats, loadRuns]);

    useEffect(() => {
        if (tab === 'db' && !dbRequested) {
            setDbRequested(true);
            loadDb();
        }
        if (tab === 'gallery' && !galleryRequested) {
            setGalleryRequested(true);
            loadGallery();
        }
    }, [tab, dbRequested, galleryRequested, loadDb, loadGallery]);

    const handleRefresh = async () => {
        setRefreshing(true);
        const jobs: Promise<unknown>[] = [loadStats(), loadRuns()];
        if (dbRequested) jobs.push(loadDb());
        if (galleryRequested) jobs.push(loadGallery());
        setCalendarKey((k) => k + 1);
        await Promise.all(jobs);
        setRefreshing(false);
    };

    const latestRun = runs?.runs.find((r) => r.mode === 'full' || r.mode === null) ?? runs?.runs[0] ?? null;

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 text-[15px] sm:px-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-white sm:text-3xl">管理ダッシュボード</h1>
                    <p className="mt-1 text-[15px] text-slate-300">毎晩の物件取得の結果と、データベースの中身を確かめる画面（読むだけ）</p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[15px] font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-60"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                    更新
                </button>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="gap-5">
                <div className="max-w-full overflow-x-auto pb-1">
                    <TabsList className="w-max gap-2 rounded-xl border-0 bg-slate-900 p-1.5">
                        <TabsTrigger value="overview" className={TRIGGER}>
                            <Database aria-hidden="true" /> 概要
                        </TabsTrigger>
                        <TabsTrigger value="runs" className={TRIGGER}>
                            <History aria-hidden="true" /> 取得履歴
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className={TRIGGER}>
                            <Calendar aria-hidden="true" /> カレンダー
                        </TabsTrigger>
                        <TabsTrigger value="db" className={TRIGGER}>
                            <Server aria-hidden="true" /> DB詳細
                        </TabsTrigger>
                        <TabsTrigger value="gallery" className={TRIGGER}>
                            <ImageIcon aria-hidden="true" /> 生成画像
                        </TabsTrigger>
                        <TabsTrigger value="how" className={TRIGGER}>
                            <BookOpen aria-hidden="true" /> 仕組み
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview">
                    <StatsOverviewPanel stats={stats} statsError={statsError} latestRun={latestRun} workflowUrl={runs?.workflowUrl ?? WORKFLOW_URL} />
                </TabsContent>
                <TabsContent value="runs">
                    <RunsPanel data={runs} error={runsError} />
                </TabsContent>
                <TabsContent value="calendar">
                    <CalendarPanel key={calendarKey} />
                </TabsContent>
                <TabsContent value="db">
                    <DbPanel data={db} error={dbError} />
                </TabsContent>
                <TabsContent value="gallery">
                    <GeneratedImagesGallery images={generatedImages} localOnly={localOnlyImages} loading={galleryLoading} onRefresh={loadGallery} />
                </TabsContent>
                <TabsContent value="how">
                    <HowItWorksPanel workflowUrl={runs?.workflowUrl ?? WORKFLOW_URL} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
