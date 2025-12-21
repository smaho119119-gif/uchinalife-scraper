'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Activity,
    Database,
    PieChart as PieChartIcon,
    BarChart3,
    Calendar,
    RefreshCw,
} from 'lucide-react';
import PropertyModal from '@/components/PropertyModal';
import { propertyCache } from '@/lib/propertyCache';

interface DiffAnalytics {
    summary: {
        total: number;
        active: number;
        inactive: number;
        newToday: number;
        updatedToday: number;
        soldToday: number;
    };
    health: {
        activeRate: string;
        inactiveRate: string;
        newRate: string;
    };
    market: {
        rental: number;
        sale: number;
        rentalPercentage: string;
        salePercentage: string;
    };
    categories: Array<{
        category: string;
        categoryId: string;
        active: number;
        newToday: number;
        inactive: number;
    }>;
    trend: Array<{
        date: string;
        new: number;
        sold: number;
        net: number;
    }>;
}

const COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    cyan: '#06b6d4',
    emerald: '#059669',
};

const CATEGORY_COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#059669', // emerald
];

export default function AnalyticsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [analytics, setAnalytics] = useState<DiffAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalFilter, setModalFilter] = useState<'active' | 'newToday' | 'soldToday' | 'inactive' | 'total'>('total');
    const [modalTitle, setModalTitle] = useState('');
    const [modalCategory, setModalCategory] = useState<string | undefined>(undefined);

    // Restore modal state from URL params
    useEffect(() => {
        const modalParam = searchParams.get('modal');
        const categoryParam = searchParams.get('category');
        const titleParam = searchParams.get('title');

        if (modalParam) {
            setModalFilter(modalParam as typeof modalFilter);
            setModalCategory(categoryParam || undefined);
            setModalTitle(titleParam || modalParam);
            setModalOpen(true);
        }
    }, [searchParams]);

    const openModal = (filter: typeof modalFilter, title: string, category?: string) => {
        setModalFilter(filter);
        setModalTitle(title);
        setModalCategory(category);
        setModalOpen(true);

        // Update URL with modal state
        const params = new URLSearchParams();
        params.set('modal', filter);
        params.set('title', title);
        if (category) {
            params.set('category', category);
        }
        router.push(`/analytics?${params.toString()}`, { scroll: false });
    };

    const closeModal = () => {
        setModalOpen(false);
        // Clear URL params
        router.push('/analytics', { scroll: false });
    };

    const fetchAnalytics = async (forceRefresh = false) => {
        const cacheKey = `analytics-${days}`;

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cachedData = propertyCache.get<DiffAnalytics>(cacheKey);
            if (cachedData) {
                console.log('✅ Using cached analytics data');
                setAnalytics(cachedData);
                setLoading(false);
                return;
            }
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/analytics/diff?days=${days}`);
            const data = await response.json();

            // Cache the data
            propertyCache.set(cacheKey, data);
            setAnalytics(data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [days]);

    if (loading || !analytics) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">データを読み込み中...</p>
                </div>
            </div>
        );
    }

    const marketData = [
        { name: '賃貸', value: analytics.market.rental, color: COLORS.primary },
        { name: '売買', value: analytics.market.sale, color: COLORS.success },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                差分分析ダッシュボード
                            </h1>
                            <p className="mt-2 text-gray-600">リアルタイム市場動向と物件統計</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <select
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value={7}>過去7日間</option>
                                <option value={14}>過去14日間</option>
                                <option value={30}>過去30日間</option>
                            </select>
                            <button
                                onClick={() => fetchAnalytics(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                更新
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                    <button
                        onClick={() => openModal('total', '総物件数')}
                        className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl hover:scale-105 transition-all cursor-pointer text-left"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">総物件数</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {analytics.summary.total.toLocaleString()}
                                </p>
                            </div>
                            <Database className="w-12 h-12 text-blue-500 opacity-80" />
                        </div>
                    </button>

                    <button
                        onClick={() => openModal('active', 'アクティブ物件')}
                        className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white hover:shadow-xl hover:scale-105 transition-all cursor-pointer text-left"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-100 mb-1">アクティブ</p>
                                <p className="text-3xl font-bold">
                                    {analytics.summary.active.toLocaleString()}
                                </p>
                                <p className="text-xs text-green-100 mt-1">
                                    {analytics.health.activeRate}%
                                </p>
                            </div>
                            <Activity className="w-12 h-12 text-white opacity-80" />
                        </div>
                    </button>

                    <button
                        onClick={() => openModal('newToday', '本日追加された物件')}
                        className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg p-6 text-white hover:shadow-xl hover:scale-105 transition-all cursor-pointer text-left"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-amber-100 mb-1">本日追加</p>
                                <p className="text-3xl font-bold">
                                    {analytics.summary.newToday.toLocaleString()}
                                </p>
                                <p className="text-xs text-amber-100 mt-1">
                                    新規率 {analytics.health.newRate}%
                                </p>
                            </div>
                            <TrendingUp className="w-12 h-12 text-white opacity-80" />
                        </div>
                    </button>

                    <button
                        onClick={() => openModal('soldToday', '本日成約された物件')}
                        className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 text-white hover:shadow-xl hover:scale-105 transition-all cursor-pointer text-left"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-100 mb-1">本日成約</p>
                                <p className="text-3xl font-bold">
                                    {analytics.summary.soldToday.toLocaleString()}
                                </p>
                            </div>
                            <TrendingDown className="w-12 h-12 text-white opacity-80" />
                        </div>
                    </button>

                    <button
                        onClick={() => openModal('inactive', '売却済み物件')}
                        className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-6 text-white hover:shadow-xl hover:scale-105 transition-all cursor-pointer text-left"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-100 mb-1">売却済み</p>
                                <p className="text-3xl font-bold">
                                    {analytics.summary.inactive.toLocaleString()}
                                </p>
                                <p className="text-xs text-red-100 mt-1">
                                    {analytics.health.inactiveRate}%
                                </p>
                            </div>
                            <TrendingDown className="w-12 h-12 text-white opacity-80" />
                        </div>
                    </button>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Daily Trend */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-blue-600" />
                            日次推移
                        </h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={analytics.trend}>
                                <defs>
                                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="colorSold" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return `${date.getMonth() + 1}/${date.getDate()}`;
                                    }}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                    }}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="new"
                                    stroke={COLORS.success}
                                    fillOpacity={1}
                                    fill="url(#colorNew)"
                                    name="新規"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sold"
                                    stroke={COLORS.danger}
                                    fillOpacity={1}
                                    fill="url(#colorSold)"
                                    name="売却"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Market Composition */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <PieChartIcon className="w-6 h-6 text-blue-600" />
                            市場構成
                        </h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={marketData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value, percent }) =>
                                        `${name}: ${value.toLocaleString()}件 (${((percent || 0) * 100).toFixed(1)}%)`
                                    }
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {marketData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm text-gray-600">賃貸物件</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {analytics.market.rentalPercentage}%
                                </p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                                <p className="text-sm text-gray-600">売買物件</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {analytics.market.salePercentage}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                        カテゴリ別詳細
                    </h2>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={analytics.categories}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="category"
                                tick={{ fontSize: 11 }}
                                angle={-45}
                                textAnchor="end"
                                height={100}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                }}
                            />
                            <Legend />
                            <Bar dataKey="active" fill={COLORS.primary} name="アクティブ" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="newToday" fill={COLORS.success} name="本日追加" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="inactive" fill={COLORS.danger} name="売却済み" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Table */}
                <div className="mt-6 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <h2 className="text-xl font-bold text-white">カテゴリ別統計</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        カテゴリ
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        アクティブ
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        本日追加
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        売却済み
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        合計
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {analytics.categories.map((cat, index) => (
                                    <tr key={cat.categoryId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div
                                                    className="w-3 h-3 rounded-full mr-3"
                                                    style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                                                />
                                                <span className="text-sm font-medium text-gray-900">{cat.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                            {cat.active.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                +{cat.newToday}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                            {cat.inactive.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                            {(cat.active + cat.inactive).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                                <tr className="font-bold">
                                    <td className="px-6 py-4 text-sm text-gray-900">合計</td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                                        {analytics.summary.active.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            +{analytics.summary.newToday}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                                        {analytics.summary.inactive.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                                        {analytics.summary.total.toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {/* Property Modal */}
            <PropertyModal
                isOpen={modalOpen}
                onClose={closeModal}
                filter={modalFilter}
                title={modalTitle}
                category={modalCategory}
            />
        </div>
    );
}
