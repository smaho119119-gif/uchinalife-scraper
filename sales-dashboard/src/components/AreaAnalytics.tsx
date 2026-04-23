"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, MapPin, Activity } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { ErrorBanner } from '@/components/ui/error-banner';

interface AreaData {
    city: string;
    totalProperties: number;
    byCategory: Record<string, number>;
    byType: { '賃貸': number; '売買': number };
    avgPrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    newThisWeek: number;
    newThisMonth: number;
    activityScore: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#6b7280'];

interface AreasResponse {
    success: boolean;
    areas: AreaData[];
    totalAreas: number;
}

export default function AreaAnalytics() {
    const { data, error, loading, refetch } = useApi<AreasResponse>('/api/analytics/areas');
    const areas = data?.areas ?? [];
    const [selectedArea, setSelectedArea] = useState<AreaData | null>(null);

    // Default the selected area to the most active one once data arrives.
    useEffect(() => {
        if (!selectedArea && areas.length > 0) {
            setSelectedArea(areas[0]);
        }
    }, [areas, selectedArea]);

    if (error) {
        return (
            <div className="p-4">
                <ErrorBanner message={error} onRetry={refetch} />
            </div>
        );
    }

    if (loading) {
        return <div className="text-white p-8">読み込み中...</div>;
    }

    const topAreas = areas.slice(0, 10);
    const hotAreas = [...areas].sort((a, b) => b.activityScore - a.activityScore).slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Hot Areas */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-200 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-orange-500" />
                        🔥 ホットエリア TOP5
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {hotAreas.map((area, index) => (
                            <div
                                key={area.city}
                                className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-all"
                                onClick={() => setSelectedArea(area)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl font-bold text-orange-500">#{index + 1}</span>
                                    <MapPin className="h-4 w-4 text-orange-400" />
                                </div>
                                <h3 className="font-semibold text-white mb-1">{area.city}</h3>
                                <p className="text-sm text-slate-400">{area.totalProperties}件</p>
                                <div className="mt-2 flex items-center gap-1 text-xs text-orange-400">
                                    <TrendingUp className="h-3 w-3" />
                                    <span>活動スコア: {area.activityScore}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Area Distribution */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-slate-200">市町村別 物件数 TOP10</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={topAreas}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis
                                    dataKey="city"
                                    stroke="#94a3b8"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
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
                                <Bar dataKey="totalProperties" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-slate-200">賃貸 vs 売買 比率</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: '賃貸', value: areas.reduce((sum, a) => sum + a.byType['賃貸'], 0) },
                                        { name: '売買', value: areas.reduce((sum, a) => sum + a.byType['売買'], 0) }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    <Cell fill="#8b5cf6" />
                                    <Cell fill="#10b981" />
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#fff'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Selected Area Details */}
            {selectedArea && (
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-slate-200 flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-blue-500" />
                            {selectedArea.city} - 詳細分析
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <p className="text-sm text-slate-400 mb-1">総物件数</p>
                                <p className="text-2xl font-bold text-white">{selectedArea.totalProperties}</p>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <p className="text-sm text-slate-400 mb-1">平均価格</p>
                                <p className="text-2xl font-bold text-white">¥{selectedArea.avgPrice.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <p className="text-sm text-slate-400 mb-1">今週の新着</p>
                                <p className="text-2xl font-bold text-green-500">{selectedArea.newThisWeek}</p>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <p className="text-sm text-slate-400 mb-1">今月の新着</p>
                                <p className="text-2xl font-bold text-blue-500">{selectedArea.newThisMonth}</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-300 mb-3">カテゴリー別内訳</h4>
                                <div className="space-y-2">
                                    {Object.entries(selectedArea.byCategory).map(([category, count]) => (
                                        <div key={category} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                                            <span className="text-sm text-slate-300">{category}</span>
                                            <span className="text-sm font-semibold text-white">{count}件</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-slate-300 mb-3">価格帯情報</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 bg-slate-800 rounded">
                                        <span className="text-sm text-slate-300">最低価格</span>
                                        <span className="text-sm font-semibold text-white">¥{selectedArea.minPrice.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-slate-800 rounded">
                                        <span className="text-sm text-slate-300">中央値</span>
                                        <span className="text-sm font-semibold text-white">¥{selectedArea.medianPrice.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-slate-800 rounded">
                                        <span className="text-sm text-slate-300">最高価格</span>
                                        <span className="text-sm font-semibold text-white">¥{selectedArea.maxPrice.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
