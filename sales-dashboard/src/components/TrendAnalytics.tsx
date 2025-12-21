"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Calendar } from 'lucide-react';

interface TrendData {
    date: string;
    newProperties: number;
    soldProperties: number;
    netChange: number;
    avgPrice: number;
    byType: { '賃貸': number; '売買': number };
}

interface TrendSummary {
    totalNew: number;
    totalSold: number;
    netChange: number;
    avgDailyNew: number;
    avgDailySold: number;
    growthRate: number;
}

export default function TrendAnalytics() {
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [summary, setSummary] = useState<TrendSummary | null>(null);
    const [period, setPeriod] = useState(30);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrendData();
    }, [period]);

    const fetchTrendData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/analytics/trends?days=${period}`);
            const data = await response.json();

            if (data.success) {
                setTrends(data.trends);
                setSummary(data.summary);
            }
        } catch (error) {
            console.error('Error fetching trend data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-white p-8">読み込み中...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <div className="flex gap-2">
                            {[7, 30, 90].map((days) => (
                                <button
                                    key={days}
                                    onClick={() => setPeriod(days)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${period === days
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                        }`}
                                >
                                    {days}日間
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-slate-400">総新着物件</p>
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                            </div>
                            <p className="text-3xl font-bold text-white">{summary.totalNew}</p>
                            <p className="text-xs text-slate-400 mt-1">
                                平均 {summary.avgDailyNew}件/日
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-slate-400">総成約物件</p>
                                <Activity className="h-4 w-4 text-green-500" />
                            </div>
                            <p className="text-3xl font-bold text-white">{summary.totalSold}</p>
                            <p className="text-xs text-slate-400 mt-1">
                                平均 {summary.avgDailySold}件/日
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-slate-400">純増減</p>
                                {summary.netChange >= 0 ? (
                                    <TrendingUp className="h-4 w-4 text-purple-500" />
                                ) : (
                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                )}
                            </div>
                            <p className={`text-3xl font-bold ${summary.netChange >= 0 ? 'text-purple-500' : 'text-red-500'}`}>
                                {summary.netChange >= 0 ? '+' : ''}{summary.netChange}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                期間中の変動
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-slate-400">成長率</p>
                                {summary.growthRate >= 0 ? (
                                    <TrendingUp className="h-4 w-4 text-orange-500" />
                                ) : (
                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                )}
                            </div>
                            <p className={`text-3xl font-bold ${summary.growthRate >= 0 ? 'text-orange-500' : 'text-red-500'}`}>
                                {summary.growthRate >= 0 ? '+' : ''}{summary.growthRate}%
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                前半 vs 後半
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* New vs Sold Trend */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-200">新着 vs 成約 トレンド</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trends}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                }}
                            />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                                labelFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="newProperties"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                name="新着物件"
                                dot={{ fill: '#3b82f6', r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="soldProperties"
                                stroke="#10b981"
                                strokeWidth={2}
                                name="成約物件"
                                dot={{ fill: '#10b981', r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Net Change Trend */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-200">純増減トレンド</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={trends}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                }}
                            />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="netChange"
                                stroke="#8b5cf6"
                                fill="#8b5cf6"
                                fillOpacity={0.3}
                                name="純増減"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Price Trend */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-200">平均価格トレンド</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={trends.filter(t => t.avgPrice > 0)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                }}
                            />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                                formatter={(value: any) => [`¥${value.toLocaleString()}`, '平均価格']}
                            />
                            <Line
                                type="monotone"
                                dataKey="avgPrice"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={{ fill: '#f59e0b', r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
