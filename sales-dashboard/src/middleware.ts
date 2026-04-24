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
 * (CSP, HSTS, X-Frame-Options, Referrer-Policy, COOP, etc.). Inline scripts
 * are trusted via per-request nonce + 'strict-dynamic'; 'unsafe-inline' is
 * no longer granted to script-src. Inline styles still need 'unsafe-inline'
 * (React style props + Tailwind). 'unsafe-eval' is enabled only in dev HMR.
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

/**
 * Build a per-request nonce. Used to mark inline `<script>` tags emitted
 * by Next.js so they pass CSP `strict-dynamic` checks in modern browsers.
 *
 * `'strict-dynamic'` makes browsers ignore `'unsafe-inline'` (and host
 * allowlists) and instead trust scripts that share the nonce. Older
 * browsers fall back to the legacy directives, so behavior is unchanged
 * there.
 */
function generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function buildCsp(nonce: string): string {
    // script-src: nonce + 'strict-dynamic' trusts scripts carrying the nonce
    // and anything they load. Next.js injects the nonce into its bootstrap
    // <script> automatically when middleware sets `x-nonce`. 'unsafe-eval'
    // stays dev-only for HMR / React DevTools.
    const scriptSrc = IS_DEV
        ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https:`
        : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:`;

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

function applySecurityHeaders(res: NextResponseType, nonce: string): NextResponseType {
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
    res.headers.set('Content-Security-Policy', buildCsp(nonce));
    return res;
}

/** Forward the nonce to the page via a request header so RSCs can read it. */
function forwardNonce(req: NextRequest, nonce: string): NextResponseType {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);
    return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isAuth = !!token;
    const { pathname } = req.nextUrl;
    const nonce = generateNonce();

    if (pathname.startsWith('/login')) {
        if (isAuth) {
            return applySecurityHeaders(NextResponse.redirect(new URL('/', req.url)), nonce);
        }
        return applySecurityHeaders(forwardNonce(req, nonce), nonce);
    }

    if (isPublicPath(pathname)) {
        return applySecurityHeaders(forwardNonce(req, nonce), nonce);
    }

    if (!isAuth) {
        if (pathname.startsWith('/api/')) {
            return applySecurityHeaders(
                NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
                nonce,
            );
        }
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce);
    }

    return applySecurityHeaders(forwardNonce(req, nonce), nonce);
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/auth).*)',
    ],
};
