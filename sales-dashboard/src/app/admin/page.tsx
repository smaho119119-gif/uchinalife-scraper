"use client";

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, ExternalLink, Database, GitBranch, Cloud, Download, RefreshCw,
    Play, Square, Clock, Settings, FileText, Activity, CheckCircle,
    Terminal, Calendar, Zap, AlertCircle, BarChart3, ChevronLeft, ChevronRight, X,
    Image as ImageIcon,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import type {
    Stats, GitHubWorkflow, ScrapingInfo, ScrapingStatus, LogData,
    ScrapingProgress, CalendarData, DayDetails, GeneratedImageItem,
} from '@/app/admin/types';
import { StatsOverviewPanel } from '@/components/admin/StatsOverviewPanel';
import { ScrapingSettingsPanel } from '@/components/admin/ScrapingSettingsPanel';
import {
    GeneratedImagesGallery,
    type LocalOnlyImage,
} from '@/components/admin/GeneratedImagesGallery';
import { LogViewerPanel } from '@/components/admin/LogViewerPanel';

export default function AdminPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [workflows, setWorkflows] = useState<GitHubWorkflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // スクレイピング関連の状態
    const [scrapingInfo, setScrapingInfo] = useState<ScrapingInfo | null>(null);
    const [scrapingStatus, setScrapingStatus] = useState<ScrapingStatus | null>(null);
    const [scrapingProgress, setScrapingProgress] = useState<ScrapingProgress | null>(null);
    const [logData, setLogData] = useState<LogData | null>(null);
    const [selectedLogFile, setSelectedLogFile] = useState<string>('scraper.log');
    const [isExecuting, setIsExecuting] = useState(false);
    
    // カレンダー関連の状態
    const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [dayDetails, setDayDetails] = useState<DayDetails | null>(null);
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
    
    // 生成画像ギャラリー関連の状態
    const [generatedImages, setGeneratedImages] = useState<GeneratedImageItem[]>([]);
    const [localOnlyImages, setLocalOnlyImages] = useState<LocalOnlyImage[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/stats');
            if (!res.ok) {
                console.error('Failed to fetch stats:', res.status, res.statusText);
                return;
            }
            const data = await res.json();
            console.log('Stats data received:', data);
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchWorkflows = async () => {
        try {
            // スクレイピング専用のワークフロー（property-scraper.yml）のみを取得
            const res = await fetch('https://api.github.com/repos/smaho119119-gif/uchinalife-scraper/actions/workflows/property-scraper.yml/runs?per_page=10');
            const data = await res.json();
            // ワークフロー実行履歴を取得
            setWorkflows(data.workflow_runs || []);
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
        }
    };
    
    // 生成画像ギャラリーを取得
    const fetchGeneratedImages = async () => {
        setGalleryLoading(true);
        try {
            const res = await fetch('/api/ai/sync-images');
            const data = await res.json();
            setGeneratedImages(data.images || []);
            setLocalOnlyImages(data.local_only || []);
        } catch (error) {
            console.error('Failed to fetch generated images:', error);
        } finally {
            setGalleryLoading(false);
        }
    };

    const fetchScrapingInfo = async () => {
        try {
            const res = await fetch('/api/admin/scraping?type=info');
            const data = await res.json();
            setScrapingInfo(data);
        } catch (error) {
            console.error('Failed to fetch scraping info:', error);
        }
    };

    const fetchScrapingStatus = async () => {
        try {
            const res = await fetch('/api/admin/scraping?type=status');
            const data = await res.json();
            setScrapingStatus(data);
            return data;
        } catch (error) {
            console.error('Failed to fetch scraping status:', error);
            return null;
        }
    };

    const fetchScrapingProgress = async () => {
        try {
            const res = await fetch('/api/admin/scraping?type=progress');
            const data = await res.json();
            setScrapingProgress(data);
        } catch (error) {
            console.error('Failed to fetch scraping progress:', error);
        }
    };

    const fetchLogs = async (filename?: string) => {
        try {
            const file = filename || selectedLogFile;
            const res = await fetch(`/api/admin/scraping?type=logs&file=${file}`);
            const data = await res.json();
            setLogData(data);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    };

    const fetchCalendar = async (year?: number, month?: number) => {
        try {
            const y = year || calendarYear;
            const m = month || calendarMonth;
            const res = await fetch(`/api/admin/calendar?year=${y}&month=${m}`);
            const data = await res.json();
            setCalendarData(data);
        } catch (error) {
            console.error('Failed to fetch calendar:', error);
        }
    };

    const fetchDayDetails = async (date: string) => {
        try {
            const res = await fetch(`/api/admin/calendar?date=${date}`);
            const data = await res.json();
            setDayDetails(data);
            setSelectedDate(date);
        } catch (error) {
            console.error('Failed to fetch day details:', error);
        }
    };

    const changeMonth = (delta: number) => {
        let newMonth = calendarMonth + delta;
        let newYear = calendarYear;
        
        if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        } else if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        }
        
        setCalendarMonth(newMonth);
        setCalendarYear(newYear);
        fetchCalendar(newYear, newMonth);
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchStats(), 
                fetchWorkflows(), 
                fetchScrapingInfo(),
                fetchScrapingStatus(),
                fetchScrapingProgress(),
                fetchCalendar()
            ]);
            setLoading(false);
        };
        loadData();
        
        // ステータスと進捗を3秒ごとに更新（実行中のみ進捗を更新）
        const interval = setInterval(async () => {
            const status = await fetchScrapingStatus();
            if (status?.isRunning) {
                await fetchScrapingProgress();
            } else if (scrapingProgress?.phase !== 'completed') {
                // スクレイピングが停止した場合、完了状態を確認するために一度進捗を更新
                await fetchScrapingProgress();
            }
        }, 3000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchStats(), 
            fetchWorkflows(),
            fetchScrapingInfo(),
            fetchScrapingStatus(),
            fetchScrapingProgress(),
            fetchCalendar()
        ]);
        setRefreshing(false);
    };

    const handleRunScraping = async () => {
        setIsExecuting(true);
        try {
            const res = await fetch('/api/admin/scraping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'run' }),
            });
            await res.json();
            await fetchScrapingStatus();
        } catch (error) {
            console.error('スクレイピングの開始に失敗しました:', error);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleStopScraping = async () => {
        setIsExecuting(true);
        try {
            await fetch('/api/admin/scraping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' }),
            });
            await fetchScrapingStatus();
        } catch (error) {
            console.error('スクレイピングの停止に失敗しました:', error);
        } finally {
            setIsExecuting(false);
        }
    };

    const getStatusColor = (status: string, conclusion: string | null) => {
        if (status === 'in_progress') return 'text-yellow-500';
        if (conclusion === 'success') return 'text-green-500';
        if (conclusion === 'failure') return 'text-red-500';
        return 'text-gray-500';
    };

    const getStatusIcon = (status: string, conclusion: string | null) => {
        if (status === 'in_progress') return '🟡';
        if (conclusion === 'success') return '✅';
        if (conclusion === 'failure') return '❌';
        return '⚪';
    };

    // グラフ用のデータをメモ化（コンポーネントのトップレベルで定義）
    const barChartData = useMemo(() => 
        Object.entries(stats?.categories || {}).map(([category, count]) => ({
            name: category,
            件数: count,
        })), [stats?.categories]
    );

    const pieChartData = useMemo(() => 
        Object.entries(stats?.categories || {}).map(([category, count]) => ({
            name: category,
            value: count,
        })), [stats?.categories]
    );

    const pieChartCells = useMemo(() => 
        Object.entries(stats?.categories || {}).map((_, index) => (
            <Cell key={`cell-${index}`} fill={[
                '#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', 
                '#ef4444', '#ec4899', '#3b82f6', '#14b8a6'
            ][index % 8]} />
        )), [stats?.categories]
    );

    const lineChartData = useMemo(() => 
        calendarData?.days.filter(d => d.hasLog).map(d => ({
            date: d.date.split('-')[2] + '日',
            リンク数: d.totalLinks,
        })) || [], [calendarData?.days]
    );

    const progressBarChartData = useMemo(() => 
        scrapingProgress?.categoryProgress.filter(cat => cat.links > 0).map(cat => ({
            name: cat.name.replace('賃貸 - ', '').replace('売買 - ', ''),
            収集: cat.links,
            処理済: cat.processed,
        })) || [], [scrapingProgress?.categoryProgress]
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">🎛️ 管理ダッシュボード</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        スクレイピングシステムの状態を確認・管理
                    </p>
                </div>
                <Button onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    更新
                </Button>
            </div>

            {/* タブナビゲーション */}
            <Tabs defaultValue="overview" className="space-y-6">
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0">
                    <TabsList className="inline-flex h-auto p-1 bg-transparent gap-2 min-w-max sm:min-w-0">
                        <TabsTrigger 
                            value="overview"
                            className="px-6 py-3 rounded-full border-2 border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:border-cyan-400 data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-500/30 font-medium transition-all duration-300"
                        >
                            <Database className="w-4 h-4 mr-2" />
                            概要
                        </TabsTrigger>
                        <TabsTrigger 
                            value="scraping"
                            className="px-6 py-3 rounded-full border-2 border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:border-green-400 data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/30 font-medium transition-all duration-300"
                        >
                            <Activity className="w-4 h-4 mr-2" />
                            スクレイピング
                        </TabsTrigger>
                        <TabsTrigger 
                            value="logs"
                            className="px-6 py-3 rounded-full border-2 border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:border-amber-400 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/30 font-medium transition-all duration-300"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            ログ
                        </TabsTrigger>
                        <TabsTrigger 
                            value="calendar"
                            className="px-6 py-3 rounded-full border-2 border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:border-rose-400 data-[state=active]:shadow-lg data-[state=active]:shadow-rose-500/30 font-medium transition-all duration-300"
                        >
                            <Calendar className="w-4 h-4 mr-2" />
                            カレンダー
                        </TabsTrigger>
                        <TabsTrigger 
                            value="settings"
                            className="px-6 py-3 rounded-full border-2 border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:border-purple-400 data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 font-medium transition-all duration-300"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            設定
                        </TabsTrigger>
                        <TabsTrigger 
                            value="gallery"
                            onClick={() => fetchGeneratedImages()}
                            className="px-6 py-3 rounded-full border-2 border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white data-[state=active]:border-pink-400 data-[state=active]:shadow-lg data-[state=active]:shadow-pink-500/30 font-medium transition-all duration-300"
                        >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            生成画像
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* 概要タブ */}
                <TabsContent value="overview" className="space-y-6">
                    <StatsOverviewPanel stats={stats} workflows={workflows} />
                </TabsContent>

                {/* スクレイピングタブ */}
                <TabsContent value="scraping" className="space-y-6">
                    {/* 実行状態 */}
                    <Card className={scrapingStatus?.isRunning ? 'border-green-500 border-2' : ''}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                スクレイピング実行状態
                                {scrapingStatus?.isRunning && (
                                    <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`flex items-center gap-2 ${
                                        scrapingStatus?.isRunning ? 'text-green-600' : 'text-slate-500'
                                    }`}>
                                        {scrapingStatus?.isRunning ? (
                                            <>
                                                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                                                <span className="font-medium">実行中</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="h-3 w-3 bg-slate-400 rounded-full" />
                                                <span className="font-medium">停止中</span>
                                            </>
                                        )}
                                    </div>
                                    {scrapingStatus?.pids && scrapingStatus.pids.length > 0 && (
                                        <Badge variant="outline">
                                            PID: {scrapingStatus.pids.join(', ')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleRunScraping}
                                        disabled={scrapingStatus?.isRunning || isExecuting}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {isExecuting ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Play className="mr-2 h-4 w-4" />
                                        )}
                                        実行
                                    </Button>
                                    <Button
                                        onClick={handleStopScraping}
                                        disabled={!scrapingStatus?.isRunning || isExecuting}
                                        variant="destructive"
                                    >
                                        <Square className="mr-2 h-4 w-4" />
                                        停止
                                    </Button>
                                </div>
                            </div>

                            {/* 進捗表示（実行中または進捗データがある場合） */}
                            {(scrapingStatus?.isRunning || scrapingProgress?.collectedLinks) && scrapingProgress && (
                                <div className="mt-4 space-y-4">
                                    {/* フェーズ表示 */}
                                    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                        <div className="flex items-center gap-2">
                                            {scrapingProgress.phase === 'collecting' && (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                                                    <span className="font-medium text-amber-700 dark:text-amber-400">
                                                        📥 リンク収集中 - {scrapingProgress.currentCategory}
                                                    </span>
                                                    {scrapingProgress.currentPage > 0 && (
                                                        <Badge variant="outline" className="ml-2">
                                                            ページ {scrapingProgress.currentPage}
                                                        </Badge>
                                                    )}
                                                </>
                                            )}
                                            {scrapingProgress.phase === 'scraping' && (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                                                    <span className="font-medium text-green-700 dark:text-green-400">
                                                        📊 データ取得中 - {scrapingProgress.currentCategory}
                                                    </span>
                                                    <Badge variant="outline" className="ml-2 bg-green-100">
                                                        {scrapingProgress.processedItems}/{scrapingProgress.totalItems}
                                                    </Badge>
                                                </>
                                            )}
                                            {scrapingProgress.phase === 'completed' && (
                                                <>
                                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                                    <span className="font-medium text-green-700 dark:text-green-400">
                                                        ✅ 完了
                                                    </span>
                                                </>
                                            )}
                                            {scrapingProgress.phase === 'unknown' && scrapingStatus?.isRunning && (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                                                    <span className="font-medium text-slate-700 dark:text-slate-400">
                                                        処理中...
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {/* 3秒ごと自動更新中の表示 */}
                                        {scrapingStatus?.isRunning && (
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                                3秒毎に更新
                                            </div>
                                        )}
                                    </div>

                                    {/* 進捗サマリー */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* 収集リンク数 */}
                                        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500 rounded-lg">
                                                    <ExternalLink className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-slate-600 dark:text-slate-400">収集リンク数</div>
                                                    <div className="text-2xl font-bold text-blue-600">
                                                        {scrapingProgress.collectedLinks.toLocaleString()}
                                                        <span className="text-sm ml-1">件</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 処理済み（今回） */}
                                        {scrapingProgress.phase === 'scraping' && (
                                            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-green-500 rounded-lg">
                                                        <Activity className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400">処理済み</div>
                                                        <div className="text-2xl font-bold text-green-600">
                                                            {scrapingProgress.processedItems.toLocaleString()}
                                                            <span className="text-sm ml-1">/ {scrapingProgress.totalItems.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* プログレスバー */}
                                                <div className="mt-2 h-2 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-green-500 transition-all duration-500"
                                                        style={{ width: `${scrapingProgress.totalItems > 0 ? (scrapingProgress.processedItems / scrapingProgress.totalItems) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* 開始時刻 */}
                                        {scrapingProgress.startTime && (
                                            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-purple-500 rounded-lg">
                                                        <Clock className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400">開始時刻</div>
                                                        <div className="text-lg font-bold text-purple-600">
                                                            {scrapingProgress.startTime}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* カテゴリ別進捗グラフ */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <BarChart3 className="h-5 w-5 text-cyan-600" />
                                                カテゴリ別収集リンク数
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={progressBarChartData}
                                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                                        <YAxis tick={{ fontSize: 12 }} />
                                                        <Tooltip 
                                                            formatter={(value: number) => value.toLocaleString()}
                                                            contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px' }}
                                                        />
                                                        <Legend />
                                                        <Bar dataKey="収集" fill="#06b6d4" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                                        <Bar dataKey="処理済" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* 比較テーブル */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Database className="h-5 w-5 text-purple-600" />
                                                カテゴリ別詳細
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b bg-slate-50 dark:bg-slate-800">
                                                            <th className="text-left p-3 font-medium">カテゴリ</th>
                                                            <th className="text-right p-3 font-medium">収集リンク</th>
                                                            <th className="text-right p-3 font-medium">処理済み</th>
                                                            <th className="text-right p-3 font-medium">進捗率</th>
                                                            <th className="text-center p-3 font-medium">状態</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {scrapingProgress.categoryProgress.map((cat) => {
                                                            const progress = cat.links > 0 ? Math.round((cat.processed / cat.links) * 100) : 0;
                                                            const isActive = scrapingProgress.currentCategory === cat.id;
                                                            return (
                                                                <tr 
                                                                    key={cat.id}
                                                                    className={`border-b transition-colors ${
                                                                        isActive ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    <td className="p-3">
                                                                        <div className="flex items-center gap-2">
                                                                            {isActive && <Loader2 className="h-4 w-4 animate-spin text-green-500" />}
                                                                            <span className="font-medium">{cat.name}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-right p-3 font-mono">
                                                                        <span className="text-cyan-600 font-bold">{cat.links.toLocaleString()}</span>
                                                                    </td>
                                                                    <td className="text-right p-3 font-mono">
                                                                        <span className="text-green-600 font-bold">{cat.processed.toLocaleString()}</span>
                                                                    </td>
                                                                    <td className="text-right p-3">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                                <div 
                                                                                    className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-500"
                                                                                    style={{ width: `${progress}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-xs font-medium w-10">{progress}%</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-center p-3">
                                                                        {cat.links === 0 && (
                                                                            <Badge variant="outline" className="text-slate-500">待機中</Badge>
                                                                        )}
                                                                        {cat.links > 0 && cat.processed === 0 && !isActive && (
                                                                            <Badge variant="outline" className="text-cyan-600 border-cyan-300">収集済</Badge>
                                                                        )}
                                                                        {isActive && (
                                                                            <Badge className="bg-green-500">処理中</Badge>
                                                                        )}
                                                                        {cat.links > 0 && cat.processed === cat.links && (
                                                                            <Badge className="bg-purple-500">完了</Badge>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                                            <td className="p-3">合計</td>
                                                            <td className="text-right p-3 font-mono text-cyan-600">
                                                                {scrapingProgress.collectedLinks.toLocaleString()}
                                                            </td>
                                                            <td className="text-right p-3 font-mono text-green-600">
                                                                {scrapingProgress.categoryProgress.reduce((sum, cat) => sum + cat.processed, 0).toLocaleString()}
                                                            </td>
                                                            <td className="text-right p-3">
                                                                {scrapingProgress.collectedLinks > 0 
                                                                    ? Math.round((scrapingProgress.categoryProgress.reduce((sum, cat) => sum + cat.processed, 0) / scrapingProgress.collectedLinks) * 100)
                                                                    : 0}%
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* カテゴリ別カード（コンパクト表示） */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {scrapingProgress.categoryProgress.filter(cat => cat.links > 0).map((cat) => (
                                            <div
                                                key={cat.id}
                                                className={`p-3 rounded-lg border-l-4 ${
                                                    scrapingProgress.currentCategory === cat.id 
                                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500' 
                                                        : 'bg-slate-50 dark:bg-slate-800 border-cyan-500'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                                    {scrapingProgress.currentCategory === cat.id && (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    )}
                                                    {cat.name}
                                                </div>
                                                <div className="text-xl font-bold">
                                                    {cat.links.toLocaleString()}
                                                    <span className="text-xs ml-1 font-normal">リンク</span>
                                                </div>
                                                {cat.processed > 0 && (
                                                    <div className="text-sm text-green-600">
                                                        {cat.processed.toLocaleString()} 処理済
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* リアルタイムログ（実行中のみ） */}
                                    {scrapingStatus?.isRunning && scrapingProgress.currentLog && (
                                        <div className="mt-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Terminal className="h-4 w-4 text-slate-500" />
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                    リアルタイムログ
                                                </span>
                                                <Loader2 className="h-3 w-3 animate-spin text-green-500" />
                                            </div>
                                            <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs max-h-40 overflow-auto">
                                                <pre className="whitespace-pre-wrap">{scrapingProgress.currentLog}</pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* スケジュール情報 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                スケジュール設定
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="h-4 w-4 text-cyan-600" />
                                        <span className="font-medium">自動実行</span>
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        {scrapingInfo?.schedule.daily.description || '毎日午前3時'}
                                    </div>
                                    <Badge className="mt-2" variant={scrapingInfo?.schedule.daily.enabled ? 'default' : 'secondary'}>
                                        {scrapingInfo?.schedule.daily.enabled ? '有効' : '無効'}
                                    </Badge>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span className="font-medium">最終成功日</span>
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        {scrapingInfo?.lastSuccess || '記録なし'}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* カテゴリ一覧 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                スクレイピング対象カテゴリ
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {scrapingInfo?.config.categories.map((cat) => (
                                    <div
                                        key={cat.id}
                                        className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border-l-4 border-cyan-500"
                                    >
                                        <div className="font-medium text-sm">{cat.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">{cat.url}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ログタブ */}
                <TabsContent value="logs" className="space-y-6">
                    <LogViewerPanel
                        logData={logData}
                        selectedFile={selectedLogFile}
                        scrapingInfo={scrapingInfo}
                        onSelectFile={(f) => { setSelectedLogFile(f); fetchLogs(f); }}
                        onRefresh={() => fetchLogs()}
                    />
                </TabsContent>

                {/* 設定タブ */}
                <TabsContent value="settings" className="space-y-6">
                    <ScrapingSettingsPanel scrapingInfo={scrapingInfo} />
                </TabsContent>

                {/* カレンダータブ */}
                <TabsContent value="calendar" className="space-y-6">
                    {/* 月のサマリー */}
                    {calendarData && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">実行日数</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-cyan-600">
                                        {calendarData.summary.daysWithLogs}
                                        <span className="text-lg text-slate-400">/{calendarData.summary.totalDays}日</span>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">成功日数</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-green-600">
                                        {calendarData.summary.successDays}日
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">月間収集リンク</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-purple-600">
                                        {calendarData.summary.totalLinksCollected.toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">実行率</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-amber-600">
                                        {Math.round((calendarData.summary.daysWithLogs / calendarData.summary.totalDays) * 100)}%
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* カレンダー */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-rose-600" />
                                    スクレイピング履歴
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="font-bold text-lg min-w-[120px] text-center">
                                        {calendarYear}年{calendarMonth}月
                                    </span>
                                    <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* 曜日ヘッダー */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                                    <div key={day} className={`text-center text-sm font-medium p-2 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'}`}>
                                        {day}
                                    </div>
                                ))}
                            </div>
                            
                            {/* カレンダーグリッド */}
                            <div className="grid grid-cols-7 gap-1">
                                {/* 月初の空白 */}
                                {calendarData && Array.from({ length: new Date(calendarData.year, calendarData.month - 1, 1).getDay() }).map((_, i) => (
                                    <div key={`empty-${i}`} className="p-2 h-24" />
                                ))}
                                
                                {/* 日付セル */}
                                {calendarData?.days.map((day) => {
                                    const dayNum = parseInt(day.date.split('-')[2]);
                                    const dayOfWeek = new Date(day.date).getDay();
                                    const isToday = day.date === new Date().toISOString().split('T')[0];
                                    // GitHub Actionsで実行されたがSupabaseに保存されていない場合を検出
                                    const hasGitHubActionButNoSupabase = day.githubAction && !day.dataSources?.supabase?.saved;
                                    
                                    return (
                                        <div
                                            key={day.date}
                                            onClick={() => day.hasLog && fetchDayDetails(day.date)}
                                            className={`p-2 h-24 rounded-lg border transition-all cursor-pointer
                                                ${isToday ? 'border-2 border-rose-500' : hasGitHubActionButNoSupabase ? 'border-2 border-red-500' : 'border-slate-200 dark:border-slate-700'}
                                                ${day.hasLog ? 'hover:shadow-md' : 'opacity-50'}
                                                ${hasGitHubActionButNoSupabase 
                                                    ? 'bg-red-100 dark:bg-red-900/30' 
                                                    : day.success 
                                                    ? 'bg-green-50 dark:bg-green-900/20' 
                                                    : day.hasLog 
                                                    ? 'bg-amber-50 dark:bg-amber-900/20' 
                                                    : 'bg-slate-50 dark:bg-slate-800'}
                                                ${selectedDate === day.date ? 'ring-2 ring-rose-500' : ''}
                                            `}
                                        >
                                            <div className={`text-sm font-bold ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}`}>
                                                {dayNum}
                                            </div>
                                            {day.hasLog && (
                                                <div className="mt-1 space-y-1">
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {day.githubAction ? (
                                                            <a
                                                                href={day.githubAction.htmlUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="flex items-center gap-1"
                                                            >
                                                                <GitBranch className="h-3 w-3 text-blue-500" />
                                                                <span className="text-xs text-blue-600">#{day.githubAction.runNumber}</span>
                                                            </a>
                                                        ) : null}
                                                        {day.success ? (
                                                            <Badge className="bg-green-500 text-xs px-1">✓</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs px-1">実行</Badge>
                                                        )}
                                                    </div>
                                                    {day.totalLinks > 0 && (
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {day.totalLinks.toLocaleString()}件
                                                        </div>
                                                    )}
                                                    {/* データソースの保存状況インジケーター */}
                                                    {day.dataSources && (
                                                        <div className="flex items-center gap-0.5 mt-0.5">
                                                            {day.dataSources.supabase?.saved ? (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Supabase保存済み" />
                                                            ) : day.githubAction ? (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="Supabase未保存" />
                                                            ) : null}
                                                            {day.dataSources.sqlite?.saved && (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="SQLite保存済み" />
                                                            )}
                                                            {day.dataSources.csv?.saved && (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="CSV保存済み" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 凡例 */}
                            <div className="flex flex-wrap gap-4 mt-4 text-sm">
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
                                    <span>成功</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300" />
                                    <span>実行（未完了）</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 rounded bg-slate-100 border border-slate-300" />
                                    <span>未実行</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <span>Supabase保存済み</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    <span>Supabase未保存（警告）</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    <span>SQLite保存済み</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                    <span>CSV保存済み</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 日別推移グラフ */}
                    {calendarData && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-cyan-600" />
                                    日別収集リンク数推移
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={lineChartData}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(value: number) => value.toLocaleString() + '件'} />
                                            <Legend />
                                            <Line 
                                                type="monotone" 
                                                dataKey="リンク数" 
                                                stroke="#06b6d4" 
                                                strokeWidth={2} 
                                                dot={{ fill: '#06b6d4' }}
                                                isAnimationActive={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 選択した日の詳細 */}
                    {selectedDate && dayDetails && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        {selectedDate} の詳細
                                        {dayDetails.hasSuccess && (
                                            <Badge className="bg-green-500">成功</Badge>
                                        )}
                                    </CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(null); setDayDetails(null); }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* GitHub Actions情報 */}
                                {dayDetails.githubAction && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="h-5 w-5 text-blue-600" />
                                                <span className="font-medium">GitHub Actions実行</span>
                                            </div>
                                            <a
                                                href={dayDetails.githubAction.htmlUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Button variant="outline" size="sm">
                                                    <ExternalLink className="h-4 w-4 mr-1" />
                                                    詳細を見る
                                                </Button>
                                            </a>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <div className="text-slate-600 dark:text-slate-400">実行番号</div>
                                                <div className="font-bold">#{dayDetails.githubAction.runNumber}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-600 dark:text-slate-400">ステータス</div>
                                                <div>
                                                    {dayDetails.githubAction.conclusion === 'success' ? (
                                                        <Badge className="bg-green-500">成功</Badge>
                                                    ) : dayDetails.githubAction.status === 'in_progress' ? (
                                                        <Badge className="bg-yellow-500">実行中</Badge>
                                                    ) : (
                                                        <Badge variant="outline">失敗</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-600 dark:text-slate-400">開始時刻</div>
                                                <div className="font-mono text-xs">
                                                    {new Date(dayDetails.githubAction.runStartedAt).toLocaleString('ja-JP')}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-600 dark:text-slate-400">更新時刻</div>
                                                <div className="font-mono text-xs">
                                                    {new Date(dayDetails.githubAction.updatedAt).toLocaleString('ja-JP')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* データソース保存状況 */}
                                {(dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources) && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="font-medium mb-3">データソース保存状況</div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {/* Supabase */}
                                            <div className={`p-3 rounded-lg border ${
                                                (dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.supabase?.saved
                                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300'
                                                    : dayDetails.githubAction
                                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300'
                                                    : 'bg-slate-100 dark:bg-slate-700 border-slate-300'
                                            }`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Cloud className={`h-4 w-4 ${
                                                        (dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.supabase?.saved
                                                            ? 'text-green-600'
                                                            : dayDetails.githubAction
                                                            ? 'text-red-600'
                                                            : 'text-slate-500'
                                                    }`} />
                                                    <span className="font-medium text-sm">Supabase</span>
                                                </div>
                                                {(dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.supabase?.saved ? (
                                                    <div className="text-xs text-green-700 dark:text-green-400">
                                                        ✓ 保存済み ({(dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.supabase?.count || 0}件)
                                                    </div>
                                                ) : dayDetails.githubAction ? (
                                                    <div className="text-xs text-red-700 dark:text-red-400 font-bold">
                                                        ⚠️ 未保存（GitHub Actions実行済み）
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-500">
                                                        データなし
                                                    </div>
                                                )}
                                            </div>

                                            {/* SQLite */}
                                            <div className={`p-3 rounded-lg border ${
                                                (dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.sqlite?.saved
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300'
                                                    : 'bg-slate-100 dark:bg-slate-700 border-slate-300'
                                            }`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Database className={`h-4 w-4 ${
                                                        (dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.sqlite?.saved
                                                            ? 'text-blue-600'
                                                            : 'text-slate-500'
                                                    }`} />
                                                    <span className="font-medium text-sm">SQLite</span>
                                                </div>
                                                {(dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.sqlite?.saved ? (
                                                    <div className="text-xs text-blue-700 dark:text-blue-400">
                                                        ✓ 保存済み
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-500">
                                                        {(dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.sqlite?.fileExists ? 'ファイル存在' : 'データなし'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* CSV */}
                                            <div className={`p-3 rounded-lg border ${
                                                (dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.csv?.saved
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300'
                                                    : 'bg-slate-100 dark:bg-slate-700 border-slate-300'
                                            }`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileText className={`h-4 w-4 ${
                                                        (dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.csv?.saved
                                                            ? 'text-purple-600'
                                                            : 'text-slate-500'
                                                    }`} />
                                                    <span className="font-medium text-sm">CSV</span>
                                                </div>
                                                {(dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.csv?.saved ? (
                                                    <div className="text-xs text-purple-700 dark:text-purple-400">
                                                        ✓ 保存済み ({(dayDetails.dataSources || calendarData?.days.find(d => d.date === selectedDate)?.dataSources)?.csv?.files?.length || 0}ファイル)
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-500">
                                                        データなし
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* サマリー */}
                                {dayDetails.summary && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                                            <div className="text-sm text-slate-600">収集リンク</div>
                                            <div className="text-xl font-bold text-cyan-600">{dayDetails.summary.totalLinks.toLocaleString()}</div>
                                        </div>
                                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                            <div className="text-sm text-slate-600">処理済み</div>
                                            <div className="text-xl font-bold text-green-600">{dayDetails.summary.totalProcessed.toLocaleString()}</div>
                                        </div>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                            <div className="text-sm text-slate-600">ログファイル数</div>
                                            <div className="text-xl font-bold text-purple-600">{dayDetails.logs.length}</div>
                                        </div>
                                    </div>
                                )}

                                {/* カテゴリ別 */}
                                {dayDetails.summary?.categories && Object.keys(dayDetails.summary.categories).length > 0 && (
                                    <div>
                                        <h4 className="font-medium mb-2">カテゴリ別</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {Object.entries(dayDetails.summary.categories).map(([cat, count]) => (
                                                <div key={cat} className="p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                                                    <span className="text-slate-500">{cat}:</span>
                                                    <span className="font-bold ml-1">{count.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 診断情報と修正方法 */}
                                {dayDetails.diagnosis && dayDetails.diagnosis.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium flex items-center gap-2">
                                                <AlertCircle className="h-5 w-5 text-red-500" />
                                                診断情報
                                            </h4>
                                            <Button
                                                onClick={async () => {
                                                    if (confirm('この日のスクレイピングを再実行しますか？\n\n※全件スクレイピングを実行しますが、重複データは自動的に更新されます。')) {
                                                        setIsExecuting(true);
                                                        try {
                                                            const res = await fetch('/api/admin/scraping', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ 
                                                                    action: 'run',
                                                                    noDiff: true, // 差分検出をスキップして全件スクレイピング
                                                                    forceRefresh: false, // リンクは再収集しない（既存リンクを使用）
                                                                }),
                                                            });
                                                            const data = await res.json();
                                                            if (data.error) {
                                                                alert(`エラー: ${data.error}`);
                                                            } else {
                                                                alert('スクレイピングを開始しました。数分後に結果を確認してください。\n\n※全件スクレイピングを実行しますが、重複データは自動的に更新されます。');
                                                                // 3秒後に進捗を更新
                                                                setTimeout(() => {
                                                                    fetchScrapingStatus();
                                                                    fetchScrapingProgress();
                                                                }, 3000);
                                                            }
                                                        } catch (error) {
                                                            console.error('再実行エラー:', error);
                                                            alert('再実行に失敗しました');
                                                        } finally {
                                                            setIsExecuting(false);
                                                        }
                                                    }
                                                }}
                                                disabled={isExecuting}
                                                className="bg-red-500 hover:bg-red-600"
                                            >
                                                {isExecuting ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        実行中...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="h-4 w-4 mr-2" />
                                                        再スクレイピング実行
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        {dayDetails.diagnosis.map((diag, index) => (
                                            <div
                                                key={index}
                                                className={`p-4 rounded-lg border ${
                                                    diag.severity === 'error'
                                                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300'
                                                        : diag.severity === 'warning'
                                                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300'
                                                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {diag.severity === 'error' && (
                                                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                    )}
                                                    {diag.severity === 'warning' && (
                                                        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                    )}
                                                    {diag.severity === 'info' && (
                                                        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="font-medium mb-1">{diag.issue}</div>
                                                        <div className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                                                            {diag.message}
                                                        </div>
                                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                            💡 修正方法:
                                                        </div>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                            {diag.solution}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ログファイル一覧 */}
                                <div>
                                    <h4 className="font-medium mb-2">ログファイル</h4>
                                    <div className="space-y-2">
                                        {dayDetails.logs.length > 0 ? (
                                            dayDetails.logs.map((log) => (
                                                <div key={log.filename} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-mono text-sm">{log.filename}</span>
                                                        <span className="text-xs text-slate-500">{log.size} / {log.lineCount}行</span>
                                                    </div>
                                                    <div className="bg-slate-900 text-green-400 p-2 rounded font-mono text-xs max-h-32 overflow-auto">
                                                        <pre className="whitespace-pre-wrap">{log.preview}</pre>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-500">
                                                ログファイルが見つかりません
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 一覧表示 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                スクレイピング履歴一覧
                            </CardTitle>
                            <CardDescription>実行があった日の一覧</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-slate-50 dark:bg-slate-800">
                                            <th className="text-left p-3">日付</th>
                                            <th className="text-center p-3">状態</th>
                                            <th className="text-right p-3">収集リンク</th>
                                            <th className="text-right p-3">処理済み</th>
                                            <th className="text-left p-3">ログファイル</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calendarData?.days.filter(d => d.hasLog).reverse().map((day) => (
                                            <tr 
                                                key={day.date} 
                                                className="border-b hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                                onClick={() => fetchDayDetails(day.date)}
                                            >
                                                <td className="p-3 font-medium">{day.date}</td>
                                                <td className="p-3 text-center">
                                                    {day.success ? (
                                                        <Badge className="bg-green-500">成功</Badge>
                                                    ) : (
                                                        <Badge variant="outline">実行</Badge>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-mono text-cyan-600">{day.totalLinks.toLocaleString()}</td>
                                                <td className="p-3 text-right font-mono text-green-600">{day.totalProcessed.toLocaleString()}</td>
                                                <td className="p-3 text-slate-500 text-xs">{day.logFile}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 生成画像ギャラリータブ */}
                <TabsContent value="gallery" className="space-y-6">
                    <GeneratedImagesGallery
                        images={generatedImages}
                        localOnly={localOnlyImages}
                        loading={galleryLoading}
                        onRefresh={fetchGeneratedImages}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
