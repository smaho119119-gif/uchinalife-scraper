import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * 管理用 API の入口でログインを確かめ直す。
 * middleware でも見ているが、matcher の書き換えや公開パスの追加で抜けても
 * 管理データが出ないように、ルート側でも必ず確認する。
 * 未ログインなら 401 の応答を返す（ログイン済みなら null）。
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) return null;
    return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
}

/** 管理データは共有キャッシュに載せない */
export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;
