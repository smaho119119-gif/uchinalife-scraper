import { NextRequest, NextResponse } from 'next/server';
import { getAllStaffPhotos, saveStaffPhoto, deleteStaffPhoto, initDefaultStaffPhotos } from '@/lib/db';
import { jsonError, logAndSerializeError } from '@/lib/api-utils';
import { enforceRateLimit } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// 1.5MB の base64 (≒ 1.1MB のオリジナル画像)
const MAX_DATAURL_LENGTH = 1_500_000;
const ALLOWED_MIME_PREFIXES = [
    'data:image/jpeg;',
    'data:image/jpg;',
    'data:image/png;',
    'data:image/webp;',
];

function isAllowedDataUrl(value: string): boolean {
    if (!value.startsWith('data:image/')) return false;
    return ALLOWED_MIME_PREFIXES.some((p) => value.startsWith(p));
}

// GET: 全スタッフ写真を取得
export async function GET() {
    try {
        await initDefaultStaffPhotos();
        const photos = await getAllStaffPhotos();
        const formattedPhotos = photos.map((p) => ({
            id: p.id,
            name: p.name,
            dataUrl: p.data_url,
            timestamp: new Date(p.created_at).getTime(),
        }));
        return NextResponse.json({ photos: formattedPhotos });
    } catch (error) {
        return jsonError(logAndSerializeError('staff-photos GET', error));
    }
}

// POST: スタッフ写真を保存
export async function POST(request: NextRequest) {
    const limited = await enforceRateLimit(request, 'staff-photo-write', 30, 60_000);
    if (limited) return limited;
    try {
        const body = await request.json();
        const { id, name, dataUrl } = body ?? {};

        if (typeof id !== 'string' || typeof name !== 'string' || typeof dataUrl !== 'string') {
            return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
        }
        if (id.length === 0 || name.length === 0 || name.length > 100) {
            return NextResponse.json({ error: '入力値が不正です' }, { status: 400 });
        }
        if (dataUrl.length > MAX_DATAURL_LENGTH) {
            return NextResponse.json(
                { error: '画像サイズが大きすぎます（最大1.1MB相当）' },
                { status: 413 },
            );
        }
        // External URL (e.g. dicebear avatar) is allowed; otherwise must be image data URL.
        const isHttpUrl = dataUrl.startsWith('https://') || dataUrl.startsWith('http://');
        if (!isHttpUrl && !isAllowedDataUrl(dataUrl)) {
            return NextResponse.json(
                { error: '対応していない画像形式です（JPEG/PNG/WebPのみ）' },
                { status: 415 },
            );
        }

        const photo = await saveStaffPhoto(id, name, dataUrl);
        return NextResponse.json({
            success: true,
            photo: {
                id: photo.id,
                name: photo.name,
                dataUrl: photo.data_url,
                timestamp: new Date(photo.created_at).getTime(),
            },
        });
    } catch (error) {
        return jsonError(logAndSerializeError('staff-photos POST', error));
    }
}

// DELETE: スタッフ写真を削除
export async function DELETE(request: NextRequest) {
    const limited = await enforceRateLimit(request, 'staff-photo-write', 30, 60_000);
    if (limited) return limited;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'IDが指定されていません' }, { status: 400 });
        }
        const success = await deleteStaffPhoto(id);
        if (success) return NextResponse.json({ success: true });
        return NextResponse.json({ error: '指定された写真が見つかりません' }, { status: 404 });
    } catch (error) {
        return jsonError(logAndSerializeError('staff-photos DELETE', error));
    }
}
