// Global cache for property data
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class PropertyCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    set<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
        console.log(`✅ Cached data for key: ${key}`);
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            console.log(`❌ No cache found for key: ${key}`);
            return null;
        }

        const isExpired = Date.now() - entry.timestamp > this.CACHE_DURATION;

        if (isExpired) {
            console.log(`⏰ Cache expired for key: ${key}`);
            this.cache.delete(key);
            return null;
        }

        console.log(`✅ Using cached data for key: ${key}`);
        return entry.data as T;
    }

    clear(key?: string): void {
        if (key) {
            this.cache.delete(key);
            console.log(`🗑️ Cleared cache for key: ${key}`);
        } else {
            this.cache.clear();
            console.log(`🗑️ Cleared all cache`);
        }
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        const isExpired = Date.now() - entry.timestamp > this.CACHE_DURATION;
        if (isExpired) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    getAge(key: string): number | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        return Date.now() - entry.timestamp;
    }
}

// Export singleton instance
export const propertyCache = new PropertyCache();
