import { NextResponse } from 'next/server';
import { getAllProperties } from '../../../lib/db';
import { parseIntParam, jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export const revalidate = 60;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // Properties page asks for the full set client-side (~18k rows today).
        // Cap at 25k so a typo in the URL cannot trigger a much larger query.
        const limit = parseIntParam(searchParams.get('limit'), 50, 1, 25000);

        const properties = await getAllProperties(limit);
        return NextResponse.json(properties, {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
        });
    } catch (error) {
        return jsonError(logAndSerializeError('properties', error));
    }
}
