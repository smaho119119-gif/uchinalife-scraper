import { getAllProperties } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        const properties = await getAllProperties(limit);
        return NextResponse.json(properties);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
}
