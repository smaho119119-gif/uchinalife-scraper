import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category') || '';

    const { data, error } = await supabase.rpc('by_area_stats', { p_category: categoryFilter });
    if (error) throw error;

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  } catch (error: any) {
    console.error('Error in by-area API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
