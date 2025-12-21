import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ url: string[] }> }) {
    try {
        const { url } = await params;
        const decodedUrl = decodeURIComponent(url.join('/'));

        const { data: property, error } = await supabase
            .from('properties')
            .select('*')
            .eq('url', decodedUrl)
            .single();

        if (error || !property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        // キャッシュヘッダーを追加（5分間キャッシュ）
        return NextResponse.json({
            ...property,
            images: typeof property.images === 'string' ? JSON.parse(property.images) : property.images || [],
            property_data: typeof property.property_data === 'string' ? JSON.parse(property.property_data) : property.property_data || {},
            is_active: Boolean(property.is_active)
        }, {
            headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
            }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch property' }, { status: 500 });
    }
}
