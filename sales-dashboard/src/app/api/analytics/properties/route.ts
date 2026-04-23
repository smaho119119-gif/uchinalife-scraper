import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { isValidCategory } from '@/lib/categories';
import { parseIntParam, jsonError, logAndSerializeError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const JST = 'Asia/Tokyo';
const ALLOWED_FILTERS = ['active', 'inactive', 'newToday', 'soldToday'] as const;
type Filter = (typeof ALLOWED_FILTERS)[number];

/** Returns the JST "today" boundary as a UTC ISO string. */
function startOfTodayJSTAsUtc(): string {
    const nowJst = toZonedTime(new Date(), JST);
    const startOfDayJst = new Date(
        nowJst.getFullYear(),
        nowJst.getMonth(),
        nowJst.getDate(),
    );
    return fromZonedTime(startOfDayJst, JST).toISOString();
}

export async function GET(request: Request) {
    try {
        const supabase = getSupabase('anon');
        const { searchParams } = new URL(request.url);
        const rawFilter = searchParams.get('filter');
        const rawCategory = searchParams.get('category');
        const limit = parseIntParam(searchParams.get('limit'), 50, 1, 500);

        const filter: Filter | null =
            rawFilter && (ALLOWED_FILTERS as readonly string[]).includes(rawFilter)
                ? (rawFilter as Filter)
                : null;
        const category =
            rawCategory && isValidCategory(rawCategory) ? rawCategory : null;

        let query = supabase
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (filter === 'active') {
            query = query.eq('is_active', true);
        } else if (filter === 'inactive') {
            query = query.eq('is_active', false);
        } else if (filter === 'newToday') {
            query = query.eq('is_active', true).gte('created_at', startOfTodayJSTAsUtc());
        } else if (filter === 'soldToday') {
            query = query.eq('is_active', false).gte('updated_at', startOfTodayJSTAsUtc());
        }

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ properties: data || [] });
    } catch (error) {
        return jsonError(logAndSerializeError('analytics/properties', error));
    }
}
