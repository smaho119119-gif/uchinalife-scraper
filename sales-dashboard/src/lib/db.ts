/**
 * Supabase data access layer.
 *
 * Re-exports types from lib/types.ts (single source of truth) and provides
 * legacy `supabase` client + helper functions used by older code paths.
 * New code should prefer `getSupabase()` from `lib/supabase-server.ts`.
 */
import { getSupabase } from '@/lib/supabase-server';
import { safeParseJson } from '@/lib/json';

export type { Property, StaffPhoto, GeneratedImage } from '@/lib/types';
import type { Property, StaffPhoto, GeneratedImage } from '@/lib/types';

/**
 * Legacy named export — proxies to the validated server-side client.
 * Prefer `getSupabase()` directly in new code.
 */
export const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
    get(_target, prop) {
        const client = getSupabase();
        const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value;
    },
});

// ============================================
// 物件データ関連
// ============================================

/**
 * Active-properties listing for the dashboard table view.
 *
 * Returns only the columns actually consumed by the UI to keep the
 * payload small (typical query: 18k rows × ~10 cols instead of 18k × 30+).
 * `images` and `property_data` are still returned because the search /
 * filter UI reads location strings out of property_data.
 */
const PROPERTIES_LIST_COLUMNS = [
    'url',
    'title',
    'category',
    'category_type',
    'category_name_ja',
    'genre_name_ja',
    'price',
    'company_name',
    'images',
    'property_data',
    'is_active',
    'first_seen_date',
].join(',');

export async function getAllProperties(limit: number = 50): Promise<Property[]> {
    const { data, error } = await supabase
        .from('properties')
        .select(PROPERTIES_LIST_COLUMNS)
        .eq('is_active', true)
        .order('first_seen_date', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching properties:', error);
        return [];
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    return rows.map((row) => ({
        ...row,
        images: safeParseJson<string[]>(row.images, []),
        property_data: safeParseJson(row.property_data),
        is_active: Boolean(row.is_active),
    } as Property));
}

export async function getPropertyStats() {
    // 総数
    const { count: total } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    // 今日の新着 (簡易実装: JST判定などは省略し、UTCベースで今日以降)
    const today = new Date().toISOString().split('T')[0];
    const { count: newToday } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

    // 今日の成約
    const { count: soldToday } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false)
        .gte('last_seen_date', today);

    // カテゴリ別集計
    // SupabaseでGROUP BYはRPCを使わないと難しいので、ここでは全件取得してJSで集計するか、
    // パフォーマンスを考慮して別途API (already implemented in stats/route.ts) に任せるべきだが、
    // ここでは互換性のために簡易的な実装、または空配列を返す。
    // ※ stats/route.ts はこの関数を使っていないので、この関数はあまり使われていない可能性が高い。
    // 一応実装する。

    // データ量が多いと重いので、上位のみ取得するか、この関数を使わないように呼び出し元を修正するのがベター。
    // ここでは空配列を返し、呼び出し元でstats APIを叩くように誘導するのが賢明だが、
    // db.tsの責務として実装しておく。

    return {
        total: total || 0,
        newToday: newToday || 0,
        soldToday: soldToday || 0,
        byCategory: [] // 重いのでスキップ
    };
}


// ============================================
// スタッフ写真管理
// ============================================

// テーブル初期化（Supabaseではマイグレーションで行うべきなので何もしない）
export function initStaffPhotosTable() { }

export async function getAllStaffPhotos(): Promise<StaffPhoto[]> {
    const { data, error } = await supabase
        .from('staff_photos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        // テーブルがない場合のエラーハンドリングが必要かも
        console.error('Error fetching staff photos:', error);
        return [];
    }

    return data || [];
}

export async function saveStaffPhoto(id: string, name: string, dataUrl: string): Promise<StaffPhoto> {
    const { data, error } = await supabase
        .from('staff_photos')
        .upsert({
            id,
            name,
            data_url: dataUrl,
            // created_at はデフォルト値または更新
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving staff photo:', error);
        throw error;
    }

    return data;
}

export async function deleteStaffPhoto(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('staff_photos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting staff photo:', error);
        return false;
    }
    return true;
}

export async function initDefaultStaffPhotos() {
    const { count } = await supabase
        .from('staff_photos')
        .select('*', { count: 'exact', head: true });

    if (count === 0) {
        const defaults = [
            { id: 'sample1', name: 'スタッフA', data_url: 'https://api.dicebear.com/7.x/personas/svg?seed=staff1&backgroundColor=b6e3f4' },
            { id: 'sample2', name: 'スタッフB', data_url: 'https://api.dicebear.com/7.x/personas/svg?seed=staff2&backgroundColor=c0aede' },
            { id: 'sample3', name: 'スタッフC', data_url: 'https://api.dicebear.com/7.x/personas/svg?seed=staff3&backgroundColor=ffd5dc' },
        ];

        await supabase.from('staff_photos').insert(defaults);
    }
}


// ============================================
// 生成画像管理
// ============================================

// 生成画像テーブル名は supabase.ts と db.ts で異なっていたが、
// db.ts (generated_images) はSQLite用、supabase.ts (uchina_property_images) はSupabase用と思われる。
// 基本的に supabase.ts の実装を踏襲する。
const IMAGE_TABLE_NAME = 'uchina_property_images';

export function initGeneratedImagesTable() { }

export async function getGeneratedImages(propertyUrl: string): Promise<GeneratedImage[]> {
    const { data, error } = await supabase
        .from(IMAGE_TABLE_NAME)
        .select('*')
        .eq('property_url', propertyUrl)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching generated images:', error);
        return [];
    }
    return data || [];
}

export async function saveGeneratedImage(data: {
    propertyUrl: string;
    imageUrl: string;
    filename: string;
    mode: string;
    style: string;
    size: string;
    aspectRatio: string;
}): Promise<GeneratedImage> {
    const { data: insertedData, error } = await supabase
        .from(IMAGE_TABLE_NAME)
        .insert({
            property_url: data.propertyUrl,
            image_url: data.imageUrl,
            filename: data.filename,
            mode: data.mode,
            style: data.style,
            size: data.size,
            aspect_ratio: data.aspectRatio
        })
        .select()
        .single();

    if (error) {
        throw error;
    }
    return insertedData;
}

export async function deleteGeneratedImage(id: number): Promise<boolean> {
    const { error } = await supabase
        .from(IMAGE_TABLE_NAME)
        .delete()
        .eq('id', id);
    return !error;
}
