/**
 * Browser-only in-memory cache (5-minute TTL).
 *
 * Lives only on the client. Survives within a single tab/session and
 * complements the HTTP `Cache-Control` headers set by API routes.
 *
 * Limitations (intentional, documented):
 * - Not shared across tabs.
 * - Cleared when the tab is closed or the JS context is replaced.
 * - Not used during SSR — get() always returns null on the server.
 *
 * For cross-request caching prefer `Cache-Control` on the API route or a
 * shared store (Redis/Upstash). This module is kept thin to avoid hiding
 * stale data and to keep memory bounded per tab.
 */
interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

const store: Map<string, CacheEntry<unknown>> = new Map();

function isClient(): boolean {
    return typeof window !== 'undefined';
}

class PropertyCache {
    set<T>(key: string, data: T): void {
        if (!isClient()) return;
        store.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    get<T>(key: string): T | null {
        if (!isClient()) return null;
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return null;
        }
        return entry.data as T;
    }

    clear(key?: string): void {
        if (!isClient()) return;
        if (key) {
            store.delete(key);
        } else {
            store.clear();
        }
    }
}

export const propertyCache = new PropertyCache();
