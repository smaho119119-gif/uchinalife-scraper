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
 * (CSP, HSTS, X-Frame-Options, Referrer-Policy, COOP, etc.). The CSP allows
 * inline styles (Tailwind / React style props), and inline scripts (Next.js
 * bootstrap). 'unsafe-eval' is enabled only in dev for HMR. Tightening to a
 * nonce-based CSP is tracked in docs/todo.md.
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

const IS_DEV = process.env.NODE_ENV !== 'production';

function buildCsp(): string {
    // script-src:
    //   - 'unsafe-inline' is still required by Next.js inline bootstrap script
    //   - 'unsafe-eval' is only needed for HMR / React DevTools (dev-only)
    // style-src:
    //   - 'unsafe-inline' stays — React style props + Tailwind require it
    //   - removing it would break virtually every component until we hash/nonce styles
    //
    // Tightening to nonce-based CSP requires emitting a per-request nonce
    // and threading it into <Script> / <link> tags. Tracked in docs/todo.md.
    const scriptSrc = IS_DEV
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'";

    return [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co https://api.github.com https://generativelanguage.googleapis.com https://api.openai.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
    ].join('; ');
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
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.headers.set('Content-Security-Policy', buildCsp());
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
