import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        // Note: Complex date filtering logic with OR condition on different columns
        // (first_seen_date OR (is_active=0 AND last_seen_date))
        // is tricky with simple Supabase filters.
        // We will fetch properties within the date range based on first_seen_date primarily,
        // and also check last_seen_date for sold items if possible, then process in JS.
        // Or simpler: fetch all properties (or a smart subset) and filter in JS.
        // Considering performance, let's fetch roughly recent data.

        // Calculate the cutoff date
        const date = new Date();
        date.setDate(date.getDate() - days);
        const dateStr = date.toISOString().split('T')[0];

        // Fetch properties:
        // Supabase .or() syntax: 'first_seen_date.gte.dateStr,and(is_active.eq.0,last_seen_date.gte.dateStr)'
        // But simpler to just fetch all active or recently updated properties if the dataset isn't huge.
        // Let's try to be specific with .or()

        const { data: properties, error } = await supabase
            .from('properties')
            .select('category, category_type, genre_name_ja, first_seen_date, last_seen_date, is_active, property_data')
            .or(`first_seen_date.gte.${dateStr},and(is_active.eq.false,last_seen_date.gte.${dateStr})`)
            .order('first_seen_date', { ascending: false });

        if (error) {
            throw error;
        }

        // Group by date
        const dailyStats: Record<string, any> = {};

        (properties || []).forEach((prop: any) => {
            const date = prop.first_seen_date;
            if (!date) return; // skip invalid data

            if (!dailyStats[date]) {
                dailyStats[date] = {
                    date,
                    newProperties: 0,
                    soldProperties: 0,
                    byCategory: {},
                    byType: { '賃貸': 0, '売買': 0 },
                    avgPrice: 0,
                    prices: []
                };
            }

            dailyStats[date].newProperties++;

            // Handle potentially missing category_type
            if (prop.category_type && dailyStats[date].byType[prop.category_type] !== undefined) {
                dailyStats[date].byType[prop.category_type]++;
            }

            // Handle genre_name_ja
            if (prop.genre_name_ja) {
                if (!dailyStats[date].byCategory[prop.genre_name_ja]) {
                    dailyStats[date].byCategory[prop.genre_name_ja] = 0;
                }
                dailyStats[date].byCategory[prop.genre_name_ja]++;
            }

            // Track prices
            const data = typeof prop.property_data === 'string' ? JSON.parse(prop.property_data || '{}') : prop.property_data || {};
            const price = extractPrice(data);
            if (price > 0) {
                dailyStats[date].prices.push(price);
            }

            // Track sold properties
            // logic: if inactive and last_seen_date matches the processing date
            // But wait, the loop is iterating by first_seen_date of the property.
            // If we want to track 'sold on date X', we should be aggregating based on date, not property's first_seen_date.
            // The original code was:
            // properties.forEach(prop => { const date = prop.first_seen_date; ... if (sold...) dailyStats[date].soldProperties++ })
            // This logic implies it counts a property as "sold on date X" only if it was also "first seen on date X" which seems wrong?
            // Re-reading original SQLite code:
            // "dailyStats[date]" uses "prop.first_seen_date" as the key.
            // Then "if (prop.is_active === 0 && prop.last_seen_date === date)" -> increment sold.
            // This means it ONLY counts sold properties if they were sold on the SAME DAY they were first seen?
            // That seems like a bug in the original code or a very specific definition of 'sold'.
            // However, to maintain behavior parity, I will reproduce it.
            // BUT, looking closely, `dailyStats` key is `date` (from first_seen).
            // So if a property was seen 10 days ago and sold today, it filters into `dailyStats[10_days_ago]`.
            // Then it checks `last_seen_date === 10_days_ago`.
            // So effectively, it tracks properties that were "listed and sold on the same day".
            // If the intention was to track daily trends, we should probably iterate through dates.
            //
            // Actually, let's look at the SQL again:
            // SELECT ... WHERE first_seen >= ... OR (is_active=0 AND last_seen >= ...)
            // The iteration is `properties.forEach`.
            // `const date = prop.first_seen_date` -> grouping by listing date.
            // So `dailyStats` represents "Cohort Analysis based on Listing Date".
            // It answers: "For properties listed on Date X, how many were new? How many are already sold (on Date X)?"
            // It does NOT answer: "How many properties were sold on Date X (regardless of when listed)?"
            // If that is the logic, I will stick to it.

            if (prop.is_active === false && prop.last_seen_date === date) {
                dailyStats[date].soldProperties++;
            }
        });

        // Note: The above logic misses "Properties listed before window but sold within window".
        // The SQL query fetches them (OR active=0 AND last_seen >= ...).
        // But the JS loop keys them by `first_seen_date`.
        // If `first_seen_date` is outside the window (e.g. 1 year ago), but sold yesterday.
        // fetched property: first: 2024-01-01, last: 2024-12-20.
        // JS loop: date = 2024-01-01.
        // If we strictly want to show trends for the requested 'days' (e.g. 30 days).
        // Then `dailyStats` key `2024-01-01` will be created.
        // But this date is outside the 'period' we usually want to show?
        // The response returns `trends: trendData`. `trendData` is `Object.values(dailyStats)`.
        // The SQL restricts `first_seen >= ...` OR `last_seen >= ...`.
        // So we might get keys (dates) that are old.
        // It seems the original code might have intended this behavior or it's a bit loose.
        // Given I am migrating, I will replicate the behavior.

        // HOWEVER, there is a catch: The loop uses `date = prop.first_seen_date`.
        // If I fetch a property that was sold recently but listed long ago, `date` is long ago.
        // So it will be added to a date bucket that might be outside the requested `trends` range if we were plotting a chart of "Last 30 Days".
        // But the original code just returns `trendData` sorted by date.
        // So the frontend probably handles it or shows a long tail.

        // Let's refine the "Sold" logic because the original might have been:
        // If I want to see "Sold counts per day", I need to aggregate by `last_seen_date` for sold items.
        // The original logic:
        // `if (prop.is_active === 0 && prop.last_seen_date === date)`
        // This implies it ONLY counts if sold date == listed date.
        // This effectively ignores properties sold days later.
        // This looks like a BUG in the original code or a very specific 'Same Day Sale' metric.
        //
        // WAIT. Let's look at the original SQL results again.
        // `properties` list contains mixed: new ones and sold ones.
        // If I want to match the "Activity Stream" idea:
        // Maybe we should iterate through the DATES in the range, and for each date count:
        // - New: count where first_seen == date
        // - Sold: count where last_seen == date AND is_active == false
        //
        // The original code was:
        /*
            properties.forEach(prop => {
                const date = prop.first_seen_date;
                if (!dailyStats[date]) { init... }
                dailyStats[date].newProperties++;
                ...
                if (prop.is_active === 0 && prop.last_seen_date === date) {
                    dailyStats[date].soldProperties++;
                }
            })
        */
        // Yes, the original code groups EVERYTHING by `first_seen_date`.
        // So `dailyStats[X]` contains data about properties BORN on day X.
        // - `newProperties`: How many born on day X.
        // - `soldProperties`: How many born on day X AND died on day X.
        //
        // This seems to essentially miss "Sold properties that were listed previously".
        // It basically only counts "Same day sales".
        // Unless `last_seen_date` represents something else... default logic usually updates it every scrape.
        // If `is_active=0` (sold), `last_seen_date` is the day it disappeared.
        //
        // To be safe and helpful, I will stick to the exact logic of the original file to avoid changing business logic during a migration.
        // I will replicate the structure exactly.

        // Calculate average prices and format data
        const trendData = Object.values(dailyStats).map((day: any) => {
            const avgPrice = day.prices.length > 0
                ? Math.round(day.prices.reduce((a: number, b: number) => a + b, 0) / day.prices.length)
                : 0;

            return {
                date: day.date,
                newProperties: day.newProperties,
                soldProperties: day.soldProperties,
                netChange: day.newProperties - day.soldProperties,
                byCategory: day.byCategory,
                byType: day.byType,
                avgPrice,
                priceCount: day.prices.length
            };
        }).sort((a: any, b: any) => a.date.localeCompare(b.date));

        // Calculate overall trends
        const totalNew = trendData.reduce((sum, day) => sum + day.newProperties, 0);
        const totalSold = trendData.reduce((sum, day) => sum + day.soldProperties, 0);
        const avgDailyNew = trendData.length > 0 ? Math.round(totalNew / trendData.length) : 0;
        const avgDailySold = trendData.length > 0 ? Math.round(totalSold / trendData.length) : 0;

        // Calculate growth rate (comparing first half vs second half)
        const midpoint = Math.floor(trendData.length / 2);
        const firstHalf = trendData.slice(0, midpoint);
        const secondHalf = trendData.slice(midpoint);

        const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, day) => sum + day.newProperties, 0) / firstHalf.length : 0;
        const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, day) => sum + day.newProperties, 0) / secondHalf.length : 0;
        const growthRate = firstHalfAvg > 0
            ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)
            : 0;

        return NextResponse.json({
            success: true,
            period: {
                days,
                from: trendData[0]?.date,
                to: trendData[trendData.length - 1]?.date
            },
            summary: {
                totalNew,
                totalSold,
                netChange: totalNew - totalSold,
                avgDailyNew,
                avgDailySold,
                growthRate
            },
            trends: trendData
        });
    } catch (error: any) {
        console.error('Error fetching trend data:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

function extractPrice(data: any): number {
    const priceStr = data['家賃'] || data['価格'] || data['販売価格'] || '';
    const match = priceStr.match(/[\d,]+/);
    if (match) {
        return parseInt(match[0].replace(/,/g, ''));
    }
    return 0;
}
