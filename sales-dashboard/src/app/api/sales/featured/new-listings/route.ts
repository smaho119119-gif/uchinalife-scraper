import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const categoryFilter = searchParams.get('category');

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Fetch new listings with pagination
    const allProperties: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('properties')
        .select('url, title, price, category, genre_name_ja, images, company_name, property_data, first_seen_date')
        .eq('is_active', true)
        .gte('first_seen_date', cutoffStr);

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query
        .order('first_seen_date', { ascending: false })
        .range(from, from + pageSize - 1);

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

    // Limit to 200 and map
    const newListings = allProperties.slice(0, 200).map((prop) => {
      const pd = typeof prop.property_data === 'string'
        ? JSON.parse(prop.property_data)
        : prop.property_data || {};

      return {
        url: prop.url,
        title: prop.title,
        price: prop.price,
        category: prop.category,
        genre_name_ja: prop.genre_name_ja,
        images: typeof prop.images === 'string' ? JSON.parse(prop.images) : (prop.images || []),
        company_name: prop.company_name,
        location: pd['所在地'] || pd['住所'] || pd['物件所在地'] || '',
        madori: pd['間取り'] || pd['間取'] || '',
        first_seen_date: prop.first_seen_date,
      };
    });

    return NextResponse.json({
      success: true,
      properties: newListings,
      total: newListings.length,
      days,
    });
  } catch (error: any) {
    console.error('Error in new-listings API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
