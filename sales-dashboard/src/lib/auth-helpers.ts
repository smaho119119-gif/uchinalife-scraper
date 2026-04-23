import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkRateLimit } from '@/lib/rate-limit';
import { jsonError } from '@/lib/api-utils';

/**
 * Resolve a stable identifier for rate-limiting / audit logging.
 * Uses the authenticated user id if available, otherwise the IP from
 * common forwarding headers, otherwise a constant fallback so the
 * limiter still applies even when both are missing.
 */
export async function getActorKey(req: Request): Promise<string> {
    try {
        const session = await getServerSession(authOptions);
        const id = (session?.user as { id?: string } | undefined)?.id
            ?? session?.user?.email
            ?? session?.user?.name;
        if (id) return `user:${id}`;
    } catch {
        // fall through to IP
    }
    const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown';
    return `ip:${ip}`;
}

/**
 * Throttle helper. Returns a 429 response if the limit is hit, otherwise null.
 *
 *   const limited = await enforceRateLimit(req, 'ai-generate', 20, 60_000);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
    req: Request,
    scope: string,
    limit: number,
    windowMs: number,
): Promise<Response | null> {
    const actor = await getActorKey(req);
    const ok = checkRateLimit(`${scope}:${actor}`, limit, windowMs);
    if (ok) return null;
    return jsonError(
        `リクエストが多すぎます。${Math.ceil(windowMs / 1000)}秒後に再度お試しください。`,
        429,
    );
}
