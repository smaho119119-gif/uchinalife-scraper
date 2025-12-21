import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");

    if (isAuthPage) {
        if (isAuth) {
            return NextResponse.redirect(new URL("/", req.url));
        }
        return null;
    }

    if (!isAuth) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    return null;
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
