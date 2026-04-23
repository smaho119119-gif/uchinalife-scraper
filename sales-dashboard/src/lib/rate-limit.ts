/**
 * In-memory rate limiter (token bucket).
 *
 * Caveats — please read before using:
 * - State is per-process. On Vercel/serverless this means each cold-start
 *   instance has its own bucket; the limit is approximate, not strict.
 * - Good enough to stop accidental loops and trivial abuse, e.g. AI cost
 *   bombs from a runaway client.
 * - For strict global rate-limiting use Upstash Redis or Vercel KV.
 *
 * Usage:
 *   const ok = checkRateLimit(`ai:${userId}`, 10, 60_000); // 10 req / 60s
 *   if (!ok) return jsonError('Rate limit exceeded', 429);
 */
interface Bucket {
    count: number;
    resetAt: number;
}

const buckets: Map<string, Bucket> = new Map();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
}

/** Best-effort cleanup so the map doesn't grow unbounded under long uptime. */
export function pruneExpiredBuckets(): void {
    const now = Date.now();
    for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
    }
}
