import { NextResponse } from 'next/server';
import type { NextRequest, NextResponse as NextResponseType } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Auth + security headers.
 *
 * Auth:
 * - Pages under PUBLIC_PAGE_PREFIXES are open to anonymous users.
 * - The login page redirects authenticated users back to "/".
 * - Everything else requires a valid NextAuth session.
 *
 * Headers: every response carries a baseline set of HTTP security headers
 * (CSP, HSTS, X-Frame-Options, Referrer-Policy, etc.). The CSP allows
 * inline styles (Tailwind/Next runtime needs them) and unsafe-eval (Next
 * dev/HMR), but blocks third-party scripts.
 */
const PUBLIC_PAGE_PREFIXES = [
    '/sales/featured',
    '/api/sales/featured',
    // Read-only stats APIs are intentionally public so the homepage and
    // featured pages can render without an auth round-trip.
    '/api/stats',
    '/api/analytics',
    '/api/sales/area-stats',
    '/api/sales/market-price',
    '/api/properties/locations',
];

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p));
}

function applySecurityHeaders(res: NextResponseType): NextResponseType {
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()',
    );
    res.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
    );
    // CSP: allow inline styles (Tailwind, Next runtime), our Supabase project,
    // OSM tiles for Leaflet, DiceBear avatars, GitHub API, blob/data URIs for
    // generated images. Tighten with hashes/nonces in a future round.
    res.headers.set(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co https://api.github.com https://generativelanguage.googleapis.com https://api.openai.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join('; '),
    );
    return res;
}

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isAuth = !!token;
    const { pathname } = req.nextUrl;

    if (pathname.startsWith('/login')) {
        if (isAuth) {
            return applySecurityHeaders(NextResponse.redirect(new URL('/', req.url)));
        }
        return applySecurityHeaders(NextResponse.next());
    }

    if (isPublicPath(pathname)) {
        return applySecurityHeaders(NextResponse.next());
    }

    if (!isAuth) {
        if (pathname.startsWith('/api/')) {
            return applySecurityHeaders(
                NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
            );
        }
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    return applySecurityHeaders(NextResponse.next());
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/auth).*)',
    ],
};
