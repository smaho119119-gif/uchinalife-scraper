import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { safeParseJson } from '@/lib/json';
import { isValidCategory } from '@/lib/categories';
import { jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const rawCategory = searchParams.get('category');
    const categoryFilter = rawCategory && isValidCategory(rawCategory) ? rawCategory : null;

    // Use Supabase JSONB filter to find pet-friendly properties directly
    let query = supabase
      .from('properties')
      .select('url, title, price, category, genre_name_ja, images, company_name, property_data, first_seen_date')
      .eq('is_active', true)
      .or('property_data->>ペット.ilike.%可%,property_data->>ペット.ilike.%相談%,property_data->>ペット.ilike.%小型%,property_data->>ペット飼育.ilike.%可%,property_data->>ペット飼育.ilike.%相談%')
      .order('first_seen_date', { ascending: false })
      .limit(200);

    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching pet-friendly properties:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const properties = (data || [])
      .filter((prop) => {
        // Double-check: exclude "不可"
        const pd = safeParseJson(prop.property_data);
        const petValue = pd['ペット'] || pd['ペット飼育'] || '';
        return petValue !== '不可' && petValue !== 'ペット不可';
      })
      .map((prop) => {
        const pd = safeParseJson(prop.property_data);
        return {
          url: prop.url,
          title: prop.title,
          price: prop.price,
          category: prop.category,
          genre_name_ja: prop.genre_name_ja,
          images: safeParseJson<unknown[]>(prop.images, []),
          company_name: prop.company_name,
          pet_info: pd['ペット'] || pd['ペット飼育'] || '',
          location: pd['所在地'] || pd['住所'] || '',
          madori: pd['間取り'] || '',
        };
      });

    return NextResponse.json(
      { success: true, properties, total: properties.length },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    return jsonError(logAndSerializeError('sales/featured/pet-friendly', error));
  }
}
