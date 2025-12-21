import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase, getAllGeneratedImages, imageExistsByFilename } from '@/lib/supabase';

// テーブル名
const TABLE_NAME = 'uchina_property_images';

// ローカルの画像ファイルをSupabaseに同期するAPI
export async function POST(request: Request) {
    try {
        const publicDir = path.join(process.cwd(), 'public', 'generated-images');
        
        // ディレクトリが存在しない場合
        if (!fs.existsSync(publicDir)) {
            return NextResponse.json({ 
                message: 'No generated-images directory found',
                synced: 0 
            });
        }

        // 画像ファイル一覧を取得
        const files = fs.readdirSync(publicDir)
            .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));

        let synced = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const filename of files) {
            // ファイル名からメタデータを抽出
            // 新形式: {category}_{itemId}_{mode}_{style}_{timestamp}.png
            // 例: jigyo_c-7573-3250916-0119_sns_banner_modern_1234567890.png
            // 旧形式: {mode}-{style}-{timestamp}.png
            
            let propertyUrl = 'unknown';
            let mode = 'unknown';
            let style = 'unknown';
            let timestamp = Date.now().toString();
            
            // 新形式を試す: {category}_{itemId}_{mode}_{style}_{timestamp}.png
            const newMatch = filename.match(/^([a-z]+)_([a-z]-[\d-]+)_(.+?)_(.+?)_(\d+)\.(png|jpg|jpeg)$/i);
            
            if (newMatch) {
                const [, category, itemId, m, s, ts] = newMatch;
                // 物件URLを復元
                propertyUrl = `https://www.e-uchina.net/bukken/${category}/${itemId}/detail.html`;
                mode = m;
                style = s;
                timestamp = ts;
            } else {
                // 旧形式を試す: {mode}-{style}-{timestamp}.png
                const oldMatch = filename.match(/^(.+?)-(.+?)-(\d+)\.(png|jpg|jpeg)$/);
                
                if (oldMatch) {
                    const [, m, s, ts] = oldMatch;
                    mode = m;
                    style = s;
                    timestamp = ts;
                } else {
                    skipped++;
                    continue;
                }
            }
            
            const imageUrl = `/generated-images/${filename}`;
            const createdAt = new Date(parseInt(timestamp)).toISOString();

            // 既に登録されているかチェック
            const exists = await imageExistsByFilename(filename);
            if (exists) {
                skipped++;
                continue;
            }

            // Supabaseに登録
            const { error } = await supabase
                .from(TABLE_NAME)
                .insert({
                    property_url: propertyUrl,
                    image_url: imageUrl,
                    filename: filename,
                    mode: mode,
                    style: style,
                    size: '2K',
                    aspect_ratio: '16:9',
                    created_at: createdAt
                });

            if (error) {
                errors.push(`${filename}: ${error.message}`);
            } else {
                synced++;
            }
        }

        return NextResponse.json({
            message: 'Sync completed',
            total: files.length,
            synced,
            skipped,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({
            error: 'Failed to sync images',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// 全ての生成画像を取得（物件URLに関係なく）
export async function GET() {
    try {
        const images = await getAllGeneratedImages(100);
        
        // ローカルファイルの存在確認も行う
        const publicDir = path.join(process.cwd(), 'public', 'generated-images');
        const imagesWithStatus = images.map(img => {
            let fileExists = false;
            if (img.filename) {
                try {
                    const filepath = path.join(publicDir, img.filename);
                    fileExists = fs.existsSync(filepath);
                } catch {
                    fileExists = false;
                }
            }
            return {
                ...img,
                file_exists: fileExists
            };
        });

        // ローカルにあるがDBにない画像もリスト
        let localOnlyImages: { filename: string; url: string; mode: string; style: string; created_at: string }[] = [];
        
        if (fs.existsSync(publicDir)) {
            const localFiles = fs.readdirSync(publicDir)
                .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
            
            const dbFilenames = new Set(images.map(img => img.filename));
            
            localOnlyImages = localFiles
                .filter(f => !dbFilenames.has(f))
                .map(filename => {
                    // 新形式: {category}_{itemId}_{mode}_{style}_{timestamp}.png
                    const newMatch = filename.match(/^([a-z]+)_([a-z]-[\d-]+)_(.+?)_(.+?)_(\d+)\.(png|jpg|jpeg)$/i);
                    
                    if (newMatch) {
                        const [, category, itemId, mode, style, timestamp] = newMatch;
                        return {
                            filename,
                            url: `/generated-images/${filename}`,
                            property_url: `https://www.e-uchina.net/bukken/${category}/${itemId}/detail.html`,
                            property_id: `${category}_${itemId}`,
                            mode,
                            style,
                            created_at: new Date(parseInt(timestamp)).toISOString()
                        };
                    }
                    
                    // 旧形式: {mode}-{style}-{timestamp}.png
                    const oldMatch = filename.match(/^(.+?)-(.+?)-(\d+)\.(png|jpg|jpeg)$/);
                    return {
                        filename,
                        url: `/generated-images/${filename}`,
                        property_url: 'unknown',
                        property_id: 'unknown',
                        mode: oldMatch ? oldMatch[1] : 'unknown',
                        style: oldMatch ? oldMatch[2] : 'unknown',
                        created_at: oldMatch ? new Date(parseInt(oldMatch[3])).toISOString() : new Date().toISOString()
                    };
                })
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        return NextResponse.json({
            images: imagesWithStatus,
            local_only: localOnlyImages,
            total_in_db: imagesWithStatus.length,
            total_local_only: localOnlyImages.length
        });

    } catch (error) {
        console.error('Get all images error:', error);
        return NextResponse.json({
            error: 'Failed to get images',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
