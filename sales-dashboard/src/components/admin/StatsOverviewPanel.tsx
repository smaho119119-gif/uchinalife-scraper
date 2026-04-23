'use client';

import { useMemo } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import {
    Loader2,
    ExternalLink,
    Database,
    GitBranch,
    Cloud,
    Download,
    BarChart3,
} from 'lucide-react';
import type { Stats, GitHubWorkflow } from '@/app/admin/types';

const PIE_COLORS = [
    '#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b',
    '#ef4444', '#ec4899', '#3b82f6', '#14b8a6',
];

function statusEmoji(status: string, conclusion: string | null): string {
    if (status === 'in_progress') return '🟡';
    if (conclusion === 'success') return '✅';
    if (conclusion === 'failure') return '❌';
    return '⚪';
}

interface Props {
    stats: Stats | null;
    workflows: GitHubWorkflow[];
}

export function StatsOverviewPanel({ stats, workflows }: Props) {
    const barChartData = useMemo(
        () =>
            Object.entries(stats?.categories || {}).map(([category, count]) => ({
                name: category,
                件数: count,
            })),
        [stats?.categories],
    );

    const pieChartData = useMemo(
        () =>
            Object.entries(stats?.categories || {}).map(([category, count]) => ({
                name: category,
                value: count,
            })),
        [stats?.categories],
    );

    const pieChartCells = useMemo(
        () =>
            Object.entries(stats?.categories || {}).map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            )),
        [stats?.categories],
    );

    return (
        <div className="space-y-6">
            {/* KPI tiles */}
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
                            {stats?.lastUpdated
                                ? new Date(stats.lastUpdated).toLocaleString('ja-JP')
                                : '-'}
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                        formatter={(value: number) => [
                                            value.toLocaleString() + '件',
                                            '物件数',
                                        ]}
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            borderRadius: '8px',
                                        }}
                                    />
                                    <Bar dataKey="件数" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

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
                                        label={({ name, percent }) =>
                                            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                        }
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        isAnimationActive={false}
                                    >
                                        {pieChartCells}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => value.toLocaleString() + '件'}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Category breakdown */}
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
                            <div
                                key={category}
                                className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                            >
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                    {category}
                                </div>
                                <div className="text-2xl font-bold">{count.toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* GitHub Actions history */}
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
                                const startTime = new Date(
                                    workflow.run_started_at || workflow.created_at,
                                );
                                const endTime =
                                    workflow.status === 'completed'
                                        ? new Date(workflow.updated_at)
                                        : null;
                                const duration = endTime
                                    ? Math.round(
                                          (endTime.getTime() - startTime.getTime()) / 1000 / 60,
                                      )
                                    : null;

                                return (
                                    <div
                                        key={workflow.id}
                                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="text-2xl" aria-hidden="true">
                                                {statusEmoji(workflow.status, workflow.conclusion)}
                                            </span>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        #{workflow.run_number}
                                                    </span>
                                                    <span className="text-sm text-slate-500">-</span>
                                                    <span className="font-medium">
                                                        {workflow.name || 'Daily Property Scraper'}
                                                    </span>
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
                                            aria-label={`実行 #${workflow.run_number} を GitHub で開く`}
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

            {/* Quick links */}
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
        </div>
    );
}
