import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { isValidCategory } from '@/lib/categories';
import { jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase('anon');
    const { searchParams } = new URL(request.url);
    const rawCategory = searchParams.get('category') || '';
    const categoryFilter = rawCategory && isValidCategory(rawCategory) ? rawCategory : '';

    const { data, error } = await supabase.rpc('by_area_stats', { p_category: categoryFilter });
    if (error) throw error;

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  } catch (error) {
    return jsonError(logAndSerializeError('sales/featured/by-area', error));
  }
}
