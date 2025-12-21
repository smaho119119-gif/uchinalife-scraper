import { supabase } from '@/lib/db';
import { generateSalesCopy, TextModelKey } from '@/lib/ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url, model } = await request.json();
        const modelKey = (model || 'gemini-3-pro') as TextModelKey;

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

        console.log(`Generating sales copy with model: ${modelKey}`);
        const copy = await generateSalesCopy(propertyData, modelKey);

        // Save to database
        const { error: insertError } = await supabase
            .from('ai_copy_history')
            .insert({
                property_url: url,
                copy_text: copy,
                is_active: true
            });

        if (insertError) {
            console.error('Failed to save AI copy history:', insertError);
            // We continue even if saving fails, as we want to return the copy
        }

        return NextResponse.json({ copy });
    } catch (error) {
        console.error('AI Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate copy' }, { status: 500 });
    }
}
