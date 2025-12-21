import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        // Get all history for this property
        const { data: history, error } = await supabase
            .from('ai_copy_history')
            .select('id, copy_text, created_at, is_active')
            .eq('property_url', url)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error fetching history:', error);
            throw error;
        }

        // キャッシュヘッダーを追加（3分間キャッシュ）
        return NextResponse.json({ history: history || [] }, {
            headers: {
                'Cache-Control': 'public, max-age=180, stale-while-revalidate=300'
            }
        });
    } catch (error) {
        console.error('Failed to fetch AI copy history:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
