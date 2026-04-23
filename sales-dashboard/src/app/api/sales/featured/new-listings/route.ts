import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { safeParseJson } from '@/lib/json';
import { parseIntParam, jsonError, logAndSerializeError } from '@/lib/api-utils';
import { isValidCategory } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const days = parseIntParam(searchParams.get('days'), 7, 1, 90);
    const rawCategory = searchParams.get('category');
    const categoryFilter = rawCategory && isValidCategory(rawCategory) ? rawCategory : null;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Fetch new listings directly with limit
    let query = supabase
      .from('properties')
      .select('url, title, price, category, genre_name_ja, images, company_name, property_data, first_seen_date')
      .eq('is_active', true)
      .gte('first_seen_date', cutoffStr)
      .order('first_seen_date', { ascending: false })
      .limit(200);

    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }

    const { data: allProperties, error } = await query;

    if (error) throw error;

    const newListings = (allProperties || []).map((prop) => {
      const pd = safeParseJson(prop.property_data);

      return {
        url: prop.url,
        title: prop.title,
        price: prop.price,
        category: prop.category,
        genre_name_ja: prop.genre_name_ja,
        images: safeParseJson<unknown[]>(prop.images, []),
        company_name: prop.company_name,
        location: pd['所在地'] || pd['住所'] || pd['物件所在地'] || '',
        madori: pd['間取り'] || pd['間取'] || '',
        first_seen_date: prop.first_seen_date,
      };
    });

    return NextResponse.json(
      { success: true, properties: newListings, total: newListings.length, days },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    return jsonError(logAndSerializeError('sales/featured/new-listings', error));
  }
}
