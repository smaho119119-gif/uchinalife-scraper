"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InteractiveMap from '@/components/InteractiveMap';
import AreaAnalytics from '@/components/AreaAnalytics';
import TrendAnalytics from '@/components/TrendAnalytics';
import { Home, TrendingUp, MapPin, Activity, BarChart3, DollarSign, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-yellow-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-cyan-500 mb-4"></div>
          <p className="text-slate-700 dark:text-slate-400 font-bold">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 bg-yellow-100 dark:bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-fuchsia-600 dark:text-fuchsia-400 drop-shadow-lg">
            🏝️ 沖縄不動産 営業ダッシュボード
          </h1>
          <p className="text-slate-700 dark:text-slate-400 mt-2 font-semibold">プロフェッショナルセールスツール</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">最終更新</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {new Date().toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })}
            </p>
          </div>
          <Link href="/admin">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <Shield className="mr-2 h-4 w-4" />
              管理ページ
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-cyan-400 dark:bg-cyan-600 border-4 border-cyan-600 dark:border-cyan-400 hover:scale-105 transition-transform shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">総物件数</CardTitle>
            <Home className="h-6 w-6 text-slate-900 dark:text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 dark:text-white">{stats?.total?.toLocaleString() || 0}</div>
            <p className="text-sm text-slate-800 dark:text-cyan-100 mt-2 flex items-center gap-1 font-bold">
              <TrendingUp className="h-4 w-4" />
              アクティブ物件
            </p>
          </CardContent>
        </Card>

        <Card className="bg-lime-400 dark:bg-lime-600 border-4 border-lime-600 dark:border-lime-400 hover:scale-105 transition-transform shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">本日の新着</CardTitle>
            <Activity className="h-6 w-6 text-slate-900 dark:text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 dark:text-white">{stats?.newToday || 0}</div>
            <p className="text-sm text-slate-800 dark:text-lime-100 mt-2 font-bold">新規チャンス</p>
          </CardContent>
        </Card>

        <Card className="bg-fuchsia-400 dark:bg-fuchsia-600 border-4 border-fuchsia-600 dark:border-fuchsia-400 hover:scale-105 transition-transform shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">賃貸物件</CardTitle>
            <MapPin className="h-6 w-6 text-slate-900 dark:text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 dark:text-white">{stats?.byType?.['賃貸']?.toLocaleString() || 0}</div>
            <p className="text-sm text-slate-800 dark:text-fuchsia-100 mt-2 font-bold">賃貸カテゴリー</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-400 dark:bg-amber-600 border-4 border-amber-600 dark:border-amber-400 hover:scale-105 transition-transform shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">売買物件</CardTitle>
            <DollarSign className="h-6 w-6 text-slate-900 dark:text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 dark:text-white">{stats?.byType?.['売買']?.toLocaleString() || 0}</div>
            <p className="text-sm text-slate-800 dark:text-amber-100 mt-2 font-bold">売買カテゴリー</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="map" className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-950 border-4 border-slate-900 dark:border-white">
          <TabsTrigger
            value="map"
            className="data-[state=active]:bg-cyan-500 data-[state=active]:border-cyan-600"
          >
            <MapPin className="h-5 w-5 mr-2" />
            マップビュー
          </TabsTrigger>
          <TabsTrigger
            value="areas"
            className="data-[state=active]:bg-fuchsia-500 data-[state=active]:border-fuchsia-600"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            地域分析
          </TabsTrigger>
          <TabsTrigger
            value="trends"
            className="data-[state=active]:bg-amber-500 data-[state=active]:border-amber-600"
          >
            <TrendingUp className="h-5 w-5 mr-2" />
            トレンド分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          <InteractiveMap />
        </TabsContent>

        <TabsContent value="areas" className="space-y-4">
          <AreaAnalytics />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <TrendAnalytics />
        </TabsContent>
      </Tabs>

      {/* Quick Stats Footer */}
      <Card className="bg-white dark:bg-slate-900 border-4 border-slate-900 dark:border-white shadow-xl">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-black text-cyan-600 dark:text-cyan-400">{Object.keys(stats?.byCategory || {}).length}</p>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1 font-bold">カテゴリー数</p>
            </div>
            <div>
              <p className="text-3xl font-black text-lime-600 dark:text-lime-400">{stats?.newToday || 0}</p>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1 font-bold">今日の新着</p>
            </div>
            <div>
              <p className="text-3xl font-black text-fuchsia-600 dark:text-fuchsia-400">{stats?.soldToday || 0}</p>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1 font-bold">今日の成約</p>
            </div>
            <div>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
                {stats?.total ? ((stats.newToday / stats.total) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1 font-bold">新着率</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
