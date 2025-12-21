import { NextRequest, NextResponse } from 'next/server';
import { getAllStaffPhotos, saveStaffPhoto, deleteStaffPhoto, initDefaultStaffPhotos } from '@/lib/db';
// import fs from 'fs';
// import path from 'path';

// GET: 全スタッフ写真を取得
export async function GET() {
    try {
        // デフォルト写真を初期化（テーブルが空の場合）
        await initDefaultStaffPhotos();

        const photos = await getAllStaffPhotos();

        // フロントエンド用の形式に変換
        const formattedPhotos = photos.map(p => ({
            id: p.id,
            name: p.name,
            dataUrl: p.data_url, // URLまたはbase64
            timestamp: new Date(p.created_at).getTime()
        }));

        return NextResponse.json({ photos: formattedPhotos });
    } catch (error) {
        console.error('Error fetching staff photos:', error);
        return NextResponse.json({ error: 'Failed to fetch staff photos' }, { status: 500 });
    }
}

// POST: スタッフ写真を保存（DBに直接保存）
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, name, dataUrl } = body;

        if (!id || !name || !dataUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Vercel環境ではファイルシステムへの保存はできないため、
        // dataUrlをそのままDBに保存する方式に変更
        // 本来はSupabase Storage等のオブジェクトストレージを使用すべきだが、
        // 簡易対応としてDBのカラム(text)に保存する。
        // サイズが大きすぎるとエラーになる可能性があるため注意が必要。

        // データベースに保存
        const photo = await saveStaffPhoto(id, name, dataUrl);

        return NextResponse.json({
            success: true,
            photo: {
                id: photo.id,
                name: photo.name,
                dataUrl: photo.data_url,
                timestamp: new Date(photo.created_at).getTime()
            }
        });
    } catch (error) {
        console.error('Error saving staff photo:', error);
        return NextResponse.json({ error: 'Failed to save staff photo' }, { status: 500 });
    }
}

// DELETE: スタッフ写真を削除
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing photo ID' }, { status: 400 });
        }

        const success = await deleteStaffPhoto(id);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Error deleting staff photo:', error);
        return NextResponse.json({ error: 'Failed to delete staff photo' }, { status: 500 });
    }
}

