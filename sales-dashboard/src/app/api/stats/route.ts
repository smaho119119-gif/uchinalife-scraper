import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const JST_TIMEZONE = 'Asia/Tokyo';

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 総物件数
        const { count: total } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        // 本日の新着物件数（JSTの今日）
        const now = new Date();
        const jstNow = toZonedTime(now, JST_TIMEZONE);
        const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        // JSTの今日の開始時刻と終了時刻をUTCに変換
        const todayStartUTC = fromZonedTime(todayStart, JST_TIMEZONE).toISOString();
        const todayEndUTC = fromZonedTime(todayEnd, JST_TIMEZONE).toISOString();
        
        const { count: newToday } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStartUTC)
            .lt('created_at', todayEndUTC);

        // 本日の成約物件数（JSTの今日に非アクティブになった物件）
        const { count: soldToday } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', false)
            .gte('last_seen_date', todayStart.toISOString().split('T')[0])
            .lt('last_seen_date', todayEnd.toISOString().split('T')[0]);

        // 賃貸物件数（jukyo, jigyo, parking, yard）
        const rentalCategories = ['jukyo', 'jigyo', 'parking', 'yard'];
        let rentalCount = 0;
        for (const cat of rentalCategories) {
            const { count } = await supabase
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('category', cat)
                .eq('is_active', true);
            rentalCount += count || 0;
        }

        // 売買物件数（house, mansion, tochi, sonota）
        const saleCategories = ['house', 'mansion', 'tochi', 'sonota'];
        let saleCount = 0;
        for (const cat of saleCategories) {
            const { count } = await supabase
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('category', cat)
                .eq('is_active', true);
            saleCount += count || 0;
        }

        // カテゴリ別の件数（配列形式、後方互換性のため）
        const categories: Record<string, number> = {};
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: categoryData, error } = await supabase
                .from('properties')
                .select('category')
                .eq('is_active', true)
                .range(from, from + pageSize - 1);

            if (error) {
                console.error('Error fetching category data:', error);
                break;
            }

            if (!categoryData || categoryData.length === 0) {
                hasMore = false;
                break;
            }

            categoryData.forEach((item) => {
                const cat = item.category || '不明';
                categories[cat] = (categories[cat] || 0) + 1;
            });

            if (categoryData.length < pageSize) {
                hasMore = false;
            } else {
                from += pageSize;
            }
        }

        // カテゴリ名のマッピング
        const categoryNameMap: Record<string, string> = {
            'jukyo': '賃貸',
            'jigyo': '賃貸',
            'parking': '賃貸',
            'yard': '賃貸',
            'house': '売買',
            'mansion': '売買',
            'tochi': '売買',
            'sonota': '売買',
        };

        // byCategory配列を作成（後方互換性のため）
        const byCategory = Object.entries(categories).map(([cat, count]) => {
            const categoryNameJa = categoryNameMap[cat] || '不明';
            const genreNameJa = cat;
            return {
                category_name_ja: categoryNameJa,
                genre_name_ja: genreNameJa,
                count
            };
        });

        return NextResponse.json({
            total: total || 0,
            newToday: newToday || 0,
            soldToday: soldToday || 0,
            byType: {
                '賃貸': rentalCount,
                '売買': saleCount,
            },
            byCategory,
            categories, // カテゴリ別の件数（オブジェクト形式）
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
