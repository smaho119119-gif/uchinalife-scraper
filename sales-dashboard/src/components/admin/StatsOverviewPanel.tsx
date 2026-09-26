'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { ExternalLink } from 'lucide-react';
import type { Run, Stats } from '@/app/admin/types';
import {
    CATEGORY_ORDER,
    CHART,
    catLabel,
    conclusionPill,
    eventLabel,
    fmtDay,
    fmtJst,
    fmtNum,
    ErrorNote,
    Panel,
    SectionTitle,
    StatTile,
} from '@/components/admin/admin-ui';

interface Props {
    stats: Stats | null;
    statsError: string | null;
    latestRun: Run | null;
    workflowUrl: string;
}

export function StatsOverviewPanel({ stats, statsError, latestRun, workflowUrl }: Props) {
    const chartData = useMemo(
        () =>
            CATEGORY_ORDER.map((c) => ({ name: catLabel(c), 件数: stats?.categories?.[c] ?? 0 })),
        [stats?.categories],
    );

    return (
        <div className="space-y-5">
            {statsError && <ErrorNote>物件数を取得できませんでした（{statsError}）</ErrorNote>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="DBの物件（売れた物件を含む）" value={`${fmtNum(stats?.total)}件`} />
                <StatTile label="いま掲載中" value={`${fmtNum(stats?.active)}件`} tone="ok" />
                <StatTile
                    label="物件データの最終更新（日本時間）"
                    value={<span className="text-xl">{fmtJst(stats?.lastUpdated)}</span>}
                    note={stats?.lastSnapshotDate ? `最新の掲載件数の記録: ${fmtDay(stats.lastSnapshotDate, true)}` : undefined}
                />
                <StatTile
                    label="最後の取得"
                    value={
                        latestRun ? (
                            <span className="flex flex-wrap items-center gap-2 text-xl">
                                {fmtDay(latestRun.snapshot_date)} {conclusionPill(latestRun.conclusion)}
                            </span>
                        ) : (
                            <span className="text-xl text-slate-500">記録なし</span>
                        )
                    }
                    note={latestRun ? `${eventLabel(latestRun.event)}・#${latestRun.run_number ?? '—'}` : '取得履歴タブを参照'}
                />
            </div>

            <Panel>
                <SectionTitle sub="いま掲載中の物件（properties の is_active）">カテゴリ別の掲載中件数</SectionTitle>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
                            <CartesianGrid horizontal={false} stroke={CHART.grid} />
                            <XAxis type="number" tick={{ fontSize: 13, fill: CHART.axis }} tickFormatter={(v: number) => v.toLocaleString('ja-JP')} />
                            <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 13, fill: '#0f172a' }} />
                            <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ja-JP')}件`, '掲載中']} cursor={{ fill: '#f1f5f9' }} />
                            <Bar dataKey="件数" fill={CHART.primary} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                                <LabelList dataKey="件数" position="right" formatter={(v: unknown) => Number(v).toLocaleString('ja-JP')} style={{ fontSize: 13, fill: '#334155' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <a
                    href={workflowUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-[15px] font-semibold text-slate-900 shadow-sm hover:border-teal-400"
                >
                    <span>
                        GitHub Actions（毎晩の取得・手動実行）
                        <span className="block text-[15px] font-normal text-slate-600">scrape-parallel.yml の実行一覧</span>
                    </span>
                    <ExternalLink className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                </a>
                <a
                    href="https://supabase.com/dashboard/project/csnwgqtoioqnuoqlvcds"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-[15px] font-semibold text-slate-900 shadow-sm hover:border-teal-400"
                >
                    <span>
                        Supabase（うちなーらいふDB）
                        <span className="block text-[15px] font-normal text-slate-600">表を直接見る</span>
                    </span>
                    <ExternalLink className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                </a>
            </div>
        </div>
    );
}
