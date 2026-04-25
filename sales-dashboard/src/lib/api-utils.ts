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
    // Supabase errors are plain objects ({ message, code, details, hint }),
    // not Error instances, so `String(err)` produced "[object Object]".
    // Reach into `.message` when present, fall back to a JSON dump.
    let message: string;
    if (err instanceof Error) {
        message = err.message;
    } else if (err && typeof err === 'object' && 'message' in err) {
        const m = (err as { message?: unknown }).message;
        message = typeof m === 'string' && m ? m : JSON.stringify(err);
    } else {
        message = String(err);
    }
    console.error(`[${scope}]`, message, err);
    return message;
}
