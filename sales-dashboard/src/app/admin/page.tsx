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
    Image as ImageIcon, Trash2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface Stats {
    total: number;
    active: number;
    categories: Record<string, number>;
    lastUpdated: string;
}

interface GitHubWorkflow {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    created_at: string;
    updated_at: string;
    html_url: string;
    run_number: number;
    event: string;
    run_started_at: string;
    workflow_id: number;
    path?: string;
}

interface ScrapingConfig {
    baseUrl: string;
    maxWorkers: number;
    itemsPerPage: number;
    maxPagesPerCategory: number;
    headlessMode: boolean;
    maxRequestsPerSecond: number;
    maxRetries: number;
    categories: { id: string; name: string; url: string }[];
}

interface ScrapingInfo {
    config: ScrapingConfig;
    schedule: {
        daily: { enabled: boolean; time: string; description: string };
        timeout: number;
    };
    logFiles: { name: string; date: string; size: string }[];
    lastSuccess: string | null;
    checkpoint: unknown;
}

interface ScrapingStatus {
    isRunning: boolean;
    pids: string[];
    message: string;
}

interface LogData {
    filename: string;
    logs: string;
    totalLines: number;
}

interface ScrapingProgress {
    phase: 'collecting' | 'scraping' | 'completed' | 'unknown';
    currentCategory: string;
    currentPage: number;
    collectedLinks: number;
    processedItems: number;
    totalItems: number;
    totalProcessed: number;
    checkpointProcessed: number;
    categoryProgress: { id: string; name: string; links: number; processed: number; total: number }[];
    currentLog: string;
    startTime: string | null;
}

interface CalendarDay {
    date: string;
    hasLog: boolean;
    logFile: string | null;
    success: boolean;
    totalLinks: number;
    totalProcessed: number;
    categories: Record<string, number>;
    githubAction?: {
        runNumber: number;
        status: string;
        conclusion: string | null;
        htmlUrl: string;
        runStartedAt: string;
        updatedAt: string;
    };
    dataSources?: {
        supabase: {
            saved: boolean;
            count: number;
        };
        sqlite: {
            saved: boolean;
            fileExists: boolean;
        };
        csv: {
            saved: boolean;
            files: string[];
        };
    };
}

interface CalendarData {
    year: number;
    month: number;
    days: CalendarDay[];
    summary: {
        totalDays: number;
        daysWithLogs: number;
        successDays: number;
        totalLinksCollected: number;
    };
}

interface DayDetails {
    date: string;
    hasSuccess: boolean;
    logs: {
        filename: string;
        size: string;
        createdAt: string;
        lineCount: number;
        preview: string;
        stats: { totalLinks: number; totalProcessed: number; categories: Record<string, number> };
    }[];
    githubAction?: {
        runNumber: number;
        status: string;
        conclusion: string | null;
        htmlUrl: string;
        runStartedAt: string;
        updatedAt: string;
    };
    dataSources?: {
        supabase: {
            saved: boolean;
            count: number;
        };
        sqlite: {
            saved: boolean;
            fileExists: boolean;
        };
        csv: {
            saved: boolean;
            files: string[];
        };
    };
    diagnosis?: {
        issue: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        solution: string;
    }[];
    summary: { totalLinks: number; totalProcessed: number; categories: Record<string, number> } | null;
}

