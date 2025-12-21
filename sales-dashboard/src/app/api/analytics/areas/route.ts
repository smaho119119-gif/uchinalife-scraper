import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

function extractCityName(locationStr: string): string {
    if (!locationStr || locationStr === '不明') {
        return '不明';
    }
    
    // 「沖縄県」を削除
    locationStr = locationStr.replace('沖縄県', '').trim();
    
    // 市区町村名を抽出（例: "那覇市"、"北谷町"、"読谷村"）
    const cityMatch = locationStr.match(/([^市]+市|[^町]+町|[^村]+村)/);
    if (cityMatch) {
        return cityMatch[1];
    }
    
    // 市区町村名が見つからない場合は、最初の部分を返す
    const parts = locationStr.split(/\s+/);
    if (parts.length > 0) {
        return parts[0];
    }
    
    return '不明';
}

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get all active properties (with pagination)
        const properties: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('properties')
                .select('category, category_type, property_data, first_seen_date, last_seen_date')
                .eq('is_active', true)
                .range(from, from + pageSize - 1);

            if (error) {
                console.error('Error fetching properties:', error);
                break;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            properties.push(...data);

            if (data.length < pageSize) {
                hasMore = false;
            } else {
                from += pageSize;
            }
        }

        // Analyze by area
        const areaStats: Record<string, any> = {};

        properties.forEach((prop: any) => {
            const data = prop.property_data || {};
            // 「所在地」または「住所」フィールドを探す
            const location = data['所在地'] || data['住所'] || data['location'] || '';
            const city = extractCityName(location);

            if (!areaStats[city]) {
                areaStats[city] = {
                    city,
                    totalProperties: 0,
                    byCategory: {},
                    byType: { '賃貸': 0, '売買': 0 },
                    prices: [],
                    newThisWeek: 0,
                    newThisMonth: 0
                };
            }

            areaStats[city].totalProperties++;
            areaStats[city].byType[prop.category_type]++;

            // Category breakdown
            if (!areaStats[city].byCategory[prop.category]) {
                areaStats[city].byCategory[prop.category] = 0;
            }
            areaStats[city].byCategory[prop.category]++;

            // Price analysis
            const price = extractPrice(data);
            if (price > 0) {
                areaStats[city].prices.push(price);
            }

            // New properties tracking
            const firstSeen = new Date(prop.first_seen_date);
            const now = new Date();
            const daysDiff = Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff <= 7) areaStats[city].newThisWeek++;
            if (daysDiff <= 30) areaStats[city].newThisMonth++;
        });

        // Calculate statistics for each area
        const areaAnalytics = Object.values(areaStats).map((area: any) => {
            const prices = area.prices.sort((a: number, b: number) => a - b);
            const avgPrice = prices.length > 0
                ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length)
                : 0;
            const medianPrice = prices.length > 0
                ? prices[Math.floor(prices.length / 2)]
                : 0;

            return {
                city: area.city,
                totalProperties: area.totalProperties,
                byCategory: area.byCategory,
                byType: area.byType,
                avgPrice,
                medianPrice,
                minPrice: prices[0] || 0,
                maxPrice: prices[prices.length - 1] || 0,
                newThisWeek: area.newThisWeek,
                newThisMonth: area.newThisMonth,
                activityScore: calculateActivityScore(area)
            };
        }).sort((a, b) => b.totalProperties - a.totalProperties);

        return NextResponse.json({
            success: true,
            areas: areaAnalytics,
            totalAreas: areaAnalytics.length
        });
    } catch (error: any) {
        console.error('Error fetching area analytics:', error);
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

function calculateActivityScore(area: any): number {
    // Activity score based on total properties, new listings, and diversity
    const diversityScore = Object.keys(area.byCategory).length * 10;
    const volumeScore = Math.min(area.totalProperties, 100);
    const newListingsScore = area.newThisWeek * 5;

    return Math.round(diversityScore + volumeScore + newListingsScore);
}
