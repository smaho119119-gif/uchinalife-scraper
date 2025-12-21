import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { error: 'Supabase configuration missing' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');

        // Get total properties
        const { count: totalCount } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true });

        // Get active properties
        const { count: activeCount } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        // Get inactive properties
        const inactiveCount = (totalCount || 0) - (activeCount || 0);

        // Get properties added today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());

        // Get properties updated today
        const { count: updatedTodayCount } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', today.toISOString());

        // Get properties that became inactive (sold) today
        const { count: soldTodayCount } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', false)
            .gte('updated_at', today.toISOString());

        // Get category breakdown
        const categories = [
            { id: 'jukyo', name: '賃貸_住居' },
            { id: 'jigyo', name: '賃貸_事業用' },
            { id: 'yard', name: '賃貸_月極駐車場' },
            { id: 'parking', name: '賃貸_時間貸駐車場' },
            { id: 'tochi', name: '売買_土地' },
            { id: 'mansion', name: '売買_マンション' },
            { id: 'house', name: '売買_戸建' },
            { id: 'sonota', name: '売買_その他' },
        ];

        const categoryStats = await Promise.all(
            categories.map(async (cat) => {
                const { count: activeCount } = await supabase
                    .from('properties')
                    .select('*', { count: 'exact', head: true })
                    .eq('category', cat.id)
                    .eq('is_active', true);

                const { count: todayCount } = await supabase
                    .from('properties')
                    .select('*', { count: 'exact', head: true })
                    .eq('category', cat.id)
                    .gte('created_at', today.toISOString());

                const { count: inactiveCount } = await supabase
                    .from('properties')
                    .select('*', { count: 'exact', head: true })
                    .eq('category', cat.id)
                    .eq('is_active', false);

                return {
                    category: cat.name,
                    categoryId: cat.id,
                    active: activeCount || 0,
                    newToday: todayCount || 0,
                    inactive: inactiveCount || 0,
                };
            })
        );

        // Get daily trend for the past N days
        const dailyTrend = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const { count: newCount } = await supabase
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', date.toISOString())
                .lt('created_at', nextDate.toISOString());

            const { count: soldCount } = await supabase
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', false)
                .gte('updated_at', date.toISOString())
                .lt('updated_at', nextDate.toISOString());

            dailyTrend.push({
                date: date.toISOString().split('T')[0],
                new: newCount || 0,
                sold: soldCount || 0,
                net: (newCount || 0) - (soldCount || 0),
            });
        }

        // Calculate market composition
        const rentalCategories = ['jukyo', 'jigyo', 'yard', 'parking'];
        const saleCategories = ['tochi', 'mansion', 'house', 'sonota'];

        const rentalCount = categoryStats
            .filter((s) => rentalCategories.includes(s.categoryId))
            .reduce((sum, s) => sum + s.active, 0);

        const saleCount = categoryStats
            .filter((s) => saleCategories.includes(s.categoryId))
            .reduce((sum, s) => sum + s.active, 0);

        // Health metrics
        const activeRate = activeCount && totalCount ? (activeCount / totalCount) * 100 : 0;
        const newRate = todayCount && activeCount ? (todayCount / activeCount) * 100 : 0;

        return NextResponse.json({
            summary: {
                total: totalCount || 0,
                active: activeCount || 0,
                inactive: inactiveCount,
                newToday: todayCount || 0,
                updatedToday: updatedTodayCount || 0,
                soldToday: soldTodayCount || 0,
            },
            health: {
                activeRate: activeRate.toFixed(1),
                inactiveRate: (100 - activeRate).toFixed(1),
                newRate: newRate.toFixed(2),
            },
            market: {
                rental: rentalCount,
                sale: saleCount,
                rentalPercentage: activeCount ? ((rentalCount / activeCount) * 100).toFixed(1) : '0',
                salePercentage: activeCount ? ((saleCount / activeCount) * 100).toFixed(1) : '0',
            },
            categories: categoryStats,
            trend: dailyTrend,
        });
    } catch (error) {
        console.error('Error fetching diff analytics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analytics' },
            { status: 500 }
        );
    }
}
