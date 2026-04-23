import { NextResponse } from 'next/server';
import { getAllProperties } from '../../../lib/db';
import { parseIntParam, jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export const revalidate = 60;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseIntParam(searchParams.get('limit'), 50, 1, 1000);

        const properties = await getAllProperties(limit);
        return NextResponse.json(properties, {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
        });
    } catch (error) {
        return jsonError(logAndSerializeError('properties', error));
    }
}
