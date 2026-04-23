import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Auth strategy:
 * - Pages under PUBLIC_PAGE_PREFIXES are open to anonymous users.
 * - The login page redirects authenticated users back to "/".
 * - Everything else requires a valid NextAuth session.
 *
 * The matcher below also covers admin/AI write APIs (so they are not
 * silently public). Read-only public APIs (stats, analytics, sales/featured)
 * are intentionally accessible to anonymous users to keep CDN caching effective.
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

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isAuth = !!token;
    const { pathname } = req.nextUrl;

    if (pathname.startsWith('/login')) {
        if (isAuth) {
            return NextResponse.redirect(new URL('/', req.url));
        }
        return NextResponse.next();
    }

    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    if (!isAuth) {
        // For API routes, return 401 instead of redirecting to /login (which would be HTML).
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    // Protect:
    //  - all UI pages except _next assets, favicon, robots
    //  - admin and AI write APIs (the ones that mutate state or cost money)
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/auth).*)',
    ],
};
