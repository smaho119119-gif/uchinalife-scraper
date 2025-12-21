import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

// キャッシュ（5分間有効）
let statsCache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分

export async function GET(request: NextRequest) {
    try {
        // キャッシュが有効な場合はキャッシュを返す
        if (statsCache && Date.now() - statsCache.timestamp < CACHE_DURATION) {
            return NextResponse.json(statsCache.data);
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 並列でクエリを実行して時間を短縮
        const [totalResult, activeResult, categoryResult, latestResult] = await Promise.all([
            // 総物件数
            supabase
                .from('properties')
                .select('*', { count: 'exact', head: true }),

            // 販売中の物件数
            supabase
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true),

            // カテゴリ別の件数（PostgreSQLのGROUP BY相当をRPCで実行）
            // Supabaseではgroup byが直接使えないので、異なるアプローチを使用
            // 既知のカテゴリに対して個別にカウントを取得
            Promise.all([
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'jukyo'),
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'jigyo'),
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'yard'),
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'parking'),
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'tochi'),
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'mansion'),
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'house'),
                supabase.from('properties').select('*', { count: 'exact', head: true }).eq('category', 'sonota'),
            ]),

            // 最終更新日時
            supabase
                .from('properties')
                .select('updated_at')
                .order('updated_at', { ascending: false })
                .limit(1)
        ]);

        // カテゴリ名リスト
        const categoryNames = ['jukyo', 'jigyo', 'yard', 'parking', 'tochi', 'mansion', 'house', 'sonota'];
        const categories: Record<string, number> = {};
        categoryResult.forEach((result, index) => {
            categories[categoryNames[index]] = result.count || 0;
        });

        const lastUpdated = latestResult.data?.[0]?.updated_at || null;

        const responseData = {
            total: totalResult.count || 0,
            active: activeResult.count || 0,
            categories,
            lastUpdated
        };

        // キャッシュを更新
        statsCache = { data: responseData, timestamp: Date.now() };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
