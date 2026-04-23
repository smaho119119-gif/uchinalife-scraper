import { getGeneratedImages, deleteGeneratedImage } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const propertyUrl = searchParams.get('url');

        if (!propertyUrl) {
            return NextResponse.json({ error: 'Property URL is required' }, { status: 400 });
        }

        // Supabaseから該当物件の画像のみを取得
        interface FormattedImage {
            id: number;
            url: string;
            mode: string;
            style: string;
            size: string;
            aspectRatio: string;
            timestamp: number;
        }
        let formattedImages: FormattedImage[] = [];
        
        try {
            const images = await getGeneratedImages(propertyUrl);
            
            // property_urlが実際にマッチするものだけをフィルタリング
            // （'unknown'は除外）
            formattedImages = images
                .filter(img => img.property_url === propertyUrl)
                .map(img => ({
                    id: img.id,
                    url: img.image_url,
                    mode: img.mode,
                    style: img.style,
                    size: img.size,
                    aspectRatio: img.aspect_ratio,
                    timestamp: new Date(img.created_at).getTime()
                }));
                
        } catch (dbError) {
            console.error('Supabase fetch failed:', dbError);
        }

        // 該当物件の画像のみを返す（他の物件の画像は返さない）
        return NextResponse.json({ images: formattedImages });
    } catch (error) {
        console.error('Error fetching generated images:', error);
        return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
        }

        const deleted = await deleteGeneratedImage(parseInt(id));

        if (deleted) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Error deleting generated image:', error);
        return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
    }
}

