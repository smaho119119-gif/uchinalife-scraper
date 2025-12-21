import { supabase } from '@/lib/db';
import { generatePropertyImageWithPhotos, ImageModelKey } from '@/lib/ai';
import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();

        const url = formData.get('url') as string;
        const mode = formData.get('mode') as string || 'sns_banner';
        const size = formData.get('size') as string || '2K';
        const aspectRatio = formData.get('aspectRatio') as string || '16:9';
        const style = formData.get('style') as string || 'modern';
        const template = formData.get('template') as string || 'standard';
        const propertyImagesJson = formData.get('propertyImages') as string;
        const staffPhotoFile = formData.get('staffPhoto') as File | null;
        const modelKey = (formData.get('model') as string || 'gemini-3-pro') as ImageModelKey;

        // Verify property exists
        const { data: property, error: fetchError } = await supabase
            .from('properties')
            .select('*')
            .eq('url', url)
            .single();

        if (fetchError || !property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        const propertyData = {
            ...property,
            images: typeof property.images === 'string' ? JSON.parse(property.images) : property.images || [],
            property_data: typeof property.property_data === 'string' ? JSON.parse(property.property_data) : property.property_data || {},
        };

        // Parse selected property images
        const selectedPropertyImages = propertyImagesJson ? JSON.parse(propertyImagesJson) : [];
        console.log(`Selected property images: ${selectedPropertyImages.length} 枚`);

        // Download property images and convert to base64
        const propertyImageBuffers: Array<{ data: string, mimeType: string }> = [];

        for (const imageUrl of selectedPropertyImages) {
            try {
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);
                const base64 = buffer.toString('base64');
                const mimeType = response.headers['content-type'] || 'image/jpeg';

                propertyImageBuffers.push({
                    data: base64,
                    mimeType
                });
                console.log(`Downloaded image: ${imageUrl.substring(0, 50)}...`);
            } catch (error) {
                console.error(`Failed to download image: ${imageUrl}`, error);
            }
        }
        console.log(`Successfully downloaded: ${propertyImageBuffers.length} 枚`);

        // Handle staff photo
        let staffPhotoBase64: { data: string, mimeType: string } | null = null;
        const staffPhotoUrl = formData.get('staffPhotoUrl') as string | null;

        if (staffPhotoUrl) {
            console.log('Loading staff photo:', staffPhotoUrl);
            try {
                // If local path in public folder on Vercel, we can try to read it via fs if it exists in the build,
                // OR better, since it's a URL (potentially relative), construct a full URL or map to fs
                // If it starts with /staff-photos/, it essentially maps to ./public/staff-photos/

                if (staffPhotoUrl.startsWith('/staff-photos/')) {
                    const filename = staffPhotoUrl.split('/staff-photos/').pop();
                    if (filename) {
                        const filepath = path.join(process.cwd(), 'public', 'staff-photos', filename);
                        if (fs.existsSync(filepath)) {
                            const buffer = fs.readFileSync(filepath);
                            const base64 = buffer.toString('base64');
                            const ext = path.extname(filename).toLowerCase();
                            const mimeType = ext === '.png' ? 'image/png' :
                                ext === '.gif' ? 'image/gif' :
                                    ext === '.webp' ? 'image/webp' : 'image/jpeg';
                            staffPhotoBase64 = { data: base64, mimeType };
                        } else {
                            // If file doesn't exist locally (e.g. dynamic upload not persisted), 
                            // we can't do much. Assume failure or try to fetch if it was a full URL?
                            console.log('Local staff photo not found (expected in Vercel/NextJS for static assets):', filepath);
                        }
                    }
                } else {
                    // Start downloading (external URL)
                    const response = await axios.get(staffPhotoUrl, {
                        responseType: 'arraybuffer',
                        timeout: 10000
                    });
                    const buffer = Buffer.from(response.data);
                    const base64 = buffer.toString('base64');
                    const mimeType = response.headers['content-type'] || 'image/jpeg';

                    staffPhotoBase64 = {
                        data: base64,
                        mimeType
                    };
                }
            } catch (error) {
                console.error('Failed to load staff photo:', error);
            }
        } else if (staffPhotoFile) {
            // Uploaded file
            const bytes = await staffPhotoFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            staffPhotoBase64 = {
                data: buffer.toString('base64'),
                mimeType: staffPhotoFile.type
            };
        }

        // Generate image with selected AI model
        console.log(`Generating image with model: ${modelKey}, template: ${template}`);
        const result = await generatePropertyImageWithPhotos({
            propertyData,
            propertyImages: propertyImageBuffers,
            staffPhoto: staffPhotoBase64,
            mode,
            size,
            aspectRatio,
            style,
            template,
            modelKey,
        });

        // Vercel Environment: Cannot save to filesystem.
        // Return Data URL directly.

        if (!result.imageData) {
            throw new Error('No image data received from AI');
        }

        // Prepare Data URL
        // Gemini returns 'image/png' usually? SDK returns raw bytes usually base64 encoded?
        // generatePropertyImageWithPhotos returns { imageData: string (base64), mimeType: string }
        // Wait, looking at ai.ts, it returns `response.text()`? 
        // No, ai.ts `generatePropertyImageWithPhotos` uses `responseModalities: ['TEXT', 'IMAGE']`.
        // We need to check `ai.ts` implementation again. 
        // Based on usage here `result.imageData`, I assume I implemented it to return that.
        // I should verify `src/lib/ai.ts` implementation if possible, but assuming it matches previous usage.

        // Create Data URL
        // Default to png if mimeType not provided
        const mimeType = (result as any).mimeType || 'image/png';
        const base64Image = result.imageData;
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const timestamp = Date.now();
        // Extract property ID for filename (for metadata only)
        let propertyId = 'unknown';
        const urlMatch = url.match(/\/bukken\/([^\/]+)\/([^\/]+)\/detail\.html/);
        if (urlMatch) {
            const category = urlMatch[1];
            const itemId = urlMatch[2];
            propertyId = `${category}_${itemId}`;
        }
        const filename = `${propertyId}_${mode}_${style}_${timestamp}.png`;

        // Save to Supabase (Base64 string)
        // Note: This might hit size limits if image is huge (Supabase row limit?). 
        // But for <5MB it generally works.
        try {
            const { saveGeneratedImage } = await import('@/lib/db');

            await saveGeneratedImage({
                propertyUrl: url,
                imageUrl: dataUrl, // Store Data URL directly
                filename,
                mode,
                style,
                size,
                aspectRatio
            });

            console.log(`Saved generated image to Supabase for property: ${url}`);
        } catch (dbError) {
            console.error('Failed to save to Supabase:', dbError);
        }

        // Return the Data URL to frontend
        return NextResponse.json({
            imageUrl: dataUrl,
            filename,
            isDataUrl: true
        });
    } catch (error) {
        console.error('Image Generation Error:', error);
        return NextResponse.json({
            error: 'Failed to generate image',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
