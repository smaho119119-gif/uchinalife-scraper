import { supabase } from '@/lib/db';
import { safeParseJson } from '@/lib/json';
import { generateSalesCopy, TextModelKey } from '@/lib/ai';
import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/auth-helpers';

export async function POST(request: Request) {
    const limited = await enforceRateLimit(request, 'ai-generate', 20, 60_000);
    if (limited) return limited;
    try {
        const { url, model } = await request.json();
        if (typeof url !== 'string' || !url) {
            return NextResponse.json({ error: '物件URLが指定されていません' }, { status: 400 });
        }
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
            images: safeParseJson<unknown[]>(property.images, []),
            property_data: safeParseJson(property.property_data),
        };

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
