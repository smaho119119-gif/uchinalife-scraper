import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { error: 'Supabase configuration missing' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter'); // 'active', 'newToday', 'soldToday', 'inactive'
        const category = searchParams.get('category'); // category ID
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        // Apply filters
        if (filter === 'active') {
            query = query.eq('is_active', true);
        } else if (filter === 'inactive') {
            query = query.eq('is_active', false);
        } else if (filter === 'newToday') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query
                .eq('is_active', true)
                .gte('created_at', today.toISOString());
        } else if (filter === 'soldToday') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query
                .eq('is_active', false)
                .gte('updated_at', today.toISOString());
        }

        // Apply category filter
        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching properties:', error);
            return NextResponse.json(
                { error: 'Failed to fetch properties' },
                { status: 500 }
            );
        }

        return NextResponse.json({ properties: data || [] });
    } catch (error) {
        console.error('Error fetching properties:', error);
        return NextResponse.json(
            { error: 'Failed to fetch properties' },
            { status: 500 }
        );
    }
}