interface GeneratedImageItem {
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
    const [localOnlyImages, setLocalOnlyImages] = useState<any[]>([]);
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
                <div className="flex gap-2 flex-wrap">
                    <TabsList className="inline-flex h-auto p-1 bg-transparent gap-2">
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
                    {/* 統計情報 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    総物件数
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-cyan-600">
                                    {stats?.total.toLocaleString() || 0}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    販売中
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-600">
                                    {stats?.active.toLocaleString() || 0}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    最終更新
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm font-medium">
                                    {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('ja-JP') : '-'}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    カテゴリ数
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-purple-600">
                                    {Object.keys(stats?.categories || {}).length}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* カテゴリ別統計 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 棒グラフ */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-cyan-600" />
                                    カテゴリ別物件数（DB）
                                </CardTitle>
                                <CardDescription>データベースに保存されている物件数</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={barChartData}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis 
                                                dataKey="name" 
                                                tick={{ fontSize: 11 }} 
                                                angle={-45} 
                                                textAnchor="end" 
                                                height={60}
                                                interval={0}
                                            />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip 
                                                formatter={(value: number) => [value.toLocaleString() + '件', '物件数']}
                                                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px' }}
                                            />
                                            <Bar dataKey="件数" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 円グラフ */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="h-5 w-5 text-purple-600" />
                                    カテゴリ構成比
                                </CardTitle>
                                <CardDescription>全体に占める各カテゴリの割合</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieChartData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                                isAnimationActive={false}
                                            >
                                                {pieChartCells}
                                            </Pie>
                                            <Tooltip formatter={(value: number) => value.toLocaleString() + '件'} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* カテゴリ別物件数テーブル */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                カテゴリ別物件数（詳細）
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(stats?.categories || {}).map(([category, count]) => (
                                    <div key={category} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                            {category}
                                        </div>
                                        <div className="text-2xl font-bold">
                                            {count.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* GitHub Actions ワークフロー */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GitBranch className="h-5 w-5" />
                                GitHub Actions 実行履歴
                            </CardTitle>
                            <CardDescription>
                                スクレイピング自動実行の履歴（最新10件）
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {workflows.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        実行履歴がありません
                                    </div>
                                ) : (
                                    workflows.map((workflow) => {
                                        const startTime = new Date(workflow.run_started_at || workflow.created_at);
                                        const endTime = workflow.status === 'completed' ? new Date(workflow.updated_at) : null;
                                        const duration = endTime 
                                            ? Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60) 
                                            : null;
                                        
                                        return (
                                            <div
                                                key={workflow.id}
                                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <span className="text-2xl">
                                                        {getStatusIcon(workflow.status, workflow.conclusion)}
                                                    </span>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">#{workflow.run_number}</span>
                                                            <span className="text-sm text-slate-500">-</span>
                                                            <span className="font-medium">{workflow.name || 'Daily Property Scraper'}</span>
                                                        </div>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                            <div>開始: {startTime.toLocaleString('ja-JP')}</div>
                                                            {duration !== null && (
                                                                <div className="text-xs mt-0.5">
                                                                    実行時間: {duration}分
                                                                    {workflow.conclusion === 'success' && ' ✅'}
                                                                    {workflow.conclusion === 'failure' && ' ❌'}
                                                                </div>
                                                            )}
                                                            {workflow.status === 'in_progress' && (
                                                                <div className="text-xs mt-0.5 text-yellow-600">
                                                                    <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                                                                    実行中...
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <a
                                                    href={workflow.html_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-cyan-600 hover:text-cyan-700 ml-4"
                                                    title="GitHubで詳細を確認"
                                                >
                                                    <ExternalLink className="h-5 w-5" />
                                                </a>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* クイックリンク */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <GitBranch className="h-5 w-5" />
                                    GitHub Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    ワークフローの実行状況を確認
                                </p>
                                <a
                                    href="https://github.com/smaho119119-gif/uchinalife-scraper/actions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button className="w-full">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        開く
                                    </Button>
                                </a>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Cloud className="h-5 w-5" />
                                    Supabase
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    データベースを直接確認
                                </p>
                                <a
                                    href="https://supabase.com/dashboard/project/csnwgqtoioqnuoqlvcds"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button className="w-full">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        開く
                                    </Button>
                                </a>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Download className="h-5 w-5" />
                                    バックアップ
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    自動バックアップをダウンロード
                                </p>
                                <a
                                    href="https://github.com/smaho119119-gif/uchinalife-scraper/actions/workflows/daily-backup.yml"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button className="w-full">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        開く
                                    </Button>
                                </a>
                            </CardContent>
                        </Card>
                    </div>
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
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    ログファイル
                                </CardTitle>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedLogFile}
                                        onChange={(e) => {
                                            setSelectedLogFile(e.target.value);
                                            fetchLogs(e.target.value);
                                        }}
                                        className="px-3 py-2 rounded-md border bg-white dark:bg-slate-800 text-sm"
                                    >
                                        {scrapingInfo?.logFiles.map((file) => (
                                            <option key={file.name} value={file.name}>
                                                {file.name} ({file.size})
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchLogs()}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <CardDescription>
                                {logData?.totalLines ? `全${logData.totalLines}行（最新100行を表示）` : 'ログを選択してください'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-[500px]">
                                <pre className="whitespace-pre-wrap">
                                    {logData?.logs || 'ログを読み込むにはファイルを選択してリロードしてください'}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ログファイル一覧 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Terminal className="h-5 w-5" />
                                ログファイル一覧
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {scrapingInfo?.logFiles.map((file) => (
                                    <div
                                        key={file.name}
                                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                                            selectedLogFile === file.name
                                                ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-500'
                                                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                        onClick={() => {
                                            setSelectedLogFile(file.name);
                                            fetchLogs(file.name);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-4 w-4 text-slate-500" />
                                            <span className="font-medium">{file.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                            <span>{file.size}</span>
                                            <span>{new Date(file.date).toLocaleString('ja-JP')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 設定タブ */}
                <TabsContent value="settings" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                スクレイピング設定
                            </CardTitle>
                            <CardDescription>
                                現在のスクレイピング設定値（環境変数で変更可能）
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap className="h-4 w-4 text-yellow-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">最大ワーカー数</span>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {scrapingInfo?.config.maxWorkers || 4}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">最大RPS</span>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {scrapingInfo?.config.maxRequestsPerSecond || 5}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Database className="h-4 w-4 text-green-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">1ページあたりの件数</span>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {scrapingInfo?.config.itemsPerPage || 50}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="h-4 w-4 text-purple-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">カテゴリ最大ページ</span>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {scrapingInfo?.config.maxPagesPerCategory || 150}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <RefreshCw className="h-4 w-4 text-orange-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">最大リトライ回数</span>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {scrapingInfo?.config.maxRetries || 3}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="h-4 w-4 text-red-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">タイムアウト</span>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {Math.floor((scrapingInfo?.schedule.timeout || 7200) / 3600)}時間
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 環境変数ガイド */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" />
                                環境変数で設定変更
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-sm overflow-auto">
                                <pre>{`# .env ファイルで設定可能な変数
SCRAPER_MAX_WORKERS=4       # 並列ワーカー数
SCRAPER_ITEMS_PER_PAGE=50   # 1ページあたりの取得件数
SCRAPER_MAX_PAGES=150       # カテゴリ最大ページ数
SCRAPER_HEADLESS=true       # ヘッドレスモード
SCRAPER_MAX_RPS=5           # 最大リクエスト/秒
SCRAPER_MAX_RETRIES=3       # 最大リトライ回数
SCRAPER_RETRY_DELAY=2       # リトライ待機秒数`}</pre>
                            </div>
                        </CardContent>
                    </Card>
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
                    {/* 統計カード */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">DB登録画像</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-pink-600">
                                    {generatedImages.length}
                                    <span className="text-lg text-slate-400">件</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">ローカルのみ</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-amber-600">
                                    {localOnlyImages.length}
                                    <span className="text-lg text-slate-400">件</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">合計</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-emerald-600">
                                    {generatedImages.length + localOnlyImages.length}
                                    <span className="text-lg text-slate-400">件</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 画像ギャラリー */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <ImageIcon className="h-5 w-5" />
                                        生成画像ギャラリー
                                    </CardTitle>
                                    <CardDescription>全ての生成バナー画像</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchGeneratedImages}
                                    disabled={galleryLoading}
                                >
                                    {galleryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    更新
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {galleryLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* DB登録済み画像 */}
                                    {generatedImages.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                                                <Database className="h-4 w-4" />
                                                DB登録済み ({generatedImages.length}件)
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {generatedImages.map((img) => (
                                                    <div
                                                        key={img.id}
                                                        className="group relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-pink-400 transition-all cursor-pointer"
                                                        onClick={() => setSelectedGalleryImage(img.image_url)}
                                                    >
                                                        <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                                                            <img
                                                                src={img.image_url}
                                                                alt={img.filename}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = '/placeholder.png';
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                            <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        <div className="p-2 bg-white dark:bg-slate-900">
                                                            <div className="flex gap-1 mb-1">
                                                                <Badge variant="secondary" className="text-[10px]">{img.mode}</Badge>
                                                                <Badge variant="outline" className="text-[10px]">{img.style}</Badge>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 truncate">
                                                                {img.property_url === 'unknown' ? '未紐づけ' : '物件紐づけ済'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">
                                                                {new Date(img.created_at).toLocaleDateString('ja-JP')}
                                                            </p>
                                                        </div>
                                                        {!img.file_exists && (
                                                            <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] px-1 rounded">
                                                                ファイル無
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ローカルのみ */}
                                    {localOnlyImages.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                ローカルのみ ({localOnlyImages.length}件)
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {localOnlyImages.map((img) => (
                                                    <div
                                                        key={img.filename}
                                                        className="group relative rounded-lg overflow-hidden border border-amber-200 dark:border-amber-700 hover:border-amber-400 transition-all cursor-pointer"
                                                        onClick={() => setSelectedGalleryImage(img.url)}
                                                    >
                                                        <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                                                            <img
                                                                src={img.url}
                                                                alt={img.filename}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                            <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        <div className="p-2 bg-white dark:bg-slate-900">
                                                            <div className="flex gap-1 mb-1">
                                                                <Badge variant="secondary" className="text-[10px]">{img.mode}</Badge>
                                                                <Badge variant="outline" className="text-[10px]">{img.style}</Badge>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400">
                                                                {new Date(img.created_at).toLocaleDateString('ja-JP')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {generatedImages.length === 0 && localOnlyImages.length === 0 && (
                                        <div className="text-center py-12 text-slate-500">
                                            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                            <p>生成画像がありません</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 画像プレビューダイアログ */}
                    {selectedGalleryImage && (
                        <div 
                            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                            onClick={() => setSelectedGalleryImage(null)}
                        >
                            <div className="relative max-w-4xl max-h-[90vh]">
                                <button 
                                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 rounded-full p-2 z-10"
                                    onClick={() => setSelectedGalleryImage(null)}
                                >
                                    <X className="h-6 w-6 text-white" />
                                </button>
                                <img
                                    src={selectedGalleryImage}
                                    alt="生成画像のプレビュー"
                                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                    <a 
                                        href={selectedGalleryImage} 
                                        download
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Download className="h-4 w-4" />
                                        ダウンロード
                                    </a>
                                    <a 
                                        href={selectedGalleryImage} 
                                        target="_blank"
                                        className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        新しいタブ
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
