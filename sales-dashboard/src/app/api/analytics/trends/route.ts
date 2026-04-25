import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { parseIntParam, jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseIntParam(searchParams.get('days'), 30, 1, 365);

        // Service role: anon RLS forces the RPC to scan with extra row
        // filters and trips Supabase's 8s statement timeout. Same root cause
        // as analytics/diff (R20-fix) — the RPC isn't SECURITY DEFINER.
        const supabase = getSupabase('service');
        const { data, error } = await supabase.rpc('analytics_trends', { p_days: days });
        if (error) throw error;

        const trendData = (data?.trend || []) as Array<{
            date: string;
            newProperties: number;
            soldProperties: number;
            net: number;
        }>;

        const totalNew = trendData.reduce((s, d) => s + d.newProperties, 0);
        const totalSold = trendData.reduce((s, d) => s + d.soldProperties, 0);
        const avgDailyNew = trendData.length ? Math.round(totalNew / trendData.length) : 0;
        const avgDailySold = trendData.length ? Math.round(totalSold / trendData.length) : 0;

        const half = Math.floor(trendData.length / 2);
        const firstHalf = trendData.slice(0, half);
        const secondHalf = trendData.slice(half);
        const firstAvg = firstHalf.length ? firstHalf.reduce((s, d) => s + d.newProperties, 0) / firstHalf.length : 0;
        const secondAvg = secondHalf.length ? secondHalf.reduce((s, d) => s + d.newProperties, 0) / secondHalf.length : 0;
        const growthRate = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

        return NextResponse.json(
            {
                success: true,
                period: { days, from: trendData[0]?.date, to: trendData[trendData.length - 1]?.date },
                summary: {
                    totalNew,
                    totalSold,
                    netChange: totalNew - totalSold,
                    avgDailyNew,
                    avgDailySold,
                    growthRate,
                },
                trends: trendData.map((t) => ({
                    date: t.date,
                    newProperties: t.newProperties,
                    soldProperties: t.soldProperties,
                    avgPrice: 0,
                    byType: { '賃貸': 0, '売買': 0 },
                    byCategory: {},
                })),
            },
            { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
        );
    } catch (error) {
        return jsonError(logAndSerializeError('analytics/trends', error));
    }
}
