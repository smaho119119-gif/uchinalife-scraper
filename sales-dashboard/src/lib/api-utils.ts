import { NextResponse } from 'next/server';

/**
 * Parse a query string integer with bounds + fallback.
 * Returns `defaultValue` on NaN, null, undefined, or out-of-range input.
 */
export function parseIntParam(
    raw: string | null | undefined,
    defaultValue: number,
    min = 1,
    max = 365,
): number {
    if (raw == null) return defaultValue;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return defaultValue;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

export function jsonError(message: string, status = 500, details?: unknown) {
    return NextResponse.json(
        { error: message, ...(details ? { details } : {}) },
        { status },
    );
}

export function logAndSerializeError(scope: string, err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${scope}]`, message, err);
    return message;
}
