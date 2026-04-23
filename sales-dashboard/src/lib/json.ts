/**
 * Safely parse a value that may already be an object, a JSON string, null, or invalid.
 * Returns the fallback (default `{}`) if parsing fails or the value is missing.
 *
 * The default return type is `Record<string, any>` so callers can do
 * `pd['住所']` without casting. Pass an explicit generic for stricter typing.
 */
export function safeParseJson<T = Record<string, any>>(
    value: unknown,
    fallback: T = {} as T,
): T {
    if (value == null) return fallback;
    if (typeof value === 'object') return value as T;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}
