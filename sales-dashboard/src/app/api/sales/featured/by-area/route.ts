import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractCityName } from '@/lib/area';
import { parsePrice } from '@/lib/price';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category');

    // Fetch all active properties with pagination
    const allProperties: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('properties')
        .select('category, genre_name_ja, property_data, price');

      query = query.eq('is_active', true);

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query.range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching properties:', error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      allProperties.push(...data);

      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }

    // Group by city
    const areaMap: Record<string, {
      count: number;
      categories: Record<string, number>;
      prices: number[];
    }> = {};

    allProperties.forEach((prop) => {
      const pd = typeof prop.property_data === 'string'
        ? JSON.parse(prop.property_data)
        : prop.property_data || {};

      const location = pd['所在地'] || pd['住所'] || pd['物件所在地'] || '';
      const city = extractCityName(location);

      if (!areaMap[city]) {
        areaMap[city] = { count: 0, categories: {}, prices: [] };
      }

      areaMap[city].count++;

      const cat = prop.genre_name_ja || prop.category || 'その他';
      areaMap[city].categories[cat] = (areaMap[city].categories[cat] || 0) + 1;

      const price = parsePrice(prop.price);
      if (price !== null && price > 0) {
        areaMap[city].prices.push(price);
      }
    });

    // Convert to array and calculate avgPrice
    const areas = Object.entries(areaMap)
      .map(([area, data]) => ({
        area,
        count: data.count,
        categories: data.categories,
        avgPrice: data.prices.length > 0
          ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length)
          : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      areas,
      totalAreas: areas.length,
    });
  } catch (error: any) {
    console.error('Error in by-area API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
