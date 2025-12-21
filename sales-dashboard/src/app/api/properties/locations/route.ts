import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Cache for 5 minutes
let cachedData: { markers: any[], timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
    try {
        // Check cache first
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
            return NextResponse.json({
                success: true,
                count: cachedData.markers.length,
                markers: cachedData.markers,
                cached: true
            });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '500');

        // Optimized query - only get necessary fields and limit results
        const { data: properties, error } = await supabase
            .from('properties')
            .select('id, url, title, category, category_type, genre_name_ja, property_data, images')
            .eq('is_active', true)
            .order('id', { ascending: false })
            .limit(limit);

        if (error) {
            throw error;
        }

        // Extract location information and create map markers
        const markers = (properties || []).map((prop: any) => {
            const data = typeof prop.property_data === 'string' ? JSON.parse(prop.property_data) : prop.property_data || {};
            const images = typeof prop.images === 'string' ? JSON.parse(prop.images) : prop.images || [];

            // Extract location from property_data
            const location = data['住所'] || data['所在地'] || data['location'] || '';
            const price = data['家賃'] || data['価格'] || data['販売価格'] || '';

            // Parse location to extract city/area
            const cityMatch = location.match(/沖縄県(.*?[市町村])/) || location.match(/(.*?[市町村])/);
            const city = cityMatch ? cityMatch[1] : '';

            return {
                id: prop.id,
                url: prop.url,
                title: prop.title,
                category: prop.category,
                categoryType: prop.category_type,
                genreName: prop.genre_name_ja,
                location,
                city,
                price,
                image: images[0] || null,
                coordinates: getApproximateCoordinates(city)
            };
        }).filter(marker => marker.coordinates !== null);

        // Update cache
        cachedData = {
            markers,
            timestamp: Date.now()
        };

        return NextResponse.json({
            success: true,
            count: markers.length,
            markers,
            cached: false
        });
    } catch (error: any) {
        console.error('Error fetching location data:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

function getApproximateCoordinates(city: string): [number, number] | null {
    const coordinates: Record<string, [number, number]> = {
        // 市 (Cities)
        '那覇市': [26.2124, 127.6809],
        '浦添市': [26.2458, 127.7219],
        '宜野湾市': [26.2815, 127.7781],
        '沖縄市': [26.3344, 127.8056],
        'うるま市': [26.3719, 127.8508],
        '名護市': [26.5919, 127.9772],
        '糸満市': [26.1247, 127.6647],
        '豊見城市': [26.1614, 127.6672],
        '南城市': [26.1467, 127.7669],
        '宮古島市': [24.8050, 125.2811],
        '石垣市': [24.3364, 124.1556],

        // 町 (Towns)
        '読谷村': [26.3958, 127.7439],
        '嘉手納町': [26.3586, 127.7497],
        '北谷町': [26.3169, 127.7697],
        '北中城村': [26.2908, 127.7969],
        '中城村': [26.2669, 127.8019],
        '西原町': [26.2181, 127.7614],
        '与那原町': [26.1975, 127.7514],
        '南風原町': [26.1906, 127.7278],
        '八重瀬町': [26.1306, 127.7219],
        '恩納村': [26.4969, 127.8514],
        '金武町': [26.4456, 127.9264],
        '宜野座村': [26.4889, 127.9753],
        '今帰仁村': [26.6833, 127.9556],
        '本部町': [26.6500, 127.8778],
        '大宜味村': [26.7167, 128.1167],
        '東村': [26.6167, 128.1833],
        '国頭村': [26.8167, 128.2500],
        '伊江村': [26.7167, 127.8000],
        '伊平屋村': [27.0333, 127.9667],
        '伊是名村': [26.9333, 127.9500],
        '久米島町': [26.3333, 126.8000],
        '渡嘉敷村': [26.1833, 127.3667],
        '座間味村': [26.2333, 127.3000],
        '粟国村': [26.5833, 127.2333],
        '渡名喜村': [26.3667, 127.1333],
        '南大東村': [25.8333, 131.2333],
        '北大東村': [25.9500, 131.3000],
        '多良間村': [24.6667, 124.7000],
        '竹富町': [24.3333, 124.0833],
        '与那国町': [24.4667, 123.0000],
    };

    return coordinates[city] || null;
}
